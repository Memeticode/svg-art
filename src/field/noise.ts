// ── Deterministic 2D gradient noise ──
// A compact implementation suitable for flow fields and region maps.
// Uses a permutation table seeded from the application RNG.

import type { Rng } from '@/shared/rng';

export interface NoiseGenerator {
  /** Sample 2D noise in range [-1, 1] */
  sample(x: number, y: number): number;
  /** Sample with domain warping for richer turbulence */
  warp(x: number, y: number, octaves: number, lacunarity: number, gain: number): number;
}

// Precomputed gradient vectors (12 directions on a unit circle)
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

export function createNoiseGenerator(rng: Rng): NoiseGenerator {
  // Build a seeded permutation table
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  // Fisher-Yates shuffle with the seeded RNG
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  function gradDot(hash: number, x: number, y: number): number {
    const g = GRAD[hash % 12];
    return g[0] * x + g[1] * y;
  }

  function noise2D(x: number, y: number): number {
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

    const x1 = gradDot(aa, xf, yf) * (1 - u) + gradDot(ba, xf - 1, yf) * u;
    const x2 = gradDot(ab, xf, yf - 1) * (1 - u) + gradDot(bb, xf - 1, yf - 1) * u;
    return x1 * (1 - v) + x2 * v;
  }

  function warp(
    x: number,
    y: number,
    octaves: number,
    lacunarity: number,
    gain: number,
  ): number {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise2D(x * freq, y * freq) * amp;
      maxAmp += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / maxAmp;
  }

  return {
    sample: noise2D,
    warp,
  };
}
