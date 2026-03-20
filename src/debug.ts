// Debug panel: toggled via Ctrl+Shift+D when enabled by markup.
// Layout: readouts, playback, global defaults, per-agent overrides.

const PANEL_WIDTH = 240;

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

export interface DebugHandle {
  set(key: string, value: string | number): void;
  visible: boolean;
  showFlow: boolean;
  /** Resolved config for an agent (applies override or falls back to global) */
  agentConfig(index: number): ResolvedConfig;
  panelWidth: number;
  onVisibilityChange(cb: (v: boolean) => void): void;
  onFlowChange(cb: (v: boolean) => void): void;
  onAgentChange(cb: (i: number) => void): void;
  onPause(cb: () => void): void;
  onResume(cb: () => void): void;
  onSeek(cb: (time: number) => void): void;
}

export function initDebug(): DebugHandle | null {
  const enabled = document.body.hasAttribute('data-debug-enabled');
  if (!enabled) return null;

  let visible = false;
  let showFlow = false;

  // Global defaults
  let globalCrossing = false;
  let globalSpreadMin = 0.001;
  let globalSpreadMax = 0.02;

  // Per-agent overrides
  const agents: AgentConfig[] = [{
    overrideGlobals: false,
    crossing: false,
    spreadMin: 0.001,
    spreadMax: 0.02,
  }];

  const visibilityListeners: Array<(v: boolean) => void> = [];
  const flowListeners: Array<(v: boolean) => void> = [];
  const agentListeners: Array<(i: number) => void> = [];
  const pauseListeners: Array<() => void> = [];
  const resumeListeners: Array<() => void> = [];
  const seekListeners: Array<(t: number) => void> = [];

  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.style.cssText = `
    position:fixed; top:0; right:0; width:${PANEL_WIDTH}px; height:100%;
    background:rgba(10,10,15,0.95); border-left:1px solid #2dd4bf33;
    padding:16px 14px; box-sizing:border-box; z-index:9999;
    font:13px/1.8 monospace; color:#94a3b8; user-select:none;
    overflow-y:auto; display:none;
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

  // Controls block shared by global and per-agent
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

    <!-- ═══ Playback ═══ -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:10px; padding-top:8px;">
      <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
        playback
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <button id="dbg-pause" style="
          background:#2dd4bf22; color:#2dd4bf; border:1px solid #2dd4bf44;
          border-radius:4px; padding:2px 10px; cursor:pointer; font:12px monospace;
        ">pause</button>
        <span>time: <span id="dbg-time" style="color:#e2e8f0;">0.0s</span></span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size:11px;">seek:</span>
        <input id="dbg-seek" type="number" min="0" step="0.1" value="0"
          style="width:60px; background:#0a0a0f; color:#e2e8f0; border:1px solid #2dd4bf33;
          border-radius:3px; padding:2px 4px; font:12px monospace;" />
        <button id="dbg-seek-go" style="
          background:#2dd4bf22; color:#2dd4bf; border:1px solid #2dd4bf44;
          border-radius:4px; padding:2px 8px; cursor:pointer; font:12px monospace;
        ">go</button>
      </div>
    </div>

    <div style="border-top:1px solid #2dd4bf22; margin-top:10px; padding-top:8px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" id="dbg-flow" style="accent-color:#2dd4bf;" />
        <span>show flow</span>
      </label>
    </div>

    <!-- ═══ Global defaults ═══ -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:12px; padding-top:8px;">
      <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
        global defaults
      </div>
      ${controlsHTML('dbg-g')}
    </div>

    <!-- ═══ Agent 0 ═══ -->
    <div style="border-top:1px solid #2dd4bf44; margin-top:12px; padding-top:8px;">
      <div style="color:#2dd4bf; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
        agent 0
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;">
        <input type="checkbox" id="dbg-a0-override" style="accent-color:#2dd4bf;" />
        <span>override globals</span>
      </label>
      <div id="dbg-a0-controls" style="display:none; opacity:0.7;">
        ${controlsHTML('dbg-a0')}
      </div>
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
      for (const cb of visibilityListeners) cb(visible);
    }
  });

  (document.getElementById('dbg-flow') as HTMLInputElement).addEventListener('change', function () {
    showFlow = this.checked;
    for (const cb of flowListeners) cb(showFlow);
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

  function notifyAgent(i: number) { for (const cb of agentListeners) cb(i); }

  // Global: crossing
  (document.getElementById('dbg-g-crossing') as HTMLInputElement).addEventListener('change', function () {
    globalCrossing = this.checked;
    notifyAgent(0);
  });

  // Global: stroke width
  wireDualRange('dbg-g-sw', (lo, hi) => {
    globalSpreadMin = lo;
    globalSpreadMax = hi;
    notifyAgent(0);
  });

  // Agent 0: override toggle
  const a0Override = document.getElementById('dbg-a0-override') as HTMLInputElement;
  const a0Controls = document.getElementById('dbg-a0-controls')!;
  a0Override.addEventListener('change', function () {
    a0Controls.style.display = this.checked ? '' : 'none';
    agents[0].overrideGlobals = this.checked;
    notifyAgent(0);
  });

  // Agent 0: crossing
  (document.getElementById('dbg-a0-crossing') as HTMLInputElement).addEventListener('change', function () {
    agents[0].crossing = this.checked;
    if (agents[0].overrideGlobals) notifyAgent(0);
  });

  // Agent 0: stroke width
  wireDualRange('dbg-a0-sw', (lo, hi) => {
    agents[0].spreadMin = lo;
    agents[0].spreadMax = hi;
    if (agents[0].overrideGlobals) notifyAgent(0);
  });

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
    get panelWidth() { return PANEL_WIDTH; },

    agentConfig(index: number): ResolvedConfig {
      const a = agents[index] ?? agents[0];
      if (a.overrideGlobals) {
        return { crossing: a.crossing, spreadMin: a.spreadMin, spreadMax: a.spreadMax };
      }
      return { crossing: globalCrossing, spreadMin: globalSpreadMin, spreadMax: globalSpreadMax };
    },

    onVisibilityChange(cb) { visibilityListeners.push(cb); },
    onFlowChange(cb) { flowListeners.push(cb); },
    onAgentChange(cb) { agentListeners.push(cb); },
    onPause(cb) { pauseListeners.push(cb); },
    onResume(cb) { resumeListeners.push(cb); },
    onSeek(cb) { seekListeners.push(cb); },
  };
}
