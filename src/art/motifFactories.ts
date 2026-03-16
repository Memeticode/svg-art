// ── Motif family generators ──
// Each factory produces a PrimitiveState conforming to shared slot semantics.
// Region and flow values bias the output but never destroy family identity.

import type { Rng } from '@/shared/rng';
import type { MotifFamilyId, DepthBandId } from '@/shared/types';
import type { FlowSample } from '@/field/flowField';
import type { RegionSignature } from '@/field/regionMap';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { zeroPrimitiveState } from '@/geometry/primitiveState';
import { arcPath, spokePath, ribPath, crescentPath, linePath, quadPath } from '@/geometry/pathHelpers';
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
