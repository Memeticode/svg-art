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
import { clonePrimitiveState, ensureAllParsed } from '@/geometry/primitiveState';
import { clamp, lerp } from '@/shared/math';
import { createMotifMemory } from './motifMemory';

let nextId = 0;

/** Generate a deterministic stagger profile for non-uniform morph timing.
 *  Structural paths lead, detail paths lag, residue trails. */
export function generateStaggerProfile(rng: Rng): StaggerProfile {
  return {
    // paths 0-1 (contour segments) lead, 5-7 (scaffold/puncture) lag,
    // 8-9 (lobe/manifold) trail, 10-11 (residue) trail most
    pathOffsets: [
      rng.float(-0.12, -0.04),  // path 0: leads
      rng.float(-0.10, -0.02),  // path 1: leads
      rng.float(-0.04, 0.04),   // path 2: near center
      rng.float(-0.03, 0.05),   // path 3: near center
      rng.float(-0.02, 0.06),   // path 4: slightly lags
      rng.float(0.02, 0.10),    // path 5: lags
      rng.float(0.03, 0.12),    // path 6: lags
      rng.float(0.04, 0.15),    // path 7: lags most of original set
      rng.float(0.05, 0.13),    // path 8: lobe edge trails
      rng.float(0.05, 0.13),    // path 9: manifold trace trails
      rng.float(0.06, 0.15),    // path 10: residue trails most
      rng.float(0.06, 0.15),    // path 11: residue trails most
    ],
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
    if (sample.region.circularity > 0.6 && (fid === 'interruptedShell' || fid === 'partialEnclosure')) w *= 1.3;
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

  const memory = createMotifMemory();
  const motifCtx = {
    rng: rng.fork(id + '-motif'),
    region: sample.region,
    flow: sample.flow,
    depthBand,
    energy,
    memory,
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

  // Apply art direction penalties (no-circle doctrine, closure breaking)
  if (artDirection) {
    sourceState = ensureAllParsed(applyArtDirectionPenalty(sourceState, artDirection));
    targetState = ensureAllParsed(applyArtDirectionPenalty(targetState, artDirection));
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
    opacity: rng.float(
      lerp(bandConfig.opacityRange[0], bandConfig.opacityRange[1], 0.3),
      bandConfig.opacityRange[1],
    ),
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
    memory,
  };
}

/** Spawn the initial population with cluster-aware distribution.
 *  First 40% placed uniformly, remaining 60% seeded near existing agents. */
export function spawnInitialAgents(
  rng: Rng,
  preset: CompositionPreset,
  sampler: FieldSampler,
  artDirection?: ArtDirectionConfig,
): MorphAgent[] {
  const count = preset.agentCount;

  const agents: MorphAgent[] = [];
  const uniformCount = Math.ceil(count * 0.35);
  const edgeCount = Math.ceil(count * 0.15);

  // Phase 1: uniform seed agents (interior)
  for (let i = 0; i < uniformCount; i++) {
    agents.push(spawnAgent(rng.fork(`spawn-${i}`), preset, sampler, 0, undefined, undefined, undefined, artDirection));
  }

  // Phase 2: edge-entering agents (off-screen continuity)
  // Spawn near or beyond viewport edges so forms enter/exit naturally
  for (let i = uniformCount; i < uniformCount + edgeCount; i++) {
    const edge = rng.int(0, 3); // 0=left, 1=right, 2=top, 3=bottom
    let x: number;
    let y: number;
    switch (edge) {
      case 0: x = rng.float(-0.15, -0.02); y = rng.float(0.0, 1.0); break;
      case 1: x = rng.float(1.02, 1.15); y = rng.float(0.0, 1.0); break;
      case 2: x = rng.float(0.0, 1.0); y = rng.float(-0.15, -0.02); break;
      default: x = rng.float(0.0, 1.0); y = rng.float(1.02, 1.15); break;
    }
    agents.push(spawnAgent(rng.fork(`spawn-${i}`), preset, sampler, 0, x, y, undefined, artDirection));
  }

  // Phase 3: cluster-spawned agents near existing ones
  for (let i = uniformCount + edgeCount; i < count; i++) {
    const anchor = agents[rng.int(0, agents.length - 1)];
    const regionSample = sampler.sample(anchor.xNorm, anchor.yNorm, 0);

    // Scatter radius modulated by region density (denser = tighter clusters)
    const scatterRadius = 0.05 + (1 - regionSample.region.density) * 0.10;
    const angle = rng.float(0, Math.PI * 2);
    const dist = rng.float(0.02, scatterRadius);
    const x = clamp(anchor.xNorm + Math.cos(angle) * dist, -0.15, 1.15);
    const y = clamp(anchor.yNorm + Math.sin(angle) * dist, -0.15, 1.15);

    agents.push(
      spawnAgent(rng.fork(`spawn-${i}`), preset, sampler, 0, x, y, anchor.family, artDirection),
    );
  }

  return agents;
}
