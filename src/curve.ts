// Stroke agent: state management and SVG path building.
// Each agent is a ribbon of exactly 2 lines connecting two perimeter points.

import type { Rng } from './rng';
import type { FlowSample, StrokeAgent, FlowEffects } from './schema';
import { DEFAULT_FLOW_EFFECTS } from './schema';
import { vp, getPerimeter, perimeterToXY, borderTrace, nearestCorner } from './viewport';

export const DEFAULT_SPREAD_RATIO = 0.02;

// ── Agent lifecycle ──

export function createStroke(rng: Rng): StrokeAgent {
  const P = getPerimeter();
  const defaultWidth = DEFAULT_SPREAD_RATIO * Math.min(vp.w, vp.h) / P;
  const pA = rng.float(0, 1);
  const pB = (pA + rng.float(0.25, 0.75)) % 1;

  return {
    pA, pB,
    edge1A: defaultWidth,
    edge1B: defaultWidth,
    edge2A: defaultWidth,
    edge2B: defaultWidth,
    driftA: 0,
    driftB: 0,
    animate: false,
    crossed: false,
    crossPoint: 0.5,
  };
}

// Keep old name as alias
export const createCurve = createStroke;

/** Shortest perimeter distance between two points (0..1 wrapping). */
export function perimeterDist(a: number, b: number): number {
  const d = ((b - a) % 1 + 1) % 1;
  return Math.min(d, 1 - d);
}

/** Minimum safe perimeter distance between pA and pB so edge spans don't overlap. */
export function minSafeGap(agent: StrokeAgent): number {
  const halfA = Math.max(agent.edge1A, agent.edge2A);
  const halfB = Math.max(agent.edge1B, agent.edge2B);
  return halfA + halfB + 0.005; // small buffer
}

export function updateStroke(agent: StrokeAgent, dt: number): void {
  if (!agent.animate) return;

  const prevA = agent.pA;
  const prevB = agent.pB;

  agent.pA = ((agent.pA + agent.driftA * dt) % 1 + 1) % 1;
  agent.pB = ((agent.pB + agent.driftB * dt) % 1 + 1) % 1;

  // If edges would overlap after drift, revert and reverse both drift directions
  if (perimeterDist(agent.pA, agent.pB) < minSafeGap(agent)) {
    agent.pA = prevA;
    agent.pB = prevB;
    agent.driftA = -agent.driftA;
    agent.driftB = -agent.driftB;
  }
}

// Keep old name as alias
export const updateCurve = updateStroke;

// ── Path building ──

export interface RibbonPaths {
  fill: string;
  lines: string[];
  strokeWidths: [number, number];
}

