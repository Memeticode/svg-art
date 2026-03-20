// CurveAgent: a variable-width ribbon connecting two regions on the canvas border.
// The ribbon is defined by a spine curve (center bezier) with perpendicular offsets.
// This guarantees the upper and lower edges never intersect.
// Spread is capped at 2% of the edge dimension, scaling smoothly at corners.

import type { Rng } from './rng';
import type { FlowField } from './flow';

export const W = 1920;
export const H = 1080;

const PERIMETER = 2 * (W + H);

// Edge boundaries as fractions of perimeter
const TOP_END = W / PERIMETER;
const RIGHT_END = (W + H) / PERIMETER;
const BOTTOM_END = (2 * W + H) / PERIMETER;

type Edge = 'top' | 'right' | 'bottom' | 'left';

function edgeOf(p: number): Edge {
  p = ((p % 1) + 1) % 1;
  if (p < TOP_END) return 'top';
  if (p < RIGHT_END) return 'right';
  if (p < BOTTOM_END) return 'bottom';
  return 'left';
}

// Edge lengths derived from canvas dimensions
const EDGE_LENGTH: Record<Edge, number> = {
  top: W, right: H, bottom: W, left: H,
};

// Corner positions on the perimeter (fractions)
const CORNERS = [0, TOP_END, RIGHT_END, BOTTOM_END, 1];

/** Default spread ratio (fraction of edge dimension). Overridden by debug slider. */
export const DEFAULT_SPREAD_RATIO = 0.02;

