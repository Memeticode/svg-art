// ── Seeded PRNG using a splitmix32-inspired algorithm ──

export interface Rng {
  next(): number;
  float(min: number, max: number): number;
  int(min: number, max: number): number;
  bool(probability?: number): boolean;
  sign(): 1 | -1;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly T[], getWeight: (item: T) => number): T;
  shuffle<T>(items: T[]): T[];
  fork(label: string): Rng;
}

/** Hash a string seed into a 32-bit integer */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** splitmix32 — fast, good-enough PRNG for generative art */
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

  const rng: Rng = {
    next: raw,

    float(min: number, max: number): number {
      return min + raw() * (max - min);
    },

    int(min: number, max: number): number {
      return Math.floor(min + raw() * (max - min + 1));
    },

    bool(probability = 0.5): boolean {
      return raw() < probability;
    },

    sign(): 1 | -1 {
      return raw() < 0.5 ? -1 : 1;
    },

    pick<T>(items: readonly T[]): T {
      return items[Math.floor(raw() * items.length)];
    },

    weightedPick<T>(items: readonly T[], getWeight: (item: T) => number): T {
      let total = 0;
      for (const item of items) total += getWeight(item);
      let r = raw() * total;
      for (const item of items) {
        r -= getWeight(item);
        if (r <= 0) return item;
      }
      return items[items.length - 1];
    },

    shuffle<T>(items: T[]): T[] {
      const arr = items.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },

    fork(label: string): Rng {
      return createRng(label + ':' + Math.floor(raw() * 0xffffffff));
    },
  };

  return rng;
}
