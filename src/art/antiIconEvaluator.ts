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

// Regex to find SVG arc commands: A rx ry rotation largeArc sweep ex ey
const ARC_RE = /[Aa]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+([01])[,\s]+([01])[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/g;

// Extract starting coordinate from path d string
function extractPathStart(d: string): { x: number; y: number } | null {
  const m = d.match(/[Mm]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

// Extract last coordinate from path d string
function extractPathEnd(d: string): { x: number; y: number } | null {
  const coords: Array<{ x: number; y: number }> = [];
  const numRe = /-?\d+\.?\d*/g;
  let match;
  while ((match = numRe.exec(d)) !== null) {
    coords.push({ x: parseFloat(match[0]), y: 0 });
  }
  // Rough: take last two numbers as x,y
  const allNums: number[] = [];
  const re2 = /-?\d+\.?\d*/g;
  let m2;
  while ((m2 = re2.exec(d)) !== null) {
    allNums.push(parseFloat(m2[0]));
  }
  if (allNums.length >= 2) {
    return { x: allNums[allNums.length - 2], y: allNums[allNums.length - 1] };
  }
  return null;
}

/** Measure how "circular" a path's arcs are. Returns 0..1. */
function measurePathCircularity(d: string): number {
  let totalArcSweep = 0;
  let arcCount = 0;
  ARC_RE.lastIndex = 0;
  let m;
  while ((m = ARC_RE.exec(d)) !== null) {
    const rx = parseFloat(m[1]);
    const ry = parseFloat(m[2]);
    // Approximate sweep from arc radius similarity (circular = rx ≈ ry)
    const radiusSimilarity = Math.min(rx, ry) / (Math.max(rx, ry) + 0.001);
    // Large arc flag contributes more
    const largeArc = parseInt(m[4]);
    const sweepContribution = largeArc ? 0.6 : 0.3;
    totalArcSweep += sweepContribution * radiusSimilarity;
    arcCount++;
  }

  // Self-closure: start ≈ end
  const start = extractPathStart(d);
  const end = extractPathEnd(d);
  let selfClosure = 0;
  if (start && end) {
    const dist = Math.sqrt((start.x - end.x) ** 2 + (start.y - end.y) ** 2);
    selfClosure = Math.max(0, 1 - dist / 5); // within 5 units = nearly closed
  }

  if (arcCount === 0) return selfClosure * 0.3;
  return clamp(totalArcSweep / arcCount + selfClosure * 0.3, 0, 1);
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
    if (!p.active) continue;
    activePathCount++;
    closureSum += measurePathCircularity(p.d);

    // Gather endpoint data for symmetry scoring
    const start = extractPathStart(p.d);
    const end = extractPathEnd(p.d);
    for (const pt of [start, end]) {
      if (!pt) continue;
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
  // Shift path control points along force direction + break high-closure arcs
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

  return { paths };
}
