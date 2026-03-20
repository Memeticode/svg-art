// ── Anti-icon evaluator: prevent motifs from stabilizing into icons ──
// Now uses path-based curvature analysis instead of circle counting.
// Circles are doctrinally inactive — scoring is purely arc/closure based.

import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { PATH_SLOT_COUNT } from '@/geometry/primitiveTypes';
import type { MotifMemory } from '@/agents/motifMemory';
import type { ArtDirectionConfig } from './artDirectionConfig';
import { clamp } from '@/shared/math';

export interface IconScore {
  closureScore: number;       // 0..1, how closed/circular active paths appear
  symmetryScore: number;      // 0..1, how balanced around center
  readabilityScore: number;   // 0..1, combined legibility metric
  stabilityDuration: number;  // seconds from memory.persistenceAge
}

export interface DestabilizationImpulse {
  arcBreakIntensity: number;    // 0..1, how aggressively to fragment arc paths
  pathNoiseIntensity: number;   // 0..3, control point jitter
  forceAngle: number;           // perpendicular to dominant force (shearing)
  forceStrength: number;        // 0..1
  opacityPressure: number;      // -0.2..0
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Measure closure/circularity using coords directly — no regex per frame.
 *  Uses start-end distance as a proxy for self-closure,
 *  and template inspection for arc presence. */
function measurePathCircularity(p: { coords?: Float32Array; template?: string }): number {
  if (!p.coords || p.coords.length < 4) return 0;
  // Self-closure: start ≈ end (from coords)
  const sx = p.coords[0];
  const sy = p.coords[1];
  const ex = p.coords[p.coords.length - 2];
  const ey = p.coords[p.coords.length - 1];
  const dist = Math.sqrt((sx - ex) * (sx - ex) + (sy - ey) * (sy - ey));
  const selfClosure = Math.max(0, 1 - dist / 5);

  // Arc presence from template (checked once, not per frame)
  const hasArc = p.template ? (p.template.includes('A') || p.template.includes('a')) : false;
  if (!hasArc) return selfClosure * 0.3;

  return clamp(0.3 + selfClosure * 0.3, 0, 1);
}

export function evaluateIconScore(
  state: PrimitiveState,
  memory: MotifMemory,
): IconScore {
  // Closure score: path-based arc circularity analysis
  let closureSum = 0;
  let activePathCount = 0;
  let comX = 0, comY = 0;
  let pointCount = 0;
  const qCounts = [0, 0, 0, 0];

  for (let i = 0; i < PATH_SLOT_COUNT; i++) {
    const p = state.paths[i];
    if (!p.active || !p.coords || p.coords.length < 4) continue;
    activePathCount++;
    closureSum += measurePathCircularity(p);

    // Gather endpoint data from coords (no regex)
    const sx = p.coords[0];
    const sy = p.coords[1];
    const ex = p.coords[p.coords.length - 2];
    const ey = p.coords[p.coords.length - 1];
    for (const pt of [{ x: sx, y: sy }, { x: ex, y: ey }]) {
      comX += pt.x;
      comY += pt.y;
      pointCount++;
      const q = (pt.x >= 0 ? 0 : 1) + (pt.y >= 0 ? 0 : 2);
      qCounts[q]++;
    }
  }

  const closureScore = activePathCount > 0
    ? clamp(closureSum / activePathCount, 0, 1)
    : 0;

  // Symmetry score: center-of-mass proximity to origin + quadrant balance
  if (pointCount > 0) {
    comX /= pointCount;
    comY /= pointCount;
  }
  const comDist = Math.sqrt(comX * comX + comY * comY);
  const centeredness = Math.max(0, 1 - comDist / 20);
  const maxQ = Math.max(...qCounts);
  const minQ = Math.min(...qCounts);
  const balance = pointCount > 4 ? 1 - (maxQ - minQ) / pointCount : 0.5;
  const symmetryScore = clamp(centeredness * 0.6 + balance * 0.4, 0, 1);

  // Readability: weighted combination + time-based persistence factor
  const persistenceFactor = smoothstep(3, 12, memory.persistenceAge);
  const roundnessFatigue = (memory as any).roundnessFatigue ?? 0;
  const readabilityScore = clamp(
    closureScore * 0.4 + symmetryScore * 0.3 + persistenceFactor * 0.3 - roundnessFatigue * 0.15,
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

  // Arc break intensity: controls arc fragmentation
  const arcBreakIntensity = impulseStrength * config.closureBreakStrength;

  // Path noise: increases with impulse (stronger for faster decay)
  const pathNoiseIntensity = impulseStrength * 3.0;

  // Force direction: perpendicular to dominant force (shearing, not pushing)
  const forceAngle = memory.dominantForceAngle + Math.PI / 2;
  const forceStrength = impulseStrength * config.asymmetryBias;

  // Opacity pressure: triggers at lower threshold for stronger decay
  const opacityPressure = impulseStrength > 0.5 ? -(impulseStrength - 0.5) * 0.3 : 0;

  return {
    arcBreakIntensity,
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
  // Shift coords directly — no regex
  const cosF = Math.cos(impulse.forceAngle) * impulse.forceStrength;
  const sinF = Math.sin(impulse.forceAngle) * impulse.forceStrength;
  const noiseMul = impulse.pathNoiseIntensity * 0.5;

  const paths = state.paths.map((p) => {
    if (!p.active || impulse.forceStrength < 0.01 || !p.coords || p.coords.length === 0) return p;
    const coords = new Float32Array(p.coords);
    for (let j = 0; j < coords.length; j++) {
      const shift = (j % 2 === 0) ? cosF : sinF;
      coords[j] += shift * noiseMul;
    }
    return { ...p, coords, opacity: clamp(p.opacity + impulse.opacityPressure, 0, 1) };
  }) as PrimitiveState['paths'];

  return { paths };
}
