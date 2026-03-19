// ── Continuous target drift: perturb morph destination per-frame ──

import type { MorphAgent } from './MorphAgent';
import type { FlowSample } from '@/field/flowField';
import type { RegionSignature } from '@/field/regionMap';
import type { FieldSampler } from '@/field/fieldSampler';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { ArtDirectionConfig } from '@/art/artDirectionConfig';
import type { Rng } from '@/shared/rng';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import type { MotifMemory } from './motifMemory';
import { clamp } from '@/shared/math';
import { clonePrimitiveState } from '@/geometry/primitiveState';
import { createMotifState } from '@/art/motifFactories';
import { createMacroFormState, pickMacroFormType } from '@/art/macroFormFactories';
import { applyArtDirectionPenalty } from '@/art/postFilter';
import { pickNextFamily } from '@/art/designRules';
import { generateStaggerProfile } from './agentSpawner';
import { resetPersistenceAge } from './motifMemory';

export interface DriftContext {
  flow: FlowSample;
  region: RegionSignature;
  memory: MotifMemory;
  dt: number;
  phase: number;
  energy: number;
}

/** Perturb targetState in-place based on field conditions and memory.
 *  Small per-frame mutations that make the morph destination itself a moving target. */
export function applyTargetDrift(target: PrimitiveState, ctx: DriftContext): void {
  const { flow, region, memory, dt, phase } = ctx;
  // Minimum drift floor: no motif should be structurally static
  const driftScale = Math.max(region.deformationAggression, 0.15) * dt;

  const cosA = Math.cos(flow.angle);
  const sinA = Math.sin(flow.angle);
  const magDrift = Math.max(flow.magnitude, 0.1) * 0.15 * dt;

  // Drift path control points along flow direction
  for (let i = 0; i < 8; i++) {
    const p = target.paths[i];
    if (!p.active) continue;
    const inertia = memory.slotInertia[i];
    const pathDrift = magDrift / inertia;
    if (pathDrift < 0.001) continue;

    let coordIdx = 0;
    target.paths[i] = {
      ...p,
      d: p.d.replace(/-?\d+\.?\d*/g, (match) => {
        const v = parseFloat(match);
        const shift = (coordIdx++ % 2 === 0) ? cosA * pathDrift : sinA * pathDrift;
        return (v + shift).toFixed(2);
      }),
    };
  }

  // Circles and ring are doctrinally inactive — no drift needed.

  // Anti-closure path drift: when roundnessFatigue is high, perturb arc-heavy paths
  const roundnessFatigue = (memory as any).roundnessFatigue ?? 0;
  if (roundnessFatigue > 0.5) {
    const antiClosureDrift = (roundnessFatigue - 0.5) * 0.2 * dt;
    for (let i = 0; i < 8; i++) {
      const p = target.paths[i];
      if (!p.active) continue;
      // Check if path contains arc commands
      if (/[Aa]/.test(p.d)) {
        // Shift arc coordinates to break closure
        let coordIdx = 0;
        const shearAngle = memory.dominantForceAngle + Math.PI / 2;
        const shearCos = Math.cos(shearAngle) * antiClosureDrift;
        const shearSin = Math.sin(shearAngle) * antiClosureDrift;
        target.paths[i] = {
          ...p,
          d: p.d.replace(/-?\d+\.?\d*/g, (match) => {
            const v = parseFloat(match);
            const shift = (coordIdx++ % 2 === 0) ? shearCos : shearSin;
            return (v + shift).toFixed(2);
          }),
        };
      }
    }
  }
}

/** Soft reseed: seamlessly transition from current visual state toward a new target.
 *  Called when morphProgress >= threshold and cooldown expired.
 *  Returns true if reseed happened. */
export function applySoftReseed(
  agent: MorphAgent,
  timeSec: number,
  sampler: FieldSampler,
  preset: CompositionPreset,
  rng: Rng,
  neighbors: MorphAgent[] | undefined,
  artDirection: ArtDirectionConfig | undefined,
): boolean {
  const sample = sampler.sample(agent.xNorm, agent.yNorm, timeSec);
  const bandConfig = preset.depthBands[agent.depthBand];
  const isGhost = agent.depthBand === 'ghost';

  // Family echo from neighbors
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

  // Seamless: source becomes current visual state (no snap)
  agent.sourceState = clonePrimitiveState(agent.currentState);
  agent.family = nextFamily;

  let newTarget: PrimitiveState;
  if (isGhost) {
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
  }
  // Apply no-circle doctrine to all targets including ghost/macro
  if (artDirection) {
    newTarget = applyArtDirectionPenalty(newTarget, artDirection);
  }
  agent.targetState = newTarget;

  // Start at small progress (not 0) so interpolation begins near current visual state
  agent.morphProgress = 0.08;
  agent.morphDurationSec = rng.float(
    preset.morphDurationRange[0],
    preset.morphDurationRange[1],
  ) / bandConfig.morphRateMultiplier;
  agent.reseedCooldownSec = agent.morphDurationSec * 0.8;

  // Keep existing stagger profile — regenerating causes path-level jerk
  // Only gently adjust it rather than replacing wholesale
  const oldProfile = agent.staggerProfile;
  const newProfile = generateStaggerProfile(
    rng.fork(agent.id + '-stagger-' + Math.floor(timeSec)),
  );
  // Blend old and new stagger profiles for continuity
  for (let i = 0; i < 8; i++) {
    oldProfile.pathOffsets[i] = oldProfile.pathOffsets[i] * 0.7 + newProfile.pathOffsets[i] * 0.3;
  }
  for (let i = 0; i < 7; i++) {
    oldProfile.circleOffsets[i] = oldProfile.circleOffsets[i] * 0.7 + newProfile.circleOffsets[i] * 0.3;
  }
  oldProfile.ringOffset = oldProfile.ringOffset * 0.7 + newProfile.ringOffset * 0.3;

  // Brief opacity dip to soften the visual transition
  agent.opacity *= 0.90;

  resetPersistenceAge(agent.memory);
  return true;
}
