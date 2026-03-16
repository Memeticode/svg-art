// ── AgentSystem: owns the collection of agents and drives updates ──

import type { MorphAgent, AgentRenderSnapshot } from './MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { CompositionPreset } from '@/art/compositionPresets';
import type { Rng } from '@/shared/rng';
import type { Viewport } from '@/shared/types';
import type { PalettePreset } from '@/art/palettePresets';
import { updateAgent } from './agentUpdate';
import { spawnInitialAgents } from './agentSpawner';
import { resolveColors } from '@/art/colorResolvers';

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
  let agents = spawnInitialAgents(
    rng.fork('initial-spawn'),
    preset,
    sampler,
    viewport.width,
    viewport.height,
  );

  function update(dt: number, timeSec: number): void {
    for (const agent of agents) {
      updateAgent(agent, dt, timeSec, sampler, preset, rng);
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
    );
  }

  return { agents, update, getSnapshots, reset };
}
