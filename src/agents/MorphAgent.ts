// ── MorphAgent: mutable per-agent runtime state ──

import type { MotifFamilyId, DepthBandId } from '@/shared/types';
import type { PrimitiveState } from '@/geometry/primitiveTypes';

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
}
