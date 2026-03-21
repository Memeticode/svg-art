// CurveAgent: state management and SVG path building for ribbon agents.
// Reads viewport dimensions from viewport.ts. Types from schema.ts.

import type { Rng } from './rng';
import type { FlowSample, CurveAgent, FlowEffects } from './schema';
import { DEFAULT_FLOW_EFFECTS } from './schema';
import {
  vp, getPerimeter, edgeOf, perimeterToXY, borderTrace,
  distToNearestCorner, getInward, EDGE_LENGTH, MIN_INWARD,
} from './viewport';

export const DEFAULT_SPREAD_RATIO = 0.02;
export const DEFAULT_SPREAD_MIN_RATIO = 0.001;

function spreadFloor(): number {
  return Math.max(0.0005, 2 / (getPerimeter() || 1));
}

function spreadMaxInit(): number {
  return DEFAULT_SPREAD_RATIO * Math.max(vp.w, vp.h) / (getPerimeter() || 1);
}

function maxSpreadAt(p: number, spreadRatio: number): number {
  const edge = edgeOf(p);
  const edgeMax = spreadRatio * (EDGE_LENGTH[edge] ?? vp.w) / getPerimeter();
  const cornerDist = distToNearestCorner(p);
  const TAPER_ZONE = 0.03;
  if (cornerDist < TAPER_ZONE) {
    const minEdgeMax = spreadRatio * Math.min(vp.w, vp.h) / getPerimeter();
    const t = cornerDist / TAPER_ZONE;
    return minEdgeMax + (edgeMax - minEdgeMax) * t * t;
  }
  return edgeMax;
}

// ── Agent lifecycle ──

export function createCurve(rng: Rng): CurveAgent {
  const floor = spreadFloor();
  const maxInit = spreadMaxInit();
  const pA = rng.float(0, 1);
  const pB = (pA + rng.float(0.25, 0.75)) % 1;
  return {
    pA, pB,
    driftA: rng.float(0.003, 0.012) * rng.sign(),
    driftB: rng.float(0.003, 0.012) * rng.sign(),
    spreadA: rng.float(floor, maxInit),
    spreadB: rng.float(floor, maxInit),
    spreadDriftA: rng.float(0.001, 0.004) * rng.sign(),
    spreadDriftB: rng.float(0.001, 0.004) * rng.sign(),
    crossingT: 0,
    crossingTarget: 0,
  };
}

export function updateCurve(
  agent: CurveAgent, dt: number,
  spreadMaxRatio = DEFAULT_SPREAD_RATIO,
  spreadMinRatio = DEFAULT_SPREAD_MIN_RATIO,
): void {
  const P = getPerimeter();
  const floor = spreadFloor();

  agent.pA = ((agent.pA + agent.driftA * dt) % 1 + 1) % 1;
  agent.pB = ((agent.pB + agent.driftB * dt) % 1 + 1) % 1;

  agent.spreadA += agent.spreadDriftA * dt;
  agent.spreadB += agent.spreadDriftB * dt;

  const maxA = maxSpreadAt(agent.pA, spreadMaxRatio);
  const maxB = maxSpreadAt(agent.pB, spreadMaxRatio);
  const minA = Math.max(floor, spreadMinRatio * (EDGE_LENGTH[edgeOf(agent.pA)] ?? vp.w) / P);
  const minB = Math.max(floor, spreadMinRatio * (EDGE_LENGTH[edgeOf(agent.pB)] ?? vp.w) / P);

  if (agent.spreadA > maxA || agent.spreadA < minA) agent.spreadDriftA *= -1;
  if (agent.spreadB > maxB || agent.spreadB < minB) agent.spreadDriftB *= -1;
  agent.spreadA = Math.max(minA, Math.min(maxA, agent.spreadA));
  agent.spreadB = Math.max(minB, Math.min(maxB, agent.spreadB));

  const crossingSpeed = 3 * dt;
  if (agent.crossingT < agent.crossingTarget) {
    agent.crossingT = Math.min(agent.crossingTarget, agent.crossingT + crossingSpeed);
  } else if (agent.crossingT > agent.crossingTarget) {
    agent.crossingT = Math.max(agent.crossingTarget, agent.crossingT - crossingSpeed);
  }
}

// ── Path building ──

export interface RibbonPaths {
  fill: string;
  upper: string;
  lower: string;
}

