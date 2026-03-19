// ── Macro-form generators for ghost layer ──
// These produce environmental field pressures, not symbols.
// All forms: 6-8 active paths, 0-1 circles, no ring.
// Long sweeping curves, soft edges, offscreen-capable.

import type { Rng } from '@/shared/rng';
import type { DepthBandId } from '@/shared/types';
import type { FlowSample } from '@/field/flowField';
import type { RegionSignature } from '@/field/regionMap';
import type { PrimitiveState } from '@/geometry/primitiveTypes';
import { zeroPrimitiveState } from '@/geometry/primitiveState';
import {
  cubicPath, spiralSegmentPath, brokenArcPath, linePath,
} from '@/geometry/pathHelpers';
import { TAU } from '@/shared/math';

export type MacroFormType =
  | 'warpedContourVeil'
  | 'pressureBand'
  | 'bentManifold'
  | 'partialShellField'
  | 'driftCorridor';

const MACRO_FORM_TYPES: MacroFormType[] = [
  'warpedContourVeil',
  'pressureBand',
  'bentManifold',
  'partialShellField',
  'driftCorridor',
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
      case 'warpedContourVeil': return 1.8 + region.coherence * 0.5;
      case 'pressureBand': return 0.3 + flow.convergenceZone * 0.4;
      case 'bentManifold': return 1.0 + region.fragmentation * 0.8;
      case 'partialShellField': return 0.15;
      case 'driftCorridor': return 1.5 + flow.magnitude * 1.0 + region.linearity * 0.5;
    }
  });
}

export function createMacroFormState(type: MacroFormType, ctx: MacroFormContext): PrimitiveState {
  switch (type) {
    case 'warpedContourVeil': return warpedContourVeil(ctx);
    case 'pressureBand': return pressureBand(ctx);
    case 'bentManifold': return bentManifold(ctx);
    case 'partialShellField': return partialShellField(ctx);
    case 'driftCorridor': return driftCorridor(ctx);
  }
}

// ── Warped Contour Veil ──
// Scattered flowing curves suggesting atmospheric contour layers — NOT parallel blocks.
function warpedContourVeil(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.3, 0.3);
  const perpAngle = baseAngle + Math.PI / 2;

  for (let i = 0; i < 8; i++) {
    // Per-path angle jitter
    const pathAngle = baseAngle + rng.float(-0.3, 0.3);
    const pathPerp = pathAngle + Math.PI / 2;

    // Shorter wisps — climate traces, not rails
    const length = rng.float(15, 50);

    // Scattered offset — not evenly spaced
    const offset = rng.float(-20, 20);
    const ox = Math.cos(perpAngle) * offset;
    const oy = Math.sin(perpAngle) * offset;

    // Stagger along flow
    const startShift = rng.float(-15, 15);
    const shiftX = Math.cos(pathAngle) * startShift;
    const shiftY = Math.sin(pathAngle) * startShift;

    // Strong per-path curvature
    const drift = rng.float(-15, 15);

    const sx = Math.cos(pathAngle + Math.PI) * length * 0.5 + ox + shiftX;
    const sy = Math.sin(pathAngle + Math.PI) * length * 0.5 + oy + shiftY;
    const ex = Math.cos(pathAngle) * length * 0.5 + ox + shiftX;
    const ey = Math.sin(pathAngle) * length * 0.5 + oy + shiftY;

    state.paths[i] = {
      active: rng.bool(0.70),
      d: cubicPath(
        sx, sy,
        sx + Math.cos(pathAngle) * length * 0.3 + Math.cos(pathPerp) * drift,
        sy + Math.sin(pathAngle) * length * 0.3 + Math.sin(pathPerp) * drift,
        ex - Math.cos(pathAngle) * length * 0.3 + Math.cos(pathPerp) * drift * 0.6,
        ey - Math.sin(pathAngle) * length * 0.3 + Math.sin(pathPerp) * drift * 0.6,
        ex, ey,
      ),
      strokeWidth: rng.float(0.2, 0.7),
      opacity: rng.float(0.15, 0.45),
      dashArray: [],
    };
  }

  return state;
}

