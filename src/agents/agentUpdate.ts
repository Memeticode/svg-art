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
import { createMotifState } from '@/art/motifFactories';
import { createMacroFormState, pickMacroFormType } from '@/art/macroFormFactories';
import { applyArtDirectionPenalty } from '@/art/postFilter';
import { pickNextFamily } from '@/art/designRules';
import { generateStaggerProfile } from './agentSpawner';

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

  const sample = sampler.sample(agent.xNorm, agent.yNorm, timeSec);
  const bandConfig = preset.depthBands[agent.depthBand];
  const isGhost = agent.depthBand === 'ghost';

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

  // Soft wrap — ghosts allowed further offscreen (partial offscreen forms)
  const wrapMargin = isGhost ? 0.15 : 0.05;
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
      const alignStrength = sample.region.coherence * 0.15;
      agent.heading = angleLerp(agent.heading, avgHeading, alignStrength);
    }

    // Scale harmony: drift toward local median among same-depth-band neighbors
    if (sameBandCount > 0) {
      const avgScale = scaleSum / sameBandCount;
      agent.scale = lerp(agent.scale, avgScale, 0.005);
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
        const coherenceStrength = sample.region.coherence * 0.03;
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
  if (agent.emphasisTimer <= 0 && agent.energy > 0.7 && sample.region.brightness > 0.6 && !isGhost) {
    // Trigger emphasis: 2-4 second bright pulse
    agent.emphasisTimer = 2 + rng.next() * 2;
  }
  const emphasisBoost = agent.emphasisTimer > 0 ? 0.15 * Math.sin(agent.emphasisTimer * 0.8) : 0;

  // ── Opacity: gentle breathing + emphasis ──
  const breathe = Math.sin(agent.phase * 0.4) * 0.05;
  const targetOpacity = clamp(
    lerp(bandConfig.opacityRange[0], bandConfig.opacityRange[1], agent.energy) + breathe + emphasisBoost,
    bandConfig.opacityRange[0] * 0.5,
    bandConfig.opacityRange[1] * 1.3,
  );
  agent.opacity = lerp(agent.opacity, targetOpacity, 0.02);

  // Quiet basin suppression: reduce opacity in low-magnitude regions
  if (artDirection && sample.flow.magnitude < 0.3) {
    const quietFactor = (0.3 - sample.flow.magnitude) / 0.3; // 0..1
    agent.opacity *= 1 - quietFactor * artDirection.quietBasinStrength * 0.5;
  }

  // ── Morph progression ──
  agent.morphProgress += dt / agent.morphDurationSec;
  agent.reseedCooldownSec = Math.max(0, agent.reseedCooldownSec - dt);

  if (agent.morphProgress >= 1.0) {
    agent.morphProgress = 1.0;

    // Reseed if cooldown expired
    if (agent.reseedCooldownSec <= 0) {
      // Family echo: boost weights for families common among neighbors
      let effectiveWeights = preset.motifWeights;
      if (neighbors && neighbors.length > 1) {
        const familyCounts: Partial<Record<string, number>> = {};
        for (const n of neighbors) {
          if (n.id === agent.id) continue;
          familyCounts[n.family] = (familyCounts[n.family] ?? 0) + 1;
        }
        const nCount = neighbors.length - 1;
        if (nCount > 0) {
          effectiveWeights = { ...preset.motifWeights };
          for (const [fam, count] of Object.entries(familyCounts)) {
            const ratio = (count ?? 0) / nCount;
            if (ratio > 0.4) {
              // Strong local consensus — boost that family
              effectiveWeights[fam as keyof typeof effectiveWeights] =
                ((effectiveWeights[fam as keyof typeof effectiveWeights] ?? 1.0) as number) * (1 + ratio);
            }
          }
        }
      }

      const nextFamily = pickNextFamily(
        agent.family,
        sample.region,
        rng.fork(agent.id + '-reseed-' + Math.floor(timeSec)),
        effectiveWeights,
      );

      agent.sourceState = agent.targetState;
      agent.family = nextFamily;

      let newTarget: typeof agent.targetState;
      if (isGhost) {
        // Ghost agents reseed with macro-form factories
        const newMacroType = pickMacroFormType(
          rng.fork(agent.id + '-macro-' + Math.floor(timeSec)),
          sample.flow,
          sample.region,
        );
        agent.macroFormType = newMacroType;
        newTarget = createMacroFormState(newMacroType, {
          rng: rng.fork(agent.id + '-target-' + Math.floor(timeSec)),
          region: sample.region,
          flow: sample.flow,
          depthBand: agent.depthBand,
          energy: agent.energy,
        });
      } else {
        newTarget = createMotifState(nextFamily, {
          rng: rng.fork(agent.id + '-target-' + Math.floor(timeSec)),
          region: sample.region,
          flow: sample.flow,
          depthBand: agent.depthBand,
          energy: agent.energy,
        });
        if (artDirection) {
          newTarget = applyArtDirectionPenalty(newTarget, artDirection);
        }
      }
      agent.targetState = newTarget;

      agent.morphProgress = 0;
      agent.morphDurationSec = rng.float(
        preset.morphDurationRange[0],
        preset.morphDurationRange[1],
      ) / bandConfig.morphRateMultiplier;
      agent.reseedCooldownSec = agent.morphDurationSec * 0.8;

      // Generate new stagger profile for this morph cycle
      agent.staggerProfile = generateStaggerProfile(
        rng.fork(agent.id + '-stagger-' + Math.floor(timeSec)),
      );
    }
  }

  // ── Derive current interpolated state (staggered per-slot) ──
  const easedProgress = easeInOutSine(clamp(agent.morphProgress, 0, 1));
  let interpolated = staggeredInterpolatePrimitiveState(
    agent.sourceState,
    agent.targetState,
    easedProgress,
    agent.staggerProfile,
  );

  // Apply micro-deformations (suppressed for ghosts), with directional bias from field
  const deformIntensity = isGhost ? 0.2 : (0.8 + agent.energy * 0.5);
  const deformBias = sample.region.deformationAggression > 0.3
    ? { angle: sample.flow.angle, strength: sample.region.deformationAggression * 2.0 }
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
