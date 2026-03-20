// ── Micro-deformation: smooth chaotic per-frame mutations to suggest life ──
// Operates directly on Float32Array coords — no regex, no string allocation.

import type { PrimitiveState } from './primitiveTypes';
import { clamp } from '@/shared/math';

export interface DeformContext {
  turbulence: number;
  phase: number;
  intensity: number;
  deformBias?: { angle: number; strength: number };
}

/** Multi-frequency smooth noise */
function smoothChaos(phase: number, seed: number): number {
  return (
    Math.sin(phase * 0.31 + seed * 2.7) * 0.5 +
    Math.sin(phase * 0.53 + seed * 4.1) * 0.3 +
    Math.sin(phase * 0.89 + seed * 1.3) * 0.2
  );
}

/** Apply smooth chaotic deformations using coord arrays directly. */
export function applyMicroDeform(
  state: PrimitiveState,
  ctx: DeformContext,
): PrimitiveState {
  const { turbulence, phase, intensity, deformBias } = ctx;
  const drift = Math.max(turbulence, 0.15) * intensity * 0.6;

  const biasX = deformBias ? Math.cos(deformBias.angle) * deformBias.strength : 0;
  const biasY = deformBias ? Math.sin(deformBias.angle) * deformBias.strength : 0;

  const paths = state.paths.map((p, i) => {
    if (!p.active || !p.coords || p.coords.length === 0) return p;

    const pathDrift = drift * 0.7;
    const coords = new Float32Array(p.coords);

    // Deform coordinates directly — no regex
    for (let j = 0; j < coords.length; j++) {
      const isX = j % 2 === 0;
      const seed = i * 11.3 + j * 0.73;
      const chaos = smoothChaos(phase, seed) * pathDrift;
      const bias = isX ? biasX * pathDrift * 0.6 : biasY * pathDrift * 0.6;
      const endpointFactor = (j < 4 || j > 10) ? 1.8 : 0.7;
      coords[j] += (chaos + bias) * endpointFactor;
    }

    const widthDrift = smoothChaos(phase * 0.5, i * 2.3) * 0.6;
    const newWidth = clamp(p.strokeWidth + widthDrift, 0.6, 4.0);
    const opacityDrift = smoothChaos(phase * 0.3, i * 4.7) * 0.08;
    const newOpacity = clamp(p.opacity + opacityDrift, 0.1, 1.0);

    return { ...p, coords, strokeWidth: newWidth, opacity: newOpacity };
  }) as PrimitiveState['paths'];

  return { paths };
}
