// ── Per-frame agent update logic ──

import type { MorphAgent } from './MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { Rng } from '@/shared/rng';
import { lerp, clamp, angleLerp, wrapAngle, RAD2DEG } from '@/shared/math';
import { easeInOutSine } from '@/shared/easing';
import { interpolatePrimitiveState } from '@/geometry/stateInterpolation';
import { applyMicroDeform } from '@/geometry/stateMutation';
import { clampPrimitiveState } from '@/geometry/constraints';
import { createMotifState } from '@/art/motifFactories';
import { pickNextFamily } from '@/art/designRules';

export function updateAgent(
  agent: MorphAgent,
  dt: number,
  timeSec: number,
  sampler: FieldSampler,
  preset: CompositionPreset,
  rng: Rng,
): void {
  if (!agent.alive) return;

  const sample = sampler.sample(agent.xNorm, agent.yNorm, timeSec);
  const bandConfig = preset.depthBands[agent.depthBand];

  // ── Motion ──
  const speedTarget = lerp(
    preset.speedRange[0],
    preset.speedRange[1],
    sample.flow.magnitude,
  ) * bandConfig.speedMultiplier;

  // Smooth velocity blending (inertia)
  const response = clamp(0.02 + sample.region.coherence * 0.03, 0.01, 0.08);
  agent.vx = lerp(agent.vx, sample.flow.vx * speedTarget, response);
  agent.vy = lerp(agent.vy, sample.flow.vy * speedTarget, response);

  // Add subtle curl influence
  const curlStrength = sample.flow.curl * 0.003 * bandConfig.speedMultiplier;
  agent.vx += -agent.vy * curlStrength;
  agent.vy += agent.vx * curlStrength;

  // Advance position
  agent.xNorm += agent.vx * dt;
  agent.yNorm += agent.vy * dt;

  // Soft wrap: when an agent leaves the viewport, reposition it on the opposite side
  if (agent.xNorm < -0.05) agent.xNorm = 1.05;
  else if (agent.xNorm > 1.05) agent.xNorm = -0.05;
  if (agent.yNorm < -0.05) agent.yNorm = 1.05;
  else if (agent.yNorm > 1.05) agent.yNorm = -0.05;

  // ── Heading and rotation ──
  agent.heading = angleLerp(agent.heading, sample.flow.angle, response * 0.5);
  agent.rotationDeg = lerp(
    agent.rotationDeg,
    agent.heading * RAD2DEG,
    0.01,
  );

  // ── Phase and energy ──
  agent.phase += dt * (0.3 + sample.region.tempo * 0.5) * bandConfig.morphRateMultiplier;
  agent.energy = lerp(agent.energy, 0.3 + sample.flow.magnitude * 0.4 + sample.region.brightness * 0.2, 0.01);
  agent.ageSec += dt;

  // ── Opacity: gentle breathing ──
  const breathe = Math.sin(agent.phase * 0.4) * 0.05;
  const targetOpacity = clamp(
    lerp(bandConfig.opacityRange[0], bandConfig.opacityRange[1], agent.energy) + breathe,
    bandConfig.opacityRange[0] * 0.5,
    bandConfig.opacityRange[1] * 1.2,
  );
  agent.opacity = lerp(agent.opacity, targetOpacity, 0.02);

  // ── Morph progression ──
  agent.morphProgress += dt / agent.morphDurationSec;
  agent.reseedCooldownSec = Math.max(0, agent.reseedCooldownSec - dt);

  if (agent.morphProgress >= 1.0) {
    agent.morphProgress = 1.0;

    // Reseed if cooldown expired
    if (agent.reseedCooldownSec <= 0) {
      const nextFamily = pickNextFamily(
        agent.family,
        sample.region,
        rng.fork(agent.id + '-reseed-' + Math.floor(timeSec)),
        preset.motifWeights,
      );

      agent.sourceState = agent.targetState;
      agent.family = nextFamily;
      agent.targetState = createMotifState(nextFamily, {
        rng: rng.fork(agent.id + '-target-' + Math.floor(timeSec)),
        region: sample.region,
        flow: sample.flow,
        depthBand: agent.depthBand,
        energy: agent.energy,
      });

      agent.morphProgress = 0;
      agent.morphDurationSec = rng.float(
        preset.morphDurationRange[0],
        preset.morphDurationRange[1],
      ) / bandConfig.morphRateMultiplier;
      agent.reseedCooldownSec = agent.morphDurationSec * 0.8;
    }
  }

  // ── Derive current interpolated state ──
  const easedProgress = easeInOutSine(clamp(agent.morphProgress, 0, 1));
  let interpolated = interpolatePrimitiveState(
    agent.sourceState,
    agent.targetState,
    easedProgress,
  );

  // Apply micro-deformations
  interpolated = applyMicroDeform(interpolated, {
    turbulence: sample.flow.turbulence,
    phase: agent.phase,
    intensity: 0.8 + agent.energy * 0.5,
  });

  // Clamp to safe ranges
  agent.currentState = clampPrimitiveState(interpolated);
}
