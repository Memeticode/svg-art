// ── Motif family generators ──
// Each factory produces a PrimitiveState conforming to shared slot semantics.
// Region and flow values bias the output but never destroy family identity.

import type { Rng } from '@/shared/rng';
import type { MotifFamilyId, DepthBandId } from '@/shared/types';
import type { FlowSample } from '@/field/flowField';
import type { RegionSignature } from '@/field/regionMap';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import type { MotifMemory } from '@/agents/motifMemory';
import { applyTraversalExtension } from '@/geometry/traversalExtension';
import { zeroPrimitiveState, ensureAllParsed } from '@/geometry/primitiveState';
import {
  arcPath, spokePath, ribPath, crescentPath, linePath, quadPath, cubicPath,
  kinkedLinePath, jaggedPath, spiralSegmentPath, asymmetricRibPath,
  brokenArcPath, loopCrossingPath, shellFragmentPath, biologicalArmPath,
  splitNodePath, fracturedShellPath, pressureLobePath, scaffoldStrutPath, bentManifoldPath,
} from '@/geometry/pathHelpers';
import { TAU } from '@/shared/math';

export interface MotifGenerationContext {
  rng: Rng;
  region: RegionSignature;
  flow: FlowSample;
  depthBand: DepthBandId;
  energy: number;
  memory?: MotifMemory;
}

export function createMotifState(
  family: MotifFamilyId,
  ctx: MotifGenerationContext,
): PrimitiveState {
  let state: PrimitiveState;
  switch (family) {
    case 'scaffoldArm': state = scaffoldArm(ctx); break;
    case 'shellFragment': state = shellFragment(ctx); break;
    case 'spineRibs': state = spineRibs(ctx); break;
    case 'splitCrescent': state = splitCrescent(ctx); break;
    case 'branchStruts': state = branchStruts(ctx); break;
    case 'pressureResidue': state = pressureResidue(ctx); break;
    case 'partialEnclosure': state = partialEnclosure(ctx); break;
    case 'kinkedSpine': state = kinkedSpine(ctx); break;
    case 'climateFront': state = climateFront(ctx); break;
    case 'unfoldingFan': state = unfoldingFan(ctx); break;
    case 'scatterFragment': state = scatterFragment(ctx); break;
    case 'driftingTendril': state = driftingTendril(ctx); break;
    case 'brokenCrescent': state = brokenCrescentFactory(ctx); break;
    case 'splitLobe': state = splitLobeFactory(ctx); break;
    case 'ribbedSpine': state = ribbedSpineFactory(ctx); break;
    case 'interruptedShell': state = interruptedShellFactory(ctx); break;
    case 'knotManifold': state = knotManifoldFactory(ctx); break;
    case 'pressureFragment': state = pressureFragmentFactory(ctx); break;
    case 'semiBiologicalScaffold': state = semiBiologicalScaffoldFactory(ctx); break;
  }

  // Apply climate memory influence to the generated state
  if (ctx.memory) {
    state = applyClimateInfluence(state, ctx);
  }

  // Apply traversal extension: push stroke endpoints beyond viewport.
  const extensionScales: Record<string, number> = {
    ghost: 0.3, back: 0.6, mid: 0.9, front: 1.0,
  };
  state = applyTraversalExtension(state, extensionScales[ctx.depthBand] ?? 0.8, ctx.flow.angle);

  // Parse all d-strings into coords + template for fast per-frame manipulation.
  // This is the ONLY place parsing happens — all subsequent operations use coords.
  state = ensureAllParsed(state);

  return state;
}

/** Post-process generated motif state based on accumulated climate memory.
 *  Modifies path coordinates to reflect lane stretch, curl bias, front pressure,
 *  basin compression, and weathering. */
function applyClimateInfluence(state: PrimitiveState, ctx: MotifGenerationContext): PrimitiveState {
  const mem = ctx.memory!;
  const flow = ctx.flow;

  const totalExposure = mem.laneExposure + mem.curlExposure + mem.frontPressure + mem.basinDepth;
  if (totalExposure < 0.05) return state;

  const flowCos = Math.cos(flow.angle);
  const flowSin = Math.sin(flow.angle);
  const perpCos = Math.cos(flow.angle + Math.PI / 2);
  const perpSin = Math.sin(flow.angle + Math.PI / 2);
  const laneStretch = 1 + mem.laneExposure * 0.4;
  const laneCompress = 1 - mem.laneExposure * 0.2;
  const curlRotation = mem.curlExposure * 0.15;
  const basinScale = 1 - mem.basinDepth * 0.15;
  const curlCos = Math.cos(curlRotation);
  const curlSin = Math.sin(curlRotation);
  const hasTransform = mem.laneExposure > 0.05 || mem.curlExposure > 0.05 || mem.basinDepth > 0.05;

  const paths = state.paths.map((p, i) => {
    if (!p.active || !p.coords || p.coords.length === 0) return p;

    let coords = p.coords;

    // Transform coords directly — no regex
    if (hasTransform) {
      coords = new Float32Array(p.coords);
      for (let j = 0; j < coords.length; j += 2) {
        let x = coords[j] * basinScale;
        let y = (j + 1 < coords.length ? coords[j + 1] : 0) * basinScale;

        // Lane stretch
        const fxProj = x * flowCos;
        const pxProj = x * perpCos;
        x = fxProj * laneStretch + pxProj * laneCompress;
        const fyProj = y * flowSin;
        const pyProj = y * perpSin;
        y = fyProj * laneStretch + pyProj * laneCompress;

        // Curl rotation
        coords[j] = x * curlCos;
        if (j + 1 < coords.length) {
          coords[j + 1] = y * curlCos + coords[j + 1] * curlSin * 0.1;
        }
      }
    }

    const frontWidthBoost = i < 4 ? mem.frontPressure * 0.8 : 0;
    const newWidth = p.strokeWidth * (1 + frontWidthBoost);

    let dashArray = p.dashArray;
    if (mem.climateScarIntensity > 0.3 && dashArray.length === 0) {
      const scarGap = 4 + (1 - mem.climateScarIntensity) * 6;
      const scarDash = 3 + mem.climateScarIntensity * 5;
      dashArray = [scarDash, scarGap];
    }

    const collapseOpacity = i >= 4 ? 1 - mem.shellCollapseBias * 0.3 : 1;
    const newOpacity = p.opacity * collapseOpacity;

    return { ...p, coords, strokeWidth: newWidth, opacity: newOpacity, dashArray };
  }) as PrimitiveState['paths'];

  return { paths };
}

