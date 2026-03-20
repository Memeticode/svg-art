// ── SVG path generation helpers for motif families ──
// All coordinates in local motif space [-50, 50]

import type { Vec2 } from '@/shared/types';
import { TAU } from '@/shared/math';

/** Arc path using SVG A command.
 *  No-circle doctrine: sweep is hard-capped at MAX_ARC_SWEEP to prevent circular closure. */
const MAX_ARC_SWEEP = TAU * 0.28; // ~101° — under a quarter circle, prevents circular reading even from composites

export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  // Enforce sweep cap
  let sweep = endAngle - startAngle;
  if (Math.abs(sweep) > MAX_ARC_SWEEP) {
    sweep = Math.sign(sweep) * MAX_ARC_SWEEP;
    endAngle = startAngle + sweep;
  }

  // No-circle doctrine: make arcs elliptical (ry ≠ rx) to prevent circular read
  const rx = r;
  const ry = r * (0.55 + Math.abs(Math.sin(startAngle * 2.3 + r * 0.1)) * 0.3); // 55-85% of rx
  const rotation = (startAngle * 180 / Math.PI * 0.3) % 45; // slight axis tilt

  const sx = cx + Math.cos(startAngle) * rx;
  const sy = cy + Math.sin(startAngle) * ry;
  const ex = cx + Math.cos(endAngle) * rx;
  const ey = cy + Math.sin(endAngle) * ry;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${rx.toFixed(2)} ${ry.toFixed(2)} ${rotation.toFixed(1)} ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/** Gentle curve between two points — never a straight line.
 *  Control points offset perpendicular to the line for subtle curvature. */
