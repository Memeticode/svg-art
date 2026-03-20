// ── Primitive state schema: the shared geometric grammar ──
//
// All motifs resolve to this fixed-size structure, enabling stable
// slot-to-slot interpolation between any two states.
//
// Local motif space: coordinates in [-50, 50]
// Slot semantics (path-native, no circles):
//   paths  0–1:  contour segments (primary structural curves)
//   paths  2–4:  shell fragments / spine segments
//   paths  5–7:  scaffold arms / puncture marks
//   paths  8–9:  lobe edges / manifold traces
//   paths 10–11: field residue segments

export interface PathPrimitiveState {
  active: boolean;
  d: string;                    // path d-string (set at creation, rebuilt at render time from coords)
  coords?: Float32Array;        // numeric coordinates — populated by ensureAllParsed()
  template?: string;            // command template — populated by ensureAllParsed()
  strokeWidth: number;
  opacity: number;
  dashArray: number[];
}

export interface PrimitiveState {
  paths: [
    PathPrimitiveState, PathPrimitiveState, PathPrimitiveState, PathPrimitiveState,
    PathPrimitiveState, PathPrimitiveState, PathPrimitiveState, PathPrimitiveState,
    PathPrimitiveState, PathPrimitiveState, PathPrimitiveState, PathPrimitiveState,
  ];
}

export const PATH_SLOT_COUNT = 12;
export const TAPER_SEGMENTS = 3;
export const TOTAL_PATH_ELEMENTS = PATH_SLOT_COUNT * TAPER_SEGMENTS; // 36
