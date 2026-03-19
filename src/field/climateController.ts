// ── Climate controller: multi-timescale field evolution ──
// Manages deep attractors, seasonal modulation, and weather fronts.
// Each layer evolves independently and couples downward.

import type { Rng } from '@/shared/rng';
import type { Vec2 } from '@/shared/types';
import { createNoiseGenerator, type NoiseGenerator } from './noise';
import { clamp } from '@/shared/math';

export interface PressureFront {
  position: Vec2;
  direction: Vec2;
  speed: number;       // normalized units per second
  width: number;       // influence radius
  intensity: number;   // 0..1
}

export interface Attractor {
  position: Vec2;
  strength: number;    // 0.3..1.0
  radius: number;      // influence radius in normalized space (0.2..0.5)
}

export interface ClimateState {
  deepPhase: number;
  seasonalPhase: number;
  weatherPhase: number;
  attractors: Attractor[];
  fronts: PressureFront[];
}

export interface ClimateController {
  state: ClimateState;
  update(dt: number): void;
  /** Sample attractor influence at a point: returns { pull: Vec2, calmFactor: 0..1 } */
  sampleAttractors(x: number, y: number): { pullX: number; pullY: number; calmFactor: number };
  /** Sample front influence at a point: returns { convergence: 0..1, curlBoost: number, biasAngle: number } */
  sampleFronts(x: number, y: number): { convergence: number; curlBoost: number; biasAngle: number };
  /** Sample seasonal modulation at a point: returns multipliers for region properties */
  sampleSeasonal(x: number, y: number): { coherenceMod: number; fragmentationMod: number; linearityMod: number };
}

// Timescale rates
const DEEP_RATE = 0.005;       // ~180s full cycle (TAU/0.005 ≈ 1257s, but noise doesn't cycle — this is drift rate)
const SEASONAL_RATE = 0.015;   // ~60s character drift
const WEATHER_RATE = 0.06;     // ~15s front migration

const ATTRACTOR_COUNT = 3;
const FRONT_COUNT = 2;

