// ── Interpolation between PrimitiveState values ──
// Uses Float32Array coords for fast numeric interpolation.
// No regex per frame — coords are pre-parsed at creation time.

import type {
  PrimitiveState,
  PathPrimitiveState,
} from './primitiveTypes';
import { PATH_SLOT_COUNT } from './primitiveTypes';
import { lerp, clamp } from '@/shared/math';
import type { StaggerProfile } from '@/agents/MorphAgent';

/** Interpolate two paths using their pre-parsed coord arrays.
 *  ALWAYS produces valid coords+template — never returns undefined. */
function lerpPath(a: PathPrimitiveState, b: PathPrimitiveState, t: number): PathPrimitiveState {
  const active = t < 0.5 ? a.active : b.active;

  const ac = a.coords;
  const bc = b.coords;

  let coords: Float32Array;
  let template: string;

  if (ac && bc && ac.length === bc.length && ac.length > 0) {
    // Both have coords of same length — interpolate directly
    coords = new Float32Array(ac.length);
    for (let i = 0; i < coords.length; i++) {
      coords[i] = ac[i] + (bc[i] - ac[i]) * t;
    }
    template = (t < 0.5 ? a.template : b.template) || 'M%0 %1';
  } else if (ac && ac.length > 0 && a.template) {
    // Only source has coords — use source
    coords = new Float32Array(ac);
    template = a.template;
  } else if (bc && bc.length > 0 && b.template) {
    // Only target has coords — use target
    coords = new Float32Array(bc);
    template = b.template;
  } else {
    // Neither has coords — use zero fallback
    coords = new Float32Array([0, 0]);
    template = 'M%0 %1';
  }

  // Dash array interpolation
  const dashLen = Math.max(a.dashArray.length, b.dashArray.length);
  let dashArray: number[];
  if (dashLen === 0) {
    dashArray = [];
  } else {
    dashArray = [];
    for (let i = 0; i < dashLen; i++) {
      const va = i < a.dashArray.length ? a.dashArray[i] : 0;
      const vb = i < b.dashArray.length ? b.dashArray[i] : 0;
      dashArray.push(lerp(va, vb, t));
    }
  }

  return {
    active,
    d: '', // rebuilt at render time from coords + template
    coords,
    template,
    strokeWidth: lerp(a.strokeWidth, b.strokeWidth, t),
    opacity: lerp(a.opacity, b.opacity, t),
    dashArray,
  };
}

export function interpolatePrimitiveState(
  a: PrimitiveState,
  b: PrimitiveState,
  t: number,
): PrimitiveState {
  const paths = [] as unknown as PrimitiveState['paths'];
  for (let i = 0; i < PATH_SLOT_COUNT; i++) {
    (paths as PathPrimitiveState[])[i] = lerpPath(a.paths[i], b.paths[i], t);
  }
  return { paths };
}

/** Apply a stagger offset to a global t value. */
function staggerT(globalT: number, offset: number): number {
  return clamp(globalT + offset * (1 - globalT) * globalT * 4, 0, 1);
}

/** Staggered interpolation: each slot morphs at a slightly different rate */
export function staggeredInterpolatePrimitiveState(
  a: PrimitiveState,
  b: PrimitiveState,
  t: number,
  profile: StaggerProfile,
): PrimitiveState {
  const paths = [] as unknown as PrimitiveState['paths'];
  for (let i = 0; i < PATH_SLOT_COUNT; i++) {
    const st = staggerT(t, profile.pathOffsets[i] ?? 0);
    (paths as PathPrimitiveState[])[i] = lerpPath(a.paths[i], b.paths[i], st);
  }
  return { paths };
}
