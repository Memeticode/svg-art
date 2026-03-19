// ── SvgAgentRenderer: applies AgentRenderSnapshots to pooled SVG nodes ──
// Renders each path as tapered multi-segment strokes (thick → thin).

import type { AgentRenderSnapshot } from '@/agents/MorphAgent';
import type { DepthBandId } from '@/shared/types';
import type { SvgScene } from './SvgScene';
import type { SvgPool, PooledAgentNode } from './SvgPool';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { PATH_SLOT_COUNT, CIRCLE_SLOT_COUNT, TAPER_SEGMENTS } from '@/geometry/primitiveTypes';
import { samplePathPoints } from '@/geometry/pathHelpers';

// Taper profile: stroke-width multiplier per segment (thick → thin)
const TAPER_WIDTH = [1.0, 0.5, 0.18];
// Opacity multiplier per segment (full → fading)
const TAPER_OPACITY = [1.0, 0.7, 0.35];

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

      node.group.removeAttribute('display');

      node.group.setAttribute(
        'transform',
        `translate(${snap.xPx.toFixed(1)},${snap.yPx.toFixed(1)}) ` +
        `rotate(${snap.rotationDeg.toFixed(1)}) ` +
        `scale(${snap.scale.toFixed(3)})`,
      );
      node.group.setAttribute('opacity', snap.opacity.toFixed(3));

      applyGlowFilter(node, snap.depthBand, snap.opacity);
      applyPrimitiveState(node, snap.primitiveState, snap.resolvedStroke, snap.resolvedFill);
    }

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
    // Paths — rendered as layered strokes for taper effect
    // Each path is drawn 3 times: thick/bright, medium, thin/faint
    // The overlapping layers with round linecaps create a natural tapered feel
    for (let i = 0; i < PATH_SLOT_COUNT; i++) {
      const p = state.paths[i];
      const baseElIdx = i * TAPER_SEGMENTS;

      if (!p.active) {
        for (let s = 0; s < TAPER_SEGMENTS; s++) {
          node.paths[baseElIdx + s].setAttribute('display', 'none');
        }
        continue;
      }

      const baseWidth = Math.max(1.0, p.strokeWidth * 1.8);
      for (let s = 0; s < TAPER_SEGMENTS; s++) {
        const el = node.paths[baseElIdx + s];
        el.removeAttribute('display');
        el.setAttribute('d', p.d);
        el.setAttribute('stroke', stroke);
        el.setAttribute('stroke-width', (baseWidth * TAPER_WIDTH[s]).toFixed(2));
        el.setAttribute('opacity', (p.opacity * TAPER_OPACITY[s]).toFixed(3));
      }
    }

    // Circles (mostly inactive per no-circle doctrine)
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

    // Ring (inactive per no-circle doctrine)
    const ring = state.ring;
    if (!ring.active) {
      node.ringPath.setAttribute('display', 'none');
    } else {
      node.ringPath.removeAttribute('display');
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
        if (opacity > 0.10) filterId = 'glow-subtle';
        break;
      case 'mid':
        if (opacity > 0.35) filterId = 'glow-medium';
        else if (opacity > 0.20) filterId = 'glow-subtle';
        break;
      case 'front':
        if (opacity > 0.55) filterId = 'glow-bright';
        else if (opacity > 0.40) filterId = 'glow-medium';
        else if (opacity > 0.25) filterId = 'glow-subtle';
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
