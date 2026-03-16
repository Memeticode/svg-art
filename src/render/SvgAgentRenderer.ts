// ── SvgAgentRenderer: applies AgentRenderSnapshots to pooled SVG nodes ──

import type { AgentRenderSnapshot } from '@/agents/MorphAgent';
import type { DepthBandId } from '@/shared/types';
import type { SvgScene } from './SvgScene';
import type { SvgPool, PooledAgentNode } from './SvgPool';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { PATH_SLOT_COUNT, CIRCLE_SLOT_COUNT } from '@/geometry/primitiveTypes';
import { ringPath as buildRingPath } from '@/geometry/pathHelpers';

export interface SvgAgentRenderer {
  render(snapshots: AgentRenderSnapshot[]): void;
  destroy(): void;
}

export function createSvgAgentRenderer(
  scene: SvgScene,
  pool: SvgPool,
): SvgAgentRenderer {
  const activeIds = new Set<string>();

  function render(snapshots: AgentRenderSnapshot[]): void {
    const currentIds = new Set<string>();

    for (const snap of snapshots) {
      currentIds.add(snap.id);
      const parentGroup = scene.layers[snap.depthBand];
      const node = pool.acquire(snap.id, parentGroup);

      // Ensure visible
      node.group.removeAttribute('display');

      // Set group transform and opacity
      node.group.setAttribute(
        'transform',
        `translate(${snap.xPx.toFixed(1)},${snap.yPx.toFixed(1)}) ` +
        `rotate(${snap.rotationDeg.toFixed(1)}) ` +
        `scale(${snap.scale.toFixed(3)})`,
      );
      node.group.setAttribute('opacity', snap.opacity.toFixed(3));

      // Apply glow filter based on depth band × opacity thresholds
      applyGlowFilter(node, snap.depthBand, snap.opacity);

      // Apply primitive state to SVG elements
      applyPrimitiveState(node, snap.primitiveState, snap.resolvedStroke, snap.resolvedFill);
    }

    // Release nodes for agents that are no longer in the snapshot set
    for (const prevId of activeIds) {
      if (!currentIds.has(prevId)) {
        const node = pool.getNode(prevId);
        if (node) pool.release(node);
      }
    }

    activeIds.clear();
    for (const id of currentIds) activeIds.add(id);
  }

  function applyPrimitiveState(
    node: PooledAgentNode,
    state: PrimitiveState,
    stroke: string,
    fill: string,
  ): void {
    // Paths
    for (let i = 0; i < PATH_SLOT_COUNT; i++) {
      const p = state.paths[i];
      const el = node.paths[i];
      if (!p.active) {
        el.setAttribute('display', 'none');
        continue;
      }
      el.removeAttribute('display');
      el.setAttribute('d', p.d);
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', p.strokeWidth.toFixed(2));
      el.setAttribute('opacity', p.opacity.toFixed(3));
      if (p.dashArray.length > 0) {
        el.setAttribute('stroke-dasharray', p.dashArray.map(v => v.toFixed(1)).join(' '));
      } else {
        el.removeAttribute('stroke-dasharray');
      }
    }

    // Circles
    for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
      const c = state.circles[i];
      const el = node.circles[i];
      if (!c.active) {
        el.setAttribute('display', 'none');
        continue;
      }
      el.removeAttribute('display');
      el.setAttribute('cx', c.cx.toFixed(2));
      el.setAttribute('cy', c.cy.toFixed(2));
      el.setAttribute('r', Math.max(0.1, c.r).toFixed(2));
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', c.strokeWidth.toFixed(2));
      el.setAttribute('opacity', c.opacity.toFixed(3));
      if (c.fillAlpha > 0.01) {
        el.setAttribute('fill', fill);
        el.setAttribute('fill-opacity', c.fillAlpha.toFixed(3));
      } else {
        el.setAttribute('fill', 'none');
        el.removeAttribute('fill-opacity');
      }
    }

    // Ring
    const ring = state.ring;
    if (!ring.active) {
      node.ringPath.setAttribute('display', 'none');
    } else {
      node.ringPath.removeAttribute('display');
      const d = buildRingPath(ring.cx, ring.cy, ring.r, ring.gapStart, ring.gapEnd);
      node.ringPath.setAttribute('d', d);
      node.ringPath.setAttribute('stroke', stroke);
      node.ringPath.setAttribute('stroke-width', ring.strokeWidth.toFixed(2));
      node.ringPath.setAttribute('opacity', ring.opacity.toFixed(3));
    }
  }

  function applyGlowFilter(node: PooledAgentNode, band: DepthBandId, opacity: number): void {
    let filterId: string | null = null;

    switch (band) {
      case 'ghost':
        filterId = 'glow-subtle';
        break;
      case 'back':
        if (opacity > 0.15) filterId = 'glow-subtle';
        break;
      case 'mid':
        if (opacity > 0.45) filterId = 'glow-medium';
        else if (opacity > 0.35) filterId = 'glow-subtle';
        break;
      case 'front':
        if (opacity > 0.65) filterId = 'glow-bright';
        else if (opacity > 0.55) filterId = 'glow-medium';
        break;
    }

    if (filterId) {
      node.group.setAttribute('filter', `url(#${filterId})`);
    } else {
      node.group.removeAttribute('filter');
    }
  }

  function destroy(): void {
    pool.destroy();
  }

  return { render, destroy };
}