// ── Pressure Band ──
// Broken arcs at large radii arranged as atmospheric pressure front.
function pressureBand(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const centerAngle = flow.angle + rng.float(-0.5, 0.5);

  for (let i = 0; i < 6; i++) {
    const r = rng.float(30, 50);
    const sweep = rng.float(1.5, 3.5);
    const startAngle = centerAngle + rng.float(-0.5, 0.5) + i * rng.float(0.1, 0.3);
    const notchCount = rng.int(1, 2);
    const notches: Array<{ at: number; width: number }> = [];
    for (let n = 0; n < notchCount; n++) {
      notches.push({ at: rng.float(0.2, 0.8), width: rng.float(0.05, 0.12) });
    }

    state.paths[i] = {
      active: true,
      d: brokenArcPath(
        rng.float(-8, 8), rng.float(-8, 8),
        r, startAngle, sweep, notches,
      ),
      strokeWidth: rng.float(0.3, 0.9),
      opacity: rng.float(0.25, 0.65),
      dashArray: [],
    };
  }

  // Paths 6-7: connecting stress lines
  for (let i = 6; i < 8; i++) {
    const len = rng.float(20, 40);
    const angle = centerAngle + rng.float(-0.3, 0.3);
    state.paths[i] = {
      active: rng.bool(0.5),
      d: linePath(
        Math.cos(angle) * rng.float(10, 25), Math.sin(angle) * rng.float(10, 25),
        Math.cos(angle) * (rng.float(10, 25) + len), Math.sin(angle) * (rng.float(10, 25) + len),
      ),
      strokeWidth: rng.float(0.2, 0.6),
      opacity: rng.float(0.15, 0.4),
      dashArray: [],
    };
  }

  return state;
}

// ── Bent Manifold ──
// Large-scale tangled structures — self-crossing spirals and warped loops.
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
        rng.float(0, TAU), rng.float(1.5, 2.8),
        16,
      ),
      strokeWidth: rng.float(0.4, 1.0),
      opacity: rng.float(0.3, 0.7),
      dashArray: [],
    };
  }

  // Paths 3-5: sweeping cubic connectors
  for (let i = 3; i < 6; i++) {
    const angle = rng.float(0, TAU);
    const len = rng.float(40, 70);
    const curve = rng.float(15, 30) * rng.sign();
    const perpAngle = angle + Math.PI / 2;
    const sx = Math.cos(angle + Math.PI) * len * 0.4;
    const sy = Math.sin(angle + Math.PI) * len * 0.4;
    const ex = Math.cos(angle) * len * 0.4;
    const ey = Math.sin(angle) * len * 0.4;
    state.paths[i] = {
      active: rng.bool(0.7),
      d: cubicPath(
        sx, sy,
        sx + Math.cos(angle) * len * 0.25 + Math.cos(perpAngle) * curve,
        sy + Math.sin(angle) * len * 0.25 + Math.sin(perpAngle) * curve,
        ex - Math.cos(angle) * len * 0.25 + Math.cos(perpAngle) * curve * 0.5,
        ey - Math.sin(angle) * len * 0.25 + Math.sin(perpAngle) * curve * 0.5,
        ex, ey,
      ),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.2, 0.5),
      dashArray: [],
    };
  }

  // Paths 6-7: accent spirals (capped sweep)
  for (let i = 6; i < 8; i++) {
    state.paths[i] = {
      active: rng.bool(0.5),
      d: spiralSegmentPath(
        rng.float(-15, 15), rng.float(-15, 15),
        rng.float(5, 12), rng.float(18, 30),
        rng.float(0, TAU), rng.float(1.2, 2.2),
      ),
      strokeWidth: rng.float(0.2, 0.6),
      opacity: rng.float(0.15, 0.35),
      dashArray: [],
    };
  }

  return state;
}

