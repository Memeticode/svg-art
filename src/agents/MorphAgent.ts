// ── MorphAgent: mutable per-agent runtime state ──

import type { MotifFamilyId, DepthBandId } from '@/shared/types';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import type { MacroFormType } from '@/art/macroFormFactories';
import type { MotifMemory } from './motifMemory';

export interface MorphAgent {
  id: string;
  alive: boolean;

  // Position in normalized world space [0, 1]
  xNorm: number;
  yNorm: number;

  // Velocity in normalized space per second
  vx: number;
  vy: number;

  heading: number;    // radians
  scale: number;
  rotationDeg: number;
  opacity: number;
  energy: number;     // 0..1, influences visual intensity
  ageSec: number;
  phase: number;      // continuous phase accumulator

  // Morph state
  morphProgress: number;       // 0..1
  morphDurationSec: number;
  sourceState: PrimitiveState;
  targetState: PrimitiveState;
  currentState: PrimitiveState;

  // Identity
  family: MotifFamilyId;
  depthBand: DepthBandId;
  paletteOffset: number;       // 0..1, selects position within palette

  // Cooldown before next morph reseed
  reseedCooldownSec: number;

  // Macro form type (only for ghost agents)
  macroFormType?: MacroFormType;

  // Emphasis pulse: temporary brightness boost
  emphasisTimer: number;

  // Stagger profile for non-uniform morph interpolation
  staggerProfile: StaggerProfile;

  // Structural memory: accumulated field exposure and identity drift
  memory: MotifMemory;
}

/** Per-slot timing offsets for staggered morph interpolation */
export interface StaggerProfile {
  pathOffsets: number[];   // 12 values, range [-0.15, 0.15]
}

/** Render-ready snapshot consumed by the SVG renderer */
export interface AgentRenderSnapshot {
  id: string;
  xPx: number;
  yPx: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  depthBand: DepthBandId;
  primitiveState: PrimitiveState;
  resolvedStroke: string;
  resolvedFill: string;
  resolvedGlow: string;
  /** Gradient bucket index (0-15) for directional climate evidence, or -1 for flat stroke */
  gradientBucket: number;
}
