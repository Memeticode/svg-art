// ── Micro-deformation: smooth chaotic per-frame mutations to suggest life ──
// Uses multi-frequency layered sine waves for organic, non-repeating motion.
// Key principle: chaotic but temporally smooth — never jumps, always drifts.

import type { PrimitiveState } from './primitiveTypes';
import { clamp } from '@/shared/math';

export interface DeformContext {
  turbulence: number; // 0..1 from flow field
  phase: number;      // agent phase (continuous, slowly increasing)
  intensity: number;  // overall deform strength
  deformBias?: { angle: number; strength: number }; // directional bias from flow
}

/** Multi-frequency smooth noise — layered incommensurate sine waves.
 *  Produces organic drift without periodicity. */
function smoothChaos(phase: number, seed: number): number {
  return (
    Math.sin(phase * 0.31 + seed * 2.7) * 0.5 +
    Math.sin(phase * 0.53 + seed * 4.1) * 0.3 +
    Math.sin(phase * 0.89 + seed * 1.3) * 0.2
  );
}

/** Apply smooth chaotic deformations to a state snapshot.
 *  Every path coordinate drifts continuously along flow-biased directions. */
export function applyMicroDeform(
  state: PrimitiveState,
  ctx: DeformContext,
): PrimitiveState {
  const { turbulence, phase, intensity, deformBias } = ctx;
  // Slower, smoother base — avoids frame-to-frame flicker
  const drift = Math.max(turbulence, 0.15) * intensity * 0.6;

  // Directional bias components
  const biasX = deformBias ? Math.cos(deformBias.angle) * deformBias.strength : 0;
  const biasY = deformBias ? Math.sin(deformBias.angle) * deformBias.strength : 0;

  // Circles are doctrinally inactive but handle gracefully
  const circles = state.circles.map((c, i) => {
    if (!c.active) return c;
    return {
      ...c,
      cx: c.cx + smoothChaos(phase, i * 3.1) * drift * 1.2 + biasX * drift * 0.5,
      cy: c.cy + smoothChaos(phase, i * 5.3) * drift * 1.2 + biasY * drift * 0.5,
      r: clamp(c.r + smoothChaos(phase, i * 7.7) * drift * 0.3, 0.1, 50),
    };
  }) as PrimitiveState['circles'];

  const ring = state.ring; // Ring is inactive per no-circle doctrine

  // Deform path coordinates with multi-frequency chaos + directional flow bias
  const paths = state.paths.map((p, i) => {
    if (!p.active) return p;
    const pathDrift = drift * 0.7;
    let coordIdx = 0;
    const d = p.d.replace(/-?\d+\.?\d*/g, (match) => {
      const v = parseFloat(match);
      const isX = coordIdx % 2 === 0;
      const seed = i * 11.3 + coordIdx * 0.73;
      // Multi-frequency chaos for organic, non-repeating drift
      const chaos = smoothChaos(phase, seed) * pathDrift;
      // Flow-aligned directional bias
      const bias = isX ? biasX * pathDrift * 0.6 : biasY * pathDrift * 0.6;
      // Per-coordinate growth/retraction — endpoints drift more than control points
      const endpointFactor = (coordIdx < 4 || coordIdx > 10) ? 1.8 : 0.7;
      coordIdx++;
      return (v + (chaos + bias) * endpointFactor).toFixed(2);
    });

    // Vary stroke width smoothly over time — wider range for visible taper
    const widthDrift = smoothChaos(phase * 0.5, i * 2.3) * 0.6;
    const newWidth = clamp(p.strokeWidth + widthDrift, 0.6, 4.0);

    // Vary opacity smoothly for depth breathing
    const opacityDrift = smoothChaos(phase * 0.3, i * 4.7) * 0.08;
    const newOpacity = clamp(p.opacity + opacityDrift, 0.1, 1.0);

    return { ...p, d, strokeWidth: newWidth, opacity: newOpacity };
  }) as PrimitiveState['paths'];

  return { paths, circles, ring };
}