// ── Family: Radial Cluster ──
// Spoke Scaffold: asymmetric radiating arms with split-node center. No circles.
function scaffoldArm(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const spokeCount = rng.int(3, 6);
  const baseAngle = rng.float(0, TAU);
  const innerR = rng.float(3, 8);
  const outerR = rng.float(18, 35);

  // Paths 0-1: major spoke arcs (asymmetric sweep)
  for (let i = 0; i < 2; i++) {
    const angle = baseAngle + (i / spokeCount) * TAU;
    const sweep = rng.float(0.3, 0.8) * (1 + region.closureTendency * 0.3);
    state.paths[i] = {
      active: true,
      d: arcPath(0, 0, outerR * rng.float(0.6, 1.0), angle, angle + sweep),
      strokeWidth: rng.float(0.8, 2.0),
      opacity: rng.float(0.5, 0.9),
      dashArray: [],
    };
  }

  // Paths 2-4: scaffold struts with notch marks (replace plain spokes)
  for (let i = 0; i < Math.min(spokeCount, 3); i++) {
    const angle = baseAngle + ((i + 2) / spokeCount) * TAU + rng.float(-0.15, 0.15);
    const endR = outerR * rng.float(0.5, 0.9);
    state.paths[i + 2] = {
      active: true,
      d: scaffoldStrutPath(
        Math.cos(angle) * innerR, Math.sin(angle) * innerR,
        Math.cos(angle) * endR, Math.sin(angle) * endR,
        rng.int(1, 3), rng.float(2, 5),
      ),
      strokeWidth: rng.float(0.5, 1.5),
      opacity: rng.float(0.3, 0.7),
      dashArray: [],
    };
  }

  // Path 5: split-node center mark (replaces circle 0)
  {
    const dist = rng.float(innerR * 0.3, outerR * 0.2);
    const cx = Math.cos(baseAngle) * dist;
    const cy = Math.sin(baseAngle) * dist;
    state.paths[5] = {
      active: true,
      d: splitNodePath(cx, cy, rng.float(2, 5), baseAngle, rng.float(0.5, 1.2)),
      strokeWidth: rng.float(0.5, 1.2),
      opacity: rng.float(0.4, 0.8),
      dashArray: [],
    };
  }

  // Paths 6-7: arc fragments at spoke ends
  for (let i = 6; i < 8; i++) {
    const angle = baseAngle + ((i - 4) / spokeCount) * TAU + rng.float(0.2, 0.8);
    const dist = rng.float(outerR * 0.4, outerR * 0.85);
    const arcStart = angle + rng.float(-0.3, 0.3);
    state.paths[i] = {
      active: rng.bool(0.5 + region.density * 0.2),
      d: arcPath(Math.cos(angle) * dist * 0.3, Math.sin(angle) * dist * 0.3,
        rng.float(3, 8), arcStart, arcStart + rng.float(0.6, 1.5)),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.2, 0.5),
      dashArray: [],
    };
  }

  return state;
}

// ── Family: Interrupted Halo ──
// Fractured Shell: disconnected arc fragments with gap marks. No circles, no ring.
function shellFragment(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const r = rng.float(18, 32);
  const baseAngle = rng.float(0, TAU);
  const gapSize = rng.float(0.4, 1.2) * (1 + region.fragmentation * 0.5);

  // Paths 0-1: inner arc segments at different radii
  for (let i = 0; i < 2; i++) {
    const segR = r * rng.float(0.55, 0.85);
    const segStart = baseAngle + rng.float(0.5, 2.0) + i * rng.float(1, 2.5);
    const segSweep = rng.float(0.6, 1.5);
    state.paths[i] = {
      active: true,
      d: arcPath(0, 0, segR, segStart, segStart + segSweep),
      strokeWidth: rng.float(0.6, 1.8),
      opacity: rng.float(0.4, 0.8),
      dashArray: [],
    };
  }

  // Paths 2-3: small radial ticks at shell boundary
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

  // Paths 4-5: fractured shell fragments (replace ring)
  const fragmentCount = rng.int(2, 4);
  const shellD = fracturedShellPath(0, 0, r, fragmentCount, 0.55, rng.float(1, 4));
  // Split the multi-fragment path into two path slots for better interpolation
  state.paths[4] = {
    active: true,
    d: shellD,
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };
  state.paths[5] = {
    active: rng.bool(0.7),
    d: fracturedShellPath(0, 0, r * rng.float(0.8, 0.95), rng.int(2, 3), 0.45, rng.float(1, 3)),
    strokeWidth: rng.float(0.5, 1.5),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
  };

  // Paths 6-7: split-node marks at gap positions (replace circles)
  const gapMidAngle = baseAngle + gapSize * 0.5;
  state.paths[6] = {
    active: true,
    d: splitNodePath(
      Math.cos(gapMidAngle) * r * rng.float(0.9, 1.1),
      Math.sin(gapMidAngle) * r * rng.float(0.9, 1.1),
      rng.float(2, 4), gapMidAngle, rng.float(0.5, 1.0),
    ),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.4, 0.7),
    dashArray: [],
  };
  state.paths[7] = {
    active: rng.bool(0.6),
    d: splitNodePath(
      Math.cos(baseAngle) * r * rng.float(0.85, 1.05),
      Math.sin(baseAngle) * r * rng.float(0.85, 1.05),
      rng.float(1.5, 3), baseAngle + Math.PI, rng.float(0.4, 0.9),
    ),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.3, 0.55),
    dashArray: [],
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
    dashArray: [],
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

  // Paths 5-6: split-node endpoint marks (replace circles)
  state.paths[5] = {
    active: true,
    d: splitNodePath(-sx, -sy, rng.float(2, 4), spineAngle + Math.PI, rng.float(0.5, 1.0)),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.4, 0.7),
    dashArray: [],
  };
  state.paths[6] = {
    active: true,
    d: splitNodePath(sx, sy, rng.float(1.5, 3), spineAngle, rng.float(0.4, 0.9)),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
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
      dashArray: [],
    };
  }

  // Paths 4-5: split-node tip marks (replace circles)
  for (let i = 0; i < 2; i++) {
    const tipAngle = baseAngle + (i === 0 ? 0 : sweep);
    state.paths[i + 4] = {
      active: true,
      d: splitNodePath(
        Math.cos(tipAngle) * outerR, Math.sin(tipAngle) * outerR,
        rng.float(1.5, 3.5), tipAngle, rng.float(0.5, 1.0),
      ),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.4, 0.7),
      dashArray: [],
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
      dashArray: [],
    };
  }

  // Path 5: accent strut
  state.paths[5] = {
    active: rng.bool(0.5),
    d: spokePath(0, 0, baseAngle + Math.PI + rng.float(-0.3, 0.3), 0, trunkLen * 0.3),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.2, 0.45),
    dashArray: [],
  };

  // Paths 6-7: split-node endpoint marks (replace circles)
  state.paths[6] = {
    active: true,
    d: splitNodePath(0, 0, rng.float(2, 4), baseAngle + Math.PI, rng.float(0.5, 1.0)),
    strokeWidth: rng.float(0.5, 1.2),
    opacity: rng.float(0.4, 0.75),
    dashArray: [],
  };
  state.paths[7] = {
    active: true,
    d: splitNodePath(tx, ty, rng.float(1.5, 3), baseAngle, rng.float(0.4, 0.9)),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.35, 0.65),
    dashArray: [],
  };

  return state;
}

