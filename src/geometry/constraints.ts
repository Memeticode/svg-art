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

  return { paths };
}