export function createClimateController(rng: Rng): ClimateController {
  const deepNoise: NoiseGenerator = createNoiseGenerator(rng.fork('climate-deep'));
  const seasonalNoise: NoiseGenerator = createNoiseGenerator(rng.fork('climate-seasonal'));
  const frontNoise: NoiseGenerator = createNoiseGenerator(rng.fork('climate-fronts'));

  const state: ClimateState = {
    deepPhase: 0,
    seasonalPhase: 0,
    weatherPhase: 0,
    attractors: [],
    fronts: [],
  };

  // Initialize attractors at noise-derived positions
  for (let i = 0; i < ATTRACTOR_COUNT; i++) {
    state.attractors.push({
      position: {
        x: clamp(deepNoise.sample(i * 7.3, 0) * 0.3 + 0.5, 0.1, 0.9),
        y: clamp(deepNoise.sample(0, i * 7.3) * 0.3 + 0.5, 0.1, 0.9),
      },
      strength: 0.5 + deepNoise.sample(i * 3.1, i * 5.7) * 0.2,
      radius: 0.3 + deepNoise.sample(i * 11.2, i * 8.4) * 0.1,
    });
  }

  // Initialize pressure fronts
  for (let i = 0; i < FRONT_COUNT; i++) {
    const angle = frontNoise.sample(i * 5.5, 0) * Math.PI * 2;
    state.fronts.push({
      position: {
        x: clamp(frontNoise.sample(i * 9.1, 3.2) * 0.4 + 0.5, -0.2, 1.2),
        y: clamp(frontNoise.sample(3.2, i * 9.1) * 0.4 + 0.5, -0.2, 1.2),
      },
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: 0.015 + Math.abs(frontNoise.sample(i * 4.3, i * 6.7)) * 0.02,
      width: 0.12 + Math.abs(frontNoise.sample(i * 2.1, i * 8.9)) * 0.08,
      intensity: 0.4 + Math.abs(frontNoise.sample(i * 7.7, i * 1.3)) * 0.4,
    });
  }

  function update(dt: number): void {
    state.deepPhase += DEEP_RATE * dt;
    state.seasonalPhase += SEASONAL_RATE * dt;
    state.weatherPhase += WEATHER_RATE * dt;

    const dp = state.deepPhase;

    // Drift attractors via very slow noise — they move like continents
    for (let i = 0; i < state.attractors.length; i++) {
      const a = state.attractors[i];
      const nx = deepNoise.sample(dp * 0.3 + i * 7.3, dp * 0.2 + i * 11.1);
      const ny = deepNoise.sample(dp * 0.2 + i * 13.7, dp * 0.3 + i * 5.9);
      // Very gentle drift: attractors move slowly within [0.1, 0.9]
      a.position.x = clamp(a.position.x + nx * 0.0003 * dt, 0.05, 0.95);
      a.position.y = clamp(a.position.y + ny * 0.0003 * dt, 0.05, 0.95);

      // Strength and radius oscillate gently
      a.strength = clamp(
        0.5 + deepNoise.sample(dp * 0.15 + i * 3.3, dp * 0.1 + i * 9.1) * 0.3,
        0.3, 1.0,
      );
      a.radius = clamp(
        0.3 + deepNoise.sample(dp * 0.1 + i * 17.5, dp * 0.08 + i * 6.3) * 0.1,
        0.2, 0.5,
      );
    }

    // Move pressure fronts across the viewport
    const wp = state.weatherPhase;
    for (let i = 0; i < state.fronts.length; i++) {
      const f = state.fronts[i];

      // Advance position
      f.position.x += f.direction.x * f.speed * dt;
      f.position.y += f.direction.y * f.speed * dt;

      // Front direction drifts slowly to follow deep-layer flow
      const dirNoise = frontNoise.sample(wp * 0.5 + i * 8.3, wp * 0.4 + i * 12.1);
      const angleAdj = dirNoise * 0.002 * dt;
      const cos = Math.cos(angleAdj);
      const sin = Math.sin(angleAdj);
      const dx = f.direction.x * cos - f.direction.y * sin;
      const dy = f.direction.x * sin + f.direction.y * cos;
      const len = Math.sqrt(dx * dx + dy * dy);
      f.direction.x = dx / (len || 1);
      f.direction.y = dy / (len || 1);

      // Intensity oscillates
      f.intensity = clamp(
        0.4 + frontNoise.sample(wp * 0.3 + i * 4.7, wp * 0.2 + i * 7.3) * 0.4,
        0.2, 0.9,
      );

      // Wrap fronts that exit the viewport (re-enter from opposite side)
      if (f.position.x < -0.3 || f.position.x > 1.3 ||
          f.position.y < -0.3 || f.position.y > 1.3) {
        // Re-enter from opposite side with slight randomization
        f.position.x = f.direction.x > 0 ? -0.2 : 1.2;
        f.position.y = clamp(
          frontNoise.sample(wp + i * 5.5, wp + i * 3.3) * 0.4 + 0.5,
          -0.1, 1.1,
        );
        f.speed = 0.015 + Math.abs(frontNoise.sample(wp + i * 2.2, wp + i * 8.8)) * 0.02;
      }
    }
  }

  function sampleAttractors(x: number, y: number): { pullX: number; pullY: number; calmFactor: number } {
    let pullX = 0;
    let pullY = 0;
    let calmFactor = 0;

    for (const a of state.attractors) {
      const dx = a.position.x - x;
      const dy = a.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > a.radius * 2) continue;

      // Gaussian-ish influence falloff
      const influence = a.strength * Math.exp(-(dist * dist) / (a.radius * a.radius * 0.5));

      // Pull toward attractor
      if (dist > 0.001) {
        pullX += (dx / dist) * influence * 0.3;
        pullY += (dy / dist) * influence * 0.3;
      }

      // Calm factor: how much this point is soothed by attractor proximity
      calmFactor = Math.max(calmFactor, influence);
    }

    return { pullX, pullY, calmFactor: clamp(calmFactor, 0, 1) };
  }

  function sampleFronts(x: number, y: number): { convergence: number; curlBoost: number; biasAngle: number } {
    let convergence = 0;
    let curlBoost = 0;
    let biasAngle = 0;
    let totalWeight = 0;

    for (const f of state.fronts) {
      // Distance from point to front line (perpendicular distance)
      // Front line passes through f.position with direction f.direction
      const dx = x - f.position.x;
      const dy = y - f.position.y;
      // Perpendicular distance = cross product magnitude
      const perpDist = Math.abs(dx * f.direction.y - dy * f.direction.x);

      if (perpDist > f.width * 3) continue;

      // Gaussian influence based on perpendicular distance
      const influence = f.intensity * Math.exp(-(perpDist * perpDist) / (f.width * f.width * 0.5));

      convergence = Math.max(convergence, influence);
      curlBoost += influence * 0.5; // Curl perpendicular to front

      // Bias angle: perpendicular to front direction (the convergence direction)
      const frontAngle = Math.atan2(f.direction.y, f.direction.x);
      biasAngle += (frontAngle + Math.PI / 2) * influence;
      totalWeight += influence;
    }

    if (totalWeight > 0) {
      biasAngle /= totalWeight;
    }

    return {
      convergence: clamp(convergence, 0, 1),
      curlBoost: clamp(curlBoost, 0, 1),
      biasAngle,
    };
  }

  function sampleSeasonal(x: number, y: number): { coherenceMod: number; fragmentationMod: number; linearityMod: number } {
    const sp = state.seasonalPhase;

    // Phase-offset by spatial position so different regions drift out of sync
    const spatialOffset = x * 2.7 + y * 3.1;

    const coherenceMod = 0.7 + 0.3 * Math.sin(sp + spatialOffset);
    const fragmentationMod = 0.7 + 0.3 * Math.sin(sp * 1.1 + spatialOffset + 2.0); // counter-phase
    const linearityMod = 0.7 + 0.3 * Math.sin(sp * 0.8 + spatialOffset + 4.5); // independent phase

    return { coherenceMod, fragmentationMod, linearityMod };
  }

  return { state, update, sampleAttractors, sampleFronts, sampleSeasonal };
}
