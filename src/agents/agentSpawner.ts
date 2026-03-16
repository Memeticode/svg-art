// ── Agent spawning with cluster-aware distribution ──

import type { Rng } from '@/shared/rng';
import type { MorphAgent, StaggerProfile } from './MorphAgent';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { FieldSampler } from '@/field/fieldSampler';
import type { ArtDirectionConfig } from '@/art/artDirectionConfig';
import { ALL_FAMILY_IDS } from '@/art/motifFamilies';
import { assignDepthBand } from './depthBands';
import { createMotifState } from '@/art/motifFactories';
import { createMacroFormState, pickMacroFormType } from '@/art/macroFormFactories';
import { applyArtDirectionPenalty } from '@/art/postFilter';
import { clonePrimitiveState } from '@/geometry/primitiveState';
import { agentCountForViewport } from '@/shared/perf';
import { clamp } from '@/shared/math';

let nextId = 0;

/** Generate a deterministic stagger profile for non-uniform morph timing.
 *  Structural paths lead, detail paths lag, accent circles trail. */
export function generateStaggerProfile(rng: Rng): StaggerProfile {
  return {
    // paths 0-1 (structural) lead slightly, 5-7 (accents) lag
    pathOffsets: [
      rng.float(-0.12, -0.04),  // path 0: leads
      rng.float(-0.10, -0.02),  // path 1: leads
      rng.float(-0.04, 0.04),   // path 2: near center
      rng.float(-0.03, 0.05),   // path 3: near center
      rng.float(-0.02, 0.06),   // path 4: slightly lags
      rng.float(0.02, 0.10),    // path 5: lags
      rng.float(0.03, 0.12),    // path 6: lags
      rng.float(0.04, 0.15),    // path 7: lags most
    ],
    // circles 0-2 (core) track structure, 3-6 (accents) trail
    circleOffsets: [
      rng.float(-0.08, 0.02),
      rng.float(-0.06, 0.03),
      rng.float(-0.04, 0.04),
      rng.float(0.02, 0.10),
      rng.float(0.03, 0.12),
      rng.float(0.04, 0.13),
      rng.float(0.05, 0.15),
    ],
    ringOffset: rng.float(-0.05, 0.08),
  };
}

