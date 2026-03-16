// ── LivingFieldApp: main orchestrator ──

import type { CreateLivingFieldOptions, LivingFieldAppHandle } from './runtimeConfig';
import type { Viewport } from '@/shared/types';
import { createRng } from '@/shared/rng';
import { createFlowField } from '@/field/flowField';
import { createRegionMap } from '@/field/regionMap';
import { createFieldSampler } from '@/field/fieldSampler';
import { createAgentSystem } from '@/agents/AgentSystem';
import { createSvgScene } from '@/render/SvgScene';
import { createSvgPool } from '@/render/SvgPool';
import { createSvgAgentRenderer } from '@/render/SvgAgentRenderer';
import { createSvgBackgroundRenderer } from '@/render/SvgBackgroundRenderer';
import { createDebugOverlays } from '@/render/DebugOverlays';
import { createAnimationLoop } from './animationLoop';
import { createResizeHandler } from './resizeObserver';
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

  const flowField = createFlowField(rng.fork('flow'), {
    baseFrequency: currentPreset.fieldFrequency,
    timeScale: currentPreset.fieldTimeScale,
  });
  const regionMap = createRegionMap(rng.fork('regions'));
  const sampler = createFieldSampler(flowField, regionMap);

  // ── Scene and rendering ──
  const scene = createSvgScene(container);
  const pool = createSvgPool();
  const agentRenderer = createSvgAgentRenderer(scene, pool);

  // Measure initial viewport
  const resizeHandler = createResizeHandler(container, handleResize);
  resizeHandler.start();
  const initialViewport = resizeHandler.getViewport();
  scene.resize(initialViewport);

  const bgRenderer = createSvgBackgroundRenderer(
    scene.bgGroup,
    scene.defs,
    currentPalette,
    initialViewport,
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
    initialViewport,
  );

  // ── Animation loop ──
  const loop = createAnimationLoop((dt, timeSec) => {
    const viewport = resizeHandler.getViewport();

    // Update simulation
    agentSystem.update(dt, timeSec);

    // Background wash
    bgRenderer.update(timeSec);

    // Render
    const snapshots = agentSystem.getSnapshots(viewport);
    agentRenderer.render(snapshots);

    // Debug overlays (no-op when no modes active)
    debugOverlays.update(agentSystem.agents, sampler, viewport, timeSec);
  }, pauseWhenHidden);

  function handleResize(viewport: Viewport): void {
    scene.resize(viewport);
    bgRenderer.resize(viewport);
  }

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
      resizeHandler.stop();
      debugOverlays.destroy();
      agentRenderer.destroy();
      bgRenderer.destroy();
      scene.destroy();
    },

    resize(): void {
      const viewport = resizeHandler.getViewport();
      handleResize(viewport);
    },

    setPreset(name: string): void {
      currentPreset = getPreset(name);
      currentPalette = getPalette(currentPreset.paletteId);
      const viewport = resizeHandler.getViewport();
      agentSystem.reset(viewport);
    },
  };
}
