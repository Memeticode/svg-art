// ── Primitive state factories, defaults, and coord parse/render utilities ──

import type {
  PathPrimitiveState,
  PrimitiveState,
} from './primitiveTypes';
import { PATH_SLOT_COUNT } from './primitiveTypes';

export function zeroPath(): PathPrimitiveState {
  return {
    active: false,
    d: 'M0 0',
    coords: new Float32Array([0, 0]),
    template: 'M%0 %1',
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
    paths: s.paths.map(p => ({
      ...p,
      coords: p.coords ? new Float32Array(p.coords) : undefined,
      dashArray: [...p.dashArray],
    })) as PrimitiveState['paths'],
  };
}

// ── Parse/render utilities for the coords + template system ──

const NUM_RE = /-?\d+\.?\d*/g;

/** Parse a path d-string into a template + Float32Array of coordinates.
 *  Called ONCE at path creation time (not per frame). */
export function parsePathToCoords(d: string): { template: string; coords: Float32Array } {
  const nums: number[] = [];
  let idx = 0;
  const template = d.replace(NUM_RE, (match) => {
    nums.push(parseFloat(match));
    return `%${idx++}`;
  });
  return { template, coords: new Float32Array(nums) };
}

/** Build a d-string from a template + coords array.
 *  Called at render time (once per active path per frame). */
export function renderCoordsToD(template: string, coords: Float32Array): string {
  return template.replace(/%(\d+)/g, (_, idx) => {
    const i = parseInt(idx);
    const v = i < coords.length ? coords[i] : 0;
    if (v !== v) return '0'; // NaN guard
    return Math.abs(v) < 0.01 ? '0' : v.toFixed(2);
  });
}

/** Parse a PathPrimitiveState's d-string into coords + template.
 *  Always re-parses from d — call after any d-string modification. */
export function ensureParsed(p: PathPrimitiveState): PathPrimitiveState {
  if (!p.d || p.d === 'M0 0') {
    return { ...p, coords: new Float32Array([0, 0]), template: 'M%0 %1' };
  }
  const { template, coords } = parsePathToCoords(p.d);
  return { ...p, template, coords };
}

/** Ensure all paths in a PrimitiveState have coords/template parsed. */
export function ensureAllParsed(state: PrimitiveState): PrimitiveState {
  const paths = state.paths.map(p => p.active ? ensureParsed(p) : p) as PrimitiveState['paths'];
  return { paths };
}
