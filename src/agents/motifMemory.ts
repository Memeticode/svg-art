// ── Per-agent structural memory: accumulated field exposure ──

import type { FieldSample } from '@/field/fieldSampler';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { PATH_SLOT_COUNT } from '@/geometry/primitiveTypes';
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
  slotInertia: Float32Array;        // 12 values (12 path slots), [0.5..2.0]
  roundnessFatigue: number;         // 0..1, grows when paths show closure, decays slowly
  centerRejectionBias: number;      // 0..1, grows when path endpoints cluster near origin

  // ── Boundary awareness ──
  boundaryProximity: number;        // 0..1, instant readout from region map

  // ── Climate causality channels ──
  laneExposure: number;             // 0..1, grows in high linearity + high magnitude
  basinDepth: number;               // 0..1, grows in convergence zones
  curlExposure: number;             // 0..1, accumulated curl
  frontPressure: number;            // 0..1, grows near convergence fronts
  shellCollapseBias: number;        // 0..1, grows when enclosed paths fragment
  spineBendMemory: number;          // 0..1, EMA of path curvature magnitude
  lobeDominance: number;            // 0..1, tracks asymmetric path distribution
  climateScarIntensity: number;     // 0..1, overall weatheredness
}

const SLOT_COUNT = 12; // 12 path slots

/** Measure path closure presence using template (checks for arc commands).
 *  Uses coords for start/end distance — no regex per frame. */
function measurePathClosurePresence(state: PrimitiveState): number {
  let closurePresence = 0;
  let activeCount = 0;
  for (let i = 0; i < PATH_SLOT_COUNT; i++) {
    const p = state.paths[i];
    if (!p.active || !p.coords || p.coords.length < 4) continue;
    activeCount++;
    // Check template for arc commands (parsed once, not per frame)
    const hasArc = p.template ? (p.template.includes('A') || p.template.includes('a')) : false;
    if (hasArc) {
      // Approximate closure from start-end distance
      const sx = p.coords[0];
      const sy = p.coords[1];
      const ex = p.coords[p.coords.length - 2];
      const ey = p.coords[p.coords.length - 1];
      const dist = Math.sqrt((ex - sx) * (ex - sx) + (ey - sy) * (ey - sy));
      closurePresence += Math.max(0, 1 - dist / 15) * 0.5;
    }
  }
  return activeCount > 0 ? closurePresence / activeCount : 0;
}

/** Measure how centered path start points are around origin — uses coords directly */
function measureCenteredness(state: PrimitiveState): number {
  let sumDist = 0;
  let count = 0;
  for (let i = 0; i < PATH_SLOT_COUNT; i++) {
    const p = state.paths[i];
    if (!p.active || !p.coords || p.coords.length < 2) continue;
    const x = p.coords[0];
    const y = p.coords[1];
    sumDist += Math.sqrt(x * x + y * y);
    count++;
  }
  if (count === 0) return 0;
  return Math.max(0, 1 - sumDist / count / 20);
}

/** Measure spatial asymmetry using coords directly */
function measurePathAsymmetry(state: PrimitiveState): number {
  let leftCount = 0;
  let rightCount = 0;
  let topCount = 0;
  let bottomCount = 0;
  for (let i = 0; i < PATH_SLOT_COUNT; i++) {
    const p = state.paths[i];
    if (!p.active || !p.coords || p.coords.length < 2) continue;
    const x = p.coords[0];
    const y = p.coords[1];
    if (x < 0) leftCount++; else rightCount++;
    if (y < 0) topCount++; else bottomCount++;
  }
  const total = leftCount + rightCount;
  if (total < 2) return 0;
  const hBalance = Math.abs(leftCount - rightCount) / total;
  const vBalance = Math.abs(topCount - bottomCount) / total;
  return (hBalance + vBalance) * 0.5;
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
    // Boundary awareness
    boundaryProximity: 0,
    // Climate causality channels
    laneExposure: 0,
    basinDepth: 0,
    curlExposure: 0,
    frontPressure: 0,
    shellCollapseBias: 0,
    spineBendMemory: 0,
    lobeDominance: 0,
    climateScarIntensity: 0,
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

  // ── Boundary proximity (instant readout, no accumulation) ──
  memory.boundaryProximity = sample.boundaryProximity;

  // ── Climate causality channels ──
  // Asymmetric rates: accumulate ~2x, decay ~0.5x
  // Motifs adapt to new climate faster than they heal from old exposure.
  // The field feels weathered, not merely responsive.

  // Lane exposure: grows when agent is in a flow lane (high linearity + high magnitude)
  const laneSignal = region.linearity * flow.magnitude;
  memory.laneExposure += laneSignal * 0.012 * dt;                      // 2x accumulation
  memory.laneExposure = Math.max(0, memory.laneExposure - 0.0005 * dt); // 0.5x decay
  memory.laneExposure = clamp(memory.laneExposure, 0, 1);

  // Basin depth: grows in convergence zones
  memory.basinDepth += flow.convergenceZone * 0.016 * dt;
  memory.basinDepth = Math.max(0, memory.basinDepth - 0.001 * dt);
  memory.basinDepth = clamp(memory.basinDepth, 0, 1);

  // Curl exposure: accumulated curl intensity
  memory.curlExposure += Math.abs(flow.curl) * 0.010 * dt;
  memory.curlExposure = Math.max(0, memory.curlExposure - 0.0005 * dt);
  memory.curlExposure = clamp(memory.curlExposure, 0, 1);

  // Front pressure: grows near convergence fronts with high flow
  const frontSignal = flow.convergenceZone * flow.magnitude;
  memory.frontPressure += frontSignal * 0.014 * dt;
  memory.frontPressure = Math.max(0, memory.frontPressure - 0.001 * dt);
  memory.frontPressure = clamp(memory.frontPressure, 0, 1);

  // Shell collapse bias: grows when closure presence is fragmenting
  const collapseSignal = pathClosurePresence * region.fragmentation;
  memory.shellCollapseBias += collapseSignal * 0.012 * dt;
  memory.shellCollapseBias = Math.max(0, memory.shellCollapseBias - 0.0005 * dt);
  memory.shellCollapseBias = clamp(memory.shellCollapseBias, 0, 1);

  // Spine bend memory: EMA of flow curvature magnitude
  memory.spineBendMemory = lerp(memory.spineBendMemory, Math.abs(flow.curl) * 0.5, 0.006);
  memory.spineBendMemory = clamp(memory.spineBendMemory, 0, 1);

  // Lobe dominance: tracks asymmetric path spatial distribution
  const asymmetry = measurePathAsymmetry(currentState);
  memory.lobeDominance = lerp(memory.lobeDominance, asymmetry, 0.005);
  memory.lobeDominance = clamp(memory.lobeDominance, 0, 1);

  // Climate scar intensity: overall weatheredness — scars linger longest
  // Accumulate ~1.5x, decay ~0.3x
  const weatherSignal = (memory.laneExposure + memory.curlExposure + memory.frontPressure + memory.basinDepth) * 0.25;
  memory.climateScarIntensity += Math.max(0, weatherSignal - memory.climateScarIntensity) * 0.005 * dt;
  memory.climateScarIntensity = Math.max(0, memory.climateScarIntensity - 0.0003 * dt);
  memory.climateScarIntensity = clamp(memory.climateScarIntensity, 0, 1);
}

export function resetPersistenceAge(memory: MotifMemory): void {
  memory.persistenceAge = 0;
  memory.driftAccumulator = 0;
}
