// ── Motif family generators ──
// Each factory produces a PrimitiveState conforming to shared slot semantics.
// Region and flow values bias the output but never destroy family identity.

import type { Rng } from '@/shared/rng';
import type { MotifFamilyId, DepthBandId } from '@/shared/types';
import type { FlowSample } from '@/field/flowField';
import type { RegionSignature } from '@/field/regionMap';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { zeroPrimitiveState } from '@/geometry/primitiveState';
import {
  arcPath, spokePath, ribPath, crescentPath, linePath, quadPath, cubicPath,
  kinkedLinePath, multiArcPath, jaggedPath, spiralSegmentPath, asymmetricRibPath,
} from '@/geometry/pathHelpers';
import { TAU } from '@/shared/math';

export interface MotifGenerationContext {
  rng: Rng;
  region: RegionSignature;
  flow: FlowSample;
  depthBand: DepthBandId;
  energy: number;
}

export function createMotifState(
  family: MotifFamilyId,
  ctx: MotifGenerationContext,
): PrimitiveState {
  switch (family) {
    case 'radialCluster': return radialCluster(ctx);
    case 'interruptedHalo': return interruptedHalo(ctx);
    case 'spineRibs': return spineRibs(ctx);
    case 'splitCrescent': return splitCrescent(ctx);
    case 'branchStruts': return branchStruts(ctx);
    case 'orbitalNodes': return orbitalNodes(ctx);
    case 'partialEnclosure': return partialEnclosure(ctx);
    case 'kinkedSpine': return kinkedSpine(ctx);
    case 'eccentricOrbit': return eccentricOrbit(ctx);
    case 'unfoldingFan': return unfoldingFan(ctx);
    case 'scatterFragment': return scatterFragment(ctx);
    case 'driftingTendril': return driftingTendril(ctx);
  }
}

// ── Family: Radial Cluster ──
// Radiating spokes from center with clustered nodes
function radialCluster(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const spokeCount = rng.int(3, 6);
  const baseAngle = rng.float(0, TAU);
  const innerR = rng.float(3, 8);
  const outerR = rng.float(18, 35);

  // Paths 0-1: major spokes as arcs
  for (let i = 0; i < 2; i++) {
    const angle = baseAngle + (i / spokeCount) * TAU;
    const sweep = rng.float(0.3, 0.8) * (1 + region.circularity * 0.5);
    state.paths[i] = {
      active: true,
      d: arcPath(0, 0, outerR * rng.float(0.6, 1.0), angle, angle + sweep),
      strokeWidth: rng.float(0.8, 2.0),
      opacity: rng.float(0.5, 0.9),
      dashArray: [],
    };
  }

  // Paths 2-4: spokes
  for (let i = 0; i < Math.min(spokeCount, 3); i++) {
    const angle = baseAngle + ((i + 2) / spokeCount) * TAU + rng.float(-0.15, 0.15);
    state.paths[i + 2] = {
      active: true,
      d: spokePath(0, 0, angle, innerR, outerR * rng.float(0.5, 0.9)),
      strokeWidth: rng.float(0.5, 1.5),
      opacity: rng.float(0.3, 0.7),
      dashArray: rng.bool(0.3) ? [rng.float(2, 6), rng.float(2, 4)] : [],
    };
  }

  // Circles 0-2: core nodes
  for (let i = 0; i < 3; i++) {
    const angle = baseAngle + (i / 3) * TAU;
    const dist = rng.float(innerR * 0.5, outerR * 0.3);
    state.circles[i] = {
      active: true,
      cx: Math.cos(angle) * dist,
      cy: Math.sin(angle) * dist,
      r: rng.float(1.5, 4),
      strokeWidth: rng.float(0.5, 1.2),
      opacity: rng.float(0.4, 0.8),
      fillAlpha: rng.float(0, 0.15),
    };
  }

  // Circles 3-5: orbital accents
  for (let i = 3; i < 6; i++) {
    const angle = baseAngle + ((i - 3) / 3) * TAU + rng.float(0.2, 0.8);
    const dist = rng.float(outerR * 0.4, outerR * 0.85);
    state.circles[i] = {
      active: rng.bool(0.6 + region.density * 0.3),
      cx: Math.cos(angle) * dist,
      cy: Math.sin(angle) * dist,
      r: rng.float(0.8, 2.5),
      strokeWidth: rng.float(0.3, 1.0),
      opacity: rng.float(0.2, 0.6),
      fillAlpha: rng.float(0, 0.1),
    };
  }

  return state;
}