export function spawnAgent(
  rng: Rng,
  preset: CompositionPreset,
  sampler: FieldSampler,
  timeSec: number,
  xNorm?: number,
  yNorm?: number,
  familyHint?: string,
  artDirection?: ArtDirectionConfig,
): MorphAgent {
  const id = `agent-${nextId++}`;
  const x = xNorm ?? rng.float(0.02, 0.98);
  const y = yNorm ?? rng.float(0.02, 0.98);
  const sample = sampler.sample(x, y, timeSec);

  const depthBand = assignDepthBand(preset.depthBands, rng);
  const bandConfig = preset.depthBands[depthBand];

  // Pick family weighted by preset + region
  const family = rng.weightedPick(ALL_FAMILY_IDS, (fid) => {
    let w = preset.motifWeights[fid] ?? 1.0;
    // Bias toward hint family if provided (cluster coherence)
    if (familyHint && fid === familyHint) w *= 2.0;
    // Regional biases
    if (sample.region.circularity > 0.6 && (fid === 'interruptedHalo' || fid === 'eccentricOrbit')) w *= 1.3;
    if (sample.region.linearity > 0.6 && (fid === 'spineRibs' || fid === 'kinkedSpine' || fid === 'driftingTendril')) w *= 1.3;
    if (sample.region.fragmentation > 0.6 && (fid === 'scatterFragment' || fid === 'kinkedSpine')) w *= 1.5;
    if (sample.region.stretch > 0.6 && (fid === 'unfoldingFan' || fid === 'driftingTendril')) w *= 1.3;
    return w;
  });

  const energy = rng.float(0.3, 0.8);
  const morphDuration = rng.float(
    preset.morphDurationRange[0],
    preset.morphDurationRange[1],
  ) / bandConfig.morphRateMultiplier;

  const motifCtx = {
    rng: rng.fork(id + '-motif'),
    region: sample.region,
    flow: sample.flow,
    depthBand,
    energy,
  };

  // Ghost agents use dedicated macro-form factories
  const isGhost = depthBand === 'ghost';
  const macroFormType = isGhost
    ? pickMacroFormType(rng.fork(id + '-macro'), sample.flow, sample.region)
    : undefined;

  let sourceState = isGhost && macroFormType
    ? createMacroFormState(macroFormType, motifCtx)
    : createMotifState(family, motifCtx);
  let targetState = isGhost && macroFormType
    ? createMacroFormState(macroFormType, { ...motifCtx, rng: rng.fork(id + '-target') })
    : createMotifState(family, { ...motifCtx, rng: rng.fork(id + '-target') });

  // Apply art direction penalties (circle suppression, closure penalty) — not needed for macro forms
  if (artDirection && !isGhost) {
    sourceState = applyArtDirectionPenalty(sourceState, artDirection);
    targetState = applyArtDirectionPenalty(targetState, artDirection);
  }

  return {
    id,
    alive: true,
    xNorm: x,
    yNorm: y,
    vx: 0,
    vy: 0,
    heading: sample.flow.angle,
    scale: rng.float(bandConfig.scaleRange[0], bandConfig.scaleRange[1]),
    rotationDeg: rng.float(0, 360),
    opacity: rng.float(bandConfig.opacityRange[0], bandConfig.opacityRange[1]),
    energy,
    ageSec: 0,
    phase: rng.float(0, Math.PI * 2),
    morphProgress: 0,
    morphDurationSec: morphDuration,
    sourceState,
    targetState,
    currentState: clonePrimitiveState(sourceState),
    family,
    depthBand,
    paletteOffset: rng.float(0, 1),
    reseedCooldownSec: 0,
    emphasisTimer: 0,
    staggerProfile: generateStaggerProfile(rng.fork(id + '-stagger')),
    macroFormType,
  };
}

/** Spawn the initial population with cluster-aware distribution.
 *  First 40% placed uniformly, remaining 60% seeded near existing agents. */
export function spawnInitialAgents(
  rng: Rng,
  preset: CompositionPreset,
  sampler: FieldSampler,
  viewportWidth: number,
  viewportHeight: number,
  artDirection?: ArtDirectionConfig,
): MorphAgent[] {
  const count = agentCountForViewport(
    viewportWidth,
    viewportHeight,
    preset.agentCount,
    preset.minAgents,
    preset.maxAgents,
  );

  const agents: MorphAgent[] = [];
  const uniformCount = Math.ceil(count * 0.4);

  // Phase 1: uniform seed agents
  for (let i = 0; i < uniformCount; i++) {
    agents.push(spawnAgent(rng.fork(`spawn-${i}`), preset, sampler, 0, undefined, undefined, undefined, artDirection));
  }

  // Phase 2: cluster-spawned agents near existing ones
  for (let i = uniformCount; i < count; i++) {
    const attractor = agents[rng.int(0, agents.length - 1)];
    const regionSample = sampler.sample(attractor.xNorm, attractor.yNorm, 0);

    // Scatter radius modulated by region density (denser = tighter clusters)
    const scatterRadius = 0.05 + (1 - regionSample.region.density) * 0.10;
    const angle = rng.float(0, Math.PI * 2);
    const dist = rng.float(0.02, scatterRadius);
    const x = clamp(attractor.xNorm + Math.cos(angle) * dist, -0.05, 1.05);
    const y = clamp(attractor.yNorm + Math.sin(angle) * dist, -0.05, 1.05);

    agents.push(
      spawnAgent(rng.fork(`spawn-${i}`), preset, sampler, 0, x, y, attractor.family, artDirection),
    );
  }

  return agents;
}