// ── Family: Orbital Nodes ──
// Pressure Node Field: split-node marks at non-orbital positions with broken arcs. No circles.
function pressureResidue(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const nodeCount = rng.int(3, 5);
  const spread = rng.float(14, 28);
  const baseAngle = rng.float(0, TAU);

  // Paths 0-1: broken connecting arcs (non-orbital — off-center, uneven)
  for (let i = 0; i < 2; i++) {
    const startAngle = baseAngle + (i * TAU) / nodeCount + rng.float(-0.3, 0.3);
    const sweep = rng.float(0.5, 1.4);
    const arcR = spread * rng.float(0.6, 1.1);
    const ox = rng.float(-4, 4); // off-center to prevent orbital readability
    const oy = rng.float(-4, 4);
    state.paths[i] = {
      active: true,
      d: brokenArcPath(ox, oy, arcR, startAngle, sweep,
        [{ at: rng.float(0.3, 0.7), width: rng.float(0.06, 0.14) }]),
      strokeWidth: rng.float(0.6, 1.8),
      opacity: rng.float(0.4, 0.8),
      dashArray: [],
    };
  }

  // Paths 2-4: pressure lobe marks at node positions (replace circles)
  for (let i = 0; i < Math.min(nodeCount, 3); i++) {
    const angle = baseAngle + (i / nodeCount) * TAU + rng.float(-0.2, 0.2);
    const dist = spread * rng.float(0.6, 1.1);
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;
    state.paths[i + 2] = {
      active: i < 2 ? true : rng.bool(0.6),
      d: pressureLobePath(nx, ny, angle + rng.float(-0.5, 0.5),
        rng.float(5, 12), rng.float(-0.6, 0.6), rng.float(2, 6)),
      strokeWidth: rng.float(0.5, 1.3),
      opacity: rng.float(0.35, 0.75),
      dashArray: [],
    };
  }

  // Paths 5-6: split-node accent marks
  for (let i = 5; i < 7; i++) {
    const angle = baseAngle + ((i - 2) / nodeCount) * TAU;
    const dist = spread * rng.float(0.5, 0.9);
    state.paths[i] = {
      active: rng.bool(0.6),
      d: splitNodePath(
        Math.cos(angle) * dist, Math.sin(angle) * dist,
        rng.float(2, 4), angle, rng.float(0.5, 1.2),
      ),
      strokeWidth: rng.float(0.3, 0.9),
      opacity: rng.float(0.25, 0.55),
      dashArray: [],
    };
  }

  // Path 7: scaffold strut connector
  {
    const a1 = baseAngle;
    const a2 = baseAngle + TAU / nodeCount;
    const d1 = spread * 0.7;
    const d2 = spread * 0.8;
    state.paths[7] = {
      active: rng.bool(0.5 + region.coherence * 0.3),
      d: scaffoldStrutPath(
        Math.cos(a1) * d1, Math.sin(a1) * d1,
        Math.cos(a2) * d2, Math.sin(a2) * d2,
        rng.int(1, 2), rng.float(2, 4),
      ),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.2, 0.45),
      dashArray: [],
    };
  }

  return state;
}

// ── Family: Partial Enclosure ──
// Eroded Enclosure: partial hull with split-node endpoints. No circles, no ring.
function partialEnclosure(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const encR = rng.float(22, 38);
  const baseAngle = rng.float(0, TAU);
  const encSweep = rng.float(2.5, 4.5) * (0.7 + region.closureTendency * 0.3);

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
    dashArray: [],
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

  // Paths 5-6: split-node endpoint marks (replace circles 0-1)
  for (let i = 0; i < 2; i++) {
    const capAngle = baseAngle + (i === 0 ? 0 : encSweep);
    state.paths[i + 5] = {
      active: true,
      d: splitNodePath(
        Math.cos(capAngle) * encR, Math.sin(capAngle) * encR,
        rng.float(2, 4), capAngle, rng.float(0.5, 1.0),
      ),
      strokeWidth: rng.float(0.5, 1.2),
      opacity: rng.float(0.45, 0.8),
      dashArray: [],
    };
  }

  // Path 7: internal pressure lobe (replaces circle 2 + ring)
  const lobeMidAngle = baseAngle + encSweep * 0.5;
  state.paths[7] = {
    active: rng.bool(0.6),
    d: pressureLobePath(
      Math.cos(lobeMidAngle) * encR * 0.3,
      Math.sin(lobeMidAngle) * encR * 0.3,
      lobeMidAngle, rng.float(6, 14),
      rng.float(-0.6, 0.6), rng.float(3, 7),
    ),
    strokeWidth: rng.float(0.5, 1.3),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
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
      dashArray: [],
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
      dashArray: [],
    };
  }

  // Path 5: tension mark — short accent near kink
  state.paths[5] = {
    active: rng.bool(0.6),
    d: linePath(kinkX + rng.float(-3, 3), kinkY + rng.float(-3, 3),
                kinkX + rng.float(-8, 8), kinkY + rng.float(-8, 8)),
    strokeWidth: rng.float(0.3, 0.9),
    opacity: rng.float(0.2, 0.5),
    dashArray: [],
  };

  // Paths 6-7: split-node stress marks at kink vertices (replace circles)
  state.paths[6] = {
    active: true,
    d: splitNodePath(kinkX, kinkY, rng.float(2.5, 5), baseAngle + Math.PI / 2, rng.float(0.5, 1.2)),
    strokeWidth: rng.float(0.6, 1.5),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };
  state.paths[7] = {
    active: rng.bool(0.6),
    d: splitNodePath(startX, startY, rng.float(1.5, 3), baseAngle + Math.PI, rng.float(0.4, 0.9)),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.3, 0.55),
    dashArray: [],
  };

  return state;
}

