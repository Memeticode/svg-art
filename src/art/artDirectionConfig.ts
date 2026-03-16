// ── Art direction config: global tuning knobs for visual style ──

export interface ArtDirectionConfig {
  /** 0..1 — scales down circle radius and fillAlpha */
  perfectClosurePenalty: number;
  /** 0..1 — penalizes symmetric outputs */
  asymmetryBias: number;
  /** Max fraction of 7 circle slots allowed active (0.3 ≈ max 2) */
  circleActivationCap: number;
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
  perfectClosurePenalty: 0.7,
  asymmetryBias: 0.6,
  circleActivationCap: 0.3,
  regionalDialectStrength: 1.5,
  clusterCohesion: 0.6,
  swirlLegibility: 0.6,
  quietBasinStrength: 0.4,
  accentEventRarity: 0.75,
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