// ── Family: Interrupted Halo ──
// Broken ring segments with internal nodes
function interruptedHalo(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const r = rng.float(18, 32);
  const gapCount = rng.int(1, 3);
  const baseAngle = rng.float(0, TAU);

  // Ring with gap
  const gapStart = baseAngle;
  const gapSize = rng.float(0.4, 1.2) * (1 + region.fragmentation * 0.5);
  state.ring = {
    active: true,
    cx: 0,
    cy: 0,
    r,
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.85),
    gapStart,
    gapEnd: gapStart + gapSize,
  };

  // Paths 0-1: arc segments at different radii
  for (let i = 0; i < 2; i++) {
    const segR = r * rng.float(0.55, 0.85);
    const segStart = baseAngle + rng.float(0.5, 2.0) + i * rng.float(1, 2.5);
    const segSweep = rng.float(0.6, 1.5);
    state.paths[i] = {
      active: true,
      d: arcPath(0, 0, segR, segStart, segStart + segSweep),
      strokeWidth: rng.float(0.6, 1.8),
      opacity: rng.float(0.4, 0.8),
      dashArray: rng.bool(0.4) ? [rng.float(3, 8), rng.float(2, 5)] : [],
    };
  }

  // Paths 2-3: small radial ticks
  for (let i = 2; i < 4; i++) {
    const tickAngle = baseAngle + rng.float(0, TAU);
    state.paths[i] = {
      active: rng.bool(0.7),
      d: spokePath(0, 0, tickAngle, r * 0.85, r * 1.1),
      strokeWidth: rng.float(0.5, 1.2),
      opacity: rng.float(0.3, 0.6),
      dashArray: [],
    };
  }

  // Circles: nodes at gap positions
  for (let i = 0; i < 3; i++) {
    const angle = gapStart + gapSize * (i / 2);
    state.circles[i] = {
      active: true,
      cx: Math.cos(angle) * r * rng.float(0.85, 1.1),
      cy: Math.sin(angle) * r * rng.float(0.85, 1.1),
      r: rng.float(1, 3),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.4, 0.7),
      fillAlpha: rng.float(0, 0.2),
    };
  }

  // Center node
  state.circles[3] = {
    active: rng.bool(0.5),
    cx: rng.float(-2, 2),
    cy: rng.float(-2, 2),
    r: rng.float(1.5, 4),
    strokeWidth: rng.float(0.5, 1.5),
    opacity: rng.float(0.3, 0.6),
    fillAlpha: rng.float(0, 0.1),
  };

  return state;
}

// ── Family: Spine Ribs ──
// Central spine with perpendicular rib curves
function spineRibs(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const spineAngle = rng.float(0, TAU);
  const spineLen = rng.float(20, 40) * (0.8 + region.stretch * 0.4);
  const ribCount = rng.int(3, 5);

  // Path 0: main spine
  const sx = Math.cos(spineAngle) * spineLen * 0.5;
  const sy = Math.sin(spineAngle) * spineLen * 0.5;
  const curve = rng.float(-8, 8);
  const cpx = Math.cos(spineAngle + Math.PI / 2) * curve;
  const cpy = Math.sin(spineAngle + Math.PI / 2) * curve;
  state.paths[0] = {
    active: true,
    d: quadPath(-sx, -sy, cpx, cpy, sx, sy),
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Path 1: parallel offset spine (accent)
  const offsetDist = rng.float(2, 5) * rng.sign();
  const ox = Math.cos(spineAngle + Math.PI / 2) * offsetDist;
  const oy = Math.sin(spineAngle + Math.PI / 2) * offsetDist;
  state.paths[1] = {
    active: rng.bool(0.6),
    d: quadPath(-sx + ox, -sy + oy, cpx + ox, cpy + oy, sx + ox, sy + oy),
    strokeWidth: rng.float(0.4, 1.2),
    opacity: rng.float(0.25, 0.5),
    dashArray: [rng.float(3, 7), rng.float(2, 4)],
  };

  // Paths 2-4: ribs
  for (let i = 0; i < ribCount && i < 3; i++) {
    const t = (i + 1) / (ribCount + 1);
    const dist = spineLen * (t - 0.5);
    const ribLen = rng.float(8, 18) * (1 - region.linearity * 0.3);
    const ribCurve = rng.float(2, 8) * rng.sign();
    state.paths[i + 2] = {
      active: true,
      d: ribPath(0, 0, spineAngle, dist, ribLen, ribCurve),
      strokeWidth: rng.float(0.5, 1.5),
      opacity: rng.float(0.3, 0.7),
      dashArray: [],
    };
  }

  // Circles: nodes at spine endpoints and rib junctions
  state.circles[0] = {
    active: true,
    cx: -sx, cy: -sy,
    r: rng.float(1.5, 3.5),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.4, 0.7),
    fillAlpha: rng.float(0, 0.15),
  };
  state.circles[1] = {
    active: true,
    cx: sx, cy: sy,
    r: rng.float(1, 3),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.3, 0.6),
    fillAlpha: rng.float(0, 0.1),
  };

  return state;
}