// ── Family: Eccentric Orbit ──
// Decentered Manifold: offset arc segments around decentered foci. No circles, no ring.
function climateFront(ctx: MotifGenerationContext): PrimitiveState {
  const { rng } = ctx;
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

  // Paths 0-1: bent manifold paths around decentered foci
  for (let i = 0; i < 2 && i < focals.length; i++) {
    const f = focals[i];
    state.paths[i] = {
      active: true,
      d: bentManifoldPath(f.x, f.y, rng.int(2, 3), f.r * rng.float(0.6, 1.0), rng.float(0.5, 2.0)),
      strokeWidth: rng.float(0.7, 2.0),
      opacity: rng.float(0.45, 0.85),
      dashArray: [],
    };
  }

  // Path 2: kinked connecting ligature between foci
  if (focals.length >= 2) {
    const f0 = focals[0], f1 = focals[1];
    const kinkX = (f0.x + f1.x) * 0.5 + rng.float(-8, 8);
    const kinkY = (f0.y + f1.y) * 0.5 + rng.float(-8, 8);
    state.paths[2] = {
      active: rng.bool(0.7),
      d: kinkedLinePath(f0.x, f0.y, kinkX, kinkY, f1.x, f1.y),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.2, 0.5),
      dashArray: [],
    };
  }

  // Paths 3-4: fractured shell fragments (replace ring)
  const mainFocal = focals[0];
  state.paths[3] = {
    active: true,
    d: fracturedShellPath(
      mainFocal.x * 0.5, mainFocal.y * 0.5,
      mainFocal.r * rng.float(1.0, 1.5),
      rng.int(2, 3), 0.5, rng.float(2, 5),
    ),
    strokeWidth: rng.float(0.5, 1.3),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
  };
  state.paths[4] = {
    active: rng.bool(0.6),
    d: fracturedShellPath(
      rng.float(-5, 5), rng.float(-5, 5),
      rng.float(8, 16), rng.int(2, 3), 0.4, rng.float(1, 4),
    ),
    strokeWidth: rng.float(0.3, 0.9),
    opacity: rng.float(0.2, 0.45),
    dashArray: [],
  };

  // Paths 5-7: split-node focal marks (replace circles)
  for (let i = 0; i < Math.min(focalCount, 3); i++) {
    state.paths[i + 5] = {
      active: i === 0 ? true : rng.bool(0.6),
      d: splitNodePath(
        focals[i].x, focals[i].y,
        rng.float(2, 4), rng.float(0, TAU), rng.float(0.5, 1.2),
      ),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.35, 0.7),
      dashArray: [],
    };
  }

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
      dashArray: [],
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
      dashArray: [],
    };
  }

  // Path 5: cross-rib connecting blades
  state.paths[5] = {
    active: rng.bool(0.5),
    d: arcPath(0, 0, rng.float(8, 15), baseAngle, baseAngle + rng.float(0.8, 1.8)),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.15, 0.4),
    dashArray: [],
  };

  // Split-node marks at blade tips (no circles)
  const tipAngle = baseAngle + rng.float(1.5, 3.5);
  const tipR = rng.float(20, 35);
  state.paths[6] = {
    active: true,
    d: splitNodePath(Math.cos(tipAngle) * tipR, Math.sin(tipAngle) * tipR, rng.float(2, 4.5), tipAngle, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.4, 0.75),
    dashArray: [],
  };
  state.paths[7] = {
    active: rng.bool(0.5),
    d: splitNodePath(Math.cos(baseAngle + rng.float(0.8, 1.8)) * tipR * 0.6, Math.sin(baseAngle + rng.float(0.8, 1.8)) * tipR * 0.6, rng.float(1.5, 3), baseAngle, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.25, 0.55),
    dashArray: [],
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
      dashArray: [],
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
    dashArray: [],
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

  // Tiny jagged marks replace scattered dot circles
  for (let i = 0; i < 3; i++) {
    const dotX = rng.float(-scatter * 0.7, scatter * 0.7);
    const dotY = rng.float(-scatter * 0.7, scatter * 0.7);
    const jSize = rng.float(1, 4);
    state.paths[i === 0 ? 4 : i === 1 ? 6 : 7] = {
      active: rng.bool(0.45),
      d: jaggedPath([
        { x: dotX - jSize, y: dotY - jSize * 0.5 },
        { x: dotX + jSize * 0.3, y: dotY + jSize },
        { x: dotX + jSize, y: dotY - jSize * 0.3 },
      ]),
      strokeWidth: rng.float(0.2, 0.8),
      opacity: rng.float(0.25, 0.6),
      dashArray: [],
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
    dashArray: [],
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
    dashArray: [],
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
    dashArray: [],
  };

  // Split-node marks at tendril endpoints (no circles)
  state.paths[6] = {
    active: rng.bool(0.6),
    d: splitNodePath(x1, y1, rng.float(1.5, 3), flowAngle + Math.PI, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
  };
  state.paths[7] = {
    active: rng.bool(0.5),
    d: splitNodePath(x2, y2, rng.float(1, 2.5), flowAngle, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.3, 0.7),
    opacity: rng.float(0.25, 0.5),
    dashArray: [],
  };

  return state;
}

// ══════════════════════════════════════════════════════════════
// TENSION GRAMMAR FAMILIES (v2)
// ══════════════════════════════════════════════════════════════

// ── Family: Broken Crescent ──
// Crescents with offset nicks, tension bars, trailing debris. Never complete.
function brokenCrescentFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = rng.float(0, TAU);
  const r = rng.float(18, 32);
  const sweep = rng.float(1.8, 3.5) * (0.6 + region.closureTendency * 0.4);

  // Generate 1-3 notches
  const notchCount = rng.int(1, 3);
  const notches: Array<{ at: number; width: number }> = [];
  for (let i = 0; i < notchCount; i++) {
    notches.push({
      at: rng.float(0.15, 0.85),
      width: rng.float(0.06, 0.15),
    });
  }

  // Path 0: main broken crescent arc
  state.paths[0] = {
    active: true,
    d: brokenArcPath(0, 0, r, baseAngle, sweep, notches),
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.9),
    dashArray: [],
  };

  // Path 1: offset parallel broken arc (thinner, different notches)
  const innerR = r * rng.float(0.65, 0.85);
  const innerNotches = notches.map(n => ({
    at: n.at + rng.float(-0.05, 0.05),
    width: n.width * rng.float(0.8, 1.5),
  }));
  state.paths[1] = {
    active: true,
    d: brokenArcPath(0, 0, innerR, baseAngle + rng.float(0.05, 0.2), sweep * rng.float(0.7, 0.95), innerNotches),
    strokeWidth: rng.float(0.5, 1.5),
    opacity: rng.float(0.3, 0.65),
    dashArray: [],
  };

  // Paths 2-3: short tension bars near notch points
  for (let i = 0; i < Math.min(notchCount, 2); i++) {
    const notchAngle = baseAngle + sweep * notches[i].at;
    const nx = Math.cos(notchAngle) * r;
    const ny = Math.sin(notchAngle) * r;
    const barAngle = notchAngle + rng.float(-0.5, 0.5);
    const barLen = rng.float(4, 12);
    state.paths[i + 2] = {
      active: true,
      d: linePath(
        nx + Math.cos(barAngle) * barLen * 0.3,
        ny + Math.sin(barAngle) * barLen * 0.3,
        nx - Math.cos(barAngle) * barLen * 0.7,
        ny - Math.sin(barAngle) * barLen * 0.7,
      ),
      strokeWidth: rng.float(0.4, 1.2),
      opacity: rng.float(0.3, 0.6),
      dashArray: [],
    };
  }

  // Paths 4-5: trailing debris fragments
  for (let i = 4; i < 6; i++) {
    const debrisAngle = baseAngle + sweep + rng.float(0.1, 0.6);
    const debrisR = r * rng.float(0.5, 1.2);
    const pts: Array<{ x: number; y: number }> = [];
    let px = Math.cos(debrisAngle) * debrisR;
    let py = Math.sin(debrisAngle) * debrisR;
    const ptCount = rng.int(2, 4);
    for (let p = 0; p < ptCount; p++) {
      pts.push({ x: px, y: py });
      px += rng.float(-6, 6);
      py += rng.float(-6, 6);
    }
    state.paths[i] = {
      active: rng.bool(0.6),
      d: jaggedPath(pts),
      strokeWidth: rng.float(0.3, 0.9),
      opacity: rng.float(0.2, 0.5),
      dashArray: [],
    };
  }

  // Split-node mark at notch stress point (no circles)
  if (notches.length > 0) {
    const stressAngle = baseAngle + sweep * notches[0].at;
    state.paths[6] = {
      active: rng.bool(0.6),
      d: splitNodePath(Math.cos(stressAngle) * r * rng.float(0.9, 1.1), Math.sin(stressAngle) * r * rng.float(0.9, 1.1), rng.float(1.5, 3.5), stressAngle, rng.float(0.3, 0.6)),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.3, 0.6),
      dashArray: [],
    };
  }

  return state;
}

