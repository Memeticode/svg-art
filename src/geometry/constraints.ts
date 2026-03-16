// ── Geometry constraints and clamping ──

import type { PrimitiveState } from './primitiveTypes';
import { clamp } from '@/shared/math';

/** Clamp all numeric values to safe ranges, skip invalid primitives */
export function clampPrimitiveState(state: PrimitiveState): PrimitiveState {
  const paths = state.paths.map(p => ({
    ...p,
    strokeWidth: clamp(p.strokeWidth, 0.1, 10),
    opacity: clamp(p.opacity, 0, 1),
    dashArray: p.dashArray.map(v => Math.max(0, v)),
  })) as PrimitiveState['paths'];

  const circles = state.circles.map(c => ({
    ...c,
    cx: clamp(c.cx, -60, 60),
    cy: clamp(c.cy, -60, 60),
    r: clamp(c.r, 0, 50),
    strokeWidth: clamp(c.strokeWidth, 0.1, 10),
    opacity: clamp(c.opacity, 0, 1),
    fillAlpha: clamp(c.fillAlpha, 0, 1),
  })) as PrimitiveState['circles'];

  const ring = {
    ...state.ring,
    cx: clamp(state.ring.cx, -60, 60),
    cy: clamp(state.ring.cy, -60, 60),
    r: clamp(state.ring.r, 0, 50),
    strokeWidth: clamp(state.ring.strokeWidth, 0.1, 10),
    opacity: clamp(state.ring.opacity, 0, 1),
  };

  return { paths, circles, ring };
}
