// ── Primitive state schema: the shared geometric grammar ──
//
// All motifs resolve to this fixed-size structure, enabling stable
// slot-to-slot interpolation between any two states.
//
// Local motif space: coordinates in [-50, 50]
// Slot semantics:
//   paths  0–1: major arcs / primary structural curves
//   paths  2–4: ribs / struts / secondary structure
//   paths  5–7: accents / fine detail
//   circles 0–2: core nodes
//   circles 3–6: orbital / accent dots
//   ring: enclosure / halo

export interface PathPrimitiveState {
  active: boolean;
  d: string;
  strokeWidth: number;
  opacity: number;
  dashArray: number[];
}

export interface CirclePrimitiveState {
  active: boolean;
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  opacity: number;
  fillAlpha: number;
}

export interface RingPrimitiveState {
  active: boolean;
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  opacity: number;
  gapStart: number; // radians
  gapEnd: number;   // radians
}

export interface PrimitiveState {
  paths: [
    PathPrimitiveState, PathPrimitiveState, PathPrimitiveState, PathPrimitiveState,
    PathPrimitiveState, PathPrimitiveState, PathPrimitiveState, PathPrimitiveState,
  ];
  circles: [
    CirclePrimitiveState, CirclePrimitiveState, CirclePrimitiveState,
    CirclePrimitiveState, CirclePrimitiveState, CirclePrimitiveState,
    CirclePrimitiveState,
  ];
  ring: RingPrimitiveState;
}

export const PATH_SLOT_COUNT = 8;
export const CIRCLE_SLOT_COUNT = 7;