// ── Family: Split Lobe ──
// Two-lobe forms that never resolve symmetrically. Offset, divergent.
function splitLobeFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const stemAngle = rng.float(0, TAU);
  const stemLen = rng.float(8, 16);

  // Two lobes diverging from stem — deliberately different lengths and curves
  const lobe1Angle = stemAngle + rng.float(0.4, 1.0);
  const lobe2Angle = stemAngle - rng.float(0.5, 1.2);
  const lobe1Len = rng.float(18, 35) * (0.8 + region.stretch * 0.4);
  const lobe2Len = lobe1Len * rng.float(0.5, 0.8); // deliberately shorter

  const stemX = Math.cos(stemAngle) * stemLen;
  const stemY = Math.sin(stemAngle) * stemLen;

  // Path 0: dominant lobe
  const l1EndX = stemX + Math.cos(lobe1Angle) * lobe1Len;
  const l1EndY = stemY + Math.sin(lobe1Angle) * lobe1Len;
  const l1Curve = rng.float(8, 20) * rng.sign();
  const l1PerpAngle = lobe1Angle + Math.PI / 2;
  state.paths[0] = {
    active: true,
    d: cubicPath(
      stemX, stemY,
      stemX + Math.cos(lobe1Angle) * lobe1Len * 0.3 + Math.cos(l1PerpAngle) * l1Curve,
      stemY + Math.sin(lobe1Angle) * lobe1Len * 0.3 + Math.sin(l1PerpAngle) * l1Curve,
      l1EndX - Math.cos(lobe1Angle) * lobe1Len * 0.2 + Math.cos(l1PerpAngle) * l1Curve * 0.5,
      l1EndY - Math.sin(lobe1Angle) * lobe1Len * 0.2 + Math.sin(l1PerpAngle) * l1Curve * 0.5,
      l1EndX, l1EndY,
    ),
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.9),
    dashArray: [],
  };

  // Path 1: secondary lobe (shorter, different curve)
  const l2EndX = stemX + Math.cos(lobe2Angle) * lobe2Len;
  const l2EndY = stemY + Math.sin(lobe2Angle) * lobe2Len;
  const l2Curve = rng.float(5, 15) * rng.sign();
  const l2PerpAngle = lobe2Angle + Math.PI / 2;
  state.paths[1] = {
    active: true,
    d: cubicPath(
      stemX, stemY,
      stemX + Math.cos(lobe2Angle) * lobe2Len * 0.35 + Math.cos(l2PerpAngle) * l2Curve,
      stemY + Math.sin(lobe2Angle) * lobe2Len * 0.35 + Math.sin(l2PerpAngle) * l2Curve,
      l2EndX - Math.cos(lobe2Angle) * lobe2Len * 0.15,
      l2EndY - Math.sin(lobe2Angle) * lobe2Len * 0.15,
      l2EndX, l2EndY,
    ),
    strokeWidth: rng.float(0.7, 1.8),
    opacity: rng.float(0.35, 0.7),
    dashArray: [],
  };

  // Path 2: connecting stem
  state.paths[2] = {
    active: true,
    d: quadPath(0, 0, stemX * 0.5 + rng.float(-3, 3), stemY * 0.5 + rng.float(-3, 3), stemX, stemY),
    strokeWidth: rng.float(0.8, 1.8),
    opacity: rng.float(0.4, 0.75),
    dashArray: [],
  };

  // Path 3: partial arc within dominant lobe
  state.paths[3] = {
    active: rng.bool(0.6),
    d: arcPath(stemX, stemY, lobe1Len * rng.float(0.3, 0.6), lobe1Angle - 0.3, lobe1Angle + rng.float(0.5, 1.2)),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.2, 0.5),
    dashArray: [],
  };

  // Path 5: accent line between lobes
  state.paths[5] = {
    active: rng.bool(0.5),
    d: linePath(l1EndX * 0.5, l1EndY * 0.5, l2EndX * 0.6, l2EndY * 0.6),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.15, 0.4),
    dashArray: [],
  };

  // Split-node mark at stem junction (no circles)
  state.paths[6] = {
    active: rng.bool(0.5),
    d: splitNodePath(stemX, stemY, rng.float(2, 4.5), stemAngle, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.35, 0.65),
    dashArray: [],
  };

  return state;
}

