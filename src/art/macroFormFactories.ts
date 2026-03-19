// ── Macro-form generators for ghost layer ──
// These produce environmental climate traces, not symbols or rails.
// All forms: path-native, fragmented, low-confidence, dash-capable.
// Climate weather, pressure veils, contour scars — felt, not drawn.

import type { Rng } from '@/shared/rng';
import type { DepthBandId } from '@/shared/types';
import type { FlowSample } from '@/field/flowField';
import type { RegionSignature } from '@/field/regionMap';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { zeroPrimitiveState } from '@/geometry/primitiveState';
import {
  cubicPath, spiralSegmentPath, brokenArcPath, linePath, jaggedPath,
} from '@/geometry/pathHelpers';
import { applyTraversalExtension } from '@/geometry/traversalExtension';
import { TAU } from '@/shared/math';

export type MacroFormType =
  | 'warpedContourVeil'
  | 'pressureBand'
  | 'bentManifold'
  | 'partialShellField'
  | 'driftCorridor'
  | 'pressureVeil'
  | 'contourScar'
  | 'basinRim'
  | 'fieldResidue';

const MACRO_FORM_TYPES: MacroFormType[] = [
  'warpedContourVeil',
  'pressureBand',
  'bentManifold',
  'partialShellField',
  'driftCorridor',
  'pressureVeil',
  'contourScar',
  'basinRim',
  'fieldResidue',
];

export interface MacroFormContext {
  rng: Rng;
  region: RegionSignature;
  flow: FlowSample;
  depthBand: DepthBandId;
  energy: number;
}

/** Pick a macro form type weighted by field conditions */
export function pickMacroFormType(rng: Rng, flow: FlowSample, region: RegionSignature): MacroFormType {
  return rng.weightedPick(MACRO_FORM_TYPES, (type) => {
    switch (type) {
      case 'warpedContourVeil': return 1.5 + region.coherence * 0.4;
      case 'pressureBand': return 0.3 + flow.convergenceZone * 0.4;
      case 'bentManifold': return 0.8 + region.fragmentation * 0.6;
      case 'partialShellField': return 0.15;
      case 'driftCorridor': return 1.2 + flow.magnitude * 0.8 + region.linearity * 0.4;
      case 'pressureVeil': return 1.0 + region.coherence * 0.6;
      case 'contourScar': return 0.8 + region.fragmentation * 1.0;
      case 'basinRim': return 0.4 + flow.convergenceZone * 0.8;
      case 'fieldResidue': return 1.2 + (1 - flow.magnitude) * 0.5;
    }
  });
}

export function createMacroFormState(type: MacroFormType, ctx: MacroFormContext): PrimitiveState {
  switch (type) {
    case 'warpedContourVeil': return applyTraversalExtension(warpedContourVeil(ctx), 0.4);
    case 'pressureBand': return applyTraversalExtension(pressureBand(ctx), 0.3);
    case 'bentManifold': return applyTraversalExtension(bentManifold(ctx), 0.3);
    case 'partialShellField': return applyTraversalExtension(partialShellField(ctx), 0.3);
    case 'driftCorridor': return applyTraversalExtension(driftCorridor(ctx), 0.4);
    case 'pressureVeil': return applyTraversalExtension(pressureVeil(ctx), 0.3);
    case 'contourScar': return applyTraversalExtension(contourScar(ctx), 0.2);
    case 'basinRim': return applyTraversalExtension(basinRim(ctx), 0.3);
    case 'fieldResidue': return applyTraversalExtension(fieldResidue(ctx), 0.2);
  }
}

// ── Warped Contour Veil ──
// Scattered flowing curves suggesting atmospheric contour layers.
// Reduced opacity and confidence, dash arrays for fragmentation.
function warpedContourVeil(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.3, 0.3);
  const perpAngle = baseAngle + Math.PI / 2;

  for (let i = 0; i < 8; i++) {
    const pathAngle = baseAngle + rng.float(-0.4, 0.4);
    const pathPerp = pathAngle + Math.PI / 2;
    const length = rng.float(12, 40);
    const offset = rng.float(-22, 22);
    const ox = Math.cos(perpAngle) * offset;
    const oy = Math.sin(perpAngle) * offset;
    const startShift = rng.float(-18, 18);
    const shiftX = Math.cos(pathAngle) * startShift;
    const shiftY = Math.sin(pathAngle) * startShift;
    const drift = rng.float(-18, 18);

    const sx = Math.cos(pathAngle + Math.PI) * length * 0.5 + ox + shiftX;
    const sy = Math.sin(pathAngle + Math.PI) * length * 0.5 + oy + shiftY;
    const ex = Math.cos(pathAngle) * length * 0.5 + ox + shiftX;
    const ey = Math.sin(pathAngle) * length * 0.5 + oy + shiftY;

    state.paths[i] = {
      active: rng.bool(0.55),
      d: cubicPath(
        sx, sy,
        sx + Math.cos(pathAngle) * length * 0.3 + Math.cos(pathPerp) * drift,
        sy + Math.sin(pathAngle) * length * 0.3 + Math.sin(pathPerp) * drift,
        ex - Math.cos(pathAngle) * length * 0.3 + Math.cos(pathPerp) * drift * 0.6,
        ey - Math.sin(pathAngle) * length * 0.3 + Math.sin(pathPerp) * drift * 0.6,
        ex, ey,
      ),
      strokeWidth: rng.float(0.15, 0.45),
      opacity: rng.float(0.08, 0.28),
      dashArray: rng.bool(0.4) ? [rng.float(3, 8), rng.float(2, 5)] : [],
    };
  }

  return state;
}

