// Flow field: noise-based direction, magnitude, and curl

import type { Rng } from './rng';
import { createNoise } from './noise';

const TAU = Math.PI * 2;

export interface FlowSample {
  angle: number;
  magnitude: number;
  vx: number;
  vy: number;
  curl: number;
}

export interface FlowField {
  sample(xNorm: number, yNorm: number, timeSec: number): FlowSample;
}

export function createFlowField(rng: Rng): FlowField {
  const noiseAngle = createNoise(rng.fork('angle'));
  const noiseMag = createNoise(rng.fork('mag'));

  const freq = 1.8;
  const ts = 0.04;

  function sample(xNorm: number, yNorm: number, timeSec: number): FlowSample {
    const t = timeSec * ts;
    const raw = noiseAngle.warp(xNorm * freq + t * 0.3, yNorm * freq + t * 0.2, 3, 2.0, 0.5);
    const angle = raw * TAU;

    const magRaw = noiseMag.warp(xNorm * freq * 0.7 + t * 0.15, yNorm * freq * 0.7 - t * 0.1, 2, 2.0, 0.5);
    const magnitude = (magRaw * 0.5 + 0.5) * 1.4;

    const eps = 0.01;
    const dx = noiseAngle.warp((xNorm + eps) * freq + t * 0.3, yNorm * freq + t * 0.2, 3, 2.0, 0.5);
    const dy = noiseAngle.warp(xNorm * freq + t * 0.3, (yNorm + eps) * freq + t * 0.2, 3, 2.0, 0.5);
    const curl = (dy - raw) / eps - (dx - raw) / eps;

    return {
      angle, magnitude, curl,
      vx: Math.cos(angle) * magnitude,
      vy: Math.sin(angle) * magnitude,
    };
  }

  return { sample };
}
