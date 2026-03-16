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
  const driftScale = region.deformationAggression * dt;
  if (driftScale < 0.0001) return; // calm region, skip drift

  const cosA = Math.cos(flow.angle);
  const sinA = Math.sin(flow.angle);
  const magDrift = flow.magnitude * 0.15 * dt;

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

  // Drift circle positions with phase-based variation
  for (let i = 0; i < 7; i++) {
    const c = target.circles[i];
    if (!c.active) continue;
    const inertia = memory.slotInertia[8 + i];
    const circleDrift = flow.turbulence * 0.1 * dt / inertia;

    const cxShift = Math.sin(phase * 1.7 + i * 2.3) * circleDrift;
    const cyShift = Math.cos(phase * 2.1 + i * 1.9) * circleDrift;

    target.circles[i] = {
      ...c,
      cx: c.cx + cxShift,
      cy: c.cy + cyShift,
    };

    // Closure fatigue: shrink circles when fatigue is high
    if (memory.closureFatigue > 0.5) {
      const fatigueDelta = (memory.closureFatigue - 0.5) * 0.1 * dt / inertia;
      target.circles[i] = {
        ...target.circles[i],
        r: Math.max(0.1, target.circles[i].r - fatigueDelta),
      };
    }

    // High fragmentation deactivates accent circles (slots 3-6)
    if (i >= 3 && region.fragmentation > 0.6) {
      const fragChance = (region.fragmentation - 0.6) * 0.02 * dt;
      if (fragChance > 0.001 && Math.sin(phase * 3.1 + i * 7.7) > 1 - fragChance * 10) {
        target.circles[i] = { ...target.circles[i], opacity: target.circles[i].opacity * 0.95 };
      }
    }
  }

  // Ring gap drift from closure fatigue
  if (target.ring.active && memory.closureFatigue > 0.5) {
    const ringInertia = memory.slotInertia[15];
    const gapDrift = (memory.closureFatigue - 0.5) * 0.02 * dt / ringInertia;
    target.ring = {
      ...target.ring,
      gapEnd: target.ring.gapEnd + gapDrift,
    };
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

  agent.staggerProfile = generateStaggerProfile(
    rng.fork(agent.id + '-stagger-' + Math.floor(timeSec)),
  );

  resetPersistenceAge(agent.memory);
  return true;
}
