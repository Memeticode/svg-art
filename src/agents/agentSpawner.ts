// ── Agent spawning ──

import type { Rng } from '@/shared/rng';
import type { MorphAgent } from './MorphAgent';
import type { CompositionPreset, DepthBandConfig } from '@/art/compositionPresets';
import type { FieldSampler } from '@/field/fieldSampler';
import type { MotifFamilyId } from '@/shared/types';
import { ALL_FAMILY_IDS } from '@/art/motifFamilies';
import { assignDepthBand } from './depthBands';
import { createMotifState } from '@/art/motifFactories';
import { zeroPrimitiveState, clonePrimitiveState } from '@/geometry/primitiveState';
import { agentCountForViewport } from '@/shared/perf';

let nextId = 0;

export function spawnAgent(
  rng: Rng,
  preset: CompositionPreset,
  sampler: FieldSampler,
  timeSec: number,
  xNorm?: number,
  yNorm?: number,
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
    if (sample.region.circularity > 0.6 && (fid === 'interruptedHalo' || fid === 'radialCluster')) w *= 1.2;
    if (sample.region.linearity > 0.6 && (fid === 'spineRibs' || fid === 'branchStruts')) w *= 1.2;
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

  const sourceState = createMotifState(family, motifCtx);
  const targetState = createMotifState(family, {
    ...motifCtx,
    rng: rng.fork(id + '-target'),
  });

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
  };
}

/** Spawn the initial population of agents */
export function spawnInitialAgents(
  rng: Rng,
  preset: CompositionPreset,
  sampler: FieldSampler,
  viewportWidth: number,
  viewportHeight: number,
): MorphAgent[] {
  const count = agentCountForViewport(
    viewportWidth,
    viewportHeight,
    preset.agentCount,
    preset.minAgents,
    preset.maxAgents,
  );

  const agents: MorphAgent[] = [];
  for (let i = 0; i < count; i++) {
    agents.push(spawnAgent(rng.fork(`spawn-${i}`), preset, sampler, 0));
  }
  return agents;
}
