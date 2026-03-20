// App: one curve between two screen edges, shaped by a flow field

import { createRng } from './rng';
import { createFlowField } from './flow';
import { createCurve, updateCurve, buildPath, perimeterToXY, W, H } from './curve';
import { createLoop } from './loop';
import { initDebug } from './debug';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OUTLINE_MARGIN = 24; // px gap around SVG when outline is visible

export function createApp(seed: string) {
  const rng = createRng(seed);
  const flow = createFlowField(rng.fork('flow'));
  const agent = createCurve(rng.fork('agent'));
  const debug = initDebug();

  debug?.set('seed', seed);

  // Wrapper div — controls sizing and border for outline mode
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;transition:all 0.3s ease';

  // SVG fills its wrapper completely
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'display:block;width:100%;height:100%';

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(W));
  bg.setAttribute('height', String(H));
  bg.setAttribute('fill', '#0a0a0f');
  svg.appendChild(bg);

  // Fill shape
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', '#2dd4bf');
  path.setAttribute('fill-opacity', '0.6');
  path.setAttribute('stroke', 'none');
  svg.appendChild(path);

  // Edge borders: upper = red, lower = blue
  const upperEdge = document.createElementNS(SVG_NS, 'path');
  upperEdge.setAttribute('fill', 'none');
  upperEdge.setAttribute('stroke', '#ef4444');
  upperEdge.setAttribute('stroke-width', '1.5');
  upperEdge.setAttribute('stroke-opacity', '0.8');
  upperEdge.setAttribute('stroke-linecap', 'round');
  svg.appendChild(upperEdge);

  const lowerEdge = document.createElementNS(SVG_NS, 'path');
  lowerEdge.setAttribute('fill', 'none');
  lowerEdge.setAttribute('stroke', '#3b82f6');
  lowerEdge.setAttribute('stroke-width', '1.5');
  lowerEdge.setAttribute('stroke-opacity', '0.8');
  lowerEdge.setAttribute('stroke-linecap', 'round');
  svg.appendChild(lowerEdge);

  // Outline elements — visible when debug panel is open
  const border = document.createElementNS(SVG_NS, 'rect');
  border.setAttribute('x', '0');
  border.setAttribute('y', '0');
  border.setAttribute('width', String(W));
  border.setAttribute('height', String(H));
  border.setAttribute('fill', 'none');
  border.setAttribute('stroke', '#2dd4bf');
  border.setAttribute('stroke-width', '3');
  border.setAttribute('stroke-opacity', '0.5');
  border.setAttribute('display', 'none');
  svg.appendChild(border);

  // 4 dots: a1, a2 (pair at end A), b1, b2 (pair at end B)
  const dots = Array.from({ length: 4 }, () => {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '6');
    dot.setAttribute('fill', '#2dd4bf');
    dot.setAttribute('fill-opacity', '0.8');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '2');
    dot.setAttribute('stroke-opacity', '0.5');
    dot.setAttribute('display', 'none');
    svg.appendChild(dot);
    return dot;
  });

  // Flow field overlay — grid of arrows, hidden until toggled
  const flowGroup = document.createElementNS(SVG_NS, 'g');
  flowGroup.setAttribute('display', 'none');
  svg.appendChild(flowGroup);

  wrapper.appendChild(svg);
  document.body.appendChild(wrapper);

  // Layout: debug visible → shrink SVG, show outline, make room for panel
  let outlineActive = false;

  function setDebugLayout(visible: boolean) {
    outlineActive = visible;
    if (visible) {
      const pw = debug?.panelWidth ?? 220;
      const m = OUTLINE_MARGIN;
      wrapper.style.top = `${m}px`;
      wrapper.style.left = `${m}px`;
      wrapper.style.width = `calc(100% - ${pw + m * 2}px)`;
      wrapper.style.height = `calc(100% - ${m * 2}px)`;
      wrapper.style.border = '1px solid rgba(45, 212, 191, 0.3)';
      wrapper.style.borderRadius = '4px';
      border.setAttribute('display', '');
      for (const d of dots) d.setAttribute('display', '');
    } else {
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.border = 'none';
      wrapper.style.borderRadius = '0';
      border.setAttribute('display', 'none');
      for (const d of dots) d.setAttribute('display', 'none');
    }
  }

  debug?.onVisibilityChange(setDebugLayout);

  // Flow overlay toggle — dims curve and shows flow arrows
  let flowActive = false;
  const FLOW_GRID = 16; // number of arrows per axis

  function setFlowOverlay(active: boolean) {
    flowActive = active;
    flowGroup.setAttribute('display', active ? '' : 'none');
    path.setAttribute('fill-opacity', active ? '0.15' : '0.6');
    upperEdge.setAttribute('stroke-opacity', active ? '0.2' : '0.8');
    lowerEdge.setAttribute('stroke-opacity', active ? '0.2' : '0.8');
  }

  debug?.onFlowChange(setFlowOverlay);

  // Agent config changes (crossing, stroke width)
  debug?.onAgentChange((_index) => {
    const cfg = debug.agentConfig(0);
    agent.crossingTarget = cfg.crossing ? 1 : 0;
  });

  // Playback controls (wired after loop creation below via closure)

  function renderFlowArrows(time: number) {
    // Clear previous arrows
    while (flowGroup.firstChild) flowGroup.removeChild(flowGroup.firstChild);

    const cellW = W / FLOW_GRID;
    const cellH = H / FLOW_GRID;

    for (let gx = 0; gx < FLOW_GRID; gx++) {
      for (let gy = 0; gy < FLOW_GRID; gy++) {
        const cx = (gx + 0.5) * cellW;
        const cy = (gy + 0.5) * cellH;
        const xNorm = cx / W;
        const yNorm = cy / H;

        const f = flow.sample(xNorm, yNorm, time);
        const arrowLen = Math.min(cellW, cellH) * 0.35 * f.magnitude;

        const ex = cx + Math.cos(f.angle) * arrowLen;
        const ey = cy + Math.sin(f.angle) * arrowLen;

        // Arrow line
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', cx.toFixed(1));
        line.setAttribute('y1', cy.toFixed(1));
        line.setAttribute('x2', ex.toFixed(1));
        line.setAttribute('y2', ey.toFixed(1));
        line.setAttribute('stroke', '#2dd4bf');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-opacity', '0.5');
        flowGroup.appendChild(line);

        // Arrow head dot
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', ex.toFixed(1));
        dot.setAttribute('cy', ey.toFixed(1));
        dot.setAttribute('r', '2.5');
        dot.setAttribute('fill', '#2dd4bf');
        dot.setAttribute('fill-opacity', '0.6');
        flowGroup.appendChild(dot);
      }
    }
  }

  // Loop
  let frameCount = 0;
  const loop = createLoop((dt, time) => {
    frameCount++;
    const cfg = debug?.agentConfig(0);
    updateCurve(agent, dt, cfg?.spreadMax, cfg?.spreadMin);
    const paths = buildPath(agent, flow, time);
    path.setAttribute('d', paths.fill);
    upperEdge.setAttribute('d', paths.upper);
    lowerEdge.setAttribute('d', paths.lower);
    debug?.set('time', time.toFixed(1) + 's');

    // Update flow arrows every 6 frames (~10fps) to avoid DOM churn
    if (flowActive && frameCount % 6 === 0) {
      renderFlowArrows(time);
    }

    if (outlineActive) {
      const pts = [
        perimeterToXY(agent.pA - agent.spreadA / 2),
        perimeterToXY(agent.pA + agent.spreadA / 2),
        perimeterToXY(agent.pB - agent.spreadB / 2),
        perimeterToXY(agent.pB + agent.spreadB / 2),
      ];
      for (let i = 0; i < 4; i++) {
        dots[i].setAttribute('cx', pts[i].x.toFixed(1));
        dots[i].setAttribute('cy', pts[i].y.toFixed(1));
      }
    }
  });

  // Playback controls
  debug?.onPause(() => loop.pause());
  debug?.onResume(() => loop.resume());
  debug?.onSeek((t) => loop.seekTo(t));

  loop.start();
  return { stop: loop.stop, destroy() { loop.stop(); wrapper.remove(); } };
}