// ── Family: Ribbed Spine ──
// Dominant curved stem with asymmetric offset ribs. Skeletal, directional.
function ribbedSpineFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region, flow } = ctx;
  const state = zeroPrimitiveState();
  const spineAngle = flow.angle + rng.float(-0.3, 0.3);
  const spineLen = rng.float(25, 45) * (0.8 + region.linearity * 0.4);

  const sx = Math.cos(spineAngle + Math.PI) * spineLen * 0.45;
  const sy = Math.sin(spineAngle + Math.PI) * spineLen * 0.45;
  const ex = Math.cos(spineAngle) * spineLen * 0.55;
  const ey = Math.sin(spineAngle) * spineLen * 0.55;
  const perpAngle = spineAngle + Math.PI / 2;
  const curve = rng.float(5, 15) * rng.sign();

  // Path 0: main spine as cubic curve
  state.paths[0] = {
    active: true,
    d: cubicPath(
      sx, sy,
      sx + Math.cos(spineAngle) * spineLen * 0.3 + Math.cos(perpAngle) * curve,
      sy + Math.sin(spineAngle) * spineLen * 0.3 + Math.sin(perpAngle) * curve,
      ex - Math.cos(spineAngle) * spineLen * 0.3 + Math.cos(perpAngle) * curve * 0.6,
      ey - Math.sin(spineAngle) * spineLen * 0.3 + Math.sin(perpAngle) * curve * 0.6,
      ex, ey,
    ),
    strokeWidth: rng.float(1.2, 2.8),
    opacity: rng.float(0.55, 0.9),
    dashArray: [],
  };

  // Paths 1-5: asymmetric ribs with deliberately unequal arms
  const ribCount = rng.int(3, 5);
  for (let i = 0; i < ribCount && i < 5; i++) {
    const t = (i + 1) / (ribCount + 1);
    const dist = spineLen * (t - 0.5) * 0.85;
    state.paths[i + 1] = {
      active: true,
      d: asymmetricRibPath(
        0, 0, spineAngle, dist,
        rng.float(5, 16), rng.float(2, 8), // deliberately unequal left/right
        rng.float(-8, 8), rng.float(-8, 8),
      ),
      strokeWidth: rng.float(0.4, 1.3),
      opacity: rng.float(0.3, 0.7),
      dashArray: [],
    };
  }

  // Path 6: dashed parallel offset spine
  const offDist = rng.float(2, 5) * rng.sign();
  const ox = Math.cos(perpAngle) * offDist;
  const oy = Math.sin(perpAngle) * offDist;
  state.paths[6] = {
    active: rng.bool(0.6),
    d: cubicPath(
      sx + ox, sy + oy,
      sx + Math.cos(spineAngle) * spineLen * 0.3 + Math.cos(perpAngle) * curve + ox,
      sy + Math.sin(spineAngle) * spineLen * 0.3 + Math.sin(perpAngle) * curve + oy,
      ex - Math.cos(spineAngle) * spineLen * 0.3 + Math.cos(perpAngle) * curve * 0.6 + ox,
      ey - Math.sin(spineAngle) * spineLen * 0.3 + Math.sin(perpAngle) * curve * 0.6 + oy,
      ex + ox, ey + oy,
    ),
    strokeWidth: rng.float(0.3, 0.9),
    opacity: rng.float(0.2, 0.45),
    dashArray: [],
  };

  // Split-node mark at spine midpoint (no circles)
  state.paths[7] = {
    active: rng.bool(0.3),
    d: splitNodePath(Math.cos(perpAngle) * curve * 0.3, Math.sin(perpAngle) * curve * 0.3, rng.float(2, 4), spineAngle, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.4, 0.9),
    opacity: rng.float(0.3, 0.55),
    dashArray: [],
  };

  return state;
}

