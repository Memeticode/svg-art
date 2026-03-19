// ── Per-frame agent update logic ──

import type { MorphAgent } from './MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { ArtDirectionConfig } from '@/art/artDirectionConfig';
import type { Rng } from '@/shared/rng';
import { lerp, clamp, angleLerp, RAD2DEG } from '@/shared/math';
import { easeInOutSine } from '@/shared/easing';
import { staggeredInterpolatePrimitiveState } from '@/geometry/stateInterpolation';
import { applyMicroDeform } from '@/geometry/stateMutation';
import { clampPrimitiveState } from '@/geometry/constraints';
import { evaluateIconScore, computeDestabilization, applyImpulse } from '@/art/antiIconEvaluator';
import { accumulateMemory } from './motifMemory';
import { applyTargetDrift, applySoftReseed } from './targetDrift';

export function updateAgent(
  agent: MorphAgent,
  dt: number,
  timeSec: number,
  sampler: FieldSampler,
  preset: CompositionPreset,
  rng: Rng,
  neighbors?: MorphAgent[],
  artDirection?: ArtDirectionConfig,
): void {
  if (!agent.alive) return;

  const bandConfig = preset.depthBands[agent.depthBand];
  const isGhost = agent.depthBand === 'ghost';

  // Per-layer flow: each band samples flow at different time scale and spatial offset
  const flowTimeScales: Record<string, number> = { ghost: 0.4, back: 0.7, mid: 1.0, front: 1.3 };
  const flowOffsets: Record<string, [number, number]> = {
    ghost: [0.02, 0.01], back: [0.008, 0.005], mid: [0, 0], front: [-0.005, -0.003],
  };
  const tScale = flowTimeScales[agent.depthBand] ?? 1.0;
  const [fox, foy] = flowOffsets[agent.depthBand] ?? [0, 0];
  const sample = sampler.sample(agent.xNorm + fox, agent.yNorm + foy, timeSec * tScale);

  // ── Motion ──
  const speedTarget = lerp(
    preset.speedRange[0],
    preset.speedRange[1],
    sample.flow.magnitude,
  ) * bandConfig.speedMultiplier;

  // Ghost agents have much softer velocity response (halved)
  const baseResponse = clamp(0.02 + sample.region.coherence * 0.03, 0.01, 0.08);
  const response = isGhost ? baseResponse * 0.5 : baseResponse;
  agent.vx = lerp(agent.vx, sample.flow.vx * speedTarget, response);
  agent.vy = lerp(agent.vy, sample.flow.vy * speedTarget, response);

  // Curl influence — driven by art direction swirlLegibility
  const swirlMul = artDirection ? artDirection.swirlLegibility : 0.6;
  const curlStrength = sample.flow.curl * (0.008 + swirlMul * 0.012) * bandConfig.speedMultiplier;
  agent.vx += -agent.vy * curlStrength;
  agent.vy += agent.vx * curlStrength;

  // Convergence zone effect: slow down, swell, and compress geometry
  if (sample.flow.convergenceZone > 0.5) {
    const convergeFactor = (sample.flow.convergenceZone - 0.5) * 2; // 0..1
    agent.vx *= 1 - convergeFactor * 0.4;
    agent.vy *= 1 - convergeFactor * 0.4;
    agent.scale = lerp(agent.scale, agent.scale * (1 + convergeFactor * 0.1), 0.02);
    // Convergence compression: squeeze geometry toward convergence point
    agent.scale = lerp(agent.scale, agent.scale * (1 - convergeFactor * 0.15), 0.01);
  }

  // Advance position
  agent.xNorm += agent.vx * dt;
  agent.yNorm += agent.vy * dt;

  // Soft wrap — wide margins for off-screen continuity
  // The world extends beyond the frame; agents live partially off-screen
  const wrapMargins: Record<string, number> = { ghost: 0.25, back: 0.15, mid: 0.10, front: 0.08 };
  const wrapMargin = wrapMargins[agent.depthBand] ?? 0.10;
  if (agent.xNorm < -wrapMargin) agent.xNorm = 1 + wrapMargin;
  else if (agent.xNorm > 1 + wrapMargin) agent.xNorm = -wrapMargin;
  if (agent.yNorm < -wrapMargin) agent.yNorm = 1 + wrapMargin;
  else if (agent.yNorm > 1 + wrapMargin) agent.yNorm = -wrapMargin;

  // ── Heading and rotation ──
  // Crisper heading response for visible current-following
  agent.heading = angleLerp(agent.heading, sample.flow.angle, response * 0.8);

  // ── Neighbor influence ──
  if (neighbors && neighbors.length > 1 && !isGhost) {
    // Heading alignment: blend toward local average heading, modulated by coherence
    let sinSum = 0;
    let cosSum = 0;
    let sameBandCount = 0;
    let scaleSum = 0;
    for (const n of neighbors) {
      if (n.id === agent.id) continue;
      sinSum += Math.sin(n.heading);
      cosSum += Math.cos(n.heading);
      if (n.depthBand === agent.depthBand) {
        scaleSum += n.scale;
        sameBandCount++;
      }
    }
    const neighborCount = neighbors.length - 1;
    if (neighborCount > 0) {
      const avgHeading = Math.atan2(sinSum / neighborCount, cosSum / neighborCount);
      const alignStrength = sample.region.coherence * 0.25;
      agent.heading = angleLerp(agent.heading, avgHeading, alignStrength);
    }

    // Scale harmony: drift toward local median among same-depth-band neighbors
    if (sameBandCount > 0) {
      const avgScale = scaleSum / sameBandCount;
      agent.scale = lerp(agent.scale, avgScale, 0.012);
    }

    // Phase coherence: same-band neighbors drift phase toward local average
    if (sameBandCount > 0) {
      let phaseSum = 0;
      let phaseCount = 0;
      for (const n of neighbors) {
        if (n.id === agent.id || n.depthBand !== agent.depthBand) continue;
        phaseSum += n.phase;
        phaseCount++;
      }
      if (phaseCount > 0) {
        const avgPhase = phaseSum / phaseCount;
        const coherenceStrength = sample.region.coherence * 0.06;
        agent.phase = lerp(agent.phase, avgPhase, coherenceStrength);
      }
    }
  }

  agent.rotationDeg = lerp(
    agent.rotationDeg,
    agent.heading * RAD2DEG,
    isGhost ? 0.005 : 0.015,
  );

  // ── Phase and energy ──
  agent.phase += dt * (0.3 + sample.region.tempo * 0.5) * bandConfig.morphRateMultiplier;
  agent.energy = lerp(agent.energy, 0.3 + sample.flow.magnitude * 0.4 + sample.region.brightness * 0.2, 0.01);
  agent.ageSec += dt;

  // ── Emphasis pulse system ──
  agent.emphasisTimer = Math.max(0, agent.emphasisTimer - dt);
  if (agent.emphasisTimer <= 0 && agent.energy > 0.5 && sample.region.brightness > 0.4 && !isGhost) {
    // Trigger emphasis: 2-5 second bright pulse
    agent.emphasisTimer = 2 + rng.next() * 3;
  }
  const emphasisBoost = agent.emphasisTimer > 0 ? 0.15 * Math.sin(agent.emphasisTimer * 0.6) : 0;

  // ── Opacity: gentle breathing + emphasis ──
  const breathe = Math.sin(agent.phase * 0.4) * 0.05;
  const targetOpacity = clamp(
    lerp(bandConfig.opacityRange[0], bandConfig.opacityRange[1], agent.energy) + breathe + emphasisBoost,
    bandConfig.opacityRange[0] * 0.5,
    bandConfig.opacityRange[1] * 1.3,
  );
  agent.opacity = lerp(agent.opacity, targetOpacity, 0.025);

  // Quiet basin suppression: reduce opacity in low-magnitude regions
  if (artDirection && sample.flow.magnitude < 0.3) {
    const quietFactor = (0.3 - sample.flow.magnitude) / 0.3; // 0..1
    agent.opacity *= 1 - quietFactor * artDirection.quietBasinStrength * 0.5;
  }

  // ── Accumulate structural memory ──
  accumulateMemory(agent.memory, sample, dt, agent.currentState);

  // ── Morph progression (soft reseed at ~85%) ──
  agent.morphProgress += dt / agent.morphDurationSec;
  agent.reseedCooldownSec = Math.max(0, agent.reseedCooldownSec - dt);

  const softReseedAt = artDirection?.softReseedThreshold ?? 0.85;
  if (agent.morphProgress >= softReseedAt && agent.reseedCooldownSec <= 0) {
    applySoftReseed(agent, timeSec, sampler, preset, rng, neighbors, artDirection);
  } else if (agent.morphProgress > 1.0) {
    agent.morphProgress = 1.0; // cap, cooldown still active
  }

  // ── Continuous target drift ──
  applyTargetDrift(agent.targetState, {
    flow: sample.flow,
    region: sample.region,
    memory: agent.memory,
    dt,
    phase: agent.phase,
    energy: agent.energy,
  });

  // ── Derive current interpolated state (staggered per-slot) ──
  const easedProgress = easeInOutSine(clamp(agent.morphProgress, 0, 1));
  let interpolated = staggeredInterpolatePrimitiveState(
    agent.sourceState,
    agent.targetState,
    easedProgress,
    agent.staggerProfile,
  );

  // ── Anti-icon evaluation and destabilization ──
  if (artDirection) {
    const iconScore = evaluateIconScore(interpolated, agent.memory);
    const impulse = computeDestabilization(iconScore, agent.memory, artDirection);
    if (impulse) {
      interpolated = applyImpulse(interpolated, impulse);
      agent.memory.driftAccumulator += impulse.forceStrength * dt;
    }
  }

  // ── Climate-authored deformations ──
  // Intensity varies by region type, accumulated memory, and climate exposure.
  let deformIntensity = isGhost ? 0.3 : (1.0 + agent.energy * 0.6);
  // Fragmented regions: more chaotic
  deformIntensity *= 1 + sample.region.fragmentation * 0.8;
  // Coherent regions: calmer but more aligned
  deformIntensity *= 1 - sample.region.coherence * 0.3;
  // Linearity: stretch along flow (increase bias strength, not chaos)
  const linearityStretch = sample.region.linearity * 1.5;
  // Climate memory amplifies deformation: weathered motifs deform more
  deformIntensity *= 1 + agent.memory.climateScarIntensity * 0.5;
  // Curl exposure amplifies curl-based deformation
  deformIntensity *= 1 + agent.memory.curlExposure * 0.4;
  // Front pressure increases deformation intensity near convergence fronts
  deformIntensity *= 1 + agent.memory.frontPressure * 0.3;

  const fieldBias = {
    angle: sample.flow.angle,
    strength: (sample.region.deformationAggression * 2.5 + 0.3 + linearityStretch),
  };
  // Combine field-derived and memory-derived deformation bias
  // Lane exposure increases directional stretch along flow
  const memBiasStrength = agent.memory.forceExposure * 0.8
    + agent.memory.laneExposure * 0.6;
  const deformBias = fieldBias
    ? { angle: (fieldBias.angle + agent.memory.dominantForceAngle) * 0.5,
        strength: fieldBias.strength + memBiasStrength }
    : memBiasStrength > 0.1
      ? { angle: agent.memory.dominantForceAngle, strength: memBiasStrength }
      : undefined;
  interpolated = applyMicroDeform(interpolated, {
    turbulence: sample.flow.turbulence,
    phase: agent.phase,
    intensity: deformIntensity,
    deformBias,
  });

  // Clamp to safe ranges
  agent.currentState = clampPrimitiveState(interpolated);
}
