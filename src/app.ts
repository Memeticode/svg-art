// App: orchestrates agents, flow, viewport, rendering, and debug.

import { createRng } from './rng';
import { createFlowField } from './flow';
import type { CurveAgent } from './schema';
import { createCurve, updateCurve, buildPath, perimeterToXY } from './curve';
import { setViewport, vp } from './viewport';
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

  // ── Debug wiring ──
  let outlineActive = false;
  let flowActive = false;

  debug?.onVisibilityChange((visible) => {
    outlineActive = visible;
    if (visible) {
      const pw = debug.panelWidth, m = OUTLINE_MARGIN;
      wrapper.style.top = `${m}px`;
      wrapper.style.left = `${m}px`;
      wrapper.style.width = `calc(100% - ${pw + m * 2}px)`;
      wrapper.style.height = `calc(100% - ${m * 2}px)`;
      wrapper.style.border = '1px solid rgba(45, 212, 191, 0.3)';
      wrapper.style.borderRadius = '4px';
      border.setAttribute('display', '');
      for (const v of views) for (const d of v.dots) d.setAttribute('display', '');
    } else {
      wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;transition:all 0.3s ease';
      border.setAttribute('display', 'none');
      for (const v of views) for (const d of v.dots) d.setAttribute('display', 'none');
    }
  });

  // Apply saved visibility state on startup
  if (debug?.visible) {
    outlineActive = true;
    const pw = debug.panelWidth, m = OUTLINE_MARGIN;
    wrapper.style.top = `${m}px`;
    wrapper.style.left = `${m}px`;
    wrapper.style.width = `calc(100% - ${pw + m * 2}px)`;
    wrapper.style.height = `calc(100% - ${m * 2}px)`;
    wrapper.style.border = '1px solid rgba(45, 212, 191, 0.3)';
    wrapper.style.borderRadius = '4px';
    border.setAttribute('display', '');
    for (const v of views) for (const d of v.dots) d.setAttribute('display', '');
  }

  debug?.onFlowChange((active) => {
    flowActive = active;
    flowGroup.setAttribute('display', active ? '' : 'none');
    for (const v of views) {
      v.fill.setAttribute('fill-opacity', active ? '0.15' : '0.6');
      v.upper.setAttribute('stroke-opacity', active ? '0.2' : '0.8');
      v.lower.setAttribute('stroke-opacity', active ? '0.2' : '0.8');
    }
  });

  debug?.onAgentChange((i) => {
    if (i < agents.length) {
      agents[i].crossingTarget = debug.agentConfig(i).crossing ? 1 : 0;
    }
  });

  debug?.onAgentCountChange((count) => {
    setAgentCount(count);
    if (outlineActive) {
      for (const v of views) for (const d of v.dots) d.setAttribute('display', '');
    }
    for (let i = 0; i < agents.length; i++) {
      agents[i].crossingTarget = debug!.agentConfig(i).crossing ? 1 : 0;
    }
  });

  // ── Animation loop ──
  let frameCount = 0;
  const loop = createLoop((dt, time) => {
    frameCount++;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const view = views[i];
      const cfg = debug?.agentConfig(i);

      // Sample flow at agent midpoint
      const midX = (perimeterToXY(agent.pA).x + perimeterToXY(agent.pB).x) / 2;
      const midY = (perimeterToXY(agent.pA).y + perimeterToXY(agent.pB).y) / 2;
      const flowSample = flow.sample(midX / vp.w, midY / vp.h, time);

      updateCurve(agent, dt, cfg?.spreadMax, cfg?.spreadMin);
      const paths = buildPath(agent, flowSample, debug?.flowEffects);
      view.fill.setAttribute('d', paths.fill);
      view.upper.setAttribute('d', paths.upper);
      view.lower.setAttribute('d', paths.lower);

      if (outlineActive) {
        const pts = [
          perimeterToXY(agent.pA - agent.spreadA / 2),
          perimeterToXY(agent.pA + agent.spreadA / 2),
          perimeterToXY(agent.pB - agent.spreadB / 2),
          perimeterToXY(agent.pB + agent.spreadB / 2),
        ];
        for (let j = 0; j < 4; j++) {
          view.dots[j].setAttribute('cx', pts[j].x.toFixed(1));
          view.dots[j].setAttribute('cy', pts[j].y.toFixed(1));
        }
      }
    }

    debug?.set('time', time.toFixed(1) + 's');

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
