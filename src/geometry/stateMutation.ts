// ── Micro-deformation: subtle per-frame jitter to suggest life ──

import type { PrimitiveState } from './primitiveTypes';
import { clamp } from '@/shared/math';

export interface DeformContext {
  turbulence: number; // 0..1 from flow field
  phase: number;      // agent phase
  intensity: number;  // overall deform strength (keep small: 0.5–2.0)
}

/** Apply tiny deformations to a state snapshot — never destructive */
export function applyMicroDeform(
  state: PrimitiveState,
  ctx: DeformContext,
): PrimitiveState {
  const { turbulence, phase, intensity } = ctx;
  const jitter = turbulence * intensity;

  // Deform circle positions and radii slightly
  const circles = state.circles.map((c, i) => {
    if (!c.active) return c;
    const offset = Math.sin(phase * 2.3 + i * 1.7) * jitter * 1.5;
    const rOff = Math.cos(phase * 1.9 + i * 2.1) * jitter * 0.5;
    return {
      ...c,
      cx: c.cx + offset,
      cy: c.cy + Math.cos(phase * 1.8 + i * 2.5) * jitter * 1.5,
      r: clamp(c.r + rOff, 0.1, 50),
    };
  }) as PrimitiveState['circles'];

  // Deform ring slightly
  const ring = state.ring.active
    ? {
        ...state.ring,
        r: clamp(
          state.ring.r + Math.sin(phase * 1.5) * jitter * 0.8,
          0.1,
          50,
        ),
        gapStart: state.ring.gapStart + Math.sin(phase * 0.7) * jitter * 0.05,
        gapEnd: state.ring.gapEnd + Math.cos(phase * 0.9) * jitter * 0.05,
      }
    : state.ring;

  // Deform path data numerics slightly
  const paths = state.paths.map((p, i) => {
    if (!p.active) return p;
    const pathJitter = jitter * 0.8;
    const d = p.d.replace(/-?\d+\.?\d*/g, (match, offset) => {
      const v = parseFloat(match);
      const wobble = Math.sin(phase * 2.1 + i * 3.7 + offset * 0.13) * pathJitter;
      return (v + wobble).toFixed(2);
    });
    return { ...p, d };
  }) as PrimitiveState['paths'];

  return { paths, circles, ring };
}
