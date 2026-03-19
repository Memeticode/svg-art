// ── Flow field: samples directional motion, curl, and turbulence ──
// Now climate-aware: deep attractors, weather fronts, and seasonal modulation
// blend with the existing noise-based micro layer.

import type { Rng } from '@/shared/rng';
import { createNoiseGenerator, type NoiseGenerator } from './noise';
import { TAU, clamp } from '@/shared/math';
import type { ClimateController } from './climateController';

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
  climate?: ClimateController,
): FlowField {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Three noise channels for the micro layer (existing behavior)
  const noiseAngle: NoiseGenerator = createNoiseGenerator(rng.fork('flow-angle'));
  const noiseMag: NoiseGenerator = createNoiseGenerator(rng.fork('flow-mag'));
  const noiseTurb: NoiseGenerator = createNoiseGenerator(rng.fork('flow-turb'));

  function sample(xNorm: number, yNorm: number, timeSec: number): FlowSample {
    const t = timeSec * cfg.timeScale;
    const freq = cfg.baseFrequency;

    // ── Micro layer (existing noise, ~15% weight with climate, 100% without) ──
    const raw = noiseAngle.warp(
      xNorm * freq + t * 0.3,
      yNorm * freq + t * 0.2,
      3, 2.0, 0.5,
    );
    const microAngle = raw * TAU;

    const magRaw = noiseMag.warp(
      xNorm * freq * 0.7 + t * 0.15,
      yNorm * freq * 0.7 - t * 0.1,
      2, 2.0, 0.5,
    );
    const microMag = (magRaw * 0.5 + 0.5) * cfg.magnitudeScale;

    // Curl via finite differences on the angle channel
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
    let curl = (dyVal - raw) / eps - (dxVal - raw) / eps;

    // Turbulence: high-frequency jitter channel
    let turbulence = Math.abs(
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

    // Convergence zone from pressure gradient
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
    let convergenceZone = Math.min(1, pressureGradient * 0.15);

    // ── Without climate controller: return micro layer only (backwards compatible) ──
    if (!climate) {
      const vx = Math.cos(microAngle) * microMag;
      const vy = Math.sin(microAngle) * microMag;
      return { angle: microAngle, magnitude: microMag, vx, vy, curl, turbulence, pressure, convergenceZone };
    }

    // ── With climate: blend deep + weather + micro layers ──

    // Deep layer: attractor pull and calm zones
    const attractor = climate.sampleAttractors(xNorm, yNorm);
    const deepAngle = Math.atan2(attractor.pullY, attractor.pullX);
    const deepMag = Math.sqrt(attractor.pullX * attractor.pullX + attractor.pullY * attractor.pullY);

    // Weather layer: pressure front influence
    const front = climate.sampleFronts(xNorm, yNorm);

    // Micro amplitude modulated by weather intensity and attractor calm
    const weatherIntensity = front.convergence;
    const microAmpMod = (0.5 + weatherIntensity * 0.5) * (1 - attractor.calmFactor * 0.5);
    turbulence *= microAmpMod;

    // Blend angles: deep 30%, weather (front bias) 35%, micro 35%
    // Use weighted vector addition for proper angle blending
    const deepWeight = 0.30 * (deepMag > 0.01 ? 1 : 0); // only contribute if there's a pull
    const weatherWeight = 0.35 * weatherIntensity;
    const microWeight = Math.max(0.15, 1 - deepWeight - weatherWeight); // micro gets the rest, min 15%

    let bvx = 0;
    let bvy = 0;

    // Deep contribution: direction toward attractors
    if (deepWeight > 0) {
      bvx += Math.cos(deepAngle) * deepWeight;
      bvy += Math.sin(deepAngle) * deepWeight;
    }

    // Weather contribution: front bias angle
    if (weatherWeight > 0) {
      bvx += Math.cos(front.biasAngle) * weatherWeight;
      bvy += Math.sin(front.biasAngle) * weatherWeight;
    }

    // Micro contribution: existing noise angle
    bvx += Math.cos(microAngle) * microWeight;
    bvy += Math.sin(microAngle) * microWeight;

    const blendedAngle = Math.atan2(bvy, bvx);

    // Blended magnitude: micro base, modulated by attractor calm and front intensity
    // Near attractors: calmer (reduced magnitude), more coherent
    // Near fronts: higher intensity
    const calmReduction = 1 - attractor.calmFactor * 0.4;
    const frontBoost = 1 + front.convergence * 0.3;
    const blendedMag = microMag * calmReduction * frontBoost;

    // Curl boosted near fronts (perpendicular to front line)
    curl += front.curlBoost * 2.0;

    // Convergence zone enhanced near fronts
    convergenceZone = clamp(convergenceZone + front.convergence * 0.5, 0, 1);

    const vx = Math.cos(blendedAngle) * blendedMag;
    const vy = Math.sin(blendedAngle) * blendedMag;

    return {
      angle: blendedAngle,
      magnitude: blendedMag,
      vx, vy,
      curl,
      turbulence,
      pressure,
      convergenceZone,
    };
  }

  return { sample };
}