export function buildPath(agent: CurveAgent, flow: FlowSample, effects: FlowEffects = DEFAULT_FLOW_EFFECTS): RibbonPaths {
  const W = vp.w, H = vp.h, P = getPerimeter();

  const aCtr = perimeterToXY(agent.pA);
  const bCtr = perimeterToXY(agent.pB);

  const a1 = perimeterToXY(agent.pA - agent.spreadA / 2);
  const a2 = perimeterToXY(agent.pA + agent.spreadA / 2);
  const bRaw1 = perimeterToXY(agent.pB - agent.spreadB / 2);
  const bRaw2 = perimeterToXY(agent.pB + agent.spreadB / 2);
  const ct = agent.crossingT;
  const b1 = { x: bRaw1.x + (bRaw2.x - bRaw1.x) * ct, y: bRaw1.y + (bRaw2.y - bRaw1.y) * ct };
  const b2 = { x: bRaw2.x + (bRaw1.x - bRaw2.x) * ct, y: bRaw2.y + (bRaw1.y - bRaw2.y) * ct };

  const dx = bCtr.x - aCtr.x;
  const dy = bCtr.y - aCtr.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  const perimDist = Math.min(
    ((agent.pB - agent.pA) % 1 + 1) % 1,
    ((agent.pA - agent.pB) % 1 + 1) % 1,
  );
  const proximityDampen = perimDist < 0.1 ? perimDist / 0.1 : 1;
  const k = len * 0.4 * proximityDampen;

  // Direction vector drives primary curvature (when enabled)
  const dirMag = effects.direction ? flow.direction.magnitude : 0;
  const dirVx = effects.direction ? Math.cos(flow.direction.angle) * dirMag : 0;
  const dirVy = effects.direction ? Math.sin(flow.direction.angle) * dirMag : 0;

  // Curl vector drives secondary curvature offset (when enabled)
  const curlMag = effects.curl ? flow.curl.magnitude : 0;
  const curlVx = effects.curl ? Math.cos(flow.curl.angle) * curlMag : 0;
  const curlVy = effects.curl ? Math.sin(flow.curl.angle) * curlMag : 0;

  let sc1x = aCtr.x + dx * 0.33 + px * dirMag * k + dirVx * k * 0.3;
  let sc1y = aCtr.y + dy * 0.33 + py * dirMag * k + dirVy * k * 0.3;
  let sc2x = aCtr.x + dx * 0.66 - px * curlMag * k * 0.5 + curlVx * k * 0.2;
  let sc2y = aCtr.y + dy * 0.66 - py * curlMag * k * 0.5 + curlVy * k * 0.2;

  const eA = edgeOf(agent.pA);
  const eB = edgeOf(agent.pB);
  if (eA === eB) {
    const inward = getInward(eA);
    sc1x += inward.x * MIN_INWARD;
    sc1y += inward.y * MIN_INWARD;
    sc2x += inward.x * MIN_INWARD;
    sc2y += inward.y * MIN_INWARD;
  }

  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  sc1x = cl(sc1x, 0, W); sc1y = cl(sc1y, 0, H);
  sc2x = cl(sc2x, 0, W); sc2y = cl(sc2y, 0, H);

  const spreadAPx = Math.max(1, agent.spreadA * P / 2);
  const spreadBPx = Math.max(1, agent.spreadB * P / 2);
  const hw1 = spreadAPx * 0.67 + spreadBPx * 0.33;
  const hw2 = spreadAPx * 0.33 + spreadBPx * 0.67;

  const uc1x = cl(sc1x + px * hw1, 0, W);
  const uc1y = cl(sc1y + py * hw1, 0, H);
  const lc1x = cl(sc1x - px * hw1, 0, W);
  const lc1y = cl(sc1y - py * hw1, 0, H);

  const cp2Sign = 1 - 2 * ct;
  const uc2x = cl(sc2x + px * hw2 * cp2Sign, 0, W);
  const uc2y = cl(sc2y + py * hw2 * cp2Sign, 0, H);
  const lc2x = cl(sc2x - px * hw2 * cp2Sign, 0, W);
  const lc2y = cl(sc2y - py * hw2 * cp2Sign, 0, H);

  const f = (n: number) => n.toFixed(1);

  const pA1 = ((agent.pA - agent.spreadA / 2) % 1 + 1) % 1;
  const pA2 = ((agent.pA + agent.spreadA / 2) % 1 + 1) % 1;
  const aCap = borderTrace(pA2, pA1);

  let bCap: string;
  if (ct < 0.01) {
    const pBr1 = ((agent.pB - agent.spreadB / 2) % 1 + 1) % 1;
    const pBr2 = ((agent.pB + agent.spreadB / 2) % 1 + 1) % 1;
    bCap = borderTrace(pBr1, pBr2);
  } else {
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

  const upper = `M${f(a1.x)} ${f(a1.y)} C${f(uc1x)} ${f(uc1y)} ${f(uc2x)} ${f(uc2y)} ${f(b1.x)} ${f(b1.y)}`;
  const lower = `M${f(a2.x)} ${f(a2.y)} C${f(lc1x)} ${f(lc1y)} ${f(lc2x)} ${f(lc2y)} ${f(b2.x)} ${f(b2.y)}`;

  return { fill, upper, lower };
}

// Re-export for convenience
export { perimeterToXY } from './viewport';
