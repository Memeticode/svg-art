// ── Debug overlays for development visualization ──

import type { MorphAgent } from '@/agents/MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { Viewport } from '@/shared/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type DebugMode = 'regions' | 'flow' | 'density' | 'families';

export interface DebugOverlays {
  update(agents: MorphAgent[], sampler: FieldSampler, viewport: Viewport, timeSec: number): void;
  setModes(modes: DebugMode[]): void;
  destroy(): void;
}

const GRID_SIZE = 20;

// Family → hue mapping for family distribution overlay
const FAMILY_HUES: Record<string, number> = {
  radialCluster: 0, interruptedHalo: 20, spineRibs: 40, splitCrescent: 60,
  branchStruts: 80, orbitalNodes: 100, partialEnclosure: 120, kinkedSpine: 140,
  eccentricOrbit: 160, unfoldingFan: 180, scatterFragment: 200, driftingTendril: 220,
  brokenCrescent: 240, splitLobe: 260, ribbedSpine: 280, interruptedShell: 300,
  knotManifold: 320, pressureFragment: 340, semiBiologicalScaffold: 355,
};

export function createDebugOverlays(svg: SVGSVGElement): DebugOverlays {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('data-layer', 'debug');
  group.style.pointerEvents = 'none';
  svg.appendChild(group);

  let activeModes: DebugMode[] = [];

  function setModes(modes: DebugMode[]): void {
    activeModes = modes;
    if (modes.length === 0) {
      group.innerHTML = '';
    }
  }

  function update(agents: MorphAgent[], sampler: FieldSampler, viewport: Viewport, timeSec: number): void {
    group.innerHTML = '';
    if (activeModes.length === 0) return;

    const cellW = viewport.width / GRID_SIZE;
    const cellH = viewport.height / GRID_SIZE;

    for (const mode of activeModes) {
      switch (mode) {
        case 'regions':
          renderRegions(group, sampler, viewport, timeSec, cellW, cellH);
          break;
        case 'flow':
          renderFlow(group, sampler, viewport, timeSec, cellW, cellH);
          break;
        case 'density':
          renderDensity(group, agents, viewport, cellW, cellH);
          break;
        case 'families':
          renderFamilies(group, agents, viewport);
          break;
      }
    }
  }

  function destroy(): void {
    group.remove();
  }

  return { update, setModes, destroy };
}

function renderRegions(
  group: SVGGElement, sampler: FieldSampler, viewport: Viewport,
  timeSec: number, cellW: number, cellH: number,
): void {
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const xNorm = (gx + 0.5) / GRID_SIZE;
      const yNorm = (gy + 0.5) / GRID_SIZE;
      const sample = sampler.sample(xNorm, yNorm, timeSec);
      const r = sample.region;

      // Encode coherence→red, linearity→green, fragmentation→blue
      const red = Math.floor(r.coherence * 255);
      const green = Math.floor(r.linearity * 255);
      const blue = Math.floor(r.fragmentation * 255);

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(gx * cellW));
      rect.setAttribute('y', String(gy * cellH));
      rect.setAttribute('width', String(cellW));
      rect.setAttribute('height', String(cellH));
      rect.setAttribute('fill', `rgb(${red},${green},${blue})`);
      rect.setAttribute('opacity', '0.15');
      group.appendChild(rect);
    }
  }
}

function renderFlow(
  group: SVGGElement, sampler: FieldSampler, viewport: Viewport,
  timeSec: number, cellW: number, cellH: number,
): void {
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const xNorm = (gx + 0.5) / GRID_SIZE;
      const yNorm = (gy + 0.5) / GRID_SIZE;
      const sample = sampler.sample(xNorm, yNorm, timeSec);

      const cx = (gx + 0.5) * cellW;
      const cy = (gy + 0.5) * cellH;
      const len = sample.flow.magnitude * Math.min(cellW, cellH) * 0.4;
      const ex = cx + Math.cos(sample.flow.angle) * len;
      const ey = cy + Math.sin(sample.flow.angle) * len;

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(cx));
      line.setAttribute('y1', String(cy));
      line.setAttribute('x2', String(ex));
      line.setAttribute('y2', String(ey));
      line.setAttribute('stroke', `hsl(${180 + sample.flow.curl * 60}, 80%, 60%)`);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('opacity', '0.5');
      group.appendChild(line);
    }
  }
}

function renderDensity(
  group: SVGGElement, agents: MorphAgent[], viewport: Viewport,
  cellW: number, cellH: number,
): void {
  const counts: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  let maxCount = 1;

  for (const a of agents) {
    if (!a.alive) continue;
    const gx = Math.floor(a.xNorm * GRID_SIZE);
    const gy = Math.floor(a.yNorm * GRID_SIZE);
    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      counts[gx][gy]++;
      if (counts[gx][gy] > maxCount) maxCount = counts[gx][gy];
    }
  }

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      if (counts[gx][gy] === 0) continue;
      const intensity = counts[gx][gy] / maxCount;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(gx * cellW));
      rect.setAttribute('y', String(gy * cellH));
      rect.setAttribute('width', String(cellW));
      rect.setAttribute('height', String(cellH));
      rect.setAttribute('fill', `hsl(${30 - intensity * 30}, 90%, 50%)`);
      rect.setAttribute('opacity', String(0.1 + intensity * 0.25));
      group.appendChild(rect);
    }
  }
}

function renderFamilies(
  group: SVGGElement, agents: MorphAgent[], viewport: Viewport,
): void {
  for (const a of agents) {
    if (!a.alive) continue;
    const hue = FAMILY_HUES[a.family] ?? 0;
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(a.xNorm * viewport.width));
    circle.setAttribute('cy', String(a.yNorm * viewport.height));
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', `hsl(${hue}, 80%, 55%)`);
    circle.setAttribute('opacity', '0.6');
    group.appendChild(circle);
  }
}