// ── Family: Split Crescent ──
// Paired crescent arcs with offset fills
function splitCrescent(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = rng.float(0, TAU);
  const outerR = rng.float(18, 30);
  const innerR = outerR * rng.float(0.55, 0.8);
  const sweep = rng.float(1.2, 2.2) * (0.7 + region.circularity * 0.5);

  // Path 0: primary crescent
  state.paths[0] = {
    active: true,
    d: crescentPath(0, 0, outerR, innerR, baseAngle, sweep),
    strokeWidth: rng.float(0.8, 2.0),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Path 1: secondary crescent (split counterpart)
  const splitGap = rng.float(0.15, 0.4);
  const sweep2 = sweep * rng.float(0.6, 0.95);
  state.paths[1] = {
    active: true,
    d: crescentPath(0, 0, outerR * 0.95, innerR * 0.9, baseAngle + sweep + splitGap, sweep2),
    strokeWidth: rng.float(0.6, 1.5),
    opacity: rng.float(0.35, 0.7),
    dashArray: [],
  };

  // Paths 2-3: accent arcs
  for (let i = 2; i < 4; i++) {
    const accentR = outerR * rng.float(0.3, 0.5);
    const accentAngle = baseAngle + rng.float(-0.5, sweep + 1.0);
    const accentSweep = rng.float(0.4, 1.0);
    state.paths[i] = {
      active: rng.bool(0.65),
      d: arcPath(0, 0, accentR, accentAngle, accentAngle + accentSweep),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.2, 0.5),
      dashArray: rng.bool(0.4) ? [rng.float(2, 5), rng.float(1, 3)] : [],
    };
  }

  // Circles at crescent tips
  for (let i = 0; i < 2; i++) {
    const tipAngle = baseAngle + (i === 0 ? 0 : sweep);
    state.circles[i] = {
      active: true,
      cx: Math.cos(tipAngle) * outerR,
      cy: Math.sin(tipAngle) * outerR,
      r: rng.float(1, 3),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.4, 0.7),
      fillAlpha: rng.float(0.05, 0.2),
    };
  }

  return state;
}

// ── Family: Branch Struts ──
// Branching linear structures with node endpoints
function branchStruts(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = rng.float(0, TAU);
  const trunkLen = rng.float(15, 30) * (0.8 + region.stretch * 0.4);
  const branchCount = rng.int(2, 4);

  // Path 0: main trunk
  const tx = Math.cos(baseAngle) * trunkLen;
  const ty = Math.sin(baseAngle) * trunkLen;
  state.paths[0] = {
    active: true,
    d: linePath(0, 0, tx, ty),
    strokeWidth: rng.float(1.0, 2.2),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Paths 1-3: branches
  for (let i = 0; i < branchCount && i < 3; i++) {
    const branchT = rng.float(0.3, 0.8);
    const bx = tx * branchT;
    const by = ty * branchT;
    const branchAngle = baseAngle + rng.float(0.4, 1.2) * rng.sign();
    const branchLen = trunkLen * rng.float(0.3, 0.6);
    const endX = bx + Math.cos(branchAngle) * branchLen;
    const endY = by + Math.sin(branchAngle) * branchLen;
    state.paths[i + 1] = {
      active: true,
      d: linePath(bx, by, endX, endY),
      strokeWidth: rng.float(0.5, 1.5),
      opacity: rng.float(0.35, 0.7),
      dashArray: rng.bool(0.3) ? [rng.float(3, 6), rng.float(2, 4)] : [],
    };
  }

  // Path 5: accent strut
  state.paths[5] = {
    active: rng.bool(0.5),
    d: spokePath(0, 0, baseAngle + Math.PI + rng.float(-0.3, 0.3), 0, trunkLen * 0.3),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.2, 0.45),
    dashArray: [rng.float(2, 5), rng.float(1, 3)],
  };

  // Circles: endpoint nodes
  state.circles[0] = {
    active: true,
    cx: 0, cy: 0,
    r: rng.float(2, 4),
    strokeWidth: rng.float(0.5, 1.2),
    opacity: rng.float(0.4, 0.75),
    fillAlpha: rng.float(0, 0.15),
  };
  state.circles[1] = {
    active: true,
    cx: tx, cy: ty,
    r: rng.float(1.5, 3),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.35, 0.65),
    fillAlpha: rng.float(0, 0.1),
  };

  return state;
}