// ── Pressure Band ──
// Broken arcs at large radii — atmospheric pressure front. More notches, lower confidence.
function pressureBand(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const centerAngle = flow.angle + rng.float(-0.5, 0.5);

  for (let i = 0; i < 6; i++) {
    const r = rng.float(30, 50);
    const sweep = rng.float(1.2, 3.0);
    const startAngle = centerAngle + rng.float(-0.5, 0.5) + i * rng.float(0.1, 0.3);
    const notchCount = rng.int(2, 4);
    const notches: Array<{ at: number; width: number }> = [];
    for (let n = 0; n < notchCount; n++) {
      notches.push({ at: rng.float(0.15, 0.85), width: rng.float(0.06, 0.15) });
    }

    state.paths[i] = {
      active: rng.bool(0.75),
      d: brokenArcPath(
        rng.float(-8, 8), rng.float(-8, 8),
        r, startAngle, sweep, notches,
      ),
      strokeWidth: rng.float(0.2, 0.6),
      opacity: rng.float(0.15, 0.40),
      dashArray: rng.bool(0.3) ? [rng.float(4, 10), rng.float(2, 4)] : [],
    };
  }

  // Paths 6-7: faint connecting stress lines
  for (let i = 6; i < 8; i++) {
    const len = rng.float(15, 35);
    const angle = centerAngle + rng.float(-0.3, 0.3);
    state.paths[i] = {
      active: rng.bool(0.4),
      d: linePath(
        Math.cos(angle) * rng.float(10, 25), Math.sin(angle) * rng.float(10, 25),
        Math.cos(angle) * (rng.float(10, 25) + len), Math.sin(angle) * (rng.float(10, 25) + len),
      ),
      strokeWidth: rng.float(0.15, 0.4),
      opacity: rng.float(0.10, 0.28),
      dashArray: [rng.float(3, 6), rng.float(2, 4)],
    };
  }

  return state;
}

// ── Bent Manifold ──
// Large-scale tangled structures — reduced opacity, dashed accents.
function bentManifold(ctx: MacroFormContext): PrimitiveState {
  const { rng } = ctx;
  const state = zeroPrimitiveState();

  // Paths 0-2: large directional sweeps (capped to avoid circular read)
  for (let i = 0; i < 3; i++) {
    const r = rng.float(25, 45);
    const cx = rng.float(-10, 10);
    const cy = rng.float(-10, 10);
    state.paths[i] = {
      active: true,
      d: spiralSegmentPath(
        cx, cy,
        r * rng.float(0.3, 0.6), r,
        rng.float(0, TAU), rng.float(1.3, 2.4),
        16,
      ),
      strokeWidth: rng.float(0.3, 0.7),
      opacity: rng.float(0.15, 0.40),
      dashArray: rng.bool(0.35) ? [rng.float(5, 12), rng.float(2, 5)] : [],
    };
  }

  // Paths 3-5: sweeping cubic connectors
  for (let i = 3; i < 6; i++) {
    const angle = rng.float(0, TAU);
    const len = rng.float(35, 60);
    const curve = rng.float(12, 25) * rng.sign();
    const perpAngle = angle + Math.PI / 2;
    const sx = Math.cos(angle + Math.PI) * len * 0.4;
    const sy = Math.sin(angle + Math.PI) * len * 0.4;
    const ex = Math.cos(angle) * len * 0.4;
    const ey = Math.sin(angle) * len * 0.4;
    state.paths[i] = {
      active: rng.bool(0.6),
      d: cubicPath(
        sx, sy,
        sx + Math.cos(angle) * len * 0.25 + Math.cos(perpAngle) * curve,
        sy + Math.sin(angle) * len * 0.25 + Math.sin(perpAngle) * curve,
        ex - Math.cos(angle) * len * 0.25 + Math.cos(perpAngle) * curve * 0.5,
        ey - Math.sin(angle) * len * 0.25 + Math.sin(perpAngle) * curve * 0.5,
        ex, ey,
      ),
      strokeWidth: rng.float(0.2, 0.6),
      opacity: rng.float(0.12, 0.35),
      dashArray: [],
    };
  }

  // Paths 6-7: dashed accent spirals
  for (let i = 6; i < 8; i++) {
    state.paths[i] = {
      active: rng.bool(0.4),
      d: spiralSegmentPath(
        rng.float(-15, 15), rng.float(-15, 15),
        rng.float(5, 12), rng.float(18, 30),
        rng.float(0, TAU), rng.float(1.0, 1.8),
      ),
      strokeWidth: rng.float(0.15, 0.45),
      opacity: rng.float(0.10, 0.25),
      dashArray: [rng.float(3, 8), rng.float(2, 5)],
    };
  }

  return state;
}

