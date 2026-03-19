// ── Traversal extension: push stroke endpoints beyond the viewport ──
// Every significant stroke should read as a passage through the frame,
// not a shape contained within it. This post-processor extends path
// endpoints outward along their tangent directions so that start and
// end points land well beyond the visible area.
//
// Operates in local motif space. Extension distance is calibrated so
// that at typical agent scales, endpoints exceed viewport bounds.

import type { PrimitiveState, PathPrimitiveState } from './primitiveTypes';
import { PATH_SLOT_COUNT } from './primitiveTypes';

/** Extension distance in local motif units.
 *  Must be large enough that at typical agent scale and position, endpoints
 *  land beyond the viewport. At mid-band scale 1.0 and viewport 1920px,
 *  an agent at center has local units ≈ screen pixels. Extension of 200+ units
 *  ensures endpoints are well outside even for centered agents.
 *  Most agents are not centered, so combined with position offset this
 *  virtually guarantees off-screen endpoints. */
const MIN_EXTENSION = 150;
const MAX_EXTENSION = 300;

/** Extract all numeric values from a path d string */
function extractNumbers(d: string): number[] {
  const matches = d.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(Number) : [];
}

/** Get the first coordinate pair (start point) from a path */
function getStartPoint(d: string): { x: number; y: number } | null {
  const m = d.match(/[Mm]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/** Get the last coordinate pair (end point) from a path */
function getEndPoint(d: string): { x: number; y: number } | null {
  const nums = extractNumbers(d);
  if (nums.length < 4) return null;
  return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
}

/** Get the second coordinate pair (used for start tangent estimation) */
function getSecondPoint(d: string): { x: number; y: number } | null {
  const nums = extractNumbers(d);
  if (nums.length < 4) return null;
  return { x: nums[2], y: nums[3] };
}

/** Get the second-to-last coordinate pair (used for end tangent estimation) */
function getSecondToLastPoint(d: string): { x: number; y: number } | null {
  const nums = extractNumbers(d);
  if (nums.length < 6) return null;
  return { x: nums[nums.length - 4], y: nums[nums.length - 3] };
}

/** Extend a single path's endpoints outward along estimated tangent directions.
 *  Prepends a line from the extended start to the original start,
 *  and appends a line from the original end to the extended end. */
function extendPath(p: PathPrimitiveState, extensionDist: number): PathPrimitiveState {
  if (!p.active) return p;

  const start = getStartPoint(p.d);
  const end = getEndPoint(p.d);
  const second = getSecondPoint(p.d);
  const secondToLast = getSecondToLastPoint(p.d);

  if (!start || !end) return p;

  let d = p.d;

  // Extend start: push backward along start→second tangent
  if (second) {
    const dx = start.x - second.x;
    const dy = start.y - second.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.1) {
      const nx = dx / len;
      const ny = dy / len;
      const extX = start.x + nx * extensionDist;
      const extY = start.y + ny * extensionDist;
      // Replace the M command with a new start at the extended point, then L to original start
      d = d.replace(
        /^[Mm]\s*-?\d+\.?\d*[,\s]+-?\d+\.?\d*/,
        `M${extX.toFixed(2)} ${extY.toFixed(2)} L${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
      );
    }
  }

  // Extend end: push forward along secondToLast→end tangent
  if (secondToLast) {
    const dx = end.x - secondToLast.x;
    const dy = end.y - secondToLast.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.1) {
      const nx = dx / len;
      const ny = dy / len;
      const extX = end.x + nx * extensionDist;
      const extY = end.y + ny * extensionDist;
      d += ` L${extX.toFixed(2)} ${extY.toFixed(2)}`;
    }
  }

  return { ...p, d };
}

/** Apply traversal extension to all active paths in a PrimitiveState.
 *  extensionScale: 0..1 controlling how aggressively paths are extended.
 *  1.0 = full extension (for mid/front agents), 0.5 = moderate (for back),
 *  Ghost agents already have massive scale so need less extension. */
export function applyTraversalExtension(
  state: PrimitiveState,
  extensionScale: number,
): PrimitiveState {
  if (extensionScale < 0.05) return state;

  const dist = MIN_EXTENSION + (MAX_EXTENSION - MIN_EXTENSION) * extensionScale;

  const paths = state.paths.map((p, i) => {
    // Only extend structural paths (first 8 slots). Accent/residue paths
    // (slots 8-11) can remain shorter for breathing room.
    if (i >= 8) return p;
    return extendPath(p, dist);
  }) as PrimitiveState['paths'];

  return { paths };
}