// ── Family: Orbital Nodes ──
// Multiple nodes orbiting a center with connecting arcs
function orbitalNodes(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const nodeCount = rng.int(3, 6);
  const orbitR = rng.float(14, 28);
  const baseAngle = rng.float(0, TAU);

  // Paths 0-1: connecting arcs between nodes
  for (let i = 0; i < 2; i++) {
    const startAngle = baseAngle + (i * TAU) / nodeCount;
    const sweep = (TAU / nodeCount) * rng.float(0.5, 0.9);
    const arcR = orbitR * rng.float(0.7, 1.1);
    state.paths[i] = {
      active: true,
      d: arcPath(0, 0, arcR, startAngle, startAngle + sweep),
      strokeWidth: rng.float(0.5, 1.5),
      opacity: rng.float(0.35, 0.7),
      dashArray: rng.bool(0.35) ? [rng.float(2, 5), rng.float(1, 3)] : [],
    };
  }

  // Paths 2-4: radial connectors to center
  for (let i = 2; i < 5 && (i - 2) < nodeCount; i++) {
    const angle = baseAngle + ((i - 2) / nodeCount) * TAU;
    state.paths[i] = {
      active: rng.bool(0.5 + region.coherence * 0.3),
      d: spokePath(0, 0, angle, 2, orbitR * rng.float(0.5, 0.85)),
      strokeWidth: rng.float(0.3, 1.0),
      opacity: rng.float(0.2, 0.5),
      dashArray: [rng.float(1, 3), rng.float(1, 2)],
    };
  }

  // Circles: orbital nodes
  for (let i = 0; i < Math.min(nodeCount, 5); i++) {
    const angle = baseAngle + (i / nodeCount) * TAU;
    const r = orbitR * rng.float(0.85, 1.15);
    state.circles[i] = {
      active: true,
      cx: Math.cos(angle) * r,
      cy: Math.sin(angle) * r,
      r: rng.float(1.5, 4),
      strokeWidth: rng.float(0.4, 1.2),
      opacity: rng.float(0.4, 0.8),
      fillAlpha: rng.float(0, 0.2),
    };
  }

  // Center node
  state.circles[6] = {
    active: rng.bool(0.6),
    cx: 0, cy: 0,
    r: rng.float(2, 5),
    strokeWidth: rng.float(0.5, 1.5),
    opacity: rng.float(0.3, 0.6),
    fillAlpha: rng.float(0.05, 0.15),
  };

  return state;
}

// ── Family: Partial Enclosure ──
// Large bounding arc with internal suspended elements
function partialEnclosure(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const encR = rng.float(22, 38);
  const baseAngle = rng.float(0, TAU);
  const encSweep = rng.float(2.5, 4.5) * (0.7 + region.circularity * 0.3);

  // Path 0: main enclosing arc
  state.paths[0] = {
    active: true,
    d: arcPath(0, 0, encR, baseAngle, baseAngle + encSweep),
    strokeWidth: rng.float(1.2, 2.8),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Path 1: inner parallel arc
  state.paths[1] = {
    active: rng.bool(0.7),
    d: arcPath(0, 0, encR * rng.float(0.7, 0.88), baseAngle + 0.2, baseAngle + encSweep - 0.2),
    strokeWidth: rng.float(0.5, 1.5),
    opacity: rng.float(0.3, 0.6),
    dashArray: rng.bool(0.5) ? [rng.float(4, 8), rng.float(2, 4)] : [],
  };

  // Paths 2-4: suspended internal elements
  for (let i = 2; i < 5; i++) {
    const elAngle = baseAngle + encSweep * rng.float(0.2, 0.8);
    const elDist = encR * rng.float(0.2, 0.5);
    const elLen = rng.float(5, 12);
    state.paths[i] = {
      active: rng.bool(0.6),
      d: ribPath(0, 0, elAngle, elDist, elLen, rng.float(-4, 4)),
      strokeWidth: rng.float(0.4, 1.2),
      opacity: rng.float(0.25, 0.55),
      dashArray: [],
    };
  }

  // Circles: endpoint caps and internal nodes
  for (let i = 0; i < 2; i++) {
    const capAngle = baseAngle + (i === 0 ? 0 : encSweep);
    state.circles[i] = {
      active: true,
      cx: Math.cos(capAngle) * encR,
      cy: Math.sin(capAngle) * encR,
      r: rng.float(1.5, 3.5),
      strokeWidth: rng.float(0.5, 1.2),
      opacity: rng.float(0.45, 0.8),
      fillAlpha: rng.float(0.05, 0.2),
    };
  }
  // Internal suspended node
  state.circles[2] = {
    active: rng.bool(0.7),
    cx: Math.cos(baseAngle + encSweep * 0.5) * encR * 0.4,
    cy: Math.sin(baseAngle + encSweep * 0.5) * encR * 0.4,
    r: rng.float(2, 5),
    strokeWidth: rng.float(0.5, 1.5),
    opacity: rng.float(0.35, 0.65),
    fillAlpha: rng.float(0, 0.15),
  };

  // Ring: subtle secondary enclosure
  state.ring = {
    active: rng.bool(0.4),
    cx: 0, cy: 0,
    r: encR * rng.float(0.4, 0.6),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.15, 0.35),
    gapStart: baseAngle + encSweep * 0.3,
    gapEnd: baseAngle + encSweep * 0.7,
  };

  return state;
}

