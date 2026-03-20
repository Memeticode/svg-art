// Seeded PRNG (splitmix32)

export interface Rng {
  next(): number;
  float(min: number, max: number): number;
  int(min: number, max: number): number;
  sign(): 1 | -1;
  fork(label: string): Rng;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function splitmix32(state: number): () => number {
  return () => {
    state |= 0;
    state = (state + 0x9e3779b9) | 0;
    let t = state ^ (state >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string | number): Rng {
  const numSeed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const raw = splitmix32(numSeed);

  return {
    next: raw,
    float: (min, max) => min + raw() * (max - min),
    int: (min, max) => Math.floor(min + raw() * (max - min + 1)),
    sign: () => raw() < 0.5 ? -1 : 1,
    fork: (label) => createRng(label + ':' + Math.floor(raw() * 0xffffffff)),
  };
}
