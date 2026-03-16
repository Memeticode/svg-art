// ── Post-generation art direction filters ──
// Suppress circle-heavy, overly symmetric, icon-like outputs.

import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { CIRCLE_SLOT_COUNT } from '@/geometry/primitiveTypes';
import type { ArtDirectionConfig } from './artDirectionConfig';
import { clonePrimitiveState } from '@/geometry/primitiveState';

/** Apply art direction penalties to a generated PrimitiveState.
 *  Pure function — suppresses features, never re-rolls. */
export function applyArtDirectionPenalty(
  state: PrimitiveState,
  config: ArtDirectionConfig,
): PrimitiveState {
  const result = clonePrimitiveState(state);

  // ── Circle activation cap ──
  const maxActiveCircles = Math.max(1, Math.floor(CIRCLE_SLOT_COUNT * config.circleActivationCap));
  let activeCount = 0;
  // Count active circles
  for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
    if (result.circles[i].active) activeCount++;
  }

  // If too many, deactivate smallest-radius circles first
  if (activeCount > maxActiveCircles) {
    const indices = [];
    for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
      if (result.circles[i].active) indices.push(i);
    }
    // Sort by radius ascending — deactivate smallest first
    indices.sort((a, b) => result.circles[a].r - result.circles[b].r);
    const toDeactivate = activeCount - maxActiveCircles;
    for (let i = 0; i < toDeactivate; i++) {
      result.circles[indices[i]].active = false;
    }
  }

  // ── Perfect closure penalty ──
  const penalty = config.perfectClosurePenalty;
  if (penalty > 0) {
    for (let i = 0; i < CIRCLE_SLOT_COUNT; i++) {
      const c = result.circles[i];
      if (!c.active) continue;
      // Scale down radius and fill alpha
      c.r *= 1 - penalty * 0.3;
      c.fillAlpha *= 1 - penalty * 0.5;
    }

    // Reduce ring opacity when closure penalty is high
    if (result.ring.active) {
      result.ring.opacity *= 1 - penalty * 0.35;
    }
  }

  return result;
}
