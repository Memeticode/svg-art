// ── Primitive state factories and defaults ──

import type {
  PathPrimitiveState,
  PrimitiveState,
} from './primitiveTypes';
import { PATH_SLOT_COUNT } from './primitiveTypes';

export function zeroPath(): PathPrimitiveState {
  return {
    active: false,
    d: 'M0 0',
    strokeWidth: 1,
    opacity: 0,
    dashArray: [],
  };
}

export function zeroPrimitiveState(): PrimitiveState {
  return {
    paths: Array.from({ length: PATH_SLOT_COUNT }, () => zeroPath()) as PrimitiveState['paths'],
  };
}

/** Deep clone a PrimitiveState (no shared references) */
export function clonePrimitiveState(s: PrimitiveState): PrimitiveState {
  return {
    paths: s.paths.map(p => ({ ...p, dashArray: [...p.dashArray] })) as PrimitiveState['paths'],
  };
}
