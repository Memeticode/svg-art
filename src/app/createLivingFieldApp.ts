// ── LivingFieldApp: main orchestrator ──

import type { CreateLivingFieldOptions, LivingFieldAppHandle } from './runtimeConfig';
import { createRng } from '@/shared/rng';
import { createFlowField } from '@/field/flowField';
import { createRegionMap } from '@/field/regionMap';
import { createFieldSampler } from '@/field/fieldSampler';
import { createClimateController } from '@/field/climateController';
import { createAgentSystem } from '@/agents/AgentSystem';
import { createSvgScene } from '@/render/SvgScene';
import { createSvgPool } from '@/render/SvgPool';
import { createSvgAgentRenderer } from '@/render/SvgAgentRenderer';
import { createSvgBackgroundRenderer } from '@/render/SvgBackgroundRenderer';
import { createDebugOverlays } from '@/render/DebugOverlays';
import { createResidueSystem } from '@/render/ResidueSystem';
import { createAnimationLoop } from './animationLoop';
import { getPreset, type CompositionPreset } from '@/art/compositionPresets';
import { getPalette, type PalettePreset } from '@/art/palettePresets';

export function createLivingFieldApp(
  options: CreateLivingFieldOptions = {},
): LivingFieldAppHandle {
  const {
    seed = 'living-field-default',
    preset: presetId = 'resonant-drift',
    container = document.body,
    pauseWhenHidden = true,
    debugModes,
  } = options;

  // ── Initialize core systems ──
  const rng = createRng(seed);
  let currentPreset: CompositionPreset = getPreset(presetId);
  let currentPalette: PalettePreset = getPalette(currentPreset.paletteId);

  const climate = createClimateController(rng.fork('climate'));
  const flowField = createFlowField(rng.fork('flow'), {
    baseFrequency: currentPreset.fieldFrequency,
    timeScale: currentPreset.fieldTimeScale,
  }, climate);
  const regionMap = createRegionMap(rng.fork('regions'));
  const sampler = createFieldSampler(flowField, regionMap, climate);

  // ── Scene and rendering ──
  // Fixed internal canvas (1920×1080) — CSS scales to actual viewport
  const scene = createSvgScene(container);
  const pool = createSvgPool();
  const agentRenderer = createSvgAgentRenderer(scene, pool);

  const bgRenderer = createSvgBackgroundRenderer(
    scene.bgGroup,
    scene.defs,
    currentPalette,
  );

  // ── Debug overlays ──
  const debugOverlays = createDebugOverlays(scene.svg);
  if (debugModes && debugModes.length > 0) {
    debugOverlays.setModes(debugModes);
  }

  // ── Agent system ──
  const agentSystem = createAgentSystem(
    rng.fork('agents'),
    currentPreset,
    currentPalette,
    sampler,
  );

  // ── Residue system ──
  const residueSystem = createResidueSystem(scene.layers.residue);
  agentSystem.setResidueSystem(residueSystem);

  // ── Animation loop ──
  const loop = createAnimationLoop((dt, timeSec) => {
    // Advance climate state (attractors, fronts, seasonal phase)
    climate.update(dt);

    // Update simulation
    agentSystem.update(dt, timeSec);

    // Residue: decay and render fading traces
    residueSystem.update(dt);
    residueSystem.render();

    // Background wash
    bgRenderer.update(timeSec);

    // Render
    const snapshots = agentSystem.getSnapshots(timeSec);
    agentRenderer.render(snapshots);

    // Debug overlays (no-op when no modes active)
    debugOverlays.update(agentSystem.agents, sampler, timeSec, climate);
  }, pauseWhenHidden);

  // Auto-start
  loop.start();

  // ── Public API ──
  return {
    start(): void {
      loop.start();
    },

    stop(): void {
      loop.stop();
    },

    destroy(): void {
      loop.stop();
      debugOverlays.destroy();
      agentRenderer.destroy();
      bgRenderer.destroy();
      scene.destroy();
    },

    resize(): void {
      // No-op — fixed internal canvas, CSS handles scaling
    },

    setPreset(name: string): void {
      currentPreset = getPreset(name);
      currentPalette = getPalette(currentPreset.paletteId);
      agentSystem.reset();
    },
  };
}
