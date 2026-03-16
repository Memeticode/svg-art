// ── Core shared types used across all modules ──

export interface Vec2 {
  x: number;
  y: number;
}

/** Depth band identifiers, back-to-front */
export type DepthBandId = 'back' | 'mid' | 'front';

/** Motif family identifiers */
export type MotifFamilyId =
  | 'radialCluster'
  | 'interruptedHalo'
  | 'spineRibs'
  | 'splitCrescent'
  | 'branchStruts'
  | 'orbitalNodes'
  | 'partialEnclosure';

/** Resolved color pair for an agent */
export interface ResolvedColorway {
  stroke: string;
  fill: string;
  glow: string;
}

/** Viewport dimensions in pixels */
export interface Viewport {
  width: number;
  height: number;
}
