// ── Flow field: samples directional motion, curl, and turbulence ──

import type { Rng } from '@/shared/rng';
import { createNoiseGenerator, type NoiseGenerator } from './noise';
import { TAU } from '@/shared/math';

export interface FlowSample {
  angle: number;
  magnitude: number;
  vx: number;
  vy: number;
  curl: number;
  turbulence: number;
  pressure: number;
  /** 0..1 — how strongly this point is a convergence zone (flows meeting) */
  convergenceZone: number;
}

export interface FlowField {
  sample(xNorm: number, yNorm: number, timeSec: number): FlowSample;
}

export interface FlowFieldConfig {
  /** Spatial frequency of the primary flow layer */
  baseFrequency: number;
  /** How fast the field evolves over time */
  timeScale: number;
  /** Global magnitude multiplier */
  magnitudeScale: number;
  /** Curl sampling epsilon */
  curlEpsilon: number;
}

const DEFAULT_CONFIG: FlowFieldConfig = {
  baseFrequency: 1.8,
  timeScale: 0.04,
  magnitudeScale: 1.4,
  curlEpsilon: 0.01,
};

export function createFlowField(
  rng: Rng,
  config: Partial<FlowFieldConfig> = {},
): FlowField {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Three noise channels for layered behavior
  const noiseAngle: NoiseGenerator = createNoiseGenerator(rng.fork('flow-angle'));
  const noiseMag: NoiseGenerator = createNoiseGenerator(rng.fork('flow-mag'));
  const noiseTurb: NoiseGenerator = createNoiseGenerator(rng.fork('flow-turb'));

  function sample(xNorm: number, yNorm: number, timeSec: number): FlowSample {
    const t = timeSec * cfg.timeScale;
    const freq = cfg.baseFrequency;

    // Primary angle from blended noise layers
    const raw = noiseAngle.warp(
      xNorm * freq + t * 0.3,
      yNorm * freq + t * 0.2,
      3, 2.0, 0.5,
    );
    const angle = raw * TAU;

    // Magnitude from a separate channel — produces quiet/active zones
    const magRaw = noiseMag.warp(
      xNorm * freq * 0.7 + t * 0.15,
      yNorm * freq * 0.7 - t * 0.1,
      2, 2.0, 0.5,
    );
    const magnitude = (magRaw * 0.5 + 0.5) * cfg.magnitudeScale;

    // Curl: approximate via finite differences on the angle channel
    const eps = cfg.curlEpsilon;
    const dxVal = noiseAngle.warp(
      (xNorm + eps) * freq + t * 0.3,
      yNorm * freq + t * 0.2,
      3, 2.0, 0.5,
    );
    const dyVal = noiseAngle.warp(
      xNorm * freq + t * 0.3,
      (yNorm + eps) * freq + t * 0.2,
      3, 2.0, 0.5,
    );
    const curl = (dyVal - raw) / eps - (dxVal - raw) / eps;

    // Turbulence: high-frequency jitter channel
    const turbulence = Math.abs(
      noiseTurb.sample(
        xNorm * freq * 3 + t * 0.5,
        yNorm * freq * 3 - t * 0.3,
      ),
    );

    // Pressure: low-frequency spatial variation
    const pressure = noiseMag.sample(
      xNorm * freq * 0.4 + t * 0.05,
      yNorm * freq * 0.4 + t * 0.05,
    ) * 0.5 + 0.5;

    const vx = Math.cos(angle) * magnitude;
    const vy = Math.sin(angle) * magnitude;

    // Convergence zone: detect pressure gradient (where pressure drops sharply)
    const pRight = noiseMag.sample(
      (xNorm + eps * 2) * freq * 0.4 + t * 0.05,
      yNorm * freq * 0.4 + t * 0.05,
    ) * 0.5 + 0.5;
    const pDown = noiseMag.sample(
      xNorm * freq * 0.4 + t * 0.05,
      (yNorm + eps * 2) * freq * 0.4 + t * 0.05,
    ) * 0.5 + 0.5;
    const pressureGradient = Math.sqrt(
      (pRight - pressure) * (pRight - pressure) +
      (pDown - pressure) * (pDown - pressure),
    ) / (eps * 2);
    // Normalize: high gradient = convergence zone
    const convergenceZone = Math.min(1, pressureGradient * 0.15);

    return { angle, magnitude, vx, vy, curl, turbulence, pressure, convergenceZone };
  }

  return { sample };
}
