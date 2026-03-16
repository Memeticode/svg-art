// ── Interpolation between PrimitiveState values ──
//
// Core rule: motif families must produce compatible path command formats
// per slot, so numeric interpolation of path data strings is feasible.

import type {
  PrimitiveState,
  PathPrimitiveState,
  CirclePrimitiveState,
  RingPrimitiveState,
} from './primitiveTypes';
import { PATH_SLOT_COUNT, CIRCLE_SLOT_COUNT } from './primitiveTypes';
import { lerp, clamp } from '@/shared/math';
import type { StaggerProfile } from '@/agents/MorphAgent';

/** Interpolate two path `d` strings that share the same command structure.
 *  Falls back to source or target if structures don't match. */
function lerpPathD(a: string, b: string, t: number): string {
  // Extract all numbers from both strings
  const numsA = a.match(/-?\d+\.?\d*/g);
  const numsB = b.match(/-?\d+\.?\d*/g);

  if (!numsA || !numsB || numsA.length !== numsB.length) {
    // Incompatible structures — snap at halfway
    return t < 0.5 ? a : b;
  }

  let idx = 0;
  return a.replace(/-?\d+\.?\d*/g, () => {
    const va = parseFloat(numsA[idx]);
    const vb = parseFloat(numsB[idx]);
    idx++;
    const result = lerp(va, vb, t);
    return Math.abs(result) < 0.01 ? '0' : result.toFixed(2);
  });
}

function lerpDashArray(a: number[], b: number[], t: number): number[] {
  const len = Math.max(a.length, b.length);
  if (len === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < len; i++) {
    const va = i < a.length ? a[i] : 0;
    const vb = i < b.length ? b[i] : 0;
    result.push(lerp(va, vb, t));
  }
  return result;
}

function lerpPath(a: PathPrimitiveState, b: PathPrimitiveState, t: number): PathPrimitiveState {
  return {
    active: t < 0.5 ? a.active : b.active,
    d: lerpPathD(a.d, b.d, t),
    strokeWidth: lerp(a.strokeWidth, b.strokeWidth, t),
    opacity: lerp(a.opacity, b.opacity, t),
    dashArray: lerpDashArray(a.dashArray, b.dashArray, t),
  };
}

function lerpCircle(
  a: CirclePrimitiveState,
  b: CirclePrimitiveState,
  t: number,
): CirclePrimitiveState {
  return {
    active: t < 0.5 ? a.active : b.active,
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    r: lerp(a.r, b.r, t),
    strokeWidth: lerp(a.strokeWidth, b.strokeWidth, t),
    opacity: lerp(a.opacity, b.opacity, t),
    fillAlpha: lerp(a.fillAlpha, b.fillAlpha, t),
  };
}

function lerpRing(a: RingPrimitiveState, b: RingPrimitiveState, t: number): RingPrimitiveState {
  return {
    active: t < 0.5 ? a.active : b.active,
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    r: lerp(a.r, b.r, t),
    strokeWidth: lerp(a.strokeWidth, b.strokeWidth, t),
    opacity: lerp(a.opacity, b.opacity, t),
    gapStart: lerp(a.gapStart, b.gapStart, t),
    gapEnd: lerp(a.gapEnd, b.gapEnd, t),
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

  const circles = [] as unknown as PrimitiveState['circles'];
  for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
    (circles as CirclePrimitiveState[])[i] = lerpCircle(a.circles[i], b.circles[i], t);
  }

  return {
    paths,
    circles,
    ring: lerpRing(a.ring, b.ring, t),
  };
}

/** Apply a stagger offset to a global t value.
 *  The parabolic window (1-t)*t*4 makes stagger strongest at mid-morph,
 *  preventing artifacts at endpoints. */
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

  const circles = [] as unknown as PrimitiveState['circles'];
  for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
    const st = staggerT(t, profile.circleOffsets[i] ?? 0);
    (circles as CirclePrimitiveState[])[i] = lerpCircle(a.circles[i], b.circles[i], st);
  }

  return {
    paths,
    circles,
    ring: lerpRing(a.ring, b.ring, staggerT(t, profile.ringOffset)),
  };
}
