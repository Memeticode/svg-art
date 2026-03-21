// Agent SVG view: creates and manages the DOM elements for a single curve agent.

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface AgentView {
  group: SVGGElement;
  fill: SVGPathElement;
  upper: SVGPathElement;
  lower: SVGPathElement;
  dots: SVGCircleElement[];
}

export function createAgentView(parent: SVGElement): AgentView {
  const group = document.createElementNS(SVG_NS, 'g');

  const fill = document.createElementNS(SVG_NS, 'path');
  fill.setAttribute('fill', '#2dd4bf');
  fill.setAttribute('fill-opacity', '0.6');
  fill.setAttribute('stroke', 'none');
  group.appendChild(fill);

  const upper = document.createElementNS(SVG_NS, 'path');
  upper.setAttribute('fill', 'none');
  upper.setAttribute('stroke', '#ef4444');
  upper.setAttribute('stroke-width', '1.5');
  upper.setAttribute('stroke-opacity', '0.8');
  upper.setAttribute('stroke-linecap', 'round');
  group.appendChild(upper);

  const lower = document.createElementNS(SVG_NS, 'path');
  lower.setAttribute('fill', 'none');
  lower.setAttribute('stroke', '#3b82f6');
  lower.setAttribute('stroke-width', '1.5');
  lower.setAttribute('stroke-opacity', '0.8');
  lower.setAttribute('stroke-linecap', 'round');
  group.appendChild(lower);

  const dots: SVGCircleElement[] = [];
  for (let i = 0; i < 4; i++) {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '6');
    dot.setAttribute('fill', '#2dd4bf');
    dot.setAttribute('fill-opacity', '0.8');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '2');
    dot.setAttribute('stroke-opacity', '0.5');
    dot.setAttribute('display', 'none');
    group.appendChild(dot);
    dots.push(dot);
  }

  parent.appendChild(group);
  return { group, fill, upper, lower, dots };
}

export function removeAgentView(view: AgentView) {
  view.group.remove();
}