// ── Partial Shell Field ──
// Overlapping partial enclosures — more notches, lower opacity.
function partialShellField(ctx: MacroFormContext): PrimitiveState {
  const { rng } = ctx;
  const state = zeroPrimitiveState();

  for (let i = 0; i < 6; i++) {
    const outerR = rng.float(25, 45);
    const cx = rng.float(-15, 15);
    const cy = rng.float(-15, 15);
    const startAngle = rng.float(0, TAU);
    const sweep = rng.float(1.2, 3.0);
    const notchCount = rng.int(2, 3);
    const notches: Array<{ at: number; width: number }> = [];
    for (let n = 0; n < notchCount; n++) {
      notches.push({ at: rng.float(0.2, 0.8), width: rng.float(0.06, 0.15) });
    }

    state.paths[i] = {
      active: rng.bool(0.7),
      d: brokenArcPath(cx, cy, outerR, startAngle, sweep, notches),
      strokeWidth: rng.float(0.2, 0.6),
      opacity: rng.float(0.12, 0.35),
      dashArray: rng.bool(0.3) ? [rng.float(4, 8), rng.float(2, 4)] : [],
    };
  }

  // Paths 6-7: inner fragments
  for (let i = 6; i < 8; i++) {
    const r = rng.float(15, 30);
    state.paths[i] = {
      active: rng.bool(0.45),
      d: brokenArcPath(
        rng.float(-8, 8), rng.float(-8, 8),
        r, rng.float(0, TAU), rng.float(0.8, 2.0),
        [{ at: rng.float(0.2, 0.8), width: rng.float(0.10, 0.20) }],
      ),
      strokeWidth: rng.float(0.15, 0.45),
      opacity: rng.float(0.10, 0.28),
      dashArray: [rng.float(3, 6), rng.float(2, 4)],
    };
  }

  return state;
}

// ── Drift Corridor ──
// Scattered directional paths suggesting current lanes. More gaps, lower confidence.
function driftCorridor(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.25, 0.25);
  const perpAngle = baseAngle + Math.PI / 2;

  for (let i = 0; i < 8; i++) {
    const pathAngle = baseAngle + rng.float(-0.3, 0.3);
    const pathPerp = pathAngle + Math.PI / 2;
    const length = rng.float(10, 40);
    const offset = (rng.float(-1, 1) * rng.float(8, 30));
    const ox = Math.cos(perpAngle) * offset;
    const oy = Math.sin(perpAngle) * offset;
    const startShift = rng.float(-20, 20);
    const shiftX = Math.cos(pathAngle) * startShift;
    const shiftY = Math.sin(pathAngle) * startShift;
    const laneCurve = rng.float(-15, 15);

    const sx = Math.cos(pathAngle + Math.PI) * length * 0.5 + ox + shiftX;
    const sy = Math.sin(pathAngle + Math.PI) * length * 0.5 + oy + shiftY;
    const ex = Math.cos(pathAngle) * length * 0.5 + ox + shiftX;
    const ey = Math.sin(pathAngle) * length * 0.5 + oy + shiftY;

    state.paths[i] = {
      active: rng.bool(0.50),
      d: cubicPath(
        sx, sy,
        sx + Math.cos(pathAngle) * length * 0.35 + Math.cos(pathPerp) * laneCurve,
        sy + Math.sin(pathAngle) * length * 0.35 + Math.sin(pathPerp) * laneCurve,
        ex - Math.cos(pathAngle) * length * 0.35 + Math.cos(pathPerp) * laneCurve * 0.5,
        ey - Math.sin(pathAngle) * length * 0.35 + Math.sin(pathPerp) * laneCurve * 0.5,
        ex, ey,
      ),
      strokeWidth: rng.float(0.15, 0.5),
      opacity: rng.float(0.10, 0.32),
      dashArray: rng.bool(0.45) ? [rng.float(3, 7), rng.float(2, 5)] : [],
    };
  }

  return state;
}

