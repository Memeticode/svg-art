// Debug panel: toggled via Ctrl+Shift+D when enabled by markup.

import type { FlowComponent, FlowEffects } from '../schema';
import { DEFAULT_FLOW_EFFECTS } from '../schema';

const PANEL_WIDTH = 280;
const STORAGE_KEY = 'svg-art-debug';
const MAX_HISTORY = 5;

/** Simple undo/redo history for a config object. */
class ConfigHistory<T> {
  private stack: T[] = [];
  private index = -1;

  push(state: T) {
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
  crossed: boolean;
  crossPoint: number;
  edge1A: number;
  edge1B: number;
  edge2A: number;
  edge2B: number;
  driftSpeed: number;
  animate: boolean;
}

export interface ResolvedConfig {
  crossed: boolean;
  crossPoint: number;
  edge1A: number;
  edge1B: number;
  edge2A: number;
  edge2B: number;
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
    globalCrossed: boolean;
    globalCrossPoint: number;
    globalEdge1A: number;
    globalEdge1B: number;
    globalEdge2A: number;
    globalEdge2B: number;
    globalDriftSpeed: number;
    globalAnimate: boolean;
    agentCount: number;
    flowEffects: FlowEffects;
  }

  const DEFAULTS: PersistedState = {
    debugVisible: false,
    globalCrossed: false,
    globalCrossPoint: 0.5,
    globalEdge1A: 0.01,
    globalEdge1B: 0.01,
    globalEdge2A: 0.01,
    globalEdge2B: 0.01,
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
      globalCrossed,
      globalCrossPoint,
      globalEdge1A,
      globalEdge1B,
      globalEdge2A,
      globalEdge2B,
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
  let globalCrossed = saved.globalCrossed;
  let globalCrossPoint = saved.globalCrossPoint ?? 0.5;
  let globalEdge1A = saved.globalEdge1A ?? 0.01;
  let globalEdge1B = saved.globalEdge1B ?? 0.01;
  let globalEdge2A = saved.globalEdge2A ?? 0.01;
  let globalEdge2B = saved.globalEdge2B ?? 0.01;
  let globalDriftSpeed = saved.globalDriftSpeed ?? 0;
  let globalAnimate = saved.globalAnimate ?? false;

  // Undo/redo history
  interface GlobalSnapshot {
    crossed: boolean; crossPoint: number;
    edge1A: number; edge1B: number; edge2A: number; edge2B: number;
    driftSpeed: number; animate: boolean;
  }
  const globalHistory = new ConfigHistory<GlobalSnapshot>();
  const strokeHistories: ConfigHistory<AgentConfig>[] = [];

  function snapshotGlobal(): GlobalSnapshot {
    return { crossed: globalCrossed, crossPoint: globalCrossPoint,
      edge1A: globalEdge1A, edge1B: globalEdge1B, edge2A: globalEdge2A, edge2B: globalEdge2B,
      driftSpeed: globalDriftSpeed, animate: globalAnimate };
  }

  function applyGlobalSnapshot(s: GlobalSnapshot) {
    globalCrossed = s.crossed; globalCrossPoint = s.crossPoint;
    globalEdge1A = s.edge1A; globalEdge1B = s.edge1B;
    globalEdge2A = s.edge2A; globalEdge2B = s.edge2B;
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
    return { overrideGlobals: false, crossed: false, crossPoint: 0.5,
      edge1A: 0.01, edge1B: 0.01, edge2A: 0.01, edge2B: 0.01,
      driftSpeed: 0, animate: false };
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

  const controlsHTML = (prefix: string) => `
    <div style="color:#94a3b8;font-size:11px;margin-bottom:2px;margin-top:4px;">edge 1 (red)</div>
    ${sliderHTML(prefix + '-e1a', 'A side', '0', '50', '1', '10')}
    ${sliderHTML(prefix + '-e1b', 'B side', '0', '50', '1', '10')}
    <div style="color:#94a3b8;font-size:11px;margin-bottom:2px;margin-top:4px;">edge 2 (blue)</div>
    ${sliderHTML(prefix + '-e2a', 'A side', '0', '50', '1', '10')}
    ${sliderHTML(prefix + '-e2b', 'B side', '0', '50', '1', '10')}
    ${sliderHTML(prefix + '-crosspoint', 'cross pos', '0', '100', '1', '50')}
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;">
      <input type="checkbox" id="${prefix}-crossed" style="accent-color:#2dd4bf;" />
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
        <span>strokes:</span>
        <input id="dbg-agent-count" type="number" min="1" max="5" value="${currentAgentCount}" style="width:40px;background:#0a0a0f;color:#e2e8f0;border:1px solid #2dd4bf33;border-radius:3px;padding:2px 4px;font:12px monospace;text-align:center;" />
      </div>
      ${controlsHTML('dbg-g')}
    </div>

    <!-- Dynamic stroke sections -->
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
      if (showFlow) for (const cb of flowListeners) cb(true);
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

  // Helper: wire a single slider with value display
  function wireSingleSlider(id: string, onChange: (v: number) => void) {
    const slider = document.getElementById(id) as HTMLInputElement;
    const valEl = document.getElementById(`${id}-val`)!;
    if (!slider || !valEl) return;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valEl.textContent = v.toFixed(1);
      onChange(v);
    });
  }

  function notifyAllAgents() {
    for (let i = 0; i < currentAgentCount; i++) {
      for (const cb of agentListeners) cb(i);
    }
  }

  // Wire edge width sliders for a given prefix
  function wireEdgeSliders(prefix: string, setEdge: (key: 'edge1A' | 'edge1B' | 'edge2A' | 'edge2B', v: number) => void, onChange: () => void) {
    wireSingleSlider(`${prefix}-e1a`, (v) => { setEdge('edge1A', v * 0.001); onChange(); });
    wireSingleSlider(`${prefix}-e1b`, (v) => { setEdge('edge1B', v * 0.001); onChange(); });
    wireSingleSlider(`${prefix}-e2a`, (v) => { setEdge('edge2A', v * 0.001); onChange(); });
    wireSingleSlider(`${prefix}-e2b`, (v) => { setEdge('edge2B', v * 0.001); onChange(); });
  }

  // Global: edge widths
  wireEdgeSliders('dbg-g',
    (key, v) => {
      if (key === 'edge1A') globalEdge1A = v;
      else if (key === 'edge1B') globalEdge1B = v;
      else if (key === 'edge2A') globalEdge2A = v;
      else globalEdge2B = v;
    },
    () => { saveState(); notifyAllAgents(); },
  );

  // Global: crossPoint (always visible)
  wireSingleSlider('dbg-g-crosspoint', (v) => {
    globalCrossPoint = v / 100;
    saveState();
    notifyAllAgents();
  });

  // Global: crossed checkbox
  const gCrossedEl = document.getElementById('dbg-g-crossed') as HTMLInputElement;
  gCrossedEl.checked = globalCrossed;
  gCrossedEl.addEventListener('change', () => {
    globalCrossed = gCrossedEl.checked;
    saveState();
    notifyAllAgents();
  });

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

  // Stroke count
  const agentCountInput = document.getElementById('dbg-agent-count') as HTMLInputElement;
  agentCountInput.addEventListener('change', () => {
    const n = Math.max(1, Math.min(5, parseInt(agentCountInput.value) || 1));
    agentCountInput.value = String(n);
    currentAgentCount = n;
    saveState();
    rebuildAgentSections();
    for (const cb of countListeners) cb(n);
  });

  // Dynamic stroke sections
  const agentsContainer = document.getElementById('dbg-agents-container')!;

  function rebuildAgentSections() {
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

      // Wire per-agent edge sliders
      wireEdgeSliders(id,
        (key, v) => { agents[i][key] = v; },
        () => { if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i); },
      );

      // Wire per-agent crossPoint
      wireSingleSlider(`${id}-crosspoint`, (v) => {
        agents[i].crossPoint = v / 100;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      // Wire per-agent crossed
      const crossedEl = document.getElementById(`${id}-crossed`) as HTMLInputElement;
      if (agents[i].crossed) crossedEl.checked = true;
      crossedEl.addEventListener('change', () => {
        agents[i].crossed = crossedEl.checked;
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
      strokeHistories[i].push({ ...agents[i] });

      document.getElementById(`${id}-undo`)?.addEventListener('click', () => {
        const s = strokeHistories[i]?.undo();
        if (s) {
          agents[i] = { ...s };
          for (const cb of agentListeners) cb(i);
        }
      });
      document.getElementById(`${id}-redo`)?.addEventListener('click', () => {
        const s = strokeHistories[i]?.redo();
        if (s) {
          agents[i] = { ...s };
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
          crossed: a.crossed, crossPoint: a.crossPoint,
          edge1A: a.edge1A, edge1B: a.edge1B,
          edge2A: a.edge2A, edge2B: a.edge2B,
          driftSpeed: a.driftSpeed, animate: a.animate,
        };
      }
      return {
        crossed: globalCrossed, crossPoint: globalCrossPoint,
        edge1A: globalEdge1A, edge1B: globalEdge1B,
        edge2A: globalEdge2A, edge2B: globalEdge2B,
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
