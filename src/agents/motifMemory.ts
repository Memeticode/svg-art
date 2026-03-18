// ── Per-agent structural memory: accumulated field exposure ──

import type { FieldSample } from '@/field/fieldSampler';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { angleLerp, lerp, clamp } from '@/shared/math';

export interface MotifMemory {
  accumulatedAsymmetry: number;     // 0..1, grows under asymmetric force
  closureFatigue: number;           // 0..1, grows when path arcs approach closure
  dominantForceAngle: number;       // radians, EMA of flow angle
  forceExposure: number;            // 0..1, total absorbed force magnitude
  regionalCoherence: number;        // smoothed region.coherence
  regionalFragmentation: number;    // smoothed region.fragmentation
  persistenceAge: number;           // seconds since last major structural change
  driftAccumulator: number;         // cumulative drift applied
  slotInertia: Float32Array;        // 16 values (8 paths + 7 circles + 1 ring), [0.5..2.0]
  roundnessFatigue: number;         // 0..1, grows when paths show closure, decays slowly
  centerRejectionBias: number;      // 0..1, grows when path endpoints cluster near origin
}

const SLOT_COUNT = 16; // 8 paths + 7 circles + 1 ring

// Regex to detect arc commands in path d strings
const ARC_RE = /[Aa]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+([01])[,\s]+([01])/g;

/** Measure path closure presence: how many active paths have significant arcs */
function measurePathClosurePresence(state: PrimitiveState): number {
  let closurePresence = 0;
  let activeCount = 0;
  for (let i = 0; i < 8; i++) {
    const p = state.paths[i];
    if (!p.active) continue;
    activeCount++;
    ARC_RE.lastIndex = 0;
    let arcScore = 0;
    let m;
    while ((m = ARC_RE.exec(p.d)) !== null) {
      const largeArc = parseInt(m[4]);
      arcScore += largeArc ? 0.5 : 0.2;
    }
    closurePresence += Math.min(arcScore, 1);
  }
  return activeCount > 0 ? closurePresence / activeCount : 0;
}

/** Measure how centered path endpoints are around origin */
function measureCenteredness(state: PrimitiveState): number {
  let sumDist = 0;
  let count = 0;
  const startRe = /[Mm]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/g;
  for (let i = 0; i < 8; i++) {
    const p = state.paths[i];
    if (!p.active) continue;
    startRe.lastIndex = 0;
    const m = startRe.exec(p.d);
    if (m) {
      const x = parseFloat(m[1]);
      const y = parseFloat(m[2]);
      sumDist += Math.sqrt(x * x + y * y);
      count++;
    }
  }
  if (count === 0) return 0;
  const avgDist = sumDist / count;
  return Math.max(0, 1 - avgDist / 20); // within 20 units = centered
}

export function createMotifMemory(): MotifMemory {
  const slotInertia = new Float32Array(SLOT_COUNT);
  slotInertia.fill(1.0);
  return {
    accumulatedAsymmetry: 0,
    closureFatigue: 0,
    dominantForceAngle: 0,
    forceExposure: 0,
    regionalCoherence: 0.5,
    regionalFragmentation: 0.5,
    persistenceAge: 0,
    driftAccumulator: 0,
    slotInertia,
    roundnessFatigue: 0,
    centerRejectionBias: 0,
  };
}

export function accumulateMemory(
  memory: MotifMemory,
  sample: FieldSample,
  dt: number,
  currentState: PrimitiveState,
): void {
  const { flow, region } = sample;

  // Persistence tracking
  memory.persistenceAge += dt;

  // Dominant force direction (slow exponential moving average)
  memory.dominantForceAngle = angleLerp(memory.dominantForceAngle, flow.angle, 0.01);

  // Force exposure: tracks how much force the agent has absorbed
  memory.forceExposure = lerp(memory.forceExposure, flow.magnitude, 0.005);
  memory.forceExposure = Math.max(0, memory.forceExposure - 0.002 * dt);

  // Closure fatigue: grows when paths have significant arc closure
  const pathClosurePresence = measurePathClosurePresence(currentState);
  memory.closureFatigue += pathClosurePresence * 0.01 * dt;
  memory.closureFatigue = Math.max(0, memory.closureFatigue - 0.003 * dt);
  memory.closureFatigue = clamp(memory.closureFatigue, 0, 1);

  // Roundness fatigue: grows with closure presence, decays much slower
  memory.roundnessFatigue += pathClosurePresence * 0.008 * dt;
  memory.roundnessFatigue = Math.max(0, memory.roundnessFatigue - 0.001 * dt);
  memory.roundnessFatigue = clamp(memory.roundnessFatigue, 0, 1);

  // Center rejection bias: grows when path endpoints cluster near origin
  const centeredness = measureCenteredness(currentState);
  memory.centerRejectionBias += centeredness * 0.005 * dt;
  memory.centerRejectionBias = Math.max(0, memory.centerRejectionBias - 0.002 * dt);
  memory.centerRejectionBias = clamp(memory.centerRejectionBias, 0, 1);

  // Accumulated asymmetry: grows when flow has strong perpendicular component
  const perpStrength = Math.abs(Math.sin(flow.angle - memory.dominantForceAngle)) * flow.magnitude;
  memory.accumulatedAsymmetry += perpStrength * 0.008 * dt;
  memory.accumulatedAsymmetry = Math.max(0, memory.accumulatedAsymmetry - 0.002 * dt);
  memory.accumulatedAsymmetry = clamp(memory.accumulatedAsymmetry, 0, 1);

  // Regional smoothing
  memory.regionalCoherence = lerp(memory.regionalCoherence, region.coherence, 0.005);
  memory.regionalFragmentation = lerp(memory.regionalFragmentation, region.fragmentation, 0.005);

  // Drift accumulator decay
  memory.driftAccumulator = Math.max(0, memory.driftAccumulator - 0.01 * dt);

  // Slot inertia: high turbulence lowers inertia (faster response), calm raises it
  for (let i = 0; i < SLOT_COUNT; i++) {
    const target = flow.turbulence > 0.5 ? 0.5 : 2.0;
    memory.slotInertia[i] = lerp(memory.slotInertia[i], target, 0.003);
    memory.slotInertia[i] = clamp(memory.slotInertia[i], 0.5, 2.0);
  }
}

export function resetPersistenceAge(memory: MotifMemory): void {
  memory.persistenceAge = 0;
  memory.driftAccumulator = 0;
}
