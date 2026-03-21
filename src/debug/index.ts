// Debug panel: toggled via Ctrl+Shift+D when enabled by markup.

import type { FlowComponent, FlowEffects } from '../schema';
import { DEFAULT_FLOW_EFFECTS } from '../schema';

const PANEL_WIDTH = 280;
const STORAGE_KEY = 'svg-art-debug';

export interface AgentConfig {
  overrideGlobals: boolean;
  crossing: boolean;
  spreadMin: number;
  spreadMax: number;
}

export interface ResolvedConfig {
  crossing: boolean;
  spreadMin: number;
  spreadMax: number;
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
    globalSpreadMin: number;
    globalSpreadMax: number;
    agentCount: number;
    flowEffects: FlowEffects;
  }

  const DEFAULTS: PersistedState = {
    debugVisible: false,
    globalCrossing: false,
    globalSpreadMin: 0.001,
    globalSpreadMax: 0.02,
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
      globalSpreadMin,
      globalSpreadMax,
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
  let globalSpreadMin = saved.globalSpreadMin;
  let globalSpreadMax = saved.globalSpreadMax;

  const agents: AgentConfig[] = [];
  const visibilityListeners: Array<(v: boolean) => void> = [];
  const flowListeners: Array<(v: boolean) => void> = [];
  const agentListeners: Array<(i: number) => void> = [];
  const countListeners: Array<(n: number) => void> = [];
  const pauseListeners: Array<() => void> = [];
  const resumeListeners: Array<() => void> = [];
  const seekListeners: Array<(t: number) => void> = [];

  function makeAgentConfig(): AgentConfig {
    return { overrideGlobals: false, crossing: false, spreadMin: 0.001, spreadMax: 0.02 };
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

  const rangeSliderHTML = (prefix: string, minVal: string, maxVal: string) => `
    <div style="margin-bottom:4px;">
      stroke width: <span id="${prefix}-val" style="color:#e2e8f0;">${minVal}% – ${maxVal}%</span>
    </div>
    <div style="position:relative; height:28px; margin:4px 0;">
      <div style="position:absolute;top:12px;left:0;right:0;height:4px;background:#2dd4bf22;border-radius:2px;"></div>
      <div id="${prefix}-fill" style="position:absolute;top:12px;height:4px;background:#2dd4bf66;border-radius:2px;"></div>
      <input type="range" id="${prefix}-min" min="0.1" max="10" step="0.1" value="${minVal}"
        style="position:absolute;top:0;left:0;width:100%;height:28px;-webkit-appearance:none;appearance:none;background:transparent;pointer-events:none;z-index:2;" />
      <input type="range" id="${prefix}-max" min="0.1" max="10" step="0.1" value="${maxVal}"
        style="position:absolute;top:0;left:0;width:100%;height:28px;-webkit-appearance:none;appearance:none;background:transparent;pointer-events:none;z-index:3;" />
    </div>
  `;

  const controlsHTML = (prefix: string) => `
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;">
      <input type="checkbox" id="${prefix}-crossing" style="accent-color:#2dd4bf;" />
      <span>crossed</span>
    </label>
    ${rangeSliderHTML(prefix + '-sw', '0.1', '2.0')}
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

    <!-- Global defaults -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:12px; padding-top:8px;">
      <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">global defaults</div>
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

  // Dual-range slider helper
  function wireDualRange(prefix: string, onChange: (lo: number, hi: number) => void) {
    const minS = document.getElementById(`${prefix}-min`) as HTMLInputElement;
    const maxS = document.getElementById(`${prefix}-max`) as HTMLInputElement;
    const fill = document.getElementById(`${prefix}-fill`)!;
    const val = document.getElementById(`${prefix}-val`)!;
    function sync() {
      let lo = parseFloat(minS.value), hi = parseFloat(maxS.value);
      if (lo > hi) { minS.value = maxS.value; lo = hi; }
      if (hi < lo) { maxS.value = minS.value; hi = lo; }
      val.textContent = `${lo.toFixed(1)}% – ${hi.toFixed(1)}%`;
      const range = 10 - 0.1;
      fill.style.left = ((lo - 0.1) / range * 100) + '%';
      fill.style.width = ((hi - lo) / range * 100) + '%';
      onChange(lo / 100, hi / 100);
    }
    minS.addEventListener('input', sync);
    maxS.addEventListener('input', sync);
    sync();
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

  // Global stroke width
  wireDualRange('dbg-g-sw', (lo, hi) => {
    globalSpreadMin = lo;
    globalSpreadMax = hi;
    saveState();
    notifyAllAgents();
  });

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
        <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">agent ${i}</div>
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

      // Wire crossing
      const crossEl = document.getElementById(`${id}-crossing`) as HTMLInputElement;
      if (agents[i].crossing) crossEl.checked = true;
      crossEl.addEventListener('change', () => {
        agents[i].crossing = crossEl.checked;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
      });

      // Wire stroke width
      wireDualRange(`${id}-sw`, (lo, hi) => {
        agents[i].spreadMin = lo;
        agents[i].spreadMax = hi;
        if (agents[i].overrideGlobals) for (const cb of agentListeners) cb(i);
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
        return { crossing: a.crossing, spreadMin: a.spreadMin, spreadMax: a.spreadMax };
      }
      return { crossing: globalCrossing, spreadMin: globalSpreadMin, spreadMax: globalSpreadMax };
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