// ── NEW: Pressure Veil ──
// Very faint, wide-spread cubics with heavy dash arrays — barely there.
function pressureVeil(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.5, 0.5);

  for (let i = 0; i < 8; i++) {
    const angle = baseAngle + rng.float(-0.6, 0.6);
    const perp = angle + Math.PI / 2;
    const length = rng.float(25, 60);
    const spread = rng.float(-30, 30);
    const ox = Math.cos(perp) * spread;
    const oy = Math.sin(perp) * spread;
    const curve = rng.float(-20, 20);

    const sx = Math.cos(angle + Math.PI) * length * 0.5 + ox;
    const sy = Math.sin(angle + Math.PI) * length * 0.5 + oy;
    const ex = Math.cos(angle) * length * 0.5 + ox;
    const ey = Math.sin(angle) * length * 0.5 + oy;

    state.paths[i] = {
      active: rng.bool(0.45),
      d: cubicPath(
        sx, sy,
        sx + Math.cos(angle) * length * 0.3 + Math.cos(perp) * curve,
        sy + Math.sin(angle) * length * 0.3 + Math.sin(perp) * curve,
        ex - Math.cos(angle) * length * 0.3 + Math.cos(perp) * curve * 0.4,
        ey - Math.sin(angle) * length * 0.3 + Math.sin(perp) * curve * 0.4,
        ex, ey,
      ),
      strokeWidth: rng.float(0.1, 0.3),
      opacity: rng.float(0.05, 0.18),
      dashArray: [rng.float(4, 12), rng.float(3, 8)],
    };
  }

  return state;
}

// ── NEW: Contour Scar ──
// Short jagged line segments scattered in flow direction — geological marks.
function contourScar(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.4, 0.4);

  for (let i = 0; i < 8; i++) {
    const angle = baseAngle + rng.float(-0.5, 0.5);
    const perp = angle + Math.PI / 2;
    const ox = rng.float(-25, 25);
    const oy = rng.float(-25, 25);
    const length = rng.float(8, 25);
    const segments = rng.int(3, 6);
    const jitter = rng.float(2, 6);

    // Build jagged point array
    const points: Array<{ x: number; y: number }> = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const x = ox + Math.cos(angle) * length * t + Math.cos(perp) * rng.float(-jitter, jitter);
      const y = oy + Math.sin(angle) * length * t + Math.sin(perp) * rng.float(-jitter, jitter);
      points.push({ x, y });
    }

    state.paths[i] = {
      active: rng.bool(0.55),
      d: jaggedPath(points),
      strokeWidth: rng.float(0.15, 0.4),
      opacity: rng.float(0.08, 0.22),
      dashArray: rng.bool(0.3) ? [rng.float(2, 5), rng.float(1, 3)] : [],
    };
  }

  return state;
}

// ── NEW: Basin Rim ──
// Large-radius broken arcs with heavy fragmentation — tectonic edges.
function basinRim(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const centerAngle = flow.angle + rng.float(-0.6, 0.6);

  for (let i = 0; i < 6; i++) {
    const r = rng.float(35, 55);
    const sweep = rng.float(0.8, 2.5);
    const startAngle = centerAngle + rng.float(-0.8, 0.8) + i * rng.float(0.05, 0.2);
    const notchCount = rng.int(3, 5);
    const notches: Array<{ at: number; width: number }> = [];
    for (let n = 0; n < notchCount; n++) {
      notches.push({ at: rng.float(0.1, 0.9), width: rng.float(0.08, 0.18) });
    }

    state.paths[i] = {
      active: rng.bool(0.6),
      d: brokenArcPath(
        rng.float(-12, 12), rng.float(-12, 12),
        r, startAngle, sweep, notches,
      ),
      strokeWidth: rng.float(0.15, 0.5),
      opacity: rng.float(0.08, 0.25),
      dashArray: [rng.float(4, 10), rng.float(3, 6)],
    };
  }

  return state;
}

// ── NEW: Field Residue ──
// Extremely faint disconnected path stubs — afterimages of force.
function fieldResidue(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();

  for (let i = 0; i < 8; i++) {
    const angle = flow.angle + rng.float(-0.8, 0.8);
    const ox = rng.float(-30, 30);
    const oy = rng.float(-30, 30);
    const length = rng.float(5, 18);

    const sx = ox;
    const sy = oy;
    const ex = ox + Math.cos(angle) * length;
    const ey = oy + Math.sin(angle) * length;

    state.paths[i] = {
      active: rng.bool(0.40),
      d: linePath(sx, sy, ex, ey),
      strokeWidth: rng.float(0.1, 0.3),
      opacity: rng.float(0.04, 0.14),
      dashArray: rng.bool(0.5) ? [rng.float(2, 5), rng.float(2, 4)] : [],
    };
  }

  return state;
}
