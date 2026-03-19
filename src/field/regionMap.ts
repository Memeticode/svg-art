// ── Region map: soft spatial coherence signatures ──

import type { Rng } from '@/shared/rng';
import { createNoiseGenerator, type NoiseGenerator } from './noise';
import { clamp } from '@/shared/math';

export interface RegionSignature {
  coherence: number;
  density: number;
  brightness: number;
  circularity: number;
  linearity: number;
  fragmentation: number;
  stretch: number;
  tempo: number;
  paletteShift: number;
  /** 0..1 — high = prefer enclosed forms, low = prefer fragmented/open */
  closureTendency: number;
  /** 0..1 — how aggressively field forces warp geometry */
  deformationAggression: number;
}

export interface RegionMap {
  sample(xNorm: number, yNorm: number): RegionSignature;
  /** Returns 0..1 indicating proximity to a regional dialect boundary.
   *  High values = near a sharp transition in regional character. */
  sampleBoundaryProximity(xNorm: number, yNorm: number): number;
}

export function createRegionMap(rng: Rng): RegionMap {
  // Each property is driven by its own low-frequency noise channel
  const channels: Record<keyof RegionSignature, NoiseGenerator> = {
    coherence: createNoiseGenerator(rng.fork('reg-coherence')),
    density: createNoiseGenerator(rng.fork('reg-density')),
    brightness: createNoiseGenerator(rng.fork('reg-brightness')),
    circularity: createNoiseGenerator(rng.fork('reg-circularity')),
    linearity: createNoiseGenerator(rng.fork('reg-linearity')),
    fragmentation: createNoiseGenerator(rng.fork('reg-fragmentation')),
    stretch: createNoiseGenerator(rng.fork('reg-stretch')),
    tempo: createNoiseGenerator(rng.fork('reg-tempo')),
    paletteShift: createNoiseGenerator(rng.fork('reg-palette')),
    closureTendency: createNoiseGenerator(rng.fork('reg-closure')),
    deformationAggression: createNoiseGenerator(rng.fork('reg-deform')),
  };

  const freq = 0.5; // Low frequency → large, legible soft regions

  function sampleChannel(noise: NoiseGenerator, x: number, y: number): number {
    const raw = noise.warp(x * freq, y * freq, 2, 2.0, 0.5);
    return clamp(raw * 0.5 + 0.5, 0, 1);
  }

  function sample(xNorm: number, yNorm: number): RegionSignature {
    return {
      coherence: sampleChannel(channels.coherence, xNorm, yNorm),
      density: sampleChannel(channels.density, xNorm, yNorm),
      brightness: sampleChannel(channels.brightness, xNorm, yNorm),
      circularity: sampleChannel(channels.circularity, xNorm + 7.3, yNorm + 3.1),
      linearity: sampleChannel(channels.linearity, xNorm + 13.7, yNorm + 9.2),
      fragmentation: sampleChannel(channels.fragmentation, xNorm + 21.0, yNorm + 5.6),
      stretch: sampleChannel(channels.stretch, xNorm + 31.4, yNorm + 17.8),
      tempo: sampleChannel(channels.tempo, xNorm + 41.2, yNorm + 23.5),
      paletteShift: sampleChannel(channels.paletteShift, xNorm + 53.1, yNorm + 37.9),
      closureTendency: sampleChannel(channels.closureTendency, xNorm + 61.8, yNorm + 44.2),
      deformationAggression: sampleChannel(channels.deformationAggression, xNorm + 73.5, yNorm + 51.9),
    };
  }

  /** Measure boundary proximity via gradient magnitude of key regional properties.
   *  High gradient = sharp transition = dialect boundary. */
  function sampleBoundaryProximity(xNorm: number, yNorm: number): number {
    const eps = 0.03;
    const here = sample(xNorm, yNorm);
    const right = sample(xNorm + eps, yNorm);
    const down = sample(xNorm, yNorm + eps);

    // Gradient magnitude across coherence, linearity, fragmentation
    let gradSum = 0;
    gradSum += Math.abs(right.coherence - here.coherence) + Math.abs(down.coherence - here.coherence);
    gradSum += Math.abs(right.linearity - here.linearity) + Math.abs(down.linearity - here.linearity);
    gradSum += Math.abs(right.fragmentation - here.fragmentation) + Math.abs(down.fragmentation - here.fragmentation);

    // Normalize: typical gradient is small; scale to 0..1
    return clamp(gradSum * 3.0, 0, 1);
  }

  return { sample, sampleBoundaryProximity };
}
