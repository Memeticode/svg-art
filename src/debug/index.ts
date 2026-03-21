// Debug panel: toggled via Ctrl+Shift+D when enabled by markup.

import type { FlowComponent, FlowEffects } from '../schema';
import { DEFAULT_FLOW_EFFECTS, weightsToPositions } from '../schema';

const PANEL_WIDTH = 280;
const STORAGE_KEY = 'svg-art-debug';
const MAX_HISTORY = 5;

/** Simple undo/redo history for a config object. */
class ConfigHistory<T> {
  private stack: T[] = [];
  private index = -1;

  push(state: T) {
    // Discard any redo states
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(JSON.parse(JSON.stringify(state)));
    if (this.stack.length > MAX_HISTORY) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  undo(): T | null {
    if (this.index <= 0) return null;
    this.index--;
    return JSON.parse(JSON.stringify(this.stack[this.index]));
  }

  redo(): T | null {
    if (this.index >= this.stack.length - 1) return null;
    this.index++;
    return JSON.parse(JSON.stringify(this.stack[this.index]));
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }
}

export interface AgentConfig {
  overrideGlobals: boolean;
  crossing: boolean;
  lineCount: number;
  widthA: number;
  widthB: number;
  weightsA: number[];
  weightsB: number[];
  driftSpeed: number;
  animate: boolean;
}

export interface ResolvedConfig {
  crossing: boolean;
  lineCount: number;
  widthA: number;
  widthB: number;
  weightsA: number[];
  weightsB: number[];
  driftSpeed: number;
  animate: boolean;
}

export type { FlowComponent } from '../schema';

export interface DebugHandle {
  set(key: string, value: string | number): void;
  visible: boolean;
  showFlow: boolean;
  flowComponents: Set<FlowComponent>;
  flowEffects: FlowEffects;
  agentCount: number;
  agentConfig(index: number): ResolvedConfig;
  panelWidth: number;
  onVisibilityChange(cb: (v: boolean) => void): void;
  onFlowChange(cb: (v: boolean) => void): void;
  onAgentChange(cb: (i: number) => void): void;
  onAgentCountChange(cb: (count: number) => void): void;
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  onSeek(cb: (time: number) => void): void;
}

export function initDebug(): DebugHandle | null {
  const enabled = document.body.hasAttribute('data-debug-enabled');
  if (!enabled) return null;

  // ── Persistence ──
  interface PersistedState {
    debugVisible: boolean;
    globalCrossing: boolean;
    globalLineCount: number;
    globalWidthA: number;
    globalWidthB: number;
    globalWeightsA?: number[];
    globalWeightsB?: number[];
    globalDriftSpeed: number;
    globalAnimate: boolean;
    agentCount: number;
    flowEffects: FlowEffects;
  }

  const DEFAULTS: PersistedState = {
    debugVisible: false,
    globalCrossing: false,
    globalLineCount: 1,
    globalWidthA: 0.01,
    globalWidthB: 0.01,
    globalDriftSpeed: 0,
    globalAnimate: false,
    agentCount: 1,
    flowEffects: { ...DEFAULT_FLOW_EFFECTS },
  };

  function loadState(): PersistedState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore corrupt storage */ }
    return { ...DEFAULTS };
  }

  function saveState() {
    const state: PersistedState = {
      debugVisible: visible,
      globalCrossing,
      globalLineCount,
      globalWidthA,
      globalWidthB,
      globalWeightsA,
      globalWeightsB,
      globalDriftSpeed,
      globalAnimate,
      agentCount: currentAgentCount,
      flowEffects: { ...flowEffects },
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* storage full or unavailable */ }
  }

  const saved = loadState();

  let visible = saved.debugVisible;
  let showFlow = false;
  const activeFlowComponents = new Set<FlowComponent>(['direction']);
  let currentAgentCount = saved.agentCount;
  const flowEffects: FlowEffects = { ...saved.flowEffects };

  // Global defaults
  let globalCrossing = saved.globalCrossing;
  let globalLineCount = saved.globalLineCount ?? 1;
  let globalWidthA = saved.globalWidthA ?? 0.01;
  let globalWidthB = saved.globalWidthB ?? 0.01;
  let globalWeightsA = saved.globalWeightsA ?? [];
  let globalWeightsB = saved.globalWeightsB ?? [];
  let globalDriftSpeed = saved.globalDriftSpeed ?? 0;
  let globalAnimate = saved.globalAnimate ?? false;

  // Undo/redo history
  interface GlobalSnapshot {
    crossing: boolean; lineCount: number; widthA: number; widthB: number;
    weightsA: number[]; weightsB: number[]; driftSpeed: number; animate: boolean;
  }
  const globalHistory = new ConfigHistory<GlobalSnapshot>();
  const strokeHistories: ConfigHistory<AgentConfig>[] = [];

  function snapshotGlobal(): GlobalSnapshot {
    return { crossing: globalCrossing, lineCount: globalLineCount, widthA: globalWidthA, widthB: globalWidthB,
      weightsA: [...globalWeightsA], weightsB: [...globalWeightsB], driftSpeed: globalDriftSpeed, animate: globalAnimate };
  }

  function applyGlobalSnapshot(s: GlobalSnapshot) {
    globalCrossing = s.crossing; globalLineCount = s.lineCount;
    globalWidthA = s.widthA; globalWidthB = s.widthB;
    globalWeightsA = [...s.weightsA]; globalWeightsB = [...s.weightsB];
    globalDriftSpeed = s.driftSpeed; globalAnimate = s.animate;
    saveState(); notifyAllAgents();
  }

  function pushGlobalHistory() { globalHistory.push(snapshotGlobal()); }

  const agents: AgentConfig[] = [];
  const visibilityListeners: Array<(v: boolean) => void> = [];
  const flowListeners: Array<(v: boolean) => void> = [];
  const agentListeners: Array<(i: number) => void> = [];
  const countListeners: Array<(n: number) => void> = [];
  const pauseListeners: Array<() => void> = [];
  const resumeListeners: Array<() => void> = [];
  const seekListeners: Array<(t: number) => void> = [];

  function makeAgentConfig(): AgentConfig {
    return { overrideGlobals: false, crossing: false, lineCount: 1, widthA: 0.01, widthB: 0.01, weightsA: [], weightsB: [], driftSpeed: 0, animate: false };
  }
  agents.push(makeAgentConfig());

  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText = `
    position:fixed; top:0; right:0; width:${PANEL_WIDTH}px; height:100%;
    background:rgba(10,10,15,0.95); border-left:1px solid #2dd4bf33;
    padding:16px 14px; box-sizing:border-box; z-index:9999;
    font:13px/1.8 monospace; color:#94a3b8; user-select:none;
    overflow-y:auto; display:${visible ? '' : 'none'};
  `;


  const sliderHTML = (id: string, label: string, min: string, max: string, step: string, value: string) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;">
      <span style="min-width:70px;">${label}:</span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"
        style="flex:1;accent-color:#2dd4bf;" />
      <span id="${id}-val" style="color:#e2e8f0;min-width:30px;text-align:right;">${value}</span>
    </div>
  `;

  const numberInputHTML = (id: string, label: string, min: number, max: number, value: number) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
      <span>${label}:</span>
      <input id="${id}" type="number" min="${min}" max="${max}" value="${value}"
        style="width:40px;background:#0a0a0f;color:#e2e8f0;border:1px solid #2dd4bf33;border-radius:3px;padding:2px 4px;font:12px monospace;text-align:center;" />
    </div>
  `;

  const LINE_COLORS = ['#ef4444', '#3b82f6', '#2dd4bf', '#f59e0b', '#a78bfa'];

  // Mini stroke preview: SVG widget showing lines between two ends
  const lineArrangementHTML = (prefix: string, lineCount: number) => {
    if (lineCount <= 1) {
      return `<div style="font-size:11px;color:#64748b;margin-bottom:4px;">single line — no arrangement needed</div>`;
    }

    const numGaps = lineCount - 1;
    // Gap buttons for each end
    const gapBtns = (end: string) => {
      let html = '';
      for (let g = 0; g < numGaps; g++) {
        html += `<button id="${prefix}-g${end}${g}" title="gap ${g + 1}" style="
          width:20px;height:16px;border-radius:3px;font:9px monospace;
          background:#2dd4bf11;color:#2dd4bf88;border:1px solid #2dd4bf33;
          cursor:pointer;padding:0;margin:0 1px;
        ">1</button>`;
      }
      return html;
    };

    // SVG mini-preview dimensions
    const svgW = 220, svgH = 60;
    const endX1 = 20, endX2 = svgW - 20;
    const topY = 8, botY = svgH - 8;

    return `
      <div style="border:1px solid #2dd4bf22;border-radius:6px;padding:8px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-size:11px;">
          <span style="color:#2dd4bf99;">line arrangement</span>
          <span style="color:#64748b;">${lineCount} lines, ${numGaps} gaps</span>
        </div>
        <svg id="${prefix}-preview" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}"
          style="display:block;background:#0a0a0f;border-radius:4px;margin-bottom:6px;">
          <!-- End bars -->
          <line x1="${endX1}" y1="${topY}" x2="${endX1}" y2="${botY}" stroke="#2dd4bf44" stroke-width="2" />
          <line x1="${endX2}" y1="${topY}" x2="${endX2}" y2="${botY}" stroke="#2dd4bf44" stroke-width="2" />
          <text x="${endX1}" y="${svgH - 1}" text-anchor="middle" fill="#2dd4bf66" font-size="8" font-family="monospace">A</text>
          <text x="${endX2}" y="${svgH - 1}" text-anchor="middle" fill="#2dd4bf66" font-size="8" font-family="monospace">B</text>
          <!-- Lines will be drawn by JS -->
        </svg>
        <div style="display:flex;align-items:center;gap:4px;font-size:10px;">
          <span style="color:#94a3b8;min-width:16px;">A</span>
          <div style="display:flex;">${gapBtns('A')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;font-size:10px;margin-top:2px;">
          <span style="color:#94a3b8;min-width:16px;">B</span>
          <div style="display:flex;">${gapBtns('B')}</div>
        </div>
      </div>
    `;
  };

  const controlsHTML = (prefix: string, lineCount = 1) => `
    ${numberInputHTML(prefix + '-lines', 'lines', 1, 5, lineCount)}
    ${sliderHTML(prefix + '-widthA', 'width A', '0', '50', '1', '10')}
    ${sliderHTML(prefix + '-widthB', 'width B', '0', '50', '1', '10')}
    <div id="${prefix}-arrangement">${lineArrangementHTML(prefix, lineCount)}</div>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;">
      <input type="checkbox" id="${prefix}-crossing" style="accent-color:#2dd4bf;" />
      <span>crossed</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;">
      <input type="checkbox" id="${prefix}-animate" style="accent-color:#2dd4bf;" />
      <span>animate</span>
    </label>
    <div id="${prefix}-anim-controls" style="display:none;">
      ${sliderHTML(prefix + '-drift', 'drift', '0', '20', '0.5', '0')}
    </div>
  `;

  panel.innerHTML = `
    <div style="color:#2dd4bf; font-weight:bold; margin-bottom:12px;">debug</div>
    <div>seed: <span id="dbg-seed" style="color:#e2e8f0;">—</span></div>
    <div>fps: <span id="dbg-fps" style="color:#e2e8f0;">—</span></div>

    <!-- Playback -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:10px; padding-top:8px;">
      <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">playback</div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <button id="dbg-pause" style="background:#2dd4bf22;color:#2dd4bf;border:1px solid #2dd4bf44;border-radius:4px;padding:2px 10px;cursor:pointer;font:12px monospace;">pause</button>
        <span>time: <span id="dbg-time" style="color:#e2e8f0;">0.0s</span></span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:11px;">seek:</span>
        <input id="dbg-seek" type="number" min="0" step="0.1" value="0" style="width:60px;background:#0a0a0f;color:#e2e8f0;border:1px solid #2dd4bf33;border-radius:3px;padding:2px 4px;font:12px monospace;" />
        <button id="dbg-seek-go" style="background:#2dd4bf22;color:#2dd4bf;border:1px solid #2dd4bf44;border-radius:4px;padding:2px 8px;cursor:pointer;font:12px monospace;">go</button>
      </div>
    </div>

    <div style="border-top:1px solid #2dd4bf22; margin-top:10px; padding-top:8px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:4px;">
        <input type="checkbox" id="dbg-flow" style="accent-color:#2dd4bf;" />
        <span>show flow</span>
      </label>
      <div id="dbg-flow-components" style="display:none; padding-left:8px; font-size:12px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="dbg-fc-direction" checked style="accent-color:#2dd4bf;" />
          <span style="color:#2dd4bf;">direction</span>
        </label>
        <div style="color:#64748b;font-size:10px;padding-left:22px;margin-bottom:4px;">push direction + strength (teal arrows)</div>

        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="dbg-fc-curl" style="accent-color:#a78bfa;" />
          <span style="color:#a78bfa;">curl</span>
        </label>
        <div style="color:#64748b;font-size:10px;padding-left:22px;margin-bottom:4px;">rotation axis + spin intensity (purple arrows)</div>

        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="dbg-fc-compression" style="accent-color:#f87171;" />
          <span style="color:#f87171;">compression</span>
        </label>
        <div style="color:#64748b;font-size:10px;padding-left:22px;margin-bottom:4px;">squeeze direction + intensity (red arrows)</div>
      </div>
    </div>

    <!-- Flow effects: which components influence the curve -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:12px; padding-top:8px;">
      <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">flow effects on stroke</div>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="dbg-fe-direction" ${flowEffects.direction ? 'checked' : ''} style="accent-color:#2dd4bf;" />
        <span style="color:#2dd4bf;">direction → curvature</span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="dbg-fe-curl" ${flowEffects.curl ? 'checked' : ''} style="accent-color:#a78bfa;" />
        <span style="color:#a78bfa;">curl → curvature offset</span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;">
        <input type="checkbox" id="dbg-fe-compression" ${flowEffects.compression ? 'checked' : ''} style="accent-color:#f87171;" />
        <span style="color:#f87171;">compression → (not yet wired)</span>
      </label>
    </div>

    <!-- Global default strokes -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:12px; padding-top:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px;">global default — strokes</div>
        <div style="display:flex;gap:2px;">
          <button id="dbg-g-undo" title="undo" style="width:22px;height:18px;background:#2dd4bf11;color:#2dd4bf66;border:1px solid #2dd4bf22;border-radius:3px;cursor:pointer;font:10px monospace;padding:0;">↶</button>
          <button id="dbg-g-redo" title="redo" style="width:22px;height:18px;background:#2dd4bf11;color:#2dd4bf66;border:1px solid #2dd4bf22;border-radius:3px;cursor:pointer;font:10px monospace;padding:0;">↷</button>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span>agents:</span>
        <input id="dbg-agent-count" type="number" min="1" max="5" value="${currentAgentCount}" style="width:40px;background:#0a0a0f;color:#e2e8f0;border:1px solid #2dd4bf33;border-radius:3px;padding:2px 4px;font:12px monospace;text-align:center;" />
      </div>
      ${controlsHTML('dbg-g')}
    </div>

    <!-- Dynamic agent sections -->
    <div id="dbg-agents-container"></div>

    <!-- Reset -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:16px; padding-top:10px;">
      <button id="dbg-reset" style="
        background:#f8717122; color:#f87171; border:1px solid #f8717144;
        border-radius:4px; padding:4px 12px; cursor:pointer; font:12px monospace;
        width:100%;
      ">reset all settings</button>
    </div>

    <style>
      #debug-panel input[type=range]::-webkit-slider-thumb {
        -webkit-appearance:none;appearance:none;
        width:14px;height:14px;border-radius:50%;
        background:#2dd4bf;border:2px solid #0a0a0f;
        cursor:pointer;pointer-events:auto;
      }
      #debug-panel input[type=range]::-moz-range-thumb {
        width:14px;height:14px;border-radius:50%;
        background:#2dd4bf;border:2px solid #0a0a0f;
        cursor:pointer;pointer-events:auto;
      }
    </style>
  `;
  document.body.appendChild(panel);

  // ── Wiring ──

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      visible = !visible;
      panel.style.display = visible ? '' : 'none';
      saveState();
      for (const cb of visibilityListeners) cb(visible);
    }
  });

  const flowComponentsDiv = document.getElementById('dbg-flow-components')!;
  (document.getElementById('dbg-flow') as HTMLInputElement).addEventListener('change', function () {
    showFlow = this.checked;
    flowComponentsDiv.style.display = showFlow ? '' : 'none';
    for (const cb of flowListeners) cb(showFlow);
  });

  // Flow component toggles
  const FC_IDS: FlowComponent[] = ['direction', 'curl', 'compression'];
  for (const fc of FC_IDS) {
    (document.getElementById(`dbg-fc-${fc}`) as HTMLInputElement).addEventListener('change', function () {
      if (this.checked) activeFlowComponents.add(fc);
      else activeFlowComponents.delete(fc);
      if (showFlow) for (const cb of flowListeners) cb(true); // re-render
    });
  }

  // Flow effects toggles
  for (const fc of FC_IDS) {
    (document.getElementById(`dbg-fe-${fc}`) as HTMLInputElement).addEventListener('change', function () {
      flowEffects[fc] = this.checked;
      saveState();
    });
  }

  // Reset button
  (document.getElementById('dbg-reset') as HTMLButtonElement).addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });

  // Playback
  let animPaused = false;
  const pauseBtn = document.getElementById('dbg-pause') as HTMLButtonElement;
  pauseBtn.addEventListener('click', () => {
    animPaused = !animPaused;
    pauseBtn.textContent = animPaused ? 'resume' : 'pause';
    if (animPaused) { for (const cb of pauseListeners) cb(); }
    else { for (const cb of resumeListeners) cb(); }
  });

  const seekInput = document.getElementById('dbg-seek') as HTMLInputElement;
  (document.getElementById('dbg-seek-go') as HTMLButtonElement).addEventListener('click', () => {
    const t = parseFloat(seekInput.value);
    if (!isNaN(t) && t >= 0) { for (const cb of seekListeners) cb(t); }
  });


  // Wire arrangement: SVG mini-preview + gap weight buttons
  function wireArrangement(prefix: string, lineCount: number, getWeights: () => { a: number[]; b: number[] }, onChange: () => void) {
    if (lineCount <= 1) return;

    const svgW = 220, endX1 = 20, endX2 = svgW - 20;
    const topY = 8, botY = 52;
    const numGaps = lineCount - 1;

    function renderPreview() {
      const svg = document.getElementById(`${prefix}-preview`);
      if (!svg) return;

      // Remove old lines (keep the first 3 elements: 2 end bars + 2 text labels)
      const children = Array.from(svg.children);
      for (let i = children.length - 1; i >= 4; i--) {
        children[i].remove();
      }

      const w = getWeights();
      const posA = weightsToPositions(lineCount, w.a);
      const posB = weightsToPositions(lineCount, w.b);

      for (let i = 0; i < lineCount; i++) {
        const y1 = topY + posA[i] * (botY - topY);
        const y2 = topY + posB[i] * (botY - topY);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(endX1));
        line.setAttribute('y1', y1.toFixed(1));
        line.setAttribute('x2', String(endX2));
        line.setAttribute('y2', y2.toFixed(1));
        line.setAttribute('stroke', LINE_COLORS[i % LINE_COLORS.length]);
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-opacity', '0.8');
        svg.appendChild(line);

        // Dots at endpoints
        for (const [cx, cy] of [[endX1, y1], [endX2, y2]]) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', String(cx));
          dot.setAttribute('cy', cy.toFixed(1));
          dot.setAttribute('r', '3');
          dot.setAttribute('fill', LINE_COLORS[i % LINE_COLORS.length]);
          dot.setAttribute('fill-opacity', '0.8');
          svg.appendChild(dot);
        }
      }
    }

    // Wire gap buttons
    for (const end of ['A', 'B'] as const) {
      for (let g = 0; g < numGaps; g++) {
        const btn = document.getElementById(`${prefix}-g${end}${g}`);
        if (!btn) continue;
        // Set initial value
        const w = getWeights();
        const arr = end === 'A' ? w.a : w.b;
        btn.textContent = String(arr[g] ?? 1);

        btn.addEventListener('click', () => {
          const w2 = getWeights();
          const arr2 = end === 'A' ? w2.a : w2.b;
          arr2[g] = (arr2[g] % 3) + 1;
          btn.textContent = String(arr2[g]);
          renderPreview();
          onChange();
        });
      }
    }

    renderPreview();
  }

  function notifyAllAgents() {
    for (let i = 0; i < currentAgentCount; i++) {
      for (const cb of agentListeners) cb(i);
    }
  }

  // Global crossing
  (document.getElementById('dbg-g-crossing') as HTMLInputElement).addEventListener('change', function () {
    globalCrossing = this.checked;
    saveState();
    notifyAllAgents();
  });

  // Helper: wire a single slider with value display
  function wireSingleSlider(id: string, onChange: (v: number) => void) {
    const slider = document.getElementById(id) as HTMLInputElement;
    const valEl = document.getElementById(`${id}-val`)!;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valEl.textContent = v.toFixed(1);
      onChange(v);
    });
  }

  // Global: line count (first instance, wired from controlsHTML)
  wireNumberInput('dbg-g-lines', (n) => {
    globalLineCount = n;
    // Resize weight arrays
    const numGaps = Math.max(0, n - 1);
    while (globalWeightsA.length < numGaps) globalWeightsA.push(1);
    while (globalWeightsA.length > numGaps) globalWeightsA.pop();
    while (globalWeightsB.length < numGaps) globalWeightsB.push(1);
    while (globalWeightsB.length > numGaps) globalWeightsB.pop();
    // Rebuild arrangement widget
    const container = document.getElementById('dbg-g-arrangement');
    if (container) {
      container.innerHTML = lineArrangementHTML('dbg-g', n);
      wireArrangement('dbg-g', n,
        () => ({ a: globalWeightsA, b: globalWeightsB }),
        () => { saveState(); notifyAllAgents(); },
      );
    }
    saveState();
    notifyAllAgents();
  });

  // Global: width A/B (slider 0-50 maps to 0-0.05 perimeter fraction)
  wireSingleSlider('dbg-g-widthA', (v) => {
    globalWidthA = v * 0.001;
    saveState();
    notifyAllAgents();
  });
  wireSingleSlider('dbg-g-widthB', (v) => {
    globalWidthB = v * 0.001;
    saveState();
    notifyAllAgents();
  });

  // Global: wire initial arrangement widget
  wireArrangement('dbg-g', globalLineCount,
    () => ({ a: globalWeightsA, b: globalWeightsB }),
    () => { saveState(); notifyAllAgents(); },
  );

  // Global: animate toggle
  const gAnimCheckbox = document.getElementById('dbg-g-animate') as HTMLInputElement;
  const gAnimControls = document.getElementById('dbg-g-anim-controls')!;
  gAnimCheckbox.addEventListener('change', () => {
    globalAnimate = gAnimCheckbox.checked;
    gAnimControls.style.display = globalAnimate ? '' : 'none';
    saveState();
    notifyAllAgents();
  });

  // Global: drift speed
  wireSingleSlider('dbg-g-drift', (v) => {
    pushGlobalHistory();
    globalDriftSpeed = v * 0.001;
    saveState();
    notifyAllAgents();
  });

  // Global: undo/redo
  document.getElementById('dbg-g-undo')?.addEventListener('click', () => {
    const s = globalHistory.undo();
    if (s) { applyGlobalSnapshot(s); }
  });
  document.getElementById('dbg-g-redo')?.addEventListener('click', () => {
    const s = globalHistory.redo();
    if (s) { applyGlobalSnapshot(s); }
  });

  // Push initial global state
  pushGlobalHistory();

  // Agent count
  const agentCountInput = document.getElementById('dbg-agent-count') as HTMLInputElement;
  agentCountInput.addEventListener('change', () => {
    const n = Math.max(1, Math.min(5, parseInt(agentCountInput.value) || 1));
    agentCountInput.value = String(n);
    currentAgentCount = n;
    saveState();
    rebuildAgentSections();
    for (const cb of countListeners) cb(n);
  });

  // Helper: wire a number input
  function wireNumberInput(id: string, onChange: (v: number) => void, min = 1, max = 5, fallback = 2) {
    const el = document.getElementById(id) as HTMLInputElement;
    if (!el) return;
    el.addEventListener('change', () => {
      const n = Math.max(min, Math.min(max, parseInt(el.value) || fallback));
      el.value = String(n);
      onChange(n);
    });
  }


  // Dynamic agent sections
  const agentsContainer = document.getElementById('dbg-agents-container')!;

  function rebuildAgentSections() {
    // Ensure agents array has enough entries
    while (agents.length < currentAgentCount) agents.push(makeAgentConfig());

    agentsContainer.innerHTML = '';
    for (let i = 0; i < currentAgentCount; i++) {
      const id = `dbg-a${i}`;
      const section = document.createElement('div');
      section.style.cssText = 'border-top:1px solid #2dd4bf44; margin-top:12px; padding-top:8px;';
      section.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px;">stroke ${i}</div>
          <div style="display:flex;gap:2px;">
            <button id="${id}-undo" title="undo" style="width:22px;height:18px;background:#2dd4bf11;color:#2dd4bf66;border:1px solid #2dd4bf22;border-radius:3px;cursor:pointer;font:10px monospace;padding:0;">↶</button>
            <button id="${id}-redo" title="redo" style="width:22px;height:18px;background:#2dd4bf11;color:#2dd4bf66;border:1px solid #2dd4bf22;border-radius:3px;cursor:pointer;font:10px monospace;padding:0;">↷</button>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;">
          <input type="checkbox" id="${id}-override" style="accent-color:#2dd4bf;" ${agents[i].overrideGlobals ? 'checked' : ''} />
          <span>override globals</span>
        </label>
        <div id="${id}-controls" style="display:${agents[i].overrideGlobals ? '' : 'none'}; opacity:0.7;">
          ${controlsHTML(id)}
        </div>
      `;
      agentsContainer.appendChild(section);

      // Wire override toggle
      const overrideEl = document.getElementById(`${id}-override`) as HTMLInputElement;
      const controlsEl = document.getElementById(`${id}-controls`)!;
      overrideEl.addEventListener('change', () => {
        agents[i].overrideGlobals = overrideEl.checked;
        controlsEl.style.display = overrideEl.checked ? '' : 'none';
        for (const cb of agentListeners) cb(i);
      });

      // Wire per-agent controls
      wireNumberInput(`${id}-lines`, (n) => {
        agents[i].lineCount = n;
        const ng = Math.max(0, n - 1);
        while (agents[i].weightsA.length < ng) agents[i].weightsA.push(1);
        while (agents[i].weightsA.length > ng) agents[i].weightsA.pop();
        while (agents[i].weightsB.length < ng) agents[i].weightsB.push(1);
        while (agents[i].weightsB.length > ng) agents[i].weightsB.pop();
        // Rebuild arrangement
        const container = document.getElementById(`${id}-arrangement`);
        if (container) {
          container.innerHTML = lineArrangementHTML(id, n);
          wireArrangement(id, n,
            () => ({ a: agents[i].weightsA, b: agents[i].weightsB }),
            () => { if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i); },
          );
        }
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      // Wire initial arrangement for this agent
      wireArrangement(id, agents[i].lineCount,
        () => ({ a: agents[i].weightsA, b: agents[i].weightsB }),
        () => { if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i); },
      );

      wireSingleSlider(`${id}-widthA`, (v) => {
        agents[i].widthA = v * 0.001;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      wireSingleSlider(`${id}-widthB`, (v) => {
        agents[i].widthB = v * 0.001;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      const crossEl = document.getElementById(`${id}-crossing`) as HTMLInputElement;
      if (agents[i].crossing) crossEl.checked = true;
      crossEl.addEventListener('change', () => {
        agents[i].crossing = crossEl.checked;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      const animEl = document.getElementById(`${id}-animate`) as HTMLInputElement;
      const animCtrl = document.getElementById(`${id}-anim-controls`)!;
      animEl.addEventListener('change', () => {
        agents[i].animate = animEl.checked;
        animCtrl.style.display = animEl.checked ? '' : 'none';
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      wireSingleSlider(`${id}-drift`, (v) => {
        agents[i].driftSpeed = v * 0.001;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      // Stroke undo/redo
      while (strokeHistories.length <= i) strokeHistories.push(new ConfigHistory<AgentConfig>());
      strokeHistories[i].push({ ...agents[i], weightsA: [...agents[i].weightsA], weightsB: [...agents[i].weightsB] });

      document.getElementById(`${id}-undo`)?.addEventListener('click', () => {
        const s = strokeHistories[i]?.undo();
        if (s) {
          agents[i] = { ...s, weightsA: [...s.weightsA], weightsB: [...s.weightsB] };
          for (const cb of agentListeners) cb(i);
        }
      });
      document.getElementById(`${id}-redo`)?.addEventListener('click', () => {
        const s = strokeHistories[i]?.redo();
        if (s) {
          agents[i] = { ...s, weightsA: [...s.weightsA], weightsB: [...s.weightsB] };
          for (const cb of agentListeners) cb(i);
        }
      });
    }
  }

  rebuildAgentSections(); // initial

  // FPS
  let frames = 0;
  let lastFpsTime = performance.now();
  const fpsEl = document.getElementById('dbg-fps')!;
  function tick() {
    frames++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      fpsEl.textContent = String(frames);
      frames = 0;
      lastFpsTime = now;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    set(key, value) {
      const el = document.getElementById(`dbg-${key}`);
      if (el) el.textContent = String(value);
    },
    get visible() { return visible; },
    get showFlow() { return showFlow; },
    get flowComponents() { return activeFlowComponents; },
    get flowEffects() { return flowEffects; },
    get agentCount() { return currentAgentCount; },
    get panelWidth() { return PANEL_WIDTH; },

    agentConfig(index: number): ResolvedConfig {
      const a = agents[index];
      if (a?.overrideGlobals) {
        return {
          crossing: a.crossing, lineCount: a.lineCount,
          widthA: a.widthA, widthB: a.widthB,
          weightsA: [...a.weightsA], weightsB: [...a.weightsB],
          driftSpeed: a.driftSpeed, animate: a.animate,
        };
      }
      return {
        crossing: globalCrossing, lineCount: globalLineCount,
        widthA: globalWidthA, widthB: globalWidthB,
        weightsA: [...globalWeightsA], weightsB: [...globalWeightsB],
        driftSpeed: globalDriftSpeed, animate: globalAnimate,
      };
    },

    onVisibilityChange(cb) { visibilityListeners.push(cb); },
    onFlowChange(cb) { flowListeners.push(cb); },
    onAgentChange(cb) { agentListeners.push(cb); },
    onAgentCountChange(cb) { countListeners.push(cb); },
    onPause(cb) { pauseListeners.push(cb); },
    onResume(cb) { resumeListeners.push(cb); },
    onSeek(cb) { seekListeners.push(cb); },
  };
}
