// Deterministic 2D gradient noise (Perlin-style)

import type { Rng } from './rng';

export interface NoiseGenerator {
  sample(x: number, y: number): number;
  warp(x: number, y: number, octaves: number, lacunarity: number, gain: number): number;
}

const GRAD: ReadonlyArray<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071],
  [0.7071, -0.7071], [-0.7071, -0.7071],
  [0.3827, 0.9239], [-0.3827, 0.9239],
  [0.9239, 0.3827], [-0.9239, 0.3827],
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function createNoise(rng: Rng): NoiseGenerator {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function dot(hash: number, x: number, y: number): number {
    const g = GRAD[hash % 12];
    return g[0] * x + g[1] * y;
  }

  function sample(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    const x1 = dot(aa, xf, yf) * (1 - u) + dot(ba, xf - 1, yf) * u;
    const x2 = dot(ab, xf, yf - 1) * (1 - u) + dot(bb, xf - 1, yf - 1) * u;
    return x1 * (1 - v) + x2 * v;
  }

  function warp(x: number, y: number, octaves: number, lac: number, gain: number): number {
    let sum = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      sum += sample(x * freq, y * freq) * amp;
      max += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / max;
  }

  return { sample, warp };
}
