// ── AgentSystem: owns the collection of agents and drives updates ──

import type { MorphAgent, AgentRenderSnapshot } from './MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { Rng } from '@/shared/rng';
import type { Viewport } from '@/shared/types';
import type { PalettePreset } from '@/art/palettePresets';
import type { ArtDirectionConfig } from '@/art/artDirectionConfig';
import { resolveArtDirection } from '@/art/artDirectionConfig';
import { updateAgent } from './agentUpdate';
import { spawnInitialAgents } from './agentSpawner';
import { resolveColors } from '@/art/colorResolvers';
import { createSpatialGrid } from './spatialGrid';

export interface AgentSystem {
  agents: MorphAgent[];
  update(dt: number, timeSec: number): void;
  getSnapshots(viewport: Viewport): AgentRenderSnapshot[];
  reset(viewport: Viewport): void;
}

export function createAgentSystem(
  rng: Rng,
  preset: CompositionPreset,
  palette: PalettePreset,
  sampler: FieldSampler,
  viewport: Viewport,
): AgentSystem {
  const artDirection: ArtDirectionConfig = resolveArtDirection(preset.artDirection);

  let agents = spawnInitialAgents(
    rng.fork('initial-spawn'),
    preset,
    sampler,
    viewport.width,
    viewport.height,
    artDirection,
  );

  const grid = createSpatialGrid();
  const NEIGHBOR_RADIUS = 0.12;

  function update(dt: number, timeSec: number): void {
    grid.rebuild(agents);
    for (const agent of agents) {
      const neighbors = grid.getNeighbors(agent.xNorm, agent.yNorm, NEIGHBOR_RADIUS);
      updateAgent(agent, dt, timeSec, sampler, preset, rng, neighbors, artDirection);
    }
  }

  function getSnapshots(vp: Viewport): AgentRenderSnapshot[] {
    const snapshots: AgentRenderSnapshot[] = [];
    for (const agent of agents) {
      if (!agent.alive) continue;

      const bandConfig = preset.depthBands[agent.depthBand];
      const colors = resolveColors(
        palette,
        agent.paletteOffset,
        bandConfig,
        agent.energy,
      );

      snapshots.push({
        id: agent.id,
        xPx: agent.xNorm * vp.width,
        yPx: agent.yNorm * vp.height,
        scale: agent.scale,
        rotationDeg: agent.rotationDeg,
        opacity: agent.opacity,
        depthBand: agent.depthBand,
        primitiveState: agent.currentState,
        resolvedStroke: colors.stroke,
        resolvedFill: colors.fill,
        resolvedGlow: colors.glow,
      });
    }
    return snapshots;
  }

  function reset(vp: Viewport): void {
    agents = spawnInitialAgents(
      rng.fork('respawn'),
      preset,
      sampler,
      vp.width,
      vp.height,
      artDirection,
    );
  }

  return { agents, update, getSnapshots, reset };
}