export function linePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) * 0.5;
  const my = (y1 + y2) * 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Perpendicular offset: ~8% of length for subtle curvature
  const offset = len * 0.08;
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);
  const cpx = mx + nx * offset;
  const cpy = my + ny * offset;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} Q${cpx.toFixed(2)} ${cpy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Quadratic bezier curve */
export function quadPath(
  x1: number, y1: number,
  cpx: number, cpy: number,
  x2: number, y2: number,
): string {
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} Q${cpx.toFixed(2)} ${cpy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Cubic bezier curve */
export function cubicPath(
  x1: number, y1: number,
  cp1x: number, cp1y: number,
  cp2x: number, cp2y: number,
  x2: number, y2: number,
): string {
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Radial spoke from center outward — gentle curve, not a straight line */
export function spokePath(
  cx: number,
  cy: number,
  angle: number,
  innerR: number,
  outerR: number,
): string {
  const x1 = cx + Math.cos(angle) * innerR;
  const y1 = cy + Math.sin(angle) * innerR;
  const x2 = cx + Math.cos(angle) * outerR;
  const y2 = cy + Math.sin(angle) * outerR;
  // Offset control point perpendicular to spoke for gentle curvature
  const midR = (innerR + outerR) * 0.5;
  const perpAngle = angle + Math.PI / 2;
  const offset = (outerR - innerR) * 0.1;
  const cpx = cx + Math.cos(angle) * midR + Math.cos(perpAngle) * offset;
  const cpy = cy + Math.sin(angle) * midR + Math.sin(perpAngle) * offset;
  return quadPath(x1, y1, cpx, cpy, x2, y2);
}

/** Crescent shape via two overlapping arcs */
export function crescentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  sweep: number,
): string {
  const endAngle = startAngle + sweep;
  const outer = arcPath(cx, cy, outerR, startAngle, endAngle);
  // Inner arc in reverse direction
  const ix1 = cx + Math.cos(endAngle) * innerR;
  const iy1 = cy + Math.sin(endAngle) * innerR;
  const ix2 = cx + Math.cos(startAngle) * innerR;
  const iy2 = cy + Math.sin(startAngle) * innerR;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const inner = `L${ix1.toFixed(2)} ${iy1.toFixed(2)} A${innerR.toFixed(2)} ${innerR.toFixed(2)} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)} Z`;
  return outer + ' ' + inner;
}

/** A rib: a short curved strut perpendicular to a radial direction */
export function ribPath(
  cx: number,
  cy: number,
  angle: number,
  dist: number,
  length: number,
  curve: number,
): string {
  const perpAngle = angle + Math.PI / 2;
  const baseX = cx + Math.cos(angle) * dist;
  const baseY = cy + Math.sin(angle) * dist;
  const x1 = baseX + Math.cos(perpAngle) * length * 0.5;
  const y1 = baseY + Math.sin(perpAngle) * length * 0.5;
  const x2 = baseX - Math.cos(perpAngle) * length * 0.5;
  const y2 = baseY - Math.sin(perpAngle) * length * 0.5;
  const cpx = baseX + Math.cos(angle) * curve;
  const cpy = baseY + Math.sin(angle) * curve;
  return quadPath(x1, y1, cpx, cpy, x2, y2);
}

// ── Asymmetric / interrupted path helpers ──

/** Two-segment curve through a kink point — smooth quadratic beziers */
export function kinkedLinePath(
  x1: number, y1: number,
  kinkX: number, kinkY: number,
  x2: number, y2: number,
): string {
  // Two quadratic segments meeting at the kink, with control points
  // offset for gentle curvature through each segment
  const mid1x = (x1 + kinkX) * 0.5;
  const mid1y = (y1 + kinkY) * 0.5;
  const mid2x = (kinkX + x2) * 0.5;
  const mid2y = (kinkY + y2) * 0.5;
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} Q${mid1x.toFixed(2)} ${mid1y.toFixed(2)} ${kinkX.toFixed(2)} ${kinkY.toFixed(2)} Q${mid2x.toFixed(2)} ${mid2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Compound arcs at different radii stitched with smooth curves */
export function multiArcPath(
  cx: number,
  cy: number,
  segments: Array<{ r: number; startAngle: number; sweep: number }>,
): string {
  if (segments.length === 0) return 'M0 0';
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const sx = cx + Math.cos(seg.startAngle) * seg.r;
    const sy = cy + Math.sin(seg.startAngle) * seg.r;
    const endAngle = seg.startAngle + seg.sweep;
    const ex = cx + Math.cos(endAngle) * seg.r;
    const ey = cy + Math.sin(endAngle) * seg.r;
    const largeArc = Math.abs(seg.sweep) > Math.PI ? 1 : 0;
    const sweepFlag = seg.sweep > 0 ? 1 : 0;
    if (i === 0) {
      parts.push(`M${sx.toFixed(2)} ${sy.toFixed(2)}`);
    } else {
      // Smooth curve connector between arc segments instead of straight line
      const prevEnd = parts[parts.length - 1];
      const midAngle = (seg.startAngle + (segments[i - 1].startAngle + segments[i - 1].sweep)) * 0.5;
      const midR = (seg.r + segments[i - 1].r) * 0.5;
      const cpx = cx + Math.cos(midAngle) * midR;
      const cpy = cy + Math.sin(midAngle) * midR;
      parts.push(`Q${cpx.toFixed(2)} ${cpy.toFixed(2)} ${sx.toFixed(2)} ${sy.toFixed(2)}`);
    }
    parts.push(`A${seg.r.toFixed(2)} ${seg.r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`);
  }
  return parts.join(' ');
}

/** Smooth polyline through arbitrary points — quadratic curves between segments */
export function jaggedPath(points: Vec2[]): string {
  if (points.length < 2) return 'M0 0';
  if (points.length === 2) {
    return linePath(points[0].x, points[0].y, points[1].x, points[1].y);
  }
  // Use quadratic bezier curves: each point becomes a control point
  // for a smooth curve passing near it
  const parts = [`M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let i = 1; i < points.length - 1; i++) {
    // Control point is the current point, endpoint is midpoint to next
    const midX = (points[i].x + points[i + 1].x) * 0.5;
    const midY = (points[i].y + points[i + 1].y) * 0.5;
    parts.push(`Q${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`);
  }
  // Final segment: curve to last point
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  parts.push(`Q${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
  return parts.join(' ');
}

/** Spiral arc segment — radius changes across the sweep, smooth cubic curves */
export function spiralSegmentPath(
  cx: number,
  cy: number,
  startR: number,
  endR: number,
  startAngle: number,
  sweep: number,
  steps = 12,
): string {
  // Generate sample points along the spiral
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + sweep * t;
    const r = startR + (endR - startR) * t;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  if (pts.length < 2) return 'M0 0';

  // Build smooth cubic bezier chain through the sample points
  // Using Catmull-Rom-style tangent estimation
  const parts = [`M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    // Catmull-Rom tangents → cubic bezier control points
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    parts.push(`C${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return parts.join(' ');
}

/** Asymmetric rib — independent left/right arm lengths and curvatures */
export function asymmetricRibPath(
  cx: number,
  cy: number,
  angle: number,
  dist: number,
  lenLeft: number,
  lenRight: number,
  curveLeft: number,
  curveRight: number,
): string {
  const perpAngle = angle + Math.PI / 2;
  const baseX = cx + Math.cos(angle) * dist;
  const baseY = cy + Math.sin(angle) * dist;
  // Left arm
  const lx = baseX + Math.cos(perpAngle) * lenLeft;
  const ly = baseY + Math.sin(perpAngle) * lenLeft;
  const lcpx = baseX + Math.cos(angle) * curveLeft + Math.cos(perpAngle) * lenLeft * 0.5;
  const lcpy = baseY + Math.sin(angle) * curveLeft + Math.sin(perpAngle) * lenLeft * 0.5;
  // Right arm
  const rx = baseX - Math.cos(perpAngle) * lenRight;
  const ry = baseY - Math.sin(perpAngle) * lenRight;
  const rcpx = baseX + Math.cos(angle) * curveRight - Math.cos(perpAngle) * lenRight * 0.5;
  const rcpy = baseY + Math.sin(angle) * curveRight - Math.sin(perpAngle) * lenRight * 0.5;
  // Two quadratic arcs meeting at the base point
  return `M${lx.toFixed(2)} ${ly.toFixed(2)} Q${lcpx.toFixed(2)} ${lcpy.toFixed(2)} ${baseX.toFixed(2)} ${baseY.toFixed(2)} Q${rcpx.toFixed(2)} ${rcpy.toFixed(2)} ${rx.toFixed(2)} ${ry.toFixed(2)}`;
}

// ── Tension / deformation path helpers (v2) ──

/** Arc with gap interruptions — broken, incomplete feel */
export function brokenArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweep: number,
  notches: Array<{ at: number; width: number }>,
): string {
  // No-circle doctrine: cap total sweep
  if (Math.abs(sweep) > MAX_ARC_SWEEP) {
    sweep = Math.sign(sweep) * MAX_ARC_SWEEP;
  }
  if (notches.length === 0) {
    return arcPath(cx, cy, r, startAngle, startAngle + sweep);
  }

  // Sort notches by position
  const sorted = [...notches].sort((a, b) => a.at - b.at);
  const parts: string[] = [];
  let cursor = 0; // fractional progress through sweep

  for (const notch of sorted) {
    const notchStart = notch.at - notch.width * 0.5;
    const notchEnd = notch.at + notch.width * 0.5;

    if (notchStart > cursor) {
      // Draw arc segment from cursor to notchStart
      const a0 = startAngle + sweep * cursor;
      const a1 = startAngle + sweep * notchStart;
      const sx = cx + Math.cos(a0) * r;
      const sy = cy + Math.sin(a0) * r;
      const ex = cx + Math.cos(a1) * r;
      const ey = cy + Math.sin(a1) * r;
      const segSweep = a1 - a0;
      const largeArc = Math.abs(segSweep) > Math.PI ? 1 : 0;
      const sweepFlag = segSweep > 0 ? 1 : 0;
      parts.push(`M${sx.toFixed(2)} ${sy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`);
    }
    cursor = Math.max(cursor, notchEnd);
  }

  // Final segment after last notch
  if (cursor < 1) {
    const a0 = startAngle + sweep * cursor;
    const a1 = startAngle + sweep;
    const sx = cx + Math.cos(a0) * r;
    const sy = cy + Math.sin(a0) * r;
    const ex = cx + Math.cos(a1) * r;
    const ey = cy + Math.sin(a1) * r;
    const segSweep = a1 - a0;
    const largeArc = Math.abs(segSweep) > Math.PI ? 1 : 0;
    const sweepFlag = segSweep > 0 ? 1 : 0;
    parts.push(`M${sx.toFixed(2)} ${sy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`);
  }

  return parts.join(' ') || `M${cx.toFixed(2)} ${cy.toFixed(2)}`;
}

/** Self-intersecting looping path — tangled, unresolved knot feel */
export function loopCrossingPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  loops: number,
  wobble: number,
): string {
  const steps = Math.max(16, loops * 12);
  const totalSweep = loops * TAU;
  const parts: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + totalSweep * t;
    // Spiral in and out with wobble to create crossing
    const rMod = r * (1 + wobble * Math.sin(angle * 2.3) * Math.cos(angle * 1.7));
    const x = cx + Math.cos(angle) * rMod;
    const y = cy + Math.sin(angle) * rMod;
    parts.push(i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return parts.join(' ');
}

/** Partial enclosure with jagged inner edge — eroded shell */
export function shellFragmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  sweep: number,
  raggedEdge: number,
  steps = 10,
): string {
  const endAngle = startAngle + sweep;

  // Outer arc
  const outer = arcPath(cx, cy, outerR, startAngle, endAngle);

  // Jagged inner edge (reverse direction)
  const innerParts: string[] = [];
  const eax = cx + Math.cos(endAngle) * innerR;
  const eay = cy + Math.sin(endAngle) * innerR;
  innerParts.push(`L${eax.toFixed(2)} ${eay.toFixed(2)}`);

  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const angle = startAngle + sweep * t;
    // Ragged deviation based on deterministic pattern
    const deviation = raggedEdge * Math.sin(t * 17.3) * Math.cos(t * 11.7);
    const rr = innerR + deviation;
    const x = cx + Math.cos(angle) * rr;
    const y = cy + Math.sin(angle) * rr;
    innerParts.push(`L${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return outer + ' ' + innerParts.join(' ');
}

/** Organic curved strut with asymmetric curvature — biological feel */
export function biologicalArmPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  asymmetry: number,
): string {
  const mx = (x1 + x2) * 0.5;
  const my = (y1 + y2) * 0.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Perpendicular direction
  const px = -dy;
  const py = dx;
  const pLen = Math.sqrt(px * px + py * py) || 1;
  const nx = px / pLen;
  const ny = py / pLen;

  // Two control points biased asymmetrically
  const bias1 = thickness * (0.5 + asymmetry * 0.5);
  const bias2 = thickness * (0.5 - asymmetry * 0.5);

  const cp1x = mx + nx * bias1 - dx * 0.15;
  const cp1y = my + ny * bias1 - dy * 0.15;
  const cp2x = mx - nx * bias2 + dx * 0.15;
  const cp2y = my - ny * bias2 + dy * 0.15;

  return cubicPath(x1, y1, cp1x, cp1y, cp2x, cp2y, x2, y2);
}

/** Ring path with a gap (arc that doesn't close) */
export function ringPath(
  cx: number,
  cy: number,
  r: number,
  gapStart: number,
  gapEnd: number,
): string {
  // Draw the visible portion: from gapEnd to gapStart (skipping the gap)
  const visibleStart = gapEnd;
  const visibleEnd = gapStart + TAU;
  return arcPath(cx, cy, r, visibleStart, visibleEnd);
}

// ── No-circle doctrine: replacement geometry helpers ──

/** Two short opposing arcs separated by a gap — universal circle-slot replacement.
 *  Same positioning as a circle (cx/cy) but never closes. */
export function splitNodePath(
  cx: number,
  cy: number,
  size: number,
  splitAngle: number,
  gapWidth: number,
): string {
  const halfGap = gapWidth * 0.5;
  const sweep = Math.PI - halfGap;
  // Two arcs on opposite sides, each subtending less than PI
  const arc1 = arcPath(cx, cy, size, splitAngle + halfGap, splitAngle + halfGap + sweep * 0.8);
  const a2Start = splitAngle + Math.PI + halfGap;
  const arc2 = arcPath(cx, cy, size * 0.85, a2Start, a2Start + sweep * 0.7);
  return arc1 + ' ' + arc2;
}

/** Disconnected arc fragments with radial jitter — ring replacement.
 *  Sum of arcs never exceeds ~65% of a circle. */
export function fracturedShellPath(
  cx: number,
  cy: number,
  r: number,
  fragmentCount: number,
  maxSweepFraction: number,
  jitter: number,
): string {
  const parts: string[] = [];
  const gapBetween = TAU / fragmentCount;
  let angle = 0;
  for (let i = 0; i < fragmentCount; i++) {
    const sweep = gapBetween * maxSweepFraction * (0.6 + 0.4 * Math.sin(i * 2.7 + 1.3));
    const rr = r + jitter * Math.sin(i * 3.1 + 0.7);
    const ox = jitter * 0.5 * Math.cos(i * 4.3);
    const oy = jitter * 0.5 * Math.sin(i * 5.1);
    parts.push(arcPath(cx + ox, cy + oy, rr, angle, angle + sweep));
    angle += gapBetween;
  }
  return parts.join(' ');
}

/** Asymmetric lobe as cubic bezier — bulges on one side, tapers on other.
 *  Replaces orbital node positions with non-circular pressure forms. */
export function pressureLobePath(
  stemX: number,
  stemY: number,
  angle: number,
  length: number,
  asymmetry: number,
  bulge: number,
): string {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const perpCos = Math.cos(angle + Math.PI / 2);
  const perpSin = Math.sin(angle + Math.PI / 2);
  const tipX = stemX + cosA * length;
  const tipY = stemY + sinA * length;
  // Asymmetric control points: one side bulges more
  const cp1x = stemX + cosA * length * 0.3 + perpCos * bulge * (1 + asymmetry);
  const cp1y = stemY + sinA * length * 0.3 + perpSin * bulge * (1 + asymmetry);
  const cp2x = stemX + cosA * length * 0.7 - perpCos * bulge * (1 - asymmetry * 0.6);
  const cp2y = stemY + sinA * length * 0.7 - perpSin * bulge * (1 - asymmetry * 0.6);
  return cubicPath(stemX, stemY, cp1x, cp1y, cp2x, cp2y, tipX, tipY);
}

/** Line with perpendicular notch marks — scaffold/ruler feel.
 *  Replaces radial connectors that pointed at circle nodes. */
export function scaffoldStrutPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  notchCount: number,
  notchDepth: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len; // perpendicular
  const ny = dx / len;
  // Main strut as a gentle curve (not straight line)
  const midX = (x1 + x2) * 0.5 + nx * len * 0.06;
  const midY = (y1 + y2) * 0.5 + ny * len * 0.06;
  const parts = [`M${x1.toFixed(2)} ${y1.toFixed(2)} Q${midX.toFixed(2)} ${midY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`];
  for (let i = 1; i <= notchCount; i++) {
    const t = i / (notchCount + 1);
    const bx = x1 + dx * t;
    const by = y1 + dy * t;
    const depth = notchDepth * (0.6 + 0.4 * (i % 2));
    // Notch ticks as short curves
    const nsx = bx - nx * depth;
    const nsy = by - ny * depth;
    const nex = bx + nx * depth * 0.7;
    const ney = by + ny * depth * 0.7;
    const ncpx = bx + dx / len * depth * 0.3;
    const ncpy = by + dy / len * depth * 0.3;
    parts.push(`M${nsx.toFixed(2)} ${nsy.toFixed(2)} Q${ncpx.toFixed(2)} ${ncpy.toFixed(2)} ${nex.toFixed(2)} ${ney.toFixed(2)}`);
  }
  return parts.join(' ');
}

/** Offset arc segments around decentered foci with kinked connectors.
 *  Replaces orbital/eccentric geometry with non-circular manifold logic. */
export function bentManifoldPath(
  cx: number,
  cy: number,
  fociCount: number,
  spread: number,
  perturbation: number,
): string {
  const parts: string[] = [];
  const baseAngle = perturbation * 2.3; // deterministic rotation
  for (let i = 0; i < fociCount; i++) {
    const fAngle = baseAngle + (i / fociCount) * TAU + perturbation * Math.sin(i * 1.7);
    const dist = spread * (0.5 + 0.5 * Math.sin(i * 2.1 + 0.5));
    const fx = cx + Math.cos(fAngle) * dist;
    const fy = cy + Math.sin(fAngle) * dist;
    const r = spread * (0.3 + 0.2 * Math.cos(i * 3.3));
    const startA = fAngle + perturbation * 0.5;
    const sweep = (1.0 + 0.8 * Math.sin(i * 1.9)) * (Math.PI * 0.5); // 0.5-0.9 PI sweep
    parts.push(arcPath(fx, fy, r, startA, startA + sweep));
    // Kinked connector to next focus
    if (i < fociCount - 1) {
      const nextAngle = baseAngle + ((i + 1) / fociCount) * TAU + perturbation * Math.sin((i + 1) * 1.7);
      const nextDist = spread * (0.5 + 0.5 * Math.sin((i + 1) * 2.1 + 0.5));
      const nx = cx + Math.cos(nextAngle) * nextDist;
      const ny = cy + Math.sin(nextAngle) * nextDist;
      // Kink midpoint offset perpendicular
      const mx = (fx + nx) * 0.5 + Math.cos(fAngle + Math.PI / 2) * perturbation * 3;
      const my = (fy + ny) * 0.5 + Math.sin(fAngle + Math.PI / 2) * perturbation * 3;
      const endX = fx + Math.cos(startA + sweep) * r;
      const endY = fy + Math.sin(startA + sweep) * r;
      parts.push(kinkedLinePath(endX, endY, mx, my, nx, ny));
    }
  }
  return parts.join(' ');
}

// ── Path sampling: extract points along a path for tapered rendering ──

/** Parse numeric coordinates from an SVG path d-string, returning [x,y] pairs.
 *  Extracts all numbers and pairs them as x,y coordinates, then resamples
 *  at evenly-spaced arc-length positions. */
export function samplePathPoints(d: string, numPoints: number): Array<[number, number]> {
  const nums: number[] = [];
  const matches = d.match(/-?\d+\.?\d*/g);
  if (!matches) return [];

  for (const m of matches) {
    nums.push(parseFloat(m));
  }

  // Build raw coordinate pairs
  const raw: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    raw.push([nums[i], nums[i + 1]]);
  }
  if (raw.length < 2) return raw;

  // Compute cumulative arc-length for even spacing
  const lengths: number[] = [0];
  for (let i = 1; i < raw.length; i++) {
    const dx = raw[i][0] - raw[i - 1][0];
    const dy = raw[i][1] - raw[i - 1][1];
    lengths.push(lengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLen = lengths[lengths.length - 1];
  if (totalLen < 0.01) return [raw[0]];

  // Resample at evenly-spaced arc-length positions
  const result: Array<[number, number]> = [];
  for (let p = 0; p < numPoints; p++) {
    const targetLen = (p / (numPoints - 1)) * totalLen;
    let seg = 0;
    while (seg < lengths.length - 2 && lengths[seg + 1] < targetLen) seg++;
    const segLen = lengths[seg + 1] - lengths[seg];
    const t = segLen > 0.001 ? (targetLen - lengths[seg]) / segLen : 0;
    result.push([
      raw[seg][0] + (raw[seg + 1][0] - raw[seg][0]) * t,
      raw[seg][1] + (raw[seg + 1][1] - raw[seg][1]) * t,
    ]);
  }
  return result;
}
