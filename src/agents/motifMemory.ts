// ── Per-agent structural memory: accumulated field exposure ──

import type { FieldSample } from '@/field/fieldSampler';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { angleLerp, lerp, clamp } from '@/shared/math';

export interface MotifMemory {
  accumulatedAsymmetry: number;     // 0..1, grows under asymmetric force
  closureFatigue: number;           // 0..1, grows when circles/ring stay active
  dominantForceAngle: number;       // radians, EMA of flow angle
  forceExposure: number;            // 0..1, total absorbed force magnitude
  regionalCoherence: number;        // smoothed region.coherence
  regionalFragmentation: number;    // smoothed region.fragmentation
  persistenceAge: number;           // seconds since last major structural change
  driftAccumulator: number;         // cumulative drift applied
  slotInertia: Float32Array;        // 16 values (8 paths + 7 circles + 1 ring), [0.5..2.0]
}

const SLOT_COUNT = 16; // 8 paths + 7 circles + 1 ring

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

  // Closure fatigue: grows when circles and ring are active
  let activeCircles = 0;
  for (let i = 0; i < 7; i++) {
    if (currentState.circles[i].active) activeCircles++;
  }
  const ringActive = currentState.ring.active ? 1 : 0;
  memory.closureFatigue += (activeCircles + ringActive) * 0.01 * dt;
  memory.closureFatigue = Math.max(0, memory.closureFatigue - 0.003 * dt);
  memory.closureFatigue = clamp(memory.closureFatigue, 0, 1);

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