// ══════════════════════════════════════════════════════════════
// NEW ASYMMETRIC FAMILIES
// ══════════════════════════════════════════════════════════════

// ── Family: Kinked Spine ──
// Fault-line structure with sharp angular bends. Geological, fractured.
function kinkedSpine(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.4, 0.4);
  const totalLen = rng.float(25, 45) * (0.8 + region.stretch * 0.4);

  // Choose 1-2 kink points along the spine
  const kinkCount = rng.int(1, 2);
  const startX = Math.cos(baseAngle + Math.PI) * totalLen * 0.4;
  const startY = Math.sin(baseAngle + Math.PI) * totalLen * 0.4;
  const endX = Math.cos(baseAngle) * totalLen * 0.5;
  const endY = Math.sin(baseAngle) * totalLen * 0.5;

  // First kink — sharp angular deviation
  const kinkT = rng.float(0.3, 0.6);
  const kinkDeflect = rng.float(6, 18) * rng.sign() * (1 + region.fragmentation * 0.5);
  const perpAngle = baseAngle + Math.PI / 2;
  const kinkX = startX + (endX - startX) * kinkT + Math.cos(perpAngle) * kinkDeflect;
  const kinkY = startY + (endY - startY) * kinkT + Math.sin(perpAngle) * kinkDeflect;

  // Path 0: main kinked trunk
  state.paths[0] = {
    active: true,
    d: kinkedLinePath(startX, startY, kinkX, kinkY, endX, endY),
    strokeWidth: rng.float(1.2, 2.8),
    opacity: rng.float(0.55, 0.9),
    dashArray: [],
  };

  // Path 1: second kinked segment (offset parallel, shorter)
  if (kinkCount > 1) {
    const off = rng.float(2, 5) * rng.sign();
    const offX = Math.cos(perpAngle) * off;
    const offY = Math.sin(perpAngle) * off;
    const kink2X = kinkX + offX + rng.float(-3, 3);
    const kink2Y = kinkY + offY + rng.float(-3, 3);
    state.paths[1] = {
      active: true,
      d: kinkedLinePath(startX * 0.6 + offX, startY * 0.6 + offY, kink2X, kink2Y, endX * 0.7 + offX, endY * 0.7 + offY),
      strokeWidth: rng.float(0.5, 1.5),
      opacity: rng.float(0.3, 0.6),
      dashArray: [rng.float(3, 7), rng.float(2, 5)],
    };
  }

  // Paths 2-4: asymmetric ribs at kink points and along spine
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const ribAngle = baseAngle + rng.float(-0.3, 0.3);
    const dist = totalLen * (t - 0.5) * 0.8;
    state.paths[i + 2] = {
      active: rng.bool(0.7),
      d: asymmetricRibPath(0, 0, ribAngle, dist,
        rng.float(4, 14), rng.float(2, 8),
        rng.float(-6, 6), rng.float(-6, 6)),
      strokeWidth: rng.float(0.4, 1.3),
      opacity: rng.float(0.3, 0.65),
      dashArray: rng.bool(0.3) ? [rng.float(2, 4), rng.float(1, 3)] : [],
    };
  }

  // Path 5: tension mark — short accent near kink
  state.paths[5] = {
    active: rng.bool(0.6),
    d: linePath(kinkX + rng.float(-3, 3), kinkY + rng.float(-3, 3),
                kinkX + rng.float(-8, 8), kinkY + rng.float(-8, 8)),
    strokeWidth: rng.float(0.3, 0.9),
    opacity: rng.float(0.2, 0.5),
    dashArray: [rng.float(1, 3), rng.float(1, 2)],
  };

  // Circles: stress nodes at kink vertices
  state.circles[0] = {
    active: true,
    cx: kinkX, cy: kinkY,
    r: rng.float(2, 5),
    strokeWidth: rng.float(0.6, 1.5),
    opacity: rng.float(0.5, 0.85),
    fillAlpha: rng.float(0.03, 0.12),
  };
  state.circles[1] = {
    active: rng.bool(0.6),
    cx: startX, cy: startY,
    r: rng.float(1, 2.5),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.3, 0.55),
    fillAlpha: rng.float(0, 0.08),
  };
  state.circles[2] = {
    active: rng.bool(0.5),
    cx: endX, cy: endY,
    r: rng.float(1, 2),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.25, 0.5),
    fillAlpha: rng.float(0, 0.06),
  };

  return state;
}

