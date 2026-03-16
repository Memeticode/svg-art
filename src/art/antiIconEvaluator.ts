// ── Anti-icon evaluator: prevent motifs from stabilizing into icons ──

import type { PrimitiveState } from '@/geometry/primitiveTypes';
import type { MotifMemory } from '@/agents/motifMemory';
import type { ArtDirectionConfig } from './artDirectionConfig';
import { clamp } from '@/shared/math';

export interface IconScore {
  closureScore: number;       // 0..1, how closed/circular the motif appears
  symmetryScore: number;      // 0..1, how balanced around center
  readabilityScore: number;   // 0..1, combined legibility metric
  stabilityDuration: number;  // seconds from memory.persistenceAge
}

export interface DestabilizationImpulse {
  circleRadiusDelta: number[];    // 7 values (usually negative)
  ringGapDelta: number;           // widens gap (positive)
  pathNoiseIntensity: number;     // 0..3, control point jitter
  forceAngle: number;             // perpendicular to dominant force (shearing)
  forceStrength: number;          // 0..1
  opacityPressure: number;        // -0.2..0
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function evaluateIconScore(
  state: PrimitiveState,
  memory: MotifMemory,
): IconScore {
  // Closure score: count active circles with significant radius + ring tightness
  let circlePresence = 0;
  for (let i = 0; i < 7; i++) {
    const c = state.circles[i];
    if (c.active && c.r > 3) {
      circlePresence += 0.15 + c.fillAlpha * 0.1;
    }
  }
  const ringTightness = state.ring.active
    ? Math.max(0, 1 - (state.ring.gapEnd - state.ring.gapStart) / Math.PI) * 0.3
    : 0;
  const closureScore = clamp(circlePresence + ringTightness, 0, 1);

  // Symmetry score: center-of-mass proximity to origin + quadrant balance
  let comX = 0, comY = 0, count = 0;
  let qCounts = [0, 0, 0, 0]; // quadrant counts
  for (let i = 0; i < 7; i++) {
    const c = state.circles[i];
    if (!c.active) continue;
    comX += c.cx;
    comY += c.cy;
    count++;
    const q = (c.cx >= 0 ? 0 : 1) + (c.cy >= 0 ? 0 : 2);
    qCounts[q]++;
  }
  if (count > 0) {
    comX /= count;
    comY /= count;
  }
  const comDist = Math.sqrt(comX * comX + comY * comY);
  const centeredness = Math.max(0, 1 - comDist / 20); // within 20 units of origin = centered
  const maxQ = Math.max(...qCounts);
  const minQ = Math.min(...qCounts);
  const balance = count > 2 ? 1 - (maxQ - minQ) / count : 0.5;
  const symmetryScore = clamp(centeredness * 0.6 + balance * 0.4, 0, 1);

  // Readability: weighted combination + time-based persistence factor
  const persistenceFactor = smoothstep(3, 12, memory.persistenceAge);
  const readabilityScore = clamp(
    closureScore * 0.4 + symmetryScore * 0.3 + persistenceFactor * 0.3,
    0, 1,
  );

  return {
    closureScore,
    symmetryScore,
    readabilityScore,
    stabilityDuration: memory.persistenceAge,
  };
}

export function computeDestabilization(
  score: IconScore,
  memory: MotifMemory,
  config: ArtDirectionConfig,
): DestabilizationImpulse | null {
  const threshold = config.antiIconThreshold;

  // Fast path: no destabilization needed
  if (score.readabilityScore < threshold) return null;

  const impulseStrength = (score.readabilityScore - threshold) / (1 - threshold);

  // Circle radius reduction: shrink by up to 15%
  const circleRadiusDelta: number[] = [];
  for (let i = 0; i < 7; i++) {
    circleRadiusDelta.push(-impulseStrength * config.perfectClosurePenalty * 0.15);
  }

  // Ring gap widening
  const ringGapDelta = impulseStrength * 0.08;

  // Path noise: increases with impulse
  const pathNoiseIntensity = impulseStrength * 2.0;

  // Force direction: perpendicular to dominant force (shearing, not pushing)
  const forceAngle = memory.dominantForceAngle + Math.PI / 2;
  const forceStrength = impulseStrength * config.asymmetryBias;

  // Opacity pressure: only at high impulse levels
  const opacityPressure = impulseStrength > 0.7 ? -(impulseStrength - 0.7) * 0.3 : 0;

  return {
    circleRadiusDelta,
    ringGapDelta,
    pathNoiseIntensity,
    forceAngle,
    forceStrength,
    opacityPressure,
  };
}

export function applyImpulse(
  state: PrimitiveState,
  impulse: DestabilizationImpulse,
): PrimitiveState {
  // Clone circles with destabilization applied
  const circles = state.circles.map((c, i) => {
    if (!c.active) return c;
    return {
      ...c,
      r: Math.max(0.1, c.r + c.r * impulse.circleRadiusDelta[i]),
      opacity: clamp(c.opacity + impulse.opacityPressure, 0, 1),
    };
  }) as PrimitiveState['circles'];

  // Clone ring with gap widened
  const ring = state.ring.active
    ? {
        ...state.ring,
        gapEnd: state.ring.gapEnd + impulse.ringGapDelta,
        opacity: clamp(state.ring.opacity + impulse.opacityPressure, 0, 1),
      }
    : state.ring;

  // Shift path control points along force direction
  const cosF = Math.cos(impulse.forceAngle) * impulse.forceStrength;
  const sinF = Math.sin(impulse.forceAngle) * impulse.forceStrength;
  const paths = state.paths.map((p) => {
    if (!p.active || impulse.forceStrength < 0.01) return p;
    let coordIdx = 0;
    const d = p.d.replace(/-?\d+\.?\d*/g, (match) => {
      const v = parseFloat(match);
      const shift = (coordIdx++ % 2 === 0) ? cosF : sinF;
      return (v + shift * impulse.pathNoiseIntensity * 0.5).toFixed(2);
    });
    return { ...p, d, opacity: clamp(p.opacity + impulse.opacityPressure, 0, 1) };
  }) as PrimitiveState['paths'];

  return { paths, circles, ring };
}