// ── Family: Interrupted Shell ──
// Partial enclosures with gap emphasis, layered shell fragments. Eroded.
function interruptedShellFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = rng.float(0, TAU);
  const outerR = rng.float(20, 35);
  const innerR = outerR * rng.float(0.55, 0.75);
  const sweep = rng.float(2.0, 4.0) * (0.6 + region.closureTendency * 0.4);

  // Path 0: main shell fragment with ragged inner edge
  state.paths[0] = {
    active: true,
    d: shellFragmentPath(0, 0, outerR, innerR, baseAngle, sweep, rng.float(2, 6)),
    strokeWidth: rng.float(1.0, 2.2),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Path 1: second shell fragment at smaller radius, offset angle
  const inner2R = outerR * rng.float(0.35, 0.55);
  const inner2InnerR = inner2R * rng.float(0.5, 0.75);
  state.paths[1] = {
    active: true,
    d: shellFragmentPath(
      rng.float(-3, 3), rng.float(-3, 3),
      inner2R, inner2InnerR,
      baseAngle + rng.float(0.3, 1.0),
      sweep * rng.float(0.5, 0.8),
      rng.float(1, 4),
    ),
    strokeWidth: rng.float(0.6, 1.5),
    opacity: rng.float(0.3, 0.65),
    dashArray: [],
  };

  // Paths 2-3: broken arc layers inside
  for (let i = 2; i < 4; i++) {
    const layerR = outerR * rng.float(0.4, 0.8);
    const layerSweep = sweep * rng.float(0.3, 0.7);
    const layerStart = baseAngle + rng.float(0.2, sweep * 0.5);
    state.paths[i] = {
      active: rng.bool(0.7),
      d: brokenArcPath(0, 0, layerR, layerStart, layerSweep, [
        { at: rng.float(0.3, 0.7), width: rng.float(0.08, 0.15) },
      ]),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.25, 0.55),
      dashArray: [],
    };
  }

  // Paths 4-5: gap emphasis marks (short lines at shell openings)
  const gapAngle1 = baseAngle;
  const gapAngle2 = baseAngle + sweep;
  state.paths[4] = {
    active: true,
    d: linePath(
      Math.cos(gapAngle1) * outerR, Math.sin(gapAngle1) * outerR,
      Math.cos(gapAngle1) * innerR * 0.8, Math.sin(gapAngle1) * innerR * 0.8,
    ),
    strokeWidth: rng.float(0.5, 1.2),
    opacity: rng.float(0.35, 0.65),
    dashArray: [],
  };
  state.paths[5] = {
    active: rng.bool(0.7),
    d: linePath(
      Math.cos(gapAngle2) * outerR, Math.sin(gapAngle2) * outerR,
      Math.cos(gapAngle2) * innerR * 0.85, Math.sin(gapAngle2) * innerR * 0.85,
    ),
    strokeWidth: rng.float(0.4, 1.0),
    opacity: rng.float(0.25, 0.55),
    dashArray: [],
  };

  // Split-node mark at gap endpoint (no circles)
  state.paths[6] = {
    active: rng.bool(0.5),
    d: splitNodePath(Math.cos(gapAngle1) * outerR, Math.sin(gapAngle1) * outerR, rng.float(1.5, 3), gapAngle1, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.3, 0.8),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
  };

  return state;
}

// ── Family: Knot Manifold ──
// Tangled partial loops, warped crossings. Near-knots that never close.
function knotManifoldFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng } = ctx;
  const state = zeroPrimitiveState();
  const r = rng.float(14, 28);

  // Path 0: primary loop-crossing path
  state.paths[0] = {
    active: true,
    d: loopCrossingPath(0, 0, r, rng.float(0, TAU), rng.float(1.3, 2.0), rng.float(0.15, 0.4)),
    strokeWidth: rng.float(1.0, 2.2),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Path 1: secondary crossing at different scale
  const r2 = r * rng.float(0.5, 0.8);
  const offset = rng.float(3, 10);
  const offsetAngle = rng.float(0, TAU);
  state.paths[1] = {
    active: true,
    d: loopCrossingPath(
      Math.cos(offsetAngle) * offset,
      Math.sin(offsetAngle) * offset,
      r2, rng.float(0, TAU), rng.float(1.2, 1.8), rng.float(0.2, 0.5),
    ),
    strokeWidth: rng.float(0.6, 1.5),
    opacity: rng.float(0.3, 0.65),
    dashArray: [],
  };

  // Paths 2-3: tangent extensions from loop edges
  for (let i = 2; i < 4; i++) {
    const tangAngle = rng.float(0, TAU);
    const tangR = r * rng.float(0.7, 1.2);
    const startX = Math.cos(tangAngle) * tangR;
    const startY = Math.sin(tangAngle) * tangR;
    const extLen = rng.float(8, 20);
    const extAngle = tangAngle + rng.float(-0.5, 0.5);
    state.paths[i] = {
      active: rng.bool(0.65),
      d: cubicPath(
        startX, startY,
        startX + Math.cos(extAngle) * extLen * 0.4 + rng.float(-4, 4),
        startY + Math.sin(extAngle) * extLen * 0.4 + rng.float(-4, 4),
        startX + Math.cos(extAngle) * extLen * 0.7 + rng.float(-3, 3),
        startY + Math.sin(extAngle) * extLen * 0.7 + rng.float(-3, 3),
        startX + Math.cos(extAngle) * extLen,
        startY + Math.sin(extAngle) * extLen,
      ),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.2, 0.5),
      dashArray: [],
    };
  }

  // Path 4: spiral warp through the knot region
  state.paths[4] = {
    active: rng.bool(0.6),
    d: spiralSegmentPath(
      rng.float(-3, 3), rng.float(-3, 3),
      r * rng.float(0.2, 0.4), r * rng.float(0.6, 1.0),
      rng.float(0, TAU), rng.float(1.5, 3.0),
    ),
    strokeWidth: rng.float(0.3, 0.9),
    opacity: rng.float(0.15, 0.4),
    dashArray: [],
  };

  // No circles — pure path-based knot
  // No ring

  return state;
}

