// ── Core shared types used across all modules ──

export interface Vec2 {
  x: number;
  y: number;
}

/** Depth band identifiers, back-to-front (ghost = macro field structures) */
export type DepthBandId = 'ghost' | 'back' | 'mid' | 'front';

/** Motif family identifiers */
export type MotifFamilyId =
  | 'scaffoldArm'
  | 'shellFragment'
  | 'spineRibs'
  | 'splitCrescent'
  | 'branchStruts'
  | 'pressureResidue'
  | 'partialEnclosure'
  | 'kinkedSpine'
  | 'climateFront'
  | 'unfoldingFan'
  | 'scatterFragment'
  | 'driftingTendril'
  | 'brokenCrescent'
  | 'splitLobe'
  | 'ribbedSpine'
  | 'interruptedShell'
  | 'knotManifold'
  | 'pressureFragment'
  | 'semiBiologicalScaffold';

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
