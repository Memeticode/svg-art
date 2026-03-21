// Agent SVG view: creates and manages the DOM elements for a single stroke agent.
// Each agent always has exactly 2 lines (ribbon edges) and a fill.

const SVG_NS = 'http://www.w3.org/2000/svg';

export const LINE_COLORS = ['#ef4444', '#3b82f6', '#2dd4bf', '#f59e0b', '#a78bfa'];

export interface AgentView {
  group: SVGGElement;
  fill: SVGPathElement;
  lines: SVGPathElement[];
}

export function createAgentView(parent: SVGElement): AgentView {
  const group = document.createElementNS(SVG_NS, 'g');

  const fill = document.createElementNS(SVG_NS, 'path');
  fill.setAttribute('fill', '#2dd4bf');
  fill.setAttribute('fill-opacity', '0.6');
  fill.setAttribute('stroke', 'none');
  group.appendChild(fill);

  const lines: SVGPathElement[] = [];
  for (let i = 0; i < 2; i++) {
    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', LINE_COLORS[i % LINE_COLORS.length]);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-opacity', '0.8');
    line.setAttribute('stroke-linecap', 'round');
    group.appendChild(line);
    lines.push(line);
  }

  parent.appendChild(group);
  return { group, fill, lines };
}

export function removeAgentView(view: AgentView) {
  view.group.remove();
}
