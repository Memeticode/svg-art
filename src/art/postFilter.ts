// ── Post-generation art direction filters ──
// Enforce no-circle doctrine via path-based arc sweep caps.
// Circles are doctrinally inactive — no circle manipulation needed.

import type { PrimitiveState } from '@/geometry/primitiveTypes';
import type { ArtDirectionConfig } from './artDirectionConfig';
import { clonePrimitiveState } from '@/geometry/primitiveState';

// Regex to detect arc commands with large sweep
const ARC_LARGE_RE = /([Aa])\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)[,\s]+1[,\s]+([01])[,\s]+(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/g;

/** Apply art direction enforcement to a generated PrimitiveState.
 *  Pure function — enforces no-circle doctrine on paths. */
export function applyArtDirectionPenalty(
  state: PrimitiveState,
  config: ArtDirectionConfig,
): PrimitiveState {
  const result = clonePrimitiveState(state);

  // ── Arc sweep cap: break large arcs that approach full closure ──
  if (config.closureBreakStrength > 0) {
    for (let i = 0; i < 8; i++) {
      const p = result.paths[i];
      if (!p.active) continue;

      // Split any large-arc-flag arcs into two smaller arcs
      ARC_LARGE_RE.lastIndex = 0;
      let modified = false;
      let d = p.d;
      d = d.replace(ARC_LARGE_RE, (match, cmd, rx, ry, rot, sweep, ex, ey) => {
        modified = true;
        // Replace large arc with two smaller arcs (break the closure)
        const rxN = parseFloat(rx);
        const ryN = parseFloat(ry);
        const exN = parseFloat(ex);
        const eyN = parseFloat(ey);
        // Midpoint approximation: halfway between current position and endpoint
        const midX = exN * 0.5;
        const midY = eyN * 0.5;
        return `${cmd} ${rxN.toFixed(2)} ${ryN.toFixed(2)} ${rot} 0 ${sweep} ${midX.toFixed(2)} ${midY.toFixed(2)} ${cmd} ${rxN.toFixed(2)} ${ryN.toFixed(2)} ${rot} 0 ${sweep} ${exN.toFixed(2)} ${eyN.toFixed(2)}`;
      });

      if (modified) {
        result.paths[i] = { ...p, d };
      }
    }
  }

  // ── Self-closure break: if path start ≈ end, shorten final segment ──
  if (config.closureBreakStrength > 0.5) {
    for (let i = 0; i < 8; i++) {
      const p = result.paths[i];
      if (!p.active) continue;
      // Check for Z/z close-path command
      if (/[Zz]\s*$/.test(p.d)) {
        // Remove close command — leave path open
        result.paths[i] = { ...p, d: p.d.replace(/[Zz]\s*$/, '') };
      }
    }
  }

  return result;
}
