// Stroke agent: state management and SVG path building.
// Each agent has two ends (A, B) with configurable width and line distribution.

import type { Rng } from './rng';
import type { FlowSample, StrokeAgent, FlowEffects } from './schema';
import { DEFAULT_FLOW_EFFECTS, weightsToPositions } from './schema';
import { vp, getPerimeter, perimeterToXY, borderTrace, nearestCorner } from './viewport';

export const DEFAULT_SPREAD_RATIO = 0.02;
export const DEFAULT_SPREAD_MIN_RATIO = 0.001;

const TRANSITION_SPEED = 4; // positions per second for line transitions

// ── Agent lifecycle ──

export function createStroke(rng: Rng, lineCount = 1): StrokeAgent {
  const P = getPerimeter();
  const defaultWidth = DEFAULT_SPREAD_RATIO * Math.min(vp.w, vp.h) / P;
  const pA = rng.float(0, 1);
  const pB = (pA + rng.float(0.25, 0.75)) % 1;

  const numGaps = Math.max(0, lineCount - 1);
  const gapWeights = Array.from({ length: numGaps }, () => 1);
  const targets = weightsToPositions(lineCount, gapWeights).map(t => ({ tA: t, tB: t }));

  return {
    pA, pB,
    endA: { width: defaultWidth, weights: [...gapWeights] },
    endB: { width: defaultWidth, weights: [...gapWeights] },
    lineCount,
    driftA: 0,
    driftB: 0,
    animate: false,
    linePositions: targets.map(t => ({ ...t })),
    lineTargets: targets,
    crossingT: 0,
    crossingTarget: 0,
  };
}

// Keep old name as alias
export const createCurve = createStroke;

export function updateStroke(agent: StrokeAgent, dt: number): void {
  // Drift (only when animation is on)
  if (agent.animate) {
    agent.pA = ((agent.pA + agent.driftA * dt) % 1 + 1) % 1;
    agent.pB = ((agent.pB + agent.driftB * dt) % 1 + 1) % 1;
  }

  // Animate line positions toward targets
  for (let i = 0; i < agent.linePositions.length; i++) {
    const pos = agent.linePositions[i];
    const tgt = agent.lineTargets[i];
    if (!tgt) continue;
    const speed = TRANSITION_SPEED * dt;
    pos.tA += Math.sign(tgt.tA - pos.tA) * Math.min(speed, Math.abs(tgt.tA - pos.tA));
    pos.tB += Math.sign(tgt.tB - pos.tB) * Math.min(speed, Math.abs(tgt.tB - pos.tB));
  }

  // Crossing animation
  const crossingSpeed = 3 * dt;
  if (agent.crossingT < agent.crossingTarget) {
    agent.crossingT = Math.min(agent.crossingTarget, agent.crossingT + crossingSpeed);
  } else if (agent.crossingT > agent.crossingTarget) {
    agent.crossingT = Math.max(agent.crossingTarget, agent.crossingT - crossingSpeed);
  }
}

// Keep old name as alias
export const updateCurve = updateStroke;

/** Recompute line targets from current weights. Call when weights or lineCount change. */
export function recomputeTargets(agent: StrokeAgent) {
  // Gap weights: N-1 gaps for N lines
  const numGaps = Math.max(0, agent.lineCount - 1);

  // Sync weight arrays to gap count
  while (agent.endA.weights.length < numGaps) agent.endA.weights.push(1);
  while (agent.endA.weights.length > numGaps) agent.endA.weights.pop();
  while (agent.endB.weights.length < numGaps) agent.endB.weights.push(1);
  while (agent.endB.weights.length > numGaps) agent.endB.weights.pop();

  const posA = weightsToPositions(agent.lineCount, agent.endA.weights);
  const posB = weightsToPositions(agent.lineCount, agent.endB.weights);

  // Resize position arrays
  while (agent.linePositions.length < agent.lineCount) {
    const i = agent.linePositions.length;
    agent.linePositions.push({ tA: posA[i] ?? 0.5, tB: posB[i] ?? 0.5 });
  }
  while (agent.linePositions.length > agent.lineCount) {
    agent.linePositions.pop();
  }

  agent.lineTargets = [];
  for (let i = 0; i < agent.lineCount; i++) {
    agent.lineTargets.push({ tA: posA[i] ?? 0.5, tB: posB[i] ?? 0.5 });
  }
}