export function buildPath(agent: StrokeAgent, flow: FlowSample, effects: FlowEffects = DEFAULT_FLOW_EFFECTS): RibbonPaths {
  const W = vp.w, H = vp.h;
  const P = getPerimeter();

  const aCtr = perimeterToXY(agent.pA);
  const bCtr = perimeterToXY(agent.pB);

  // Spine direction
  const dx = bCtr.x - aCtr.x;
  const dy = bCtr.y - aCtr.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  // Flow influence on control points
  const dirMag = effects.direction ? flow.direction.magnitude : 0;
  const dirVx = effects.direction ? Math.cos(flow.direction.angle) * dirMag : 0;
  const dirVy = effects.direction ? Math.sin(flow.direction.angle) * dirMag : 0;
  const curlMag = effects.curl ? flow.curl.magnitude : 0;
  const curlVx = effects.curl ? Math.cos(flow.curl.angle) * curlMag : 0;
  const curlVy = effects.curl ? Math.sin(flow.curl.angle) * curlMag : 0;

  const perimDist = Math.min(
    ((agent.pB - agent.pA) % 1 + 1) % 1,
    ((agent.pA - agent.pB) % 1 + 1) % 1,
  );
  const proximityDampen = perimDist < 0.1 ? perimDist / 0.1 : 1;
  const k = len * 0.4 * proximityDampen;

  // Spine control points
  let sc1x = aCtr.x + dx * 0.33 + px * dirMag * k + dirVx * k * 0.3;
  let sc1y = aCtr.y + dy * 0.33 + py * dirMag * k + dirVy * k * 0.3;
  let sc2x = aCtr.x + dx * 0.66 - px * curlMag * k * 0.5 + curlVx * k * 0.2;
  let sc2y = aCtr.y + dy * 0.66 - py * curlMag * k * 0.5 + curlVy * k * 0.2;

  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  sc1x = cl(sc1x, 0, W); sc1y = cl(sc1y, 0, H);
  sc2x = cl(sc2x, 0, W); sc2y = cl(sc2y, 0, H);

  // Corner blending
  const CORNER_ZONE = 0.04;
  const cornerA = nearestCorner(agent.pA);
  if (cornerA.dist < CORNER_ZONE) {
    const blend = (1 - cornerA.dist / CORNER_ZONE) ** 2;
    sc1x += (cornerA.x - sc1x) * blend;
    sc1y += (cornerA.y - sc1y) * blend;
  }
  const cornerB = nearestCorner(agent.pB);
  if (cornerB.dist < CORNER_ZONE) {
    const blend = (1 - cornerB.dist / CORNER_ZONE) ** 2;
    sc2x += (cornerB.x - sc2x) * blend;
    sc2y += (cornerB.y - sc2y) * blend;
  }

  // Per-edge offsets in perimeter units (pixels along border)
  const e1A = agent.edge1A * P; // edge 1 offset at A (positive side)
  const e1B = agent.edge1B * P; // edge 1 offset at B
  const e2A = agent.edge2A * P; // edge 2 offset at A (negative side)
  const e2B = agent.edge2B * P; // edge 2 offset at B

  const f = (n: number) => n.toFixed(1);

  // Determine short-arc direction: edge1 goes inward (between A and B), edge2 goes outward
  const cwDist = ((agent.pB - agent.pA) % 1 + 1) % 1;
  const dir = cwDist <= 0.5 ? 1 : -1;

  let e1OffA = dir * e1A;
  let e2OffA = -dir * e2A;
  let e1OffB = agent.crossed ? dir * e1B : -dir * e1B;
  let e2OffB = agent.crossed ? -dir * e2B : dir * e2B;

  // When crossed, converge edges near the cross point
  if (agent.crossed) {
    const cp = agent.crossPoint;
    e1OffA *= cp;
    e2OffA *= cp;
    e1OffB *= (1 - cp);
    e2OffB *= (1 - cp);
  }

  function buildLine(offA: number, offB: number): string {
    const sP = agent.pA + offA / P;
    const eP = agent.pB + offB / P;
    const s = perimeterToXY(sP);
    const e = perimeterToXY(eP);

    // Displacement vectors from spine endpoints to edge endpoints
    const dxA = s.x - aCtr.x, dyA = s.y - aCtr.y;
    const dxB = e.x - bCtr.x, dyB = e.y - bCtr.y;

    if (!agent.crossed) {
      // Interpolate displacements for control points
      const d1x = dxA * 0.67 + dxB * 0.33;
      const d1y = dyA * 0.67 + dyB * 0.33;
      const d2x = dxA * 0.33 + dxB * 0.67;
      const d2y = dyA * 0.33 + dyB * 0.67;
      const c1x = cl(sc1x + d1x, 0, W);
      const c1y = cl(sc1y + d1y, 0, H);
      const c2x = cl(sc2x + d2x, 0, W);
      const c2y = cl(sc2y + d2y, 0, H);
      return `M${f(s.x)} ${f(s.y)} C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(e.x)} ${f(e.y)}`;
    } else {
      const cp = agent.crossPoint;
      const t = cp, t2 = t * t, t3 = t2 * t;
      const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
      const midX = mt3 * aCtr.x + 3 * mt2 * t * sc1x + 3 * mt * t2 * sc2x + t3 * bCtr.x;
      const midY = mt3 * aCtr.y + 3 * mt2 * t * sc1y + 3 * mt * t2 * sc2y + t3 * bCtr.y;

      const c1ax = s.x + (midX - s.x) * 0.5;
      const c1ay = s.y + (midY - s.y) * 0.5;
      const c1bx = midX + (e.x - midX) * 0.5;
      const c1by = midY + (e.y - midY) * 0.5;

      return `M${f(s.x)} ${f(s.y)} Q${f(c1ax)} ${f(c1ay)} ${f(midX)} ${f(midY)} Q${f(c1bx)} ${f(c1by)} ${f(e.x)} ${f(e.y)}`;
    }
  }

  const lines = [
    buildLine(e1OffA, e1OffB),
    buildLine(e2OffA, e2OffB),
  ];

  // Fill: closed shape between the two edges
  const a1P = agent.pA + e1OffA / P;
  const a2P = agent.pA + e2OffA / P;
  const b1P = agent.pB + e1OffB / P;
  const b2P = agent.pB + e2OffB / P;

  const a1 = perimeterToXY(a1P);
  const a2 = perimeterToXY(a2P);
  const b1 = perimeterToXY(b1P);
  const b2 = perimeterToXY(b2P);

  let fill: string;
  if (!agent.crossed) {
    // Displacement vectors for each edge endpoint from spine center
    const d1Ax = a1.x - aCtr.x, d1Ay = a1.y - aCtr.y;
    const d1Bx = b1.x - bCtr.x, d1By = b1.y - bCtr.y;
    const d2Ax = a2.x - aCtr.x, d2Ay = a2.y - aCtr.y;
    const d2Bx = b2.x - bCtr.x, d2By = b2.y - bCtr.y;

    // Interpolate displacements for fill control points
    const uc1x = cl(sc1x + d1Ax * 0.67 + d1Bx * 0.33, 0, W);
    const uc1y = cl(sc1y + d1Ay * 0.67 + d1By * 0.33, 0, H);
    const uc2x = cl(sc2x + d1Ax * 0.33 + d1Bx * 0.67, 0, W);
    const uc2y = cl(sc2y + d1Ay * 0.33 + d1By * 0.67, 0, H);
    const lc1x = cl(sc1x + d2Ax * 0.67 + d2Bx * 0.33, 0, W);
    const lc1y = cl(sc1y + d2Ay * 0.67 + d2By * 0.33, 0, H);
    const lc2x = cl(sc2x + d2Ax * 0.33 + d2Bx * 0.67, 0, W);
    const lc2y = cl(sc2y + d2Ay * 0.33 + d2By * 0.67, 0, H);

    const aCap = borderTrace(((a2P % 1) + 1) % 1, ((a1P % 1) + 1) % 1);
    const bCap = borderTrace(((b1P % 1) + 1) % 1, ((b2P % 1) + 1) % 1);

    fill = [
      `M${f(a1.x)} ${f(a1.y)}`,
      `C${f(uc1x)} ${f(uc1y)} ${f(uc2x)} ${f(uc2y)} ${f(b1.x)} ${f(b1.y)}`,
      bCap,
      `C${f(lc2x)} ${f(lc2y)} ${f(lc1x)} ${f(lc1y)} ${f(a2.x)} ${f(a2.y)}`,
      aCap, 'Z',
    ].join(' ');
  } else {
    const cp = agent.crossPoint;
    const t = cp, t2 = t * t, t3 = t2 * t;
    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
    const midX = mt3 * aCtr.x + 3 * mt2 * t * sc1x + 3 * mt * t2 * sc2x + t3 * bCtr.x;
    const midY = mt3 * aCtr.y + 3 * mt2 * t * sc1y + 3 * mt * t2 * sc2y + t3 * bCtr.y;

    fill = [
      `M${f(a1.x)} ${f(a1.y)}`,
      `Q${f(a1.x + (midX - a1.x) * 0.5)} ${f(a1.y + (midY - a1.y) * 0.5)} ${f(midX)} ${f(midY)}`,
      `Q${f(midX + (b2.x - midX) * 0.5)} ${f(midY + (b2.y - midY) * 0.5)} ${f(b2.x)} ${f(b2.y)}`,
      borderTrace(((b2P % 1) + 1) % 1, ((b1P % 1) + 1) % 1),
      `Q${f(midX + (b1.x - midX) * 0.5)} ${f(midY + (b1.y - midY) * 0.5)} ${f(midX)} ${f(midY)}`,
      `Q${f(midX + (a2.x - midX) * 0.5)} ${f(midY + (a2.y - midY) * 0.5)} ${f(a2.x)} ${f(a2.y)}`,
      borderTrace(((a2P % 1) + 1) % 1, ((a1P % 1) + 1) % 1),
      'Z',
    ].join(' ');
  }

  // Stroke widths: average of A/B per edge, scaled to reasonable pixel size
  const sw1 = Math.max(0.5, (agent.edge1A + agent.edge1B) * P * 0.03);
  const sw2 = Math.max(0.5, (agent.edge2A + agent.edge2B) * P * 0.03);

  return { fill, lines, strokeWidths: [sw1, sw2] };
}

// Re-exports
export { perimeterToXY } from './viewport';
