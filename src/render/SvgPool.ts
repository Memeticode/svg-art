// ── SvgPool: preallocates and reuses SVG group nodes for agents ──

import { TOTAL_PATH_ELEMENTS, CIRCLE_SLOT_COUNT } from '@/geometry/primitiveTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface PooledAgentNode {
  group: SVGGElement;
  paths: SVGPathElement[];
  circles: SVGCircleElement[];
  ringPath: SVGPathElement;
  assignedTo: string | null;
}

export interface SvgPool {
  acquire(agentId: string, parentGroup: SVGGElement): PooledAgentNode;
  release(node: PooledAgentNode): void;
  getNode(agentId: string): PooledAgentNode | undefined;
  destroy(): void;
}

function createAgentGroup(): PooledAgentNode {
  const group = document.createElementNS(SVG_NS, 'g');
  group.style.willChange = 'transform, opacity';

  const paths: SVGPathElement[] = [];
  for (let i = 0; i < TOTAL_PATH_ELEMENTS; i++) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke-linecap', 'round');
    group.appendChild(p);
    paths.push(p);
  }

  const circles: SVGCircleElement[] = [];
  for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('fill', 'none');
    group.appendChild(c);
    circles.push(c);
  }

  const ringPath = document.createElementNS(SVG_NS, 'path');
  ringPath.setAttribute('fill', 'none');
  group.appendChild(ringPath);

  return { group, paths, circles, ringPath, assignedTo: null };
}

export function createSvgPool(): SvgPool {
  const active = new Map<string, PooledAgentNode>();
  const free: PooledAgentNode[] = [];

  function acquire(agentId: string, parentGroup: SVGGElement): PooledAgentNode {
    // Check if already assigned
    const existing = active.get(agentId);
    if (existing) return existing;

    // Reuse a free node or create a new one
    let node: PooledAgentNode;
    if (free.length > 0) {
      node = free.pop()!;
    } else {
      node = createAgentGroup();
    }

    node.assignedTo = agentId;
    active.set(agentId, node);

    // Append to parent if not already there
    if (node.group.parentNode !== parentGroup) {
      parentGroup.appendChild(node.group);
    }

    return node;
  }

  function release(node: PooledAgentNode): void {
    if (node.assignedTo) {
      active.delete(node.assignedTo);
    }
    node.assignedTo = null;
    // Hide instead of remove to avoid DOM churn
    node.group.setAttribute('display', 'none');
    free.push(node);
  }

  function getNode(agentId: string): PooledAgentNode | undefined {
    return active.get(agentId);
  }

  function destroy(): void {
    for (const node of active.values()) {
      node.group.remove();
    }
    for (const node of free) {
      node.group.remove();
    }
    active.clear();
    free.length = 0;
  }

  return { acquire, release, getNode, destroy };
}