// ── Path building ──

export interface RibbonPaths {
  fill: string;
  lines: string[];
}

export function buildPath(agent: StrokeAgent, flow: FlowSample, effects: FlowEffects = DEFAULT_FLOW_EFFECTS): RibbonPaths {
  const W = vp.w, H = vp.h;

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

  const P = getPerimeter();
  const widthA = agent.endA.width * P;
  const widthB = agent.endB.width * P;
  const f = (n: number) => n.toFixed(1);

  // Build per-line paths
  const lines: string[] = [];
  for (let i = 0; i < agent.lineCount; i++) {
    const pos = agent.linePositions[i];
    if (!pos) continue;

    // Position within width: 0..1 mapped to -0.5..+0.5 offset
    const offsetA = (pos.tA - 0.5) * widthA;
    const offsetB = (pos.tB - 0.5) * widthB;

    // Start and end points: offset from center along perimeter
    const sP = agent.pA + offsetA / P;
    const eP = agent.pB + offsetB / P;
    const s = perimeterToXY(sP);
    const e = perimeterToXY(eP);

    // Control points: offset from spine proportionally
    const hw1 = offsetA * 0.67 + offsetB * 0.33;
    const hw2 = offsetA * 0.33 + offsetB * 0.67;
    const c1x = cl(sc1x + px * hw1, 0, W);
    const c1y = cl(sc1y + py * hw1, 0, H);
    const c2x = cl(sc2x + px * hw2, 0, W);
    const c2y = cl(sc2y + py * hw2, 0, H);

    lines.push(`M${f(s.x)} ${f(s.y)} C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(e.x)} ${f(e.y)}`);
  }

  // Fill: only when 2+ lines, use first and last line endpoints
  let fill = '';
  if (agent.lineCount >= 2 && agent.linePositions.length >= 2) {
    const first = agent.linePositions[0];
    const last = agent.linePositions[agent.lineCount - 1];
    if (first && last) {
      const a1 = perimeterToXY(agent.pA + (first.tA - 0.5) * widthA / P);
      const a2 = perimeterToXY(agent.pA + (last.tA - 0.5) * widthA / P);
      const b1 = perimeterToXY(agent.pB + (first.tB - 0.5) * widthB / P);
      const b2 = perimeterToXY(agent.pB + (last.tB - 0.5) * widthB / P);

      const hw1f = ((first.tA - 0.5) * widthA) * 0.67 + ((first.tB - 0.5) * widthB) * 0.33;
      const hw2f = ((first.tA - 0.5) * widthA) * 0.33 + ((first.tB - 0.5) * widthB) * 0.67;
      const hw1l = ((last.tA - 0.5) * widthA) * 0.67 + ((last.tB - 0.5) * widthB) * 0.33;
      const hw2l = ((last.tA - 0.5) * widthA) * 0.33 + ((last.tB - 0.5) * widthB) * 0.67;

      const uc1x = cl(sc1x + px * hw1f, 0, W), uc1y = cl(sc1y + py * hw1f, 0, H);
      const uc2x = cl(sc2x + px * hw2f, 0, W), uc2y = cl(sc2y + py * hw2f, 0, H);
      const lc1x = cl(sc1x + px * hw1l, 0, W), lc1y = cl(sc1y + py * hw1l, 0, H);
      const lc2x = cl(sc2x + px * hw2l, 0, W), lc2y = cl(sc2y + py * hw2l, 0, H);

      const pA1 = agent.pA + (first.tA - 0.5) * widthA / P;
      const pA2 = agent.pA + (last.tA - 0.5) * widthA / P;
      const aCap = borderTrace(((pA2 % 1) + 1) % 1, ((pA1 % 1) + 1) % 1);
      const bCap = `L${f(b2.x)} ${f(b2.y)}`;

      fill = [
        `M${f(a1.x)} ${f(a1.y)}`,
        `C${f(uc1x)} ${f(uc1y)} ${f(uc2x)} ${f(uc2y)} ${f(b1.x)} ${f(b1.y)}`,
        bCap,
        `C${f(lc2x)} ${f(lc2y)} ${f(lc1x)} ${f(lc1y)} ${f(a2.x)} ${f(a2.y)}`,
        aCap, 'Z',
      ].join(' ');
    }
  }

  return { fill, lines };
}

// Re-exports
export { perimeterToXY } from './viewport';