/** Distance from p to the nearest corner (in perimeter fraction). */
function distToNearestCorner(p: number): number {
  p = ((p % 1) + 1) % 1;
  let minDist = 1;
  for (const c of CORNERS) {
    const d = Math.min(Math.abs(p - c), Math.abs(p - c + 1), Math.abs(p - c - 1));
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** Max spread (in perimeter fraction) at a given perimeter position.
 *  spreadRatio: fraction of edge dimension allowed (e.g. 0.02 = 2%).
 *  Smoothly tapers near corners using the shorter adjacent edge's limit. */
function maxSpreadAt(p: number, spreadRatio: number): number {
  const edge = edgeOf(p);
  const edgeMax = spreadRatio * EDGE_LENGTH[edge] / PERIMETER;

  const cornerDist = distToNearestCorner(p);
  const TAPER_ZONE = 0.03;
  if (cornerDist < TAPER_ZONE) {
    const minEdgeMax = spreadRatio * Math.min(W, H) / PERIMETER;
    const t = cornerDist / TAPER_ZONE;
    return minEdgeMax + (edgeMax - minEdgeMax) * t * t;
  }

  return edgeMax;
}

/** Default min spread ratio (fraction of edge dimension). */
export const DEFAULT_SPREAD_MIN_RATIO = 0.001;

// Absolute floor: ensures at least 1px visual thickness regardless of ratio.
const SPREAD_FLOOR = Math.max(0.0005, 2 / PERIMETER);

// Initial max for random creation (uses default ratio)
const SPREAD_MAX_INIT = DEFAULT_SPREAD_RATIO * Math.max(W, H) / PERIMETER;

// Corner pixel coordinates (clockwise: TL, TR, BR, BL)
const CORNER_XY = [
  { x: 0, y: 0 },     // top-left     (p = 0 / 1)
  { x: W, y: 0 },     // top-right    (p = TOP_END)
  { x: W, y: H },     // bottom-right (p = RIGHT_END)
  { x: 0, y: H },     // bottom-left  (p = BOTTOM_END)
];

/** Build SVG path commands to trace along the border from pFrom to pTo,
 *  taking the shorter arc. Emits L commands through any corner vertices. */
function borderTrace(pFrom: number, pTo: number): string {
  pFrom = ((pFrom % 1) + 1) % 1;
  pTo = ((pTo % 1) + 1) % 1;

  // Determine shorter direction: clockwise or counter-clockwise
  const cwDist = ((pTo - pFrom) % 1 + 1) % 1;   // clockwise distance
  const ccwDist = ((pFrom - pTo) % 1 + 1) % 1;   // counter-clockwise distance
  const goClockwise = cwDist <= ccwDist;

  // Corner positions and coordinates (clockwise order)
  const cornerP = [0, TOP_END, RIGHT_END, BOTTOM_END];

  const segments: string[] = [];

  if (goClockwise) {
    // Walk clockwise from pFrom to pTo
    let cursor = pFrom;
    for (let safety = 0; safety < 6; safety++) {
      // Find next corner clockwise from cursor
      let bestIdx = -1;
      let bestP = 2;
      for (let i = 0; i < 4; i++) {
        let cp = cornerP[i];
        if (cp <= cursor) cp += 1;
        if (cp < bestP) { bestP = cp; bestIdx = i; }
      }
      // Is pTo before the next corner?
      let target = pTo;
      if (target <= cursor) target += 1;
      if (target <= bestP) {
        const end = perimeterToXY(pTo);
        segments.push(`L${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
        break;
      }
      // Trace through corner
      const c = CORNER_XY[bestIdx];
      segments.push(`L${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
      cursor = cornerP[bestIdx] || 0.0001;
    }
  } else {
    // Walk counter-clockwise from pFrom to pTo
    let cursor = pFrom;
    for (let safety = 0; safety < 6; safety++) {
      // Find next corner counter-clockwise from cursor
      let bestIdx = -1;
      let bestP = -2;
      for (let i = 0; i < 4; i++) {
        let cp = cornerP[i];
        if (cp >= cursor) cp -= 1;
        if (cp > bestP) { bestP = cp; bestIdx = i; }
      }
      // Is pTo before the next corner (going ccw)?
      let target = pTo;
      if (target >= cursor) target -= 1;
      if (target >= bestP) {
        const end = perimeterToXY(pTo);
        segments.push(`L${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
        break;
      }
      // Trace through corner
      const c = CORNER_XY[bestIdx];
      segments.push(`L${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
      cursor = cornerP[bestIdx] || 0.9999;
    }
  }

  return segments.join(' ');
}

const INWARD: Record<Edge, { x: number; y: number }> = {
  top:    { x: 0, y: 1 },
  right:  { x: -1, y: 0 },
  bottom: { x: 0, y: -1 },
  left:   { x: 1, y: 0 },
};

const MIN_INWARD = Math.min(W, H) * 0.2;

export function perimeterToXY(p: number): { x: number; y: number } {
  p = ((p % 1) + 1) % 1;
  const d = p * PERIMETER;
  if (d < W) return { x: d, y: 0 };
  if (d < W + H) return { x: W, y: d - W };
  if (d < 2 * W + H) return { x: W - (d - W - H), y: H };
  return { x: 0, y: H - (d - 2 * W - H) };
}

export interface CurveAgent {
  pA: number;
  pB: number;
  driftA: number;
  driftB: number;
  spreadA: number;
  spreadB: number;
  spreadDriftA: number;
  spreadDriftB: number;
  /** 0 = smooth (no cross), 1 = fully crossed. Animated toward crossingTarget. */
  crossingT: number;
  /** Desired crossing state: 0 or 1. Set by debug toggle. */
  crossingTarget: number;
}

export function createCurve(rng: Rng): CurveAgent {
  const pA = rng.float(0, 1);
  const pB = (pA + rng.float(0.25, 0.75)) % 1;

  return {
    pA, pB,
    driftA: rng.float(0.003, 0.012) * rng.sign(),
    driftB: rng.float(0.003, 0.012) * rng.sign(),
    spreadA: rng.float(SPREAD_FLOOR, SPREAD_MAX_INIT),
    spreadB: rng.float(SPREAD_FLOOR, SPREAD_MAX_INIT),
    spreadDriftA: rng.float(0.001, 0.004) * rng.sign(),
    spreadDriftB: rng.float(0.001, 0.004) * rng.sign(),
    crossingT: 0,
    crossingTarget: 0,
  };
}

export function updateCurve(
  agent: CurveAgent,
  dt: number,
  spreadMaxRatio = DEFAULT_SPREAD_RATIO,
  spreadMinRatio = DEFAULT_SPREAD_MIN_RATIO,
): void {
  agent.pA = ((agent.pA + agent.driftA * dt) % 1 + 1) % 1;
  agent.pB = ((agent.pB + agent.driftB * dt) % 1 + 1) % 1;

  // Oscillate spread
  agent.spreadA += agent.spreadDriftA * dt;
  agent.spreadB += agent.spreadDriftB * dt;

  // Per-edge max (capped by spreadMaxRatio, tapered at corners)
  const maxA = maxSpreadAt(agent.pA, spreadMaxRatio);
  const maxB = maxSpreadAt(agent.pB, spreadMaxRatio);

  // Per-edge min (from spreadMinRatio, with absolute 1px floor)
  const minA = Math.max(SPREAD_FLOOR, spreadMinRatio * EDGE_LENGTH[edgeOf(agent.pA)] / PERIMETER);
  const minB = Math.max(SPREAD_FLOOR, spreadMinRatio * EDGE_LENGTH[edgeOf(agent.pB)] / PERIMETER);

  // Bounce when hitting either limit
  if (agent.spreadA > maxA || agent.spreadA < minA) agent.spreadDriftA *= -1;
  if (agent.spreadB > maxB || agent.spreadB < minB) agent.spreadDriftB *= -1;

  agent.spreadA = Math.max(minA, Math.min(maxA, agent.spreadA));
  agent.spreadB = Math.max(minB, Math.min(maxB, agent.spreadB));

  // Animate crossing transition (~3/sec lerp rate)
  const crossingSpeed = 3 * dt;
  if (agent.crossingT < agent.crossingTarget) {
    agent.crossingT = Math.min(agent.crossingTarget, agent.crossingT + crossingSpeed);
  } else if (agent.crossingT > agent.crossingTarget) {
    agent.crossingT = Math.max(agent.crossingTarget, agent.crossingT - crossingSpeed);
  }
}

export interface RibbonPaths {
  fill: string;   // closed shape for the filled ribbon
  upper: string;  // upper edge curve (a1 → b1)
  lower: string;  // lower edge curve (a2 → b2)
}

/** Build SVG paths for the filled ribbon and its two edge curves.
 *  Uses a spine curve with perpendicular offsets to guarantee
 *  the upper and lower edges never intersect. */
export function buildPath(agent: CurveAgent, flow: FlowField, time: number): RibbonPaths {
  // Spine endpoints (center of each spread pair)
  const aCtr = perimeterToXY(agent.pA);
  const bCtr = perimeterToXY(agent.pB);

  // Border endpoints (the 4 actual border points)
  const a1 = perimeterToXY(agent.pA - agent.spreadA / 2);
  const a2 = perimeterToXY(agent.pA + agent.spreadA / 2);
  // Lerp B endpoints between unswapped and swapped based on crossingT
  const bRaw1 = perimeterToXY(agent.pB - agent.spreadB / 2);
  const bRaw2 = perimeterToXY(agent.pB + agent.spreadB / 2);
  const ct = agent.crossingT;
  const b1 = { x: bRaw1.x + (bRaw2.x - bRaw1.x) * ct, y: bRaw1.y + (bRaw2.y - bRaw1.y) * ct };
  const b2 = { x: bRaw2.x + (bRaw1.x - bRaw2.x) * ct, y: bRaw2.y + (bRaw1.y - bRaw2.y) * ct };

  // Spine direction
  const dx = bCtr.x - aCtr.x;
  const dy = bCtr.y - aCtr.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  // Flow samples at 1/3 and 2/3 along spine
  const f1 = flow.sample((aCtr.x + dx * 0.33) / W, (aCtr.y + dy * 0.33) / H, time);
  const f2 = flow.sample((aCtr.x + dx * 0.66) / W, (aCtr.y + dy * 0.66) / H, time);

  // Spine control points.
  // When endpoints are close, reduce flow influence for gentler curves.
  const perimDist = Math.min(
    ((agent.pB - agent.pA) % 1 + 1) % 1,
    ((agent.pA - agent.pB) % 1 + 1) % 1,
  ); // shorter arc distance 0..0.5
  const proximityDampen = perimDist < 0.1 ? perimDist / 0.1 : 1; // 0..1 scale
  const k = len * 0.4 * proximityDampen;
  let sc1x = aCtr.x + dx * 0.33 + px * f1.magnitude * k + f1.vx * k * 0.3;
  let sc1y = aCtr.y + dy * 0.33 + py * f1.magnitude * k + f1.vy * k * 0.3;
  let sc2x = aCtr.x + dx * 0.66 - px * f2.curl * k * 0.5 + f2.vx * k * 0.2;
  let sc2y = aCtr.y + dy * 0.66 - py * f2.curl * k * 0.5 + f2.vy * k * 0.2;

  // Same-edge inward push
  const edgeA = edgeOf(agent.pA);
  const edgeB = edgeOf(agent.pB);
  if (edgeA === edgeB) {
    const inward = INWARD[edgeA];
    sc1x += inward.x * MIN_INWARD;
    sc1y += inward.y * MIN_INWARD;
    sc2x += inward.x * MIN_INWARD;
    sc2y += inward.y * MIN_INWARD;
  }

  // Clamp spine control points
  sc1x = Math.max(0, Math.min(W, sc1x));
  sc1y = Math.max(0, Math.min(H, sc1y));
  sc2x = Math.max(0, Math.min(W, sc2x));
  sc2y = Math.max(0, Math.min(H, sc2y));

  // Half-widths in pixels, interpolated along spine.
  // Enforce minimum 1px visual thickness.
  const spreadAPx = Math.max(1, agent.spreadA * PERIMETER / 2);
  const spreadBPx = Math.max(1, agent.spreadB * PERIMETER / 2);
  const hw1 = spreadAPx * 0.67 + spreadBPx * 0.33;
  const hw2 = spreadAPx * 0.33 + spreadBPx * 0.67;

  // Upper/lower control points: spine ± perpendicular * half-width.
  // At the B end (cp2), also lerp the perpendicular direction based on crossingT
  // so the control points actually swap sides when crossing.
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // cp1 (near A end): always uses +/- perpendicular normally
  const uc1x = clamp(sc1x + px * hw1, 0, W);
  const uc1y = clamp(sc1y + py * hw1, 0, H);
  const lc1x = clamp(sc1x - px * hw1, 0, W);
  const lc1y = clamp(sc1y - py * hw1, 0, H);

  // cp2 (near B end): lerp the sign of perpendicular based on crossingT
  // At ct=0: upper=+perp, lower=-perp. At ct=1: upper=-perp, lower=+perp.
  const cp2Sign = 1 - 2 * ct; // 1 at ct=0, -1 at ct=1
  const uc2x = clamp(sc2x + px * hw2 * cp2Sign, 0, W);
  const uc2y = clamp(sc2y + py * hw2 * cp2Sign, 0, H);
  const lc2x = clamp(sc2x - px * hw2 * cp2Sign, 0, W);
  const lc2y = clamp(sc2y - py * hw2 * cp2Sign, 0, H);

  const f = (n: number) => n.toFixed(1);

  // End caps: connect b1→b2 and a2→a1.
  // When not crossing (ct=0), trace along the border (handles corners).
  // When crossing or transitioning (ct>0), use direct lines since the
  // B points are lerped and may not lie on the actual border.
  const pA1 = ((agent.pA - agent.spreadA / 2) % 1 + 1) % 1;
  const pA2 = ((agent.pA + agent.spreadA / 2) % 1 + 1) % 1;
  const aCap = borderTrace(pA2, pA1); // A end always on border

  let bCap: string;
  if (ct < 0.01) {
    // Fully uncrossed: trace border between B points
    const pBr1 = ((agent.pB - agent.spreadB / 2) % 1 + 1) % 1;
    const pBr2 = ((agent.pB + agent.spreadB / 2) % 1 + 1) % 1;
    bCap = borderTrace(pBr1, pBr2);
  } else {
    // Crossing or transitioning: B points are lerped off the border,
    // connect them with a direct line
    bCap = `L${f(b2.x)} ${f(b2.y)}`;
  }

  const fill = [
    `M${f(a1.x)} ${f(a1.y)}`,
    `C${f(uc1x)} ${f(uc1y)} ${f(uc2x)} ${f(uc2y)} ${f(b1.x)} ${f(b1.y)}`,
    bCap,
    `C${f(lc2x)} ${f(lc2y)} ${f(lc1x)} ${f(lc1y)} ${f(a2.x)} ${f(a2.y)}`,
    aCap,
    'Z',
  ].join(' ');

  // Individual edge curves for colored borders
  const upper = `M${f(a1.x)} ${f(a1.y)} C${f(uc1x)} ${f(uc1y)} ${f(uc2x)} ${f(uc2y)} ${f(b1.x)} ${f(b1.y)}`;
  const lower = `M${f(a2.x)} ${f(a2.y)} C${f(lc1x)} ${f(lc1y)} ${f(lc2x)} ${f(lc2y)} ${f(b2.x)} ${f(b2.y)}`;

  return { fill, upper, lower };
}
