// ── Primitive state factories and defaults ──

import type {
  PathPrimitiveState,
  CirclePrimitiveState,
  RingPrimitiveState,
  PrimitiveState,
} from './primitiveTypes';
import { PATH_SLOT_COUNT, CIRCLE_SLOT_COUNT } from './primitiveTypes';

export function zeroPath(): PathPrimitiveState {
  return {
    active: false,
    d: 'M0 0',
    strokeWidth: 1,
    opacity: 0,
    dashArray: [],
  };
}

export function zeroCircle(): CirclePrimitiveState {
  return {
    active: false,
    cx: 0,
    cy: 0,
    r: 0,
    strokeWidth: 1,
    opacity: 0,
    fillAlpha: 0,
  };
}

export function zeroRing(): RingPrimitiveState {
  return {
    active: false,
    cx: 0,
    cy: 0,
    r: 0,
    strokeWidth: 1,
    opacity: 0,
    gapStart: 0,
    gapEnd: 0,
  };
}

export function zeroPrimitiveState(): PrimitiveState {
  return {
    paths: Array.from({ length: PATH_SLOT_COUNT }, () => zeroPath()) as PrimitiveState['paths'],
    circles: Array.from({ length: CIRCLE_SLOT_COUNT }, () => zeroCircle()) as PrimitiveState['circles'],
    ring: zeroRing(),
  };
}

/** Deep clone a PrimitiveState (no shared references) */
export function clonePrimitiveState(s: PrimitiveState): PrimitiveState {
  return {
    paths: s.paths.map(p => ({ ...p, dashArray: [...p.dashArray] })) as PrimitiveState['paths'],
    circles: s.circles.map(c => ({ ...c })) as PrimitiveState['circles'],
    ring: { ...s.ring },
  };
}
