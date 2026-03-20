// ── Traversal extension: push stroke endpoints beyond the viewport ──
// Every significant stroke should read as a passage through the frame,
// not a shape contained within it. This post-processor extends path
// endpoints outward along their tangent directions using smooth cubic
// bezier curves so extensions feel like natural continuations.
//
// Operates in local motif space. Extension distance is calibrated so
// that at typical agent scales, endpoints exceed viewport bounds.

import type { PrimitiveState, PathPrimitiveState } from './primitiveTypes';

/** Extension distance in local motif units.
 *  At mid-band scale 1.0, local units ≈ screen pixels.
 *  Viewport half-width ~960px, so 400-800 units ensures endpoints
 *  land well beyond the frame even for centered agents. */
const MIN_EXTENSION = 400;
const MAX_EXTENSION = 800;

/** Perpendicular curvature offset as fraction of extension distance.
 *  Creates gentle curvature in extensions rather than straight lines. */
const CURVE_OFFSET_FRACTION = 0.08;

/** Get the first coordinate pair (start point) from a path */
function getStartPoint(d: string): { x: number; y: number } | null {
  const m = d.match(/[Mm]\s*(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/** Extract all numeric values from a path d string */
function extractNumbers(d: string): number[] {
  const matches = d.match(/-?\d+\.?\d*/g);
  return matches ? matches.map(Number) : [];
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

/** Extend a single path's endpoints outward using smooth cubic bezier curves.
 *  Extensions follow the flow direction with gentle curvature, so they read
 *  as climate-authored continuations rather than appended straight lines.
 *  flowAngle: radians — the local flow direction that shapes the curve. */
function extendPath(p: PathPrimitiveState, extensionDist: number, flowAngle: number): PathPrimitiveState {
  if (!p.active) return p;

  const start = getStartPoint(p.d);
  const end = getEndPoint(p.d);
  const second = getSecondPoint(p.d);
  const secondToLast = getSecondToLastPoint(p.d);

  if (!start || !end) return p;

  // Very short paths: skip extension but do NOT deactivate.
  // Deactivating causes flashing during morph interpolation when
  // intermediate states temporarily have small spans.
  const spanDx = end.x - start.x;
  const spanDy = end.y - start.y;
  const span = Math.sqrt(spanDx * spanDx + spanDy * spanDy);
  if (span < 3) {
    return p; // leave unchanged, don't extend or deactivate
  }

  let d = p.d;

  // Flow-derived curve direction: extensions follow the flow field
  // rather than the path's own tangent. This makes extensions feel
  // climate-authored — curves shaped by the same forces as the motif.
  const flowCos = Math.cos(flowAngle);
  const flowSin = Math.sin(flowAngle);
  const flowPerpCos = Math.cos(flowAngle + Math.PI / 2);
  const flowPerpSin = Math.sin(flowAngle + Math.PI / 2);

  // Extend start: curve backward along flow direction
  {
    // Blend path tangent with flow direction (flow dominates at 70%)
    let nx: number, ny: number;
    if (second) {
      const tdx = start.x - second.x;
      const tdy = start.y - second.y;
      const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
      if (tlen > 0.1) {
        nx = tdx / tlen * 0.3 + (-flowCos) * 0.7;
        ny = tdy / tlen * 0.3 + (-flowSin) * 0.7;
      } else {
        nx = -flowCos;
        ny = -flowSin;
      }
    } else {
      nx = -flowCos;
      ny = -flowSin;
    }
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= nlen;
    ny /= nlen;

    // Extension point: far along blended direction
    const extX = start.x + nx * extensionDist;
    const extY = start.y + ny * extensionDist;
    // Flow-perpendicular curvature offset
    const curveMag = extensionDist * CURVE_OFFSET_FRACTION;
    // Control points: flow-shaped curve from extension point to start
    const cp1x = extX - nx * extensionDist * 0.33 + flowPerpCos * curveMag;
    const cp1y = extY - ny * extensionDist * 0.33 + flowPerpSin * curveMag;
    const cp2x = start.x + nx * extensionDist * 0.33 + flowPerpCos * curveMag * 0.5;
    const cp2y = start.y + ny * extensionDist * 0.33 + flowPerpSin * curveMag * 0.5;

    d = d.replace(
      /^[Mm]\s*-?\d+\.?\d*[,\s]+-?\d+\.?\d*/,
      `M${extX.toFixed(2)} ${extY.toFixed(2)} C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    );
  }

  // Extend end: curve forward along flow direction
  {
    let nx: number, ny: number;
    if (secondToLast) {
      const tdx = end.x - secondToLast.x;
      const tdy = end.y - secondToLast.y;
      const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
      if (tlen > 0.1) {
        nx = tdx / tlen * 0.3 + flowCos * 0.7;
        ny = tdy / tlen * 0.3 + flowSin * 0.7;
      } else {
        nx = flowCos;
        ny = flowSin;
      }
    } else {
      nx = flowCos;
      ny = flowSin;
    }
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= nlen;
    ny /= nlen;

    const extX = end.x + nx * extensionDist;
    const extY = end.y + ny * extensionDist;
    const curveMag = extensionDist * CURVE_OFFSET_FRACTION;
    // Opposite perpendicular offset for variety
    const cp1x = end.x + nx * extensionDist * 0.33 - flowPerpCos * curveMag * 0.5;
    const cp1y = end.y + ny * extensionDist * 0.33 - flowPerpSin * curveMag * 0.5;
    const cp2x = extX - nx * extensionDist * 0.33 - flowPerpCos * curveMag;
    const cp2y = extY - ny * extensionDist * 0.33 - flowPerpSin * curveMag;

    d += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${extX.toFixed(2)} ${extY.toFixed(2)}`;
  }

  return { ...p, d };
}

/** Apply traversal extension to all active paths in a PrimitiveState.
 *  extensionScale: 0..1 controlling how aggressively paths are extended.
 *  flowAngle: the local flow direction in radians — extensions curve along the flow
 *  rather than along the path's own tangent, creating climate-authored continuations. */
export function applyTraversalExtension(
  state: PrimitiveState,
  extensionScale: number,
  flowAngle = 0,
): PrimitiveState {
  if (extensionScale < 0.05) return state;

  const dist = MIN_EXTENSION + (MAX_EXTENSION - MIN_EXTENSION) * extensionScale;

  const paths = state.paths.map((p, i) => {
    // Only extend structural paths (first 8 slots). Accent/residue paths
    // (slots 8-11) can remain shorter for breathing room.
    if (i >= 8) return p;
    return extendPath(p, dist, flowAngle);
  }) as PrimitiveState['paths'];

  return { paths };
}
