// Viewport: dynamic canvas dimensions, perimeter math, border tracing.
// Call setViewport() on init and window resize.

import type { Viewport } from './schema';

// ── Mutable state ──

export const vp: Viewport = { w: 0, h: 0 };

let PERIMETER = 0;
let TOP_END = 0;
let RIGHT_END = 0;
let BOTTOM_END = 0;
let CORNERS: number[] = [];
let CORNER_XY: { x: number; y: number }[] = [];

export const EDGE_LENGTH: Record<string, number> = {};
export let MIN_INWARD = 0;

export function setViewport(w: number, h: number) {
  vp.w = w;
  vp.h = h;
  PERIMETER = 2 * (w + h);
  TOP_END = w / PERIMETER;
  RIGHT_END = (w + h) / PERIMETER;
  BOTTOM_END = (2 * w + h) / PERIMETER;
  CORNERS = [0, TOP_END, RIGHT_END, BOTTOM_END, 1];
  CORNER_XY = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  EDGE_LENGTH.top = w;
  EDGE_LENGTH.right = h;
  EDGE_LENGTH.bottom = w;
  EDGE_LENGTH.left = h;
  MIN_INWARD = Math.min(w, h) * 0.2;
}

// Initialize
setViewport(window.innerWidth || 1920, window.innerHeight || 1080);

// ── Edge helpers ──

type Edge = 'top' | 'right' | 'bottom' | 'left';

export function edgeOf(p: number): Edge {
  p = ((p % 1) + 1) % 1;
  if (p < TOP_END) return 'top';
  if (p < RIGHT_END) return 'right';
  if (p < BOTTOM_END) return 'bottom';
  return 'left';
}

export function getPerimeter(): number { return PERIMETER; }

export function perimeterToXY(p: number): { x: number; y: number } {
  p = ((p % 1) + 1) % 1;
  const d = p * PERIMETER;
  if (d < vp.w) return { x: d, y: 0 };
  if (d < vp.w + vp.h) return { x: vp.w, y: d - vp.w };
  if (d < 2 * vp.w + vp.h) return { x: vp.w - (d - vp.w - vp.h), y: vp.h };
  return { x: 0, y: vp.h - (d - 2 * vp.w - vp.h) };
}

export function distToNearestCorner(p: number): number {
  p = ((p % 1) + 1) % 1;
  let minDist = 1;
  for (const c of CORNERS) {
    const d = Math.min(Math.abs(p - c), Math.abs(p - c + 1), Math.abs(p - c - 1));
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ── Border tracing ──

const INWARD: Record<Edge, { x: number; y: number }> = {
  top:    { x: 0, y: 1 },
  right:  { x: -1, y: 0 },
  bottom: { x: 0, y: -1 },
  left:   { x: 1, y: 0 },
};

export function getInward(edge: Edge): { x: number; y: number } {
  return INWARD[edge];
}

export function borderTrace(pFrom: number, pTo: number): string {
  pFrom = ((pFrom % 1) + 1) % 1;
  pTo = ((pTo % 1) + 1) % 1;
  const cwDist = ((pTo - pFrom) % 1 + 1) % 1;
  const ccwDist = ((pFrom - pTo) % 1 + 1) % 1;
  const goClockwise = cwDist <= ccwDist;
  const cornerP = [0, TOP_END, RIGHT_END, BOTTOM_END];
  const segments: string[] = [];

  if (goClockwise) {
    let cursor = pFrom;
    for (let safety = 0; safety < 6; safety++) {
      let bestIdx = -1, bestP = 2;
      for (let i = 0; i < 4; i++) {
        let cp = cornerP[i];
        if (cp <= cursor) cp += 1;
        if (cp < bestP) { bestP = cp; bestIdx = i; }
      }
      let target = pTo;
      if (target <= cursor) target += 1;
      if (target <= bestP) {
        const end = perimeterToXY(pTo);
        segments.push(`L${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
        break;
      }
      const c = CORNER_XY[bestIdx];
      segments.push(`L${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
      cursor = cornerP[bestIdx] || 0.0001;
    }
  } else {
    let cursor = pFrom;
    for (let safety = 0; safety < 6; safety++) {
      let bestIdx = -1, bestP = -2;
      for (let i = 0; i < 4; i++) {
        let cp = cornerP[i];
        if (cp >= cursor) cp -= 1;
        if (cp > bestP) { bestP = cp; bestIdx = i; }
      }
      let target = pTo;
      if (target >= cursor) target -= 1;
      if (target >= bestP) {
        const end = perimeterToXY(pTo);
        segments.push(`L${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
        break;
      }
      const c = CORNER_XY[bestIdx];
      segments.push(`L${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
      cursor = cornerP[bestIdx] || 0.9999;
    }
  }
  return segments.join(' ');
}
