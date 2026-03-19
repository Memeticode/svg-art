// ── Art direction config: global tuning knobs for visual style ──

export interface ArtDirectionConfig {
  /** 0..1 — controls how aggressively near-closure paths are broken */
  closureBreakStrength: number;
  /** 0..1 — penalizes symmetric outputs */
  asymmetryBias: number;
  /** Max arc sweep fraction of TAU before forced split (0.0 = no full arcs allowed) */
  arcClosureCap: number;
  /** Multiplier on region signal influence for family selection */
  regionalDialectStrength: number;
  /** Neighbor family echo strength */
  clusterCohesion: number;
  /** Curl visualization multiplier */
  swirlLegibility: number;
  /** Opacity suppression in low-activity zones */
  quietBasinStrength: number;
  /** Emphasis pulse energy threshold */
  accentEventRarity: number;
  /** Ghost band macro factory usage (0..1) */
  macroFieldPresence: number;
  /** Morph inertia / subpart timing spread */
  deformationLag: number;
  /** Readability score above which destabilization kicks in (0..1) */
  antiIconThreshold: number;
  /** Expected time for motif to drift significantly (seconds) */
  identityHalfLife: number;
  /** How fast closureFatigue accumulates (0..1) */
  closureFatigueRate: number;
  /** Global multiplier on all target drift (0..1) */
  targetDriftStrength: number;
  /** How fast accumulated memory fades (0..1) */
  memoryDecayRate: number;
  /** Morph progress at which soft reseed triggers (0..1) */
  softReseedThreshold: number;
}

export const DEFAULT_ART_DIRECTION: ArtDirectionConfig = {
  closureBreakStrength: 1.0,
  asymmetryBias: 0.6,
  arcClosureCap: 0.0,
  regionalDialectStrength: 2.0,
  clusterCohesion: 0.6,
  swirlLegibility: 0.6,
  quietBasinStrength: 0.2,
  accentEventRarity: 0.55,
  macroFieldPresence: 0.9,
  deformationLag: 0.5,
  antiIconThreshold: 0.45,
  identityHalfLife: 8,
  closureFatigueRate: 0.3,
  targetDriftStrength: 0.6,
  memoryDecayRate: 0.002,
  softReseedThreshold: 0.85,
};

export function resolveArtDirection(
  overrides?: Partial<ArtDirectionConfig>,
): ArtDirectionConfig {
  if (!overrides) return DEFAULT_ART_DIRECTION;
  return { ...DEFAULT_ART_DIRECTION, ...overrides };
}