// ── Family: Eccentric Orbit ──
// Multi-center orbital — arcs around different foci. Unstable, off-balance.
function eccentricOrbit(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();

  // 2-3 off-origin focal centers
  const focalCount = rng.int(2, 3);
  const focals: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i < focalCount; i++) {
    const angle = rng.float(0, TAU);
    const dist = rng.float(5, 15);
    focals.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      r: rng.float(10, 24),
    });
  }

  // Paths 0-1: compound arcs orbiting different foci
  for (let i = 0; i < 2 && i < focals.length; i++) {
    const f = focals[i];
    const segCount = rng.int(2, 3);
    const segments: Array<{ r: number; startAngle: number; sweep: number }> = [];
    let angle = rng.float(0, TAU);
    for (let s = 0; s < segCount; s++) {
      const sweep = rng.float(0.8, 1.8) * (0.7 + region.circularity * 0.3);
      segments.push({
        r: f.r * rng.float(0.7, 1.3),
        startAngle: angle,
        sweep,
      });
      angle += sweep + rng.float(0.2, 0.6); // gap between segments
    }
    state.paths[i] = {
      active: true,
      d: multiArcPath(f.x, f.y, segments),
      strokeWidth: rng.float(0.7, 2.0),
      opacity: rng.float(0.45, 0.85),
      dashArray: rng.bool(0.3) ? [rng.float(3, 7), rng.float(2, 4)] : [],
    };
  }

  // Paths 2-3: connecting ligatures between foci
  if (focals.length >= 2) {
    const f0 = focals[0], f1 = focals[1];
    const midX = (f0.x + f1.x) * 0.5 + rng.float(-5, 5);
    const midY = (f0.y + f1.y) * 0.5 + rng.float(-5, 5);
    state.paths[2] = {
      active: rng.bool(0.7),
      d: quadPath(f0.x, f0.y, midX, midY, f1.x, f1.y),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.2, 0.5),
      dashArray: [rng.float(2, 5), rng.float(1, 3)],
    };
  }

  // Path 4: accent arc fragment
  if (focals.length >= 2) {
    const f = focals[rng.int(0, focals.length - 1)];
    state.paths[4] = {
      active: rng.bool(0.5),
      d: arcPath(f.x * 0.5, f.y * 0.5, rng.float(5, 12), rng.float(0, TAU), rng.float(0, TAU) + rng.float(0.5, 1.5)),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.15, 0.4),
      dashArray: [rng.float(1, 3), rng.float(1, 2)],
    };
  }

  // Circles: focal nodes (off-center, different sizes)
  for (let i = 0; i < focals.length && i < 3; i++) {
    state.circles[i] = {
      active: true,
      cx: focals[i].x,
      cy: focals[i].y,
      r: rng.float(1.5, 4),
      strokeWidth: rng.float(0.4, 1.2),
      opacity: rng.float(0.4, 0.75),
      fillAlpha: rng.float(0.04, 0.15),
    };
  }

  // Satellite dots along orbital paths
  for (let i = 3; i < 6; i++) {
    const f = focals[rng.int(0, focals.length - 1)];
    const orbitAngle = rng.float(0, TAU);
    const orbitDist = f.r * rng.float(0.6, 1.2);
    state.circles[i] = {
      active: rng.bool(0.5),
      cx: f.x + Math.cos(orbitAngle) * orbitDist,
      cy: f.y + Math.sin(orbitAngle) * orbitDist,
      r: rng.float(0.6, 2),
      strokeWidth: rng.float(0.2, 0.7),
      opacity: rng.float(0.2, 0.5),
      fillAlpha: rng.float(0, 0.08),
    };
  }

  // Ring: off-center enclosure around largest focal
  const mainFocal = focals[0];
  state.ring = {
    active: rng.bool(0.4),
    cx: mainFocal.x * 0.7,
    cy: mainFocal.y * 0.7,
    r: mainFocal.r * rng.float(1.1, 1.6),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.15, 0.35),
    gapStart: rng.float(0, TAU),
    gapEnd: rng.float(0, TAU) + rng.float(0.8, 2.0),
  };

  return state;
}

