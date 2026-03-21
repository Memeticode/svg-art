// Flow overlay: visualizes flow field components as colored arrows.
// All components share the same visual language (arrow = angle × magnitude).

import type { FlowField } from '../flow';
import type { FlowComponent, FlowVector } from '../schema';
import { vp } from '../viewport';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Visual style per component
const COMPONENT_STYLE: Record<FlowComponent, { stroke: string; fill: string }> = {
  direction:   { stroke: '#2dd4bf', fill: '#2dd4bf' },
  curl:        { stroke: '#a78bfa', fill: '#a78bfa' },
  compression: { stroke: '#f87171', fill: '#f87171' },
};

function drawArrow(
  group: SVGGElement,
  cx: number, cy: number,
  vec: FlowVector,
  cellMin: number,
  style: { stroke: string; fill: string },
) {
  if (vec.magnitude < 0.02) return;

  const arrowLen = cellMin * 0.35 * vec.magnitude;
  const ex = cx + Math.cos(vec.angle) * arrowLen;
  const ey = cy + Math.sin(vec.angle) * arrowLen;

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', cx.toFixed(1));
  line.setAttribute('y1', cy.toFixed(1));
  line.setAttribute('x2', ex.toFixed(1));
  line.setAttribute('y2', ey.toFixed(1));
  line.setAttribute('stroke', style.stroke);
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-opacity', '0.5');
  group.appendChild(line);

  const dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', ex.toFixed(1));
  dot.setAttribute('cy', ey.toFixed(1));
  dot.setAttribute('r', '2');
  dot.setAttribute('fill', style.fill);
  dot.setAttribute('fill-opacity', '0.6');
  group.appendChild(dot);
}

export function renderFlowOverlay(
  group: SVGGElement,
  flow: FlowField,
  time: number,
  gridSize: number,
  components: Set<FlowComponent>,
) {
  while (group.firstChild) group.removeChild(group.firstChild);
  const cellW = vp.w / gridSize;
  const cellH = vp.h / gridSize;
  const cellMin = Math.min(cellW, cellH);

  for (let gx = 0; gx < gridSize; gx++) {
    for (let gy = 0; gy < gridSize; gy++) {
      const cx = (gx + 0.5) * cellW;
      const cy = (gy + 0.5) * cellH;
      const f = flow.sample(cx / vp.w, cy / vp.h, time);

      if (components.has('direction')) {
        drawArrow(group, cx, cy, f.direction, cellMin, COMPONENT_STYLE.direction);
      }
      if (components.has('curl')) {
        drawArrow(group, cx, cy, f.curl, cellMin, COMPONENT_STYLE.curl);
      }
      if (components.has('compression')) {
        drawArrow(group, cx, cy, f.compression, cellMin, COMPONENT_STYLE.compression);
      }
    }
  }
}
