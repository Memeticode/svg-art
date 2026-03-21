// Flow field: multi-component field where each component is a vector (angle + magnitude).
// Each component has independent noise channels, spatial frequencies, and time scales.

import type { Rng } from './rng';
import type { FlowSample } from './schema';
import { createNoise, type NoiseGenerator } from './noise';

const TAU = Math.PI * 2;

export interface FlowField {
  sample(xNorm: number, yNorm: number, timeSec: number): FlowSample;
}

interface ComponentConfig {
  angleNoise: NoiseGenerator;
  magNoise: NoiseGenerator;
  freq: number;
  timeScale: number;
  magScale: number; // output magnitude multiplier
}

function sampleComponent(
  cfg: ComponentConfig,
  xNorm: number, yNorm: number, timeSec: number,
): { angle: number; magnitude: number } {
  const t = timeSec * cfg.timeScale;
  const raw = cfg.angleNoise.warp(
    xNorm * cfg.freq + t * 0.3,
    yNorm * cfg.freq + t * 0.2,
    3, 2.0, 0.5,
  );
  const angle = raw * TAU;

  const magRaw = cfg.magNoise.warp(
    xNorm * cfg.freq * 0.7 + t * 0.15,
    yNorm * cfg.freq * 0.7 - t * 0.1,
    2, 2.0, 0.5,
  );
  const magnitude = (magRaw * 0.5 + 0.5) * cfg.magScale;

  return { angle, magnitude };
}

export function createFlowField(rng: Rng): FlowField {
  // Each component gets independent noise for angle and magnitude
  const direction: ComponentConfig = {
    angleNoise: createNoise(rng.fork('dir-a')),
    magNoise: createNoise(rng.fork('dir-m')),
    freq: 1.8,
    timeScale: 0.04,
    magScale: 1.4,
  };

  const curl: ComponentConfig = {
    angleNoise: createNoise(rng.fork('curl-a')),
    magNoise: createNoise(rng.fork('curl-m')),
    freq: 1.5,
    timeScale: 0.03,
    magScale: 1.0,
  };

  const compression: ComponentConfig = {
    angleNoise: createNoise(rng.fork('comp-a')),
    magNoise: createNoise(rng.fork('comp-m')),
    freq: 0.9,
    timeScale: 0.02,
    magScale: 1.0,
  };

  function sample(xNorm: number, yNorm: number, timeSec: number): FlowSample {
    return {
      direction: sampleComponent(direction, xNorm, yNorm, timeSec),
      curl: sampleComponent(curl, xNorm, yNorm, timeSec),
      compression: sampleComponent(compression, xNorm, yNorm, timeSec),
    };
  }

  return { sample };
}