// ── Family: Unfolding Fan ──
// Spiraling fan blades at different rates — directional, mid-bloom.
function unfoldingFan(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.3, 0.3);
  const bladeCount = rng.int(2, 4);

  // Paths 0-1: primary and secondary spiral blades
  for (let i = 0; i < Math.min(bladeCount, 2); i++) {
    const bladeAngle = baseAngle + i * rng.float(0.8, 1.8);
    const startR = rng.float(3, 8);
    const endR = rng.float(20, 38) * (0.7 + region.stretch * 0.5);
    const sweep = rng.float(1.5, 3.5) * (i === 0 ? 1.0 : rng.float(0.5, 0.8));
    state.paths[i] = {
      active: true,
      d: spiralSegmentPath(0, 0, startR, endR, bladeAngle, sweep),
      strokeWidth: rng.float(i === 0 ? 1.0 : 0.5, i === 0 ? 2.5 : 1.5),
      opacity: rng.float(i === 0 ? 0.5 : 0.3, i === 0 ? 0.9 : 0.65),
      dashArray: i > 0 && rng.bool(0.4) ? [rng.float(3, 6), rng.float(2, 4)] : [],
    };
  }

  // Paths 2-3: tertiary blades or accent spirals
  for (let i = 2; i < Math.min(bladeCount + 1, 4); i++) {
    const bladeAngle = baseAngle + i * rng.float(0.6, 1.5) + rng.float(-0.3, 0.3);
    const startR = rng.float(5, 12);
    const endR = rng.float(12, 22);
    state.paths[i] = {
      active: rng.bool(0.6),
      d: spiralSegmentPath(0, 0, startR, endR, bladeAngle, rng.float(0.8, 2.0)),
      strokeWidth: rng.float(0.3, 1.0),
      opacity: rng.float(0.2, 0.5),
      dashArray: rng.bool(0.5) ? [rng.float(2, 4), rng.float(1, 3)] : [],
    };
  }

  // Path 5: cross-rib connecting blades
  state.paths[5] = {
    active: rng.bool(0.5),
    d: arcPath(0, 0, rng.float(8, 15), baseAngle, baseAngle + rng.float(0.8, 1.8)),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.15, 0.4),
    dashArray: [rng.float(2, 4), rng.float(1, 3)],
  };

  // Circles: only at blade tips (sparse)
  const tipAngle = baseAngle + rng.float(1.5, 3.5);
  const tipR = rng.float(20, 35);
  state.circles[0] = {
    active: true,
    cx: Math.cos(tipAngle) * tipR,
    cy: Math.sin(tipAngle) * tipR,
    r: rng.float(1.5, 3.5),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.4, 0.75),
    fillAlpha: rng.float(0.04, 0.15),
  };
  // Second tip
  state.circles[1] = {
    active: rng.bool(0.5),
    cx: Math.cos(baseAngle + rng.float(0.8, 1.8)) * tipR * 0.6,
    cy: Math.sin(baseAngle + rng.float(0.8, 1.8)) * tipR * 0.6,
    r: rng.float(1, 2.5),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.25, 0.55),
    fillAlpha: rng.float(0, 0.08),
  };

  return state;
}

// ── Family: Scatter Fragment ──
// Deliberately sparse debris — jagged disconnected fragments. Erosion/aftermath.
function scatterFragment(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const fragmentCount = rng.int(2, 4);
  const scatter = rng.float(15, 35) * (0.8 + region.fragmentation * 0.4);

  // Paths 0-2: jagged line fragments placed asymmetrically
  for (let i = 0; i < fragmentCount && i < 3; i++) {
    const ptCount = rng.int(3, 5);
    const cx = rng.float(-scatter, scatter) * 0.6;
    const cy = rng.float(-scatter, scatter) * 0.6;
    const points: Array<{ x: number; y: number }> = [];
    let px = cx, py = cy;
    for (let p = 0; p < ptCount; p++) {
      px += rng.float(-8, 8) * (1 + region.fragmentation * 0.3);
      py += rng.float(-8, 8) * (1 + region.fragmentation * 0.3);
      points.push({ x: px, y: py });
    }
    state.paths[i] = {
      active: true,
      d: jaggedPath(points),
      strokeWidth: rng.float(0.5, 1.8),
      opacity: rng.float(0.4, 0.8),
      dashArray: rng.bool(0.3) ? [rng.float(2, 5), rng.float(1, 3)] : [],
    };
  }

  // Path 3: isolated arc fragment — a broken remnant
  state.paths[3] = {
    active: rng.bool(0.6),
    d: arcPath(
      rng.float(-10, 10), rng.float(-10, 10),
      rng.float(6, 15),
      rng.float(0, TAU), rng.float(0, TAU) + rng.float(0.4, 1.2),
    ),
    strokeWidth: rng.float(0.4, 1.2),
    opacity: rng.float(0.25, 0.6),
    dashArray: [rng.float(2, 4), rng.float(1, 3)],
  };

  // Path 5: tension scratch — very short accent
  state.paths[5] = {
    active: rng.bool(0.5),
    d: linePath(rng.float(-scatter * 0.4, scatter * 0.4), rng.float(-scatter * 0.4, scatter * 0.4),
                rng.float(-scatter * 0.4, scatter * 0.4), rng.float(-scatter * 0.4, scatter * 0.4)),
    strokeWidth: rng.float(0.2, 0.7),
    opacity: rng.float(0.15, 0.4),
    dashArray: [],
  };

  // Circles: scattered asymmetric dots (sparse, small)
  for (let i = 0; i < 3; i++) {
    state.circles[i] = {
      active: rng.bool(0.45),
      cx: rng.float(-scatter * 0.7, scatter * 0.7),
      cy: rng.float(-scatter * 0.7, scatter * 0.7),
      r: rng.float(0.5, 2.5),
      strokeWidth: rng.float(0.2, 0.8),
      opacity: rng.float(0.25, 0.6),
      fillAlpha: rng.float(0, 0.1),
    };
  }

  // Most other slots deliberately inactive — sparsity is identity

  return state;
}