// ── Family: Pressure Fragment ──
// Compressed along pressure gradient. Broken contour residues, stress marks.
function pressureFragmentFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region, flow } = ctx;
  const state = zeroPrimitiveState();
  const pressureAngle = flow.angle + rng.float(-0.3, 0.3);
  const perpAngle = pressureAngle + Math.PI / 2;
  const spread = rng.float(15, 30) * (0.7 + region.fragmentation * 0.5);

  // Paths 0-2: jagged fragments compressed along pressure direction
  for (let i = 0; i < 3; i++) {
    const offsetPerp = rng.float(-spread * 0.3, spread * 0.3);
    const offsetAlongStart = rng.float(-spread * 0.5, -spread * 0.1);
    const baseX = Math.cos(pressureAngle) * offsetAlongStart + Math.cos(perpAngle) * offsetPerp;
    const baseY = Math.sin(pressureAngle) * offsetAlongStart + Math.sin(perpAngle) * offsetPerp;

    const ptCount = rng.int(3, 5);
    const pts: Array<{ x: number; y: number }> = [];
    let px = baseX, py = baseY;
    for (let p = 0; p < ptCount; p++) {
      // Compressed: larger steps along pressure, small perpendicular jitter
      px += Math.cos(pressureAngle) * rng.float(3, 10) + Math.cos(perpAngle) * rng.float(-3, 3);
      py += Math.sin(pressureAngle) * rng.float(3, 10) + Math.sin(perpAngle) * rng.float(-3, 3);
      pts.push({ x: px, y: py });
    }
    state.paths[i] = {
      active: true,
      d: jaggedPath(pts),
      strokeWidth: rng.float(0.5, 1.8),
      opacity: rng.float(0.4, 0.8),
      dashArray: [],
    };
  }

  // Path 3: broken arc contour residue
  state.paths[3] = {
    active: rng.bool(0.7),
    d: brokenArcPath(
      rng.float(-5, 5), rng.float(-5, 5),
      rng.float(8, 18), pressureAngle, rng.float(1.0, 2.5),
      [{ at: rng.float(0.3, 0.7), width: rng.float(0.1, 0.2) }],
    ),
    strokeWidth: rng.float(0.5, 1.3),
    opacity: rng.float(0.3, 0.6),
    dashArray: [],
  };

  // Paths 4-5: kinked stress marks
  for (let i = 4; i < 6; i++) {
    const markX = rng.float(-spread * 0.4, spread * 0.4);
    const markY = rng.float(-spread * 0.4, spread * 0.4);
    const kinkOff = rng.float(3, 8) * rng.sign();
    state.paths[i] = {
      active: rng.bool(0.6),
      d: kinkedLinePath(
        markX - rng.float(3, 8), markY - rng.float(3, 8),
        markX + Math.cos(perpAngle) * kinkOff, markY + Math.sin(perpAngle) * kinkOff,
        markX + rng.float(3, 8), markY + rng.float(3, 8),
      ),
      strokeWidth: rng.float(0.3, 0.9),
      opacity: rng.float(0.2, 0.5),
      dashArray: [],
    };
  }

  // Tiny jagged stress mark (no circles)
  const stressX = rng.float(-spread * 0.3, spread * 0.3);
  const stressY = rng.float(-spread * 0.3, spread * 0.3);
  const sSize = rng.float(1, 3);
  state.paths[6] = {
    active: rng.bool(0.4),
    d: jaggedPath([
      { x: stressX - sSize, y: stressY },
      { x: stressX, y: stressY + sSize },
      { x: stressX + sSize, y: stressY - sSize * 0.5 },
    ]),
    strokeWidth: rng.float(0.2, 0.6),
    opacity: rng.float(0.25, 0.5),
    dashArray: [],
  };

  return state;
}

// ── Family: Semi-Biological Scaffold ──
// Half-anatomical, half-mathematical. Organic support structures.
function semiBiologicalScaffoldFactory(ctx: MotifGenerationContext): PrimitiveState {
  const { rng, region } = ctx;
  const state = zeroPrimitiveState();
  const mainAngle = rng.float(0, TAU);
  const armLen = rng.float(20, 38) * (0.8 + region.density * 0.3);

  // Path 0: main biological arm
  const arm1End = {
    x: Math.cos(mainAngle) * armLen,
    y: Math.sin(mainAngle) * armLen,
  };
  state.paths[0] = {
    active: true,
    d: biologicalArmPath(0, 0, arm1End.x, arm1End.y, rng.float(6, 14), rng.float(-0.8, 0.8)),
    strokeWidth: rng.float(1.0, 2.5),
    opacity: rng.float(0.5, 0.85),
    dashArray: [],
  };

  // Path 1: second arm at offset angle
  const arm2Angle = mainAngle + rng.float(1.0, 2.5) * rng.sign();
  const arm2Len = armLen * rng.float(0.5, 0.8);
  const arm2End = {
    x: Math.cos(arm2Angle) * arm2Len,
    y: Math.sin(arm2Angle) * arm2Len,
  };
  state.paths[1] = {
    active: true,
    d: biologicalArmPath(0, 0, arm2End.x, arm2End.y, rng.float(4, 10), rng.float(-0.7, 0.7)),
    strokeWidth: rng.float(0.7, 1.8),
    opacity: rng.float(0.35, 0.7),
    dashArray: [],
  };

  // Paths 2-4: asymmetric rib cross-braces between arms
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const braceAngle = mainAngle + rng.float(-0.2, 0.2);
    const dist = armLen * (t - 0.5) * 0.7;
    state.paths[i + 2] = {
      active: rng.bool(0.7),
      d: asymmetricRibPath(
        0, 0, braceAngle, dist,
        rng.float(4, 12), rng.float(2, 7),
        rng.float(-5, 5), rng.float(-5, 5),
      ),
      strokeWidth: rng.float(0.4, 1.2),
      opacity: rng.float(0.25, 0.6),
      dashArray: [],
    };
  }

  // Path 5: organic spiral curve connecting arms
  const midAngle = (mainAngle + arm2Angle) * 0.5;
  state.paths[5] = {
    active: rng.bool(0.6),
    d: spiralSegmentPath(
      0, 0,
      rng.float(3, 8), rng.float(12, 22),
      midAngle, rng.float(1.0, 2.5),
    ),
    strokeWidth: rng.float(0.3, 0.9),
    opacity: rng.float(0.2, 0.5),
    dashArray: [],
  };

  // Split-node mark at joint point (no circles)
  state.paths[6] = {
    active: rng.bool(0.6),
    d: splitNodePath(rng.float(-2, 2), rng.float(-2, 2), rng.float(2.5, 5), mainAngle, rng.float(0.3, 0.6)),
    strokeWidth: rng.float(0.5, 1.2),
    opacity: rng.float(0.35, 0.65),
    dashArray: [],
  };

  return state;
}