// ── Partial Shell Field ──
// Overlapping partial enclosures suggesting field topology.
function partialShellField(ctx: MacroFormContext): PrimitiveState {
  const { rng } = ctx;
  const state = zeroPrimitiveState();

  for (let i = 0; i < 6; i++) {
    const outerR = rng.float(25, 45);
    const innerR = outerR * rng.float(0.6, 0.85);
    const cx = rng.float(-15, 15);
    const cy = rng.float(-15, 15);
    const startAngle = rng.float(0, TAU);
    const sweep = rng.float(1.5, 3.5);

    state.paths[i] = {
      active: true,
      d: brokenArcPath(
        cx, cy, outerR, startAngle, sweep,
        [{ at: rng.float(0.3, 0.7), width: rng.float(0.06, 0.12) }],
      ),
      strokeWidth: rng.float(0.3, 0.8),
      opacity: rng.float(0.25, 0.6),
      dashArray: [],
    };
  }

  // Paths 6-7: inner fragments
  for (let i = 6; i < 8; i++) {
    const r = rng.float(15, 30);
    state.paths[i] = {
      active: rng.bool(0.6),
      d: brokenArcPath(
        rng.float(-8, 8), rng.float(-8, 8),
        r, rng.float(0, TAU), rng.float(1.0, 2.5),
        [{ at: rng.float(0.2, 0.8), width: rng.float(0.08, 0.18) }],
      ),
      strokeWidth: rng.float(0.2, 0.6),
      opacity: rng.float(0.15, 0.4),
      dashArray: [],
    };
  }

  return state;
}

// ── Drift Corridor ──
// Scattered directional paths suggesting current lanes — NOT parallel blocks.
function driftCorridor(ctx: MacroFormContext): PrimitiveState {
  const { rng, flow } = ctx;
  const state = zeroPrimitiveState();
  const baseAngle = flow.angle + rng.float(-0.2, 0.2);
  const perpAngle = baseAngle + Math.PI / 2;

  for (let i = 0; i < 8; i++) {
    // Per-path angle jitter — breaks parallelism
    const pathAngle = baseAngle + rng.float(-0.25, 0.25);
    const pathPerp = pathAngle + Math.PI / 2;

    // Shorter fragments — climate traces, not rails
    const length = rng.float(15, 50);

    // Scattered perpendicular offset with gaps
    const offset = (rng.float(-1, 1) * rng.float(8, 30));
    const ox = Math.cos(perpAngle) * offset;
    const oy = Math.sin(perpAngle) * offset;

    // Stagger start position along flow direction
    const startShift = rng.float(-20, 20);
    const shiftX = Math.cos(pathAngle) * startShift;
    const shiftY = Math.sin(pathAngle) * startShift;

    // Stronger curvature variation
    const laneCurve = rng.float(-12, 12);

    const sx = Math.cos(pathAngle + Math.PI) * length * 0.5 + ox + shiftX;
    const sy = Math.sin(pathAngle + Math.PI) * length * 0.5 + oy + shiftY;
    const ex = Math.cos(pathAngle) * length * 0.5 + ox + shiftX;
    const ey = Math.sin(pathAngle) * length * 0.5 + oy + shiftY;

    state.paths[i] = {
      active: rng.bool(0.70), // 30% gaps — more fragmented, less rail-like
      d: cubicPath(
        sx, sy,
        sx + Math.cos(pathAngle) * length * 0.35 + Math.cos(pathPerp) * laneCurve,
        sy + Math.sin(pathAngle) * length * 0.35 + Math.sin(pathPerp) * laneCurve,
        ex - Math.cos(pathAngle) * length * 0.35 + Math.cos(pathPerp) * laneCurve * 0.5,
        ey - Math.sin(pathAngle) * length * 0.35 + Math.sin(pathPerp) * laneCurve * 0.5,
        ex, ey,
      ),
      strokeWidth: rng.float(0.2, 0.7),
      opacity: rng.float(0.15, 0.45),
      dashArray: [],
    };
  }

  return state;
}
