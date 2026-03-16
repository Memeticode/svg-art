// ── SVG path generation helpers for motif families ──
// All coordinates in local motif space [-50, 50]

import type { Vec2 } from '@/shared/types';
import { TAU } from '@/shared/math';

/** Arc path using SVG A command */
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const sx = cx + Math.cos(startAngle) * r;
  const sy = cy + Math.sin(startAngle) * r;
  const ex = cx + Math.cos(endAngle) * r;
  const ey = cy + Math.sin(endAngle) * r;
  const sweep = endAngle - startAngle;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/** Straight line segment */
export function linePath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`;
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

/** Radial spoke from center outward */
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
  return linePath(x1, y1, x2, y2);
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

/** Polyline with a sharp kink point — angular, not smooth */
export function kinkedLinePath(
  x1: number, y1: number,
  kinkX: number, kinkY: number,
  x2: number, y2: number,
): string {
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} L${kinkX.toFixed(2)} ${kinkY.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Compound arcs at different radii stitched with line segments */
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
      parts.push(`L${sx.toFixed(2)} ${sy.toFixed(2)}`);
    }
    parts.push(`A${seg.r.toFixed(2)} ${seg.r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${ex.toFixed(2)} ${ey.toFixed(2)}`);
  }
  return parts.join(' ');
}

/** Angular polyline from arbitrary points — fractured, geological */
export function jaggedPath(points: Vec2[]): string {
  if (points.length < 2) return 'M0 0';
  const parts = [`M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`);
  }
  return parts.join(' ');
}

/** Spiral arc segment — radius changes across the sweep, feels like unfolding */
export function spiralSegmentPath(
  cx: number,
  cy: number,
  startR: number,
  endR: number,
  startAngle: number,
  sweep: number,
  steps = 12,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + sweep * t;
    const r = startR + (endR - startR) * t;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    parts.push(i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`);
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
