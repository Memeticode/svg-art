// App: orchestrates agents, flow, viewport, rendering, and debug.

import { createRng } from './rng';
import { createFlowField } from './flow';
import type { CurveAgent } from './schema';
import { createCurve, updateCurve, buildPath, perimeterToXY, perimeterDist, minSafeGap } from './curve';
import { setViewport, vp, xyToPerimeter, getPerimeter } from './viewport';
import { createLoop } from './loop';
import { initDebug } from './debug/index';
import { createAgentView, removeAgentView, type AgentView } from './render/agents';
import { renderFlowOverlay } from './render/flow-overlay';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OUTLINE_MARGIN = 24;
const FLOW_GRID = 16;

export function createApp(seed: string) {
  const rng = createRng(seed);
  const flow = createFlowField(rng.fork('flow'));
  const debug = initDebug();

  debug?.set('seed', seed);

  // ── Viewport sync ──
  const syncViewport = () => {
    const w = Math.floor(window.innerWidth) || 1920;
    const h = Math.floor(window.innerHeight) || 1080;
    setViewport(w, h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    border.setAttribute('width', String(w));
    border.setAttribute('height', String(h));
  };

  // ── SVG scaffold ──
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;transition:all 0.3s ease';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${window.innerWidth || 1920} ${window.innerHeight || 1080}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'display:block;width:100%;height:100%';

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('fill', '#0a0a0f');
  svg.appendChild(bg);

  const agentLayer = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(agentLayer);

  const border = document.createElementNS(SVG_NS, 'rect');
  border.setAttribute('x', '0'); border.setAttribute('y', '0');
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', '#2dd4bf');
  border.setAttribute('stroke-width', '3');
  border.setAttribute('stroke-opacity', '0.5');
  border.setAttribute('display', 'none');
  svg.appendChild(border);

  const flowGroup = document.createElementNS(SVG_NS, 'g');
  flowGroup.setAttribute('display', 'none');
  svg.appendChild(flowGroup);

  wrapper.appendChild(svg);
  document.body.appendChild(wrapper);
  syncViewport();
  window.addEventListener('resize', syncViewport);

  // ── Agent management ──
  let agents: CurveAgent[] = [];
  let views: AgentView[] = [];
  let agentCounter = 0;

  const spawnAgent = () => {
    const agent = createCurve(rng.fork(`agent-${agentCounter++}`));
    const view = createAgentView(agentLayer);
    return { agent, view };
  };

  const setAgentCount = (count: number) => {
    while (agents.length < count) {
      const { agent, view } = spawnAgent();
      agents.push(agent);
      views.push(view);
    }
    while (agents.length > count) {
      agents.pop();
      removeAgentView(views.pop()!);
    }
  };

  setAgentCount(debug?.agentCount ?? 1);

  // ── Drag handle controls (circles outside viewport border) ──
  const HANDLE_SIZE = 14; // diameter in px
  const HANDLE_OFFSET = 8; // px outside the border

  interface DragHandle {
    el: HTMLDivElement;
    bar: HTMLDivElement; // width indicator bar
    agentIdx: number;
    endpoint: 'A' | 'B';
  }

  let handles: DragHandle[] = [];
  let dragTarget: DragHandle | null = null;

  function createHandle(agentIdx: number, endpoint: 'A' | 'B', color: string): DragHandle {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; width:${HANDLE_SIZE}px; height:${HANDLE_SIZE}px;
      border-radius:50%; background:${color}; border:2px solid #0a0a0f;
      cursor:grab; z-index:100; pointer-events:auto;
      box-shadow:0 0 4px ${color}44;
      transform:translate(-50%,-50%);
    `;
    el.title = `stroke ${agentIdx} ${endpoint}`;
    wrapper.appendChild(el);

    // Width indicator bar — colored line outside the border showing stroke width
    const bar = document.createElement('div');
    bar.style.cssText = `
      position:absolute; background:${color}; opacity:0.5;
      pointer-events:none; z-index:99; border-radius:1px;
    `;
    wrapper.appendChild(bar);

    el.addEventListener('mousedown', (e) => {
      dragTarget = handle;
      el.style.cursor = 'grabbing';
      e.preventDefault();
    });

    const handle: DragHandle = { el, bar, agentIdx, endpoint };
    return handle;
  }

  function rebuildHandles() {
    for (const h of handles) { h.el.remove(); h.bar.remove(); }
    handles = [];
    if (!outlineActive) return;
    for (let i = 0; i < agents.length; i++) {
      handles.push(createHandle(i, 'A', '#2dd4bf'));
      handles.push(createHandle(i, 'B', '#f59e0b'));
    }
  }

  function updateHandlePositions() {
    if (!outlineActive) return;
    const wrapRect = wrapper.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const P = getPerimeter();

    const borderLeft = svgRect.left - wrapRect.left;
    const borderTop = svgRect.top - wrapRect.top;
    const borderRight = borderLeft + svgRect.width;
    const borderBottom = borderTop + svgRect.height;

    function toScreen(pt: { x: number; y: number }) {
      return {
        x: svgRect.left + (pt.x / vp.w) * svgRect.width - wrapRect.left,
        y: svgRect.top + (pt.y / vp.h) * svgRect.height - wrapRect.top,
      };
    }

    for (const h of handles) {
      const agent = agents[h.agentIdx];
      if (!agent) continue;
      const p = h.endpoint === 'A' ? agent.pA : agent.pB;
      // Total width at this end = edge1 + edge2 offsets
      const totalWidth = h.endpoint === 'A'
        ? (agent.edge1A + agent.edge2A) * P
        : (agent.edge1B + agent.edge2B) * P;
      const pt = perimeterToXY(p);
      const sc = toScreen(pt);

      // Determine which edge and push handle outside
      const onTop = pt.y <= 1;
      const onRight = pt.x >= vp.w - 1;
      const onBottom = pt.y >= vp.h - 1;
      const onLeft = pt.x <= 1;

      let hx = sc.x, hy = sc.y;
      if (onTop) hy = borderTop - HANDLE_OFFSET;
      else if (onRight) hx = borderRight + HANDLE_OFFSET;
      else if (onBottom) hy = borderBottom + HANDLE_OFFSET;
      else if (onLeft) hx = borderLeft - HANDLE_OFFSET;

      h.el.style.left = hx + 'px';
      h.el.style.top = hy + 'px';
      h.el.style.display = '';

      // Width indicator bar: spans the total width of this end, outside the border
      const halfW = totalWidth / 2;
      const p1 = perimeterToXY(p - halfW / P);
      const p2 = perimeterToXY(p + halfW / P);
      const s1 = toScreen(p1);
      const s2 = toScreen(p2);

      const BAR_THICKNESS = 3;
      if (onTop || onBottom) {
        // Horizontal bar
        const left = Math.min(s1.x, s2.x);
        const width = Math.abs(s2.x - s1.x);
        const barY = onTop ? borderTop - HANDLE_OFFSET - HANDLE_SIZE / 2 - 2 : borderBottom + HANDLE_OFFSET + HANDLE_SIZE / 2 + 2;
        h.bar.style.left = left + 'px';
        h.bar.style.top = (barY - BAR_THICKNESS / 2) + 'px';
        h.bar.style.width = Math.max(2, width) + 'px';
        h.bar.style.height = BAR_THICKNESS + 'px';
      } else {
        // Vertical bar
        const top = Math.min(s1.y, s2.y);
        const height = Math.abs(s2.y - s1.y);
        const barX = onRight ? borderRight + HANDLE_OFFSET + HANDLE_SIZE / 2 + 2 : borderLeft - HANDLE_OFFSET - HANDLE_SIZE / 2 - 2;
        h.bar.style.left = (barX - BAR_THICKNESS / 2) + 'px';
        h.bar.style.top = top + 'px';
        h.bar.style.width = BAR_THICKNESS + 'px';
        h.bar.style.height = Math.max(2, height) + 'px';
      }
      h.bar.style.display = '';
    }
  }

  function screenToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / rect.width * vp.w,
      y: (clientY - rect.top) / rect.height * vp.h,
    };
  }

  window.addEventListener('mousemove', (e) => {
    if (!dragTarget) return;
    const { x, y } = screenToSvg(e.clientX, e.clientY);
    const p = xyToPerimeter(x, y);
    const agent = agents[dragTarget.agentIdx];

    // Only apply if edges won't overlap
    const other = dragTarget.endpoint === 'A' ? agent.pB : agent.pA;
    if (perimeterDist(p, other) >= minSafeGap(agent)) {
      if (dragTarget.endpoint === 'A') agent.pA = p;
      else agent.pB = p;
    }
  });

  window.addEventListener('mouseup', () => {
    if (dragTarget) {
      dragTarget.el.style.cursor = 'grab';
      dragTarget = null;
    }
  });

  // ── Debug wiring ──
  let outlineActive = false;
  let flowActive = false;

  const applyDebugLayout = (visible: boolean) => {
    outlineActive = visible;
    if (visible) {
      const pw = debug?.panelWidth ?? 280, m = OUTLINE_MARGIN;
      wrapper.style.top = `${m}px`;
      wrapper.style.left = `${m}px`;
      wrapper.style.width = `calc(100% - ${pw + m * 2}px)`;
      wrapper.style.height = `calc(100% - ${m * 2}px)`;
      wrapper.style.border = '1px solid rgba(45, 212, 191, 0.3)';
      wrapper.style.borderRadius = '4px';
      border.setAttribute('display', '');
    } else {
      wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;transition:all 0.3s ease';
      border.setAttribute('display', 'none');
    }
  };

  debug?.onVisibilityChange((v) => {
    applyDebugLayout(v);
    rebuildHandles();
  });
  if (debug?.visible) {
    applyDebugLayout(true);
    rebuildHandles();
  }

  debug?.onFlowChange((active) => {
    flowActive = active;
    flowGroup.setAttribute('display', active ? '' : 'none');
    for (const v of views) {
      v.fill.setAttribute('fill-opacity', active ? '0.15' : '0.6');
      for (const l of v.lines) l.setAttribute('stroke-opacity', active ? '0.2' : '0.8');
    }
  });

  debug?.onAgentChange((i) => {
    if (i < agents.length) {
      const cfg = debug.agentConfig(i);
      const agent = agents[i];
      agent.crossed = cfg.crossed;
      agent.crossPoint = cfg.crossPoint;
      agent.animate = cfg.animate;

      // Apply drift speed
      const sign = (v: number) => v >= 0 ? 1 : -1;
      agent.driftA = sign(agent.driftA || 1) * cfg.driftSpeed;
      agent.driftB = sign(agent.driftB || -1) * cfg.driftSpeed;

      // Apply edge widths
      agent.edge1A = cfg.edge1A;
      agent.edge1B = cfg.edge1B;
      agent.edge2A = cfg.edge2A;
      agent.edge2B = cfg.edge2B;
    }
  });

  debug?.onAgentCountChange((count) => {
    setAgentCount(count);
    rebuildHandles();
    for (let i = 0; i < agents.length; i++) {
      const cfg = debug!.agentConfig(i);
      agents[i].crossed = cfg.crossed;
      agents[i].crossPoint = cfg.crossPoint;
    }
  });

  // ── Animation loop ──
  let frameCount = 0;
  const loop = createLoop((dt, time) => {
    frameCount++;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const view = views[i];

      const midX = (perimeterToXY(agent.pA).x + perimeterToXY(agent.pB).x) / 2;
      const midY = (perimeterToXY(agent.pA).y + perimeterToXY(agent.pB).y) / 2;
      const flowSample = flow.sample(midX / vp.w, midY / vp.h, time);

      updateCurve(agent, dt);
      const paths = buildPath(agent, flowSample, debug?.flowEffects);

      view.fill.setAttribute('d', paths.fill);
      for (let li = 0; li < view.lines.length && li < paths.lines.length; li++) {
        view.lines[li].setAttribute('d', paths.lines[li]);
        view.lines[li].setAttribute('stroke-width', String(paths.strokeWidths[li].toFixed(1)));
      }
    }

    debug?.set('time', time.toFixed(1) + 's');
    updateHandlePositions();

    if (flowActive && frameCount % 6 === 0) {
      const components = debug?.flowComponents ?? new Set<import('./schema').FlowComponent>(['direction']);
      renderFlowOverlay(flowGroup, flow, time, FLOW_GRID, components);
    }
  });

  debug?.onPause(() => loop.pause());
  debug?.onResume(() => loop.resume());
  debug?.onSeek((t) => loop.seekTo(t));

  loop.start();
  return { stop: loop.stop, destroy() { loop.stop(); wrapper.remove(); } };
}
