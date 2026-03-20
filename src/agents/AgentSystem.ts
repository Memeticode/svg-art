// ── AgentSystem: owns the collection of agents and drives updates ──

import type { MorphAgent, AgentRenderSnapshot } from './MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { Rng } from '@/shared/rng';
import { CANVAS } from '@/shared/types';
import type { PalettePreset } from '@/art/palettePresets';
import type { ArtDirectionConfig } from '@/art/artDirectionConfig';
import { resolveArtDirection } from '@/art/artDirectionConfig';
import { updateAgent } from './agentUpdate';
import { spawnInitialAgents } from './agentSpawner';
import { resolveColors } from '@/art/colorResolvers';
import { createSpatialGrid } from './spatialGrid';
import type { ResidueSystem } from '@/render/ResidueSystem';

// Per-band parallax drift: slow time-based offset that differs per layer, creating depth
const PARALLAX_DRIFT: Record<string, { speed: number; amplitude: number; phaseX: number; phaseY: number }> = {
  ghost: { speed: 0.008, amplitude: 0.012, phaseX: 0, phaseY: 0.7 },
  back:  { speed: 0.015, amplitude: 0.020, phaseX: 1.1, phaseY: 2.3 },
  mid:   { speed: 0.025, amplitude: 0.030, phaseX: 2.7, phaseY: 0.3 },
  front: { speed: 0.040, amplitude: 0.045, phaseX: 4.1, phaseY: 3.9 },
};

export interface AgentSystem {
  agents: MorphAgent[];
  update(dt: number, timeSec: number): void;
  getSnapshots(timeSec?: number): AgentRenderSnapshot[];
  reset(): void;
  /** Attach a residue system to emit traces on family-changing reseeds */
  setResidueSystem(system: ResidueSystem): void;
}

export function createAgentSystem(
  rng: Rng,
  preset: CompositionPreset,
  palette: PalettePreset,
  sampler: FieldSampler,
): AgentSystem {
  const artDirection: ArtDirectionConfig = resolveArtDirection(preset.artDirection);

  let agents = spawnInitialAgents(
    rng.fork('initial-spawn'),
    preset,
    sampler,
    artDirection,
  );

  const grid = createSpatialGrid();
  const NEIGHBOR_RADIUS = 0.12;
  let residueSystem: ResidueSystem | null = null;

  function update(dt: number, timeSec: number): void {
    grid.rebuild(agents);
    for (const agent of agents) {
      const prevFamily = agent.family;
      const neighbors = grid.getNeighbors(agent.xNorm, agent.yNorm, NEIGHBOR_RADIUS);
      updateAgent(agent, dt, timeSec, sampler, preset, rng, neighbors, artDirection);

      // Emit residue on family-changing reseeds
      if (residueSystem && agent.family !== prevFamily) {
        const bandConfig = preset.depthBands[agent.depthBand];
        const colors = resolveColors(palette, agent.paletteOffset, bandConfig, agent.energy, agent.memory.climateScarIntensity);
        const activePaths: { d: string; strokeWidth: number }[] = [];
        for (const p of agent.currentState.paths) {
          if (p.active) activePaths.push({ d: p.d, strokeWidth: p.strokeWidth });
        }
        if (activePaths.length > 0) {
          residueSystem.emit({
            paths: activePaths,
            xPx: agent.xNorm * CANVAS.width,
            yPx: agent.yNorm * CANVAS.height,
            scale: agent.scale,
            rotationDeg: agent.rotationDeg,
            opacity: 0.10,
            maxLifeSec: 8 + Math.random() * 7,
            stroke: colors.stroke,
          });
        }
      }
    }
  }

  function getSnapshots(timeSec = 0): AgentRenderSnapshot[] {
    const snapshots: AgentRenderSnapshot[] = [];

    for (const agent of agents) {
      if (!agent.alive) continue;

      const bandConfig = preset.depthBands[agent.depthBand];
      const colors = resolveColors(
        palette,
        agent.paletteOffset,
        bandConfig,
        agent.energy,
        agent.memory.climateScarIntensity,
      );

      // Time-based parallax drift — each band drifts at different speed/phase
      const pd = PARALLAX_DRIFT[agent.depthBand] ?? PARALLAX_DRIFT.mid;
      const driftX = Math.sin(timeSec * pd.speed + pd.phaseX) * pd.amplitude;
      const driftY = Math.cos(timeSec * pd.speed * 0.7 + pd.phaseY) * pd.amplitude;

      // Compute gradient bucket from dominant force angle (16 buckets over TAU)
      // Only apply gradient to agents with meaningful climate exposure
      const climateExposure = agent.memory.climateScarIntensity;
      let gradientBucket = -1; // -1 = flat stroke (no gradient)
      if (climateExposure > 0.08) {
        const angle = agent.memory.dominantForceAngle;
        const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        gradientBucket = Math.floor((normalized / (Math.PI * 2)) * 16) % 16;
      }

      snapshots.push({
        id: agent.id,
        xPx: (agent.xNorm + driftX) * CANVAS.width,
        yPx: (agent.yNorm + driftY) * CANVAS.height,
        scale: agent.scale,
        rotationDeg: agent.rotationDeg,
        opacity: agent.opacity,
        depthBand: agent.depthBand,
        primitiveState: agent.currentState,
        resolvedStroke: colors.stroke,
        resolvedFill: colors.fill,
        resolvedGlow: colors.glow,
        gradientBucket,
      });
    }
    return snapshots;
  }

  function reset(): void {
    agents = spawnInitialAgents(
      rng.fork('respawn'),
      preset,
      sampler,
      artDirection,
    );
  }

  function setResidueSystem(system: ResidueSystem): void {
    residueSystem = system;
  }

  return { agents, update, getSnapshots, reset, setResidueSystem };
}
