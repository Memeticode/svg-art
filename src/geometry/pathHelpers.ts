// ── SVG path generation helpers for motif families ──
// All coordinates in local motif space [-50, 50]

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