// ── Family: Drifting Tendril ──
// Long flowing cubic bezier trunk following flow. Thread, current, drawn-out.
function driftingTendril(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region, flow } = ctx;
  const state = zeroPrimitiveState();
  const flowAngle = flow.angle;
  const length = rng.float(25, 48) * (0.7 + region.stretch * 0.5);

  // Start and end along flow direction
  const x1 = Math.cos(flowAngle + Math.PI) * length * 0.45;
  const y1 = Math.sin(flowAngle + Math.PI) * length * 0.45;
  const x2 = Math.cos(flowAngle) * length * 0.55;
  const y2 = Math.sin(flowAngle) * length * 0.55;

  // Control points biased by flow, creating a sweeping curve
  const perpAngle = flowAngle + Math.PI / 2;
  const drift = rng.float(8, 20) * rng.sign();
  const cp1x = x1 + Math.cos(flowAngle) * length * 0.3 + Math.cos(perpAngle) * drift;
  const cp1y = y1 + Math.sin(flowAngle) * length * 0.3 + Math.sin(perpAngle) * drift;
  const cp2x = x2 - Math.cos(flowAngle) * length * 0.3 + Math.cos(perpAngle) * drift * rng.float(0.3, 0.8);
  const cp2y = y2 - Math.sin(flowAngle) * length * 0.3 + Math.sin(perpAngle) * drift * rng.float(0.3, 0.8);

  // Path 0: main tendril — thick, dominant
  state.paths[0] = {
    active: true,
    d: cubicPath(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2),
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.9),
    dashArray: [],
  };

  // Path 1: parallel offset — thinner, dashed
  const offDist = rng.float(2, 5) * rng.sign();
  const ox = Math.cos(perpAngle) * offDist;
  const oy = Math.sin(perpAngle) * offDist;
  state.paths[1] = {
    active: true,
    d: cubicPath(x1 + ox, y1 + oy, cp1x + ox, cp1y + oy, cp2x + ox, cp2y + oy, x2 + ox, y2 + oy),
    strokeWidth: rng.float(0.4, 1.2),
    opacity: rng.float(0.25, 0.55),
    dashArray: [rng.float(4, 8), rng.float(3, 6)],
  };

  // Path 2: second offset — even thinner, wider gaps
  const offDist2 = offDist + rng.float(2, 4) * Math.sign(offDist);
  const ox2 = Math.cos(perpAngle) * offDist2;
  const oy2 = Math.sin(perpAngle) * offDist2;
  state.paths[2] = {
    active: rng.bool(0.6),
    d: cubicPath(x1 + ox2, y1 + oy2, cp1x + ox2, cp1y + oy2, cp2x + ox2, cp2y + oy2, x2 + ox2, y2 + oy2),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.15, 0.4),
    dashArray: [rng.float(2, 5), rng.float(4, 8)],
  };

  // Path 5: subtle branching filament from midpoint
  const midX = (cp1x + cp2x) * 0.5;
  const midY = (cp1y + cp2y) * 0.5;
  const branchAngle = flowAngle + rng.float(0.5, 1.3) * rng.sign();
  const branchLen = length * rng.float(0.15, 0.3);
  state.paths[5] = {
    active: rng.bool(0.5),
    d: linePath(midX, midY,
                midX + Math.cos(branchAngle) * branchLen,
                midY + Math.sin(branchAngle) * branchLen),
    strokeWidth: rng.float(0.3, 0.7),
    opacity: rng.float(0.15, 0.35),
    dashArray: [rng.float(1, 3), rng.float(1, 2)],
  };

  // Circles: minimal — only at endpoints
  state.circles[0] = {
    active: rng.bool(0.6),
    cx: x1, cy: y1,
    r: rng.float(1, 2.5),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.3, 0.6),
    fillAlpha: rng.float(0, 0.08),
  };
  state.circles[1] = {
    active: rng.bool(0.5),
    cx: x2, cy: y2,
    r: rng.float(0.8, 2),
    strokeWidth: rng.float(0.3, 0.7),
    opacity: rng.float(0.25, 0.5),
    fillAlpha: rng.float(0, 0.06),
  };

  return state;
}
