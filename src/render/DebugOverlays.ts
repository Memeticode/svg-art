// ── Debug overlays for development visualization ──

import type { MorphAgent } from '@/agents/MorphAgent';
import type { FieldSampler } from '@/field/fieldSampler';
import type { ClimateController } from '@/field/climateController';
import type { Viewport } from '@/shared/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type DebugMode = 'regions' | 'flow' | 'density' | 'families' | 'comfort' | 'climate' | 'memory' | 'causality' | 'timescales' | 'continuity';

export interface DebugOverlays {
  update(agents: MorphAgent[], sampler: FieldSampler, viewport: Viewport, timeSec: number, climate?: ClimateController): void;
  setModes(modes: DebugMode[]): void;
  destroy(): void;
}

const GRID_SIZE = 20;

// Family → hue mapping for family distribution overlay
const FAMILY_HUES: Record<string, number> = {
  scaffoldArm: 0, shellFragment: 20, spineRibs: 40, splitCrescent: 60,
  branchStruts: 80, pressureResidue: 100, partialEnclosure: 120, kinkedSpine: 140,
  climateFront: 160, unfoldingFan: 180, scatterFragment: 200, driftingTendril: 220,
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

  function update(agents: MorphAgent[], sampler: FieldSampler, viewport: Viewport, timeSec: number, climate?: ClimateController): void {
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
        case 'comfort':
          renderComfort(group, agents, viewport);
          break;
        case 'climate':
          renderClimate(group, sampler, viewport, timeSec, cellW, cellH);
          break;
        case 'memory':
          renderMemory(group, agents, viewport);
          break;
        case 'causality':
          renderCausality(group, agents, sampler, viewport, timeSec);
          break;
        case 'timescales':
          if (climate) renderTimescales(group, climate, viewport);
          break;
        case 'continuity':
          renderContinuity(group, agents, viewport);
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

// ── Comfort overlay: per-agent heatmap of persistenceAge ──
// green=fresh, yellow=moderate, red=stale
function renderComfort(
  group: SVGGElement, agents: MorphAgent[], viewport: Viewport,
): void {
  for (const a of agents) {
    if (!a.alive) continue;
    const staleness = Math.min(a.memory.persistenceAge / 15, 1); // 0..1 over 15 seconds
    const hue = 120 * (1 - staleness); // 120=green, 0=red
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(a.xNorm * viewport.width));
    circle.setAttribute('cy', String(a.yNorm * viewport.height));
    circle.setAttribute('r', String(3 + staleness * 4));
    circle.setAttribute('fill', `hsl(${hue}, 85%, 50%)`);
    circle.setAttribute('opacity', '0.5');
    group.appendChild(circle);
  }
}

// ── Climate overlay: field conditions (curl, convergence, lane strength) ──
function renderClimate(
  group: SVGGElement, sampler: FieldSampler, viewport: Viewport,
  timeSec: number, cellW: number, cellH: number,
): void {
  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      const xNorm = (gx + 0.5) / GRID_SIZE;
      const yNorm = (gy + 0.5) / GRID_SIZE;
      const sample = sampler.sample(xNorm, yNorm, timeSec);

      // curl→red, convergenceZone→green, lane strength (linearity*magnitude)→blue
      const red = Math.floor(Math.min(Math.abs(sample.flow.curl), 1) * 255);
      const green = Math.floor(sample.flow.convergenceZone * 255);
      const blue = Math.floor(Math.min(sample.region.linearity * sample.flow.magnitude, 1) * 255);

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(gx * cellW));
      rect.setAttribute('y', String(gy * cellH));
      rect.setAttribute('width', String(cellW));
      rect.setAttribute('height', String(cellH));
      rect.setAttribute('fill', `rgb(${red},${green},${blue})`);
      rect.setAttribute('opacity', '0.2');
      group.appendChild(rect);
    }
  }
}

// ── Memory overlay: per-agent climate memory channels as colored dots ──
function renderMemory(
  group: SVGGElement, agents: MorphAgent[], viewport: Viewport,
): void {
  for (const a of agents) {
    if (!a.alive) continue;
    const cx = a.xNorm * viewport.width;
    const cy = a.yNorm * viewport.height;
    const m = a.memory;

    // Ring of small dots around agent showing climate channels
    const channels = [
      { value: m.laneExposure, hue: 200 },      // blue
      { value: m.curlExposure, hue: 300 },       // magenta
      { value: m.frontPressure, hue: 0 },        // red
      { value: m.basinDepth, hue: 160 },         // teal
      { value: m.climateScarIntensity, hue: 40 }, // orange
    ];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      if (ch.value < 0.05) continue;
      const angle = (i / channels.length) * Math.PI * 2;
      const dist = 6;
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', String(cx + Math.cos(angle) * dist));
      dot.setAttribute('cy', String(cy + Math.sin(angle) * dist));
      dot.setAttribute('r', String(1.5 + ch.value * 2));
      dot.setAttribute('fill', `hsl(${ch.hue}, 80%, 55%)`);
      dot.setAttribute('opacity', String(0.3 + ch.value * 0.5));
      group.appendChild(dot);
    }
  }
}

// ── Causality overlay: arrows showing macro-to-micro influence ──
function renderCausality(
  group: SVGGElement, agents: MorphAgent[], sampler: FieldSampler,
  viewport: Viewport, timeSec: number,
): void {
  for (const a of agents) {
    if (!a.alive || a.depthBand === 'ghost') continue;
    const cx = a.xNorm * viewport.width;
    const cy = a.yNorm * viewport.height;
    const sample = sampler.sample(a.xNorm, a.yNorm, timeSec);

    // Show flow influence as an arrow colored by influence strength
    const influence = a.memory.climateScarIntensity;
    if (influence < 0.1) continue;

    const len = influence * 15;
    const ex = cx + Math.cos(sample.flow.angle) * len;
    const ey = cy + Math.sin(sample.flow.angle) * len;

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(cx));
    line.setAttribute('y1', String(cy));
    line.setAttribute('x2', String(ex));
    line.setAttribute('y2', String(ey));
    line.setAttribute('stroke', `hsl(${30 + influence * 60}, 90%, 55%)`);
    line.setAttribute('stroke-width', String(1 + influence * 1.5));
    line.setAttribute('opacity', String(0.3 + influence * 0.4));
    group.appendChild(line);
  }
}

// ── Timescales overlay: deep attractors and pressure fronts ──
function renderTimescales(
  group: SVGGElement, climate: ClimateController, viewport: Viewport,
): void {
  const s = climate.state;

  // Draw deep attractors as pulsing circles
  for (const a of s.attractors) {
    const cx = a.position.x * viewport.width;
    const cy = a.position.y * viewport.height;
    const r = a.radius * Math.min(viewport.width, viewport.height) * 0.5;

    // Influence radius ring
    const ring = document.createElementNS(SVG_NS, 'circle');
    ring.setAttribute('cx', String(cx));
    ring.setAttribute('cy', String(cy));
    ring.setAttribute('r', String(r));
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', `hsla(200, 70%, 60%, ${a.strength * 0.3})`);
    ring.setAttribute('stroke-width', '1');
    ring.setAttribute('stroke-dasharray', '4 3');
    group.appendChild(ring);

    // Center dot
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    dot.setAttribute('r', String(3 + a.strength * 4));
    dot.setAttribute('fill', `hsla(200, 80%, 60%, ${0.4 + a.strength * 0.3})`);
    group.appendChild(dot);
  }

  // Draw pressure fronts as lines with direction arrows
  for (const f of s.fronts) {
    const fx = f.position.x * viewport.width;
    const fy = f.position.y * viewport.height;
    const perpX = -f.direction.y;
    const perpY = f.direction.x;
    const halfLen = f.width * Math.min(viewport.width, viewport.height) * 2;

    // Front line (perpendicular to direction)
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(fx + perpX * halfLen));
    line.setAttribute('y1', String(fy + perpY * halfLen));
    line.setAttribute('x2', String(fx - perpX * halfLen));
    line.setAttribute('y2', String(fy - perpY * halfLen));
    line.setAttribute('stroke', `hsla(0, 70%, 55%, ${f.intensity * 0.5})`);
    line.setAttribute('stroke-width', String(1 + f.intensity * 2));
    group.appendChild(line);

    // Direction arrow from center
    const arrowLen = 15;
    const ax = fx + f.direction.x * arrowLen;
    const ay = fy + f.direction.y * arrowLen;
    const arrow = document.createElementNS(SVG_NS, 'line');
    arrow.setAttribute('x1', String(fx));
    arrow.setAttribute('y1', String(fy));
    arrow.setAttribute('x2', String(ax));
    arrow.setAttribute('y2', String(ay));
    arrow.setAttribute('stroke', `hsla(30, 80%, 60%, ${f.intensity * 0.6})`);
    arrow.setAttribute('stroke-width', '2');
    group.appendChild(arrow);
  }
}

// ── Continuity overlay: measure and display off-screen stroke ratios ──
function renderContinuity(
  group: SVGGElement, agents: MorphAgent[], viewport: Viewport,
): void {
  let totalStrokes = 0;
  let offScreenStart = 0;
  let offScreenEnd = 0;
  let fullyContained = 0;

  const numRe = /-?\d+\.?\d*/g;

  for (const a of agents) {
    if (!a.alive) continue;
    const cx = a.xNorm * viewport.width;
    const cy = a.yNorm * viewport.height;
    const scale = a.scale;

    for (const p of a.currentState.paths) {
      if (!p.active) continue;
      totalStrokes++;

      // Extract first and last coordinate pairs
      const nums: number[] = [];
      numRe.lastIndex = 0;
      let m;
      while ((m = numRe.exec(p.d)) !== null) nums.push(parseFloat(m[0]));
      if (nums.length < 4) continue;

      const sx = cx + nums[0] * scale;
      const sy = cy + nums[1] * scale;
      const ex = cx + nums[nums.length - 2] * scale;
      const ey = cy + nums[nums.length - 1] * scale;

      const startOff = sx < 0 || sx > viewport.width || sy < 0 || sy > viewport.height;
      const endOff = ex < 0 || ex > viewport.width || ey < 0 || ey > viewport.height;

      if (startOff) offScreenStart++;
      if (endOff) offScreenEnd++;
      if (!startOff && !endOff) fullyContained++;
    }
  }

  // Display metrics as text overlay
  const entryRatio = totalStrokes > 0 ? (offScreenStart / totalStrokes * 100).toFixed(0) : '0';
  const exitRatio = totalStrokes > 0 ? (offScreenEnd / totalStrokes * 100).toFixed(0) : '0';
  const containedPct = totalStrokes > 0 ? (fullyContained / totalStrokes * 100).toFixed(0) : '0';

  const lines = [
    `off-screen start: ${entryRatio}%`,
    `off-screen end: ${exitRatio}%`,
    `fully contained: ${containedPct}%`,
    `total strokes: ${totalStrokes}`,
  ];

  for (let i = 0; i < lines.length; i++) {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '12');
    text.setAttribute('y', String(24 + i * 18));
    text.setAttribute('fill', '#ffffff');
    text.setAttribute('font-size', '13');
    text.setAttribute('font-family', 'monospace');
    text.setAttribute('opacity', '0.7');
    text.textContent = lines[i];
    group.appendChild(text);
  }

  // Color-code: green if contained < 20%, yellow < 40%, red >= 40%
  const containedNum = totalStrokes > 0 ? fullyContained / totalStrokes : 0;
  const statusColor = containedNum < 0.2 ? '#4ade80' : containedNum < 0.4 ? '#facc15' : '#f87171';
  const indicator = document.createElementNS(SVG_NS, 'circle');
  indicator.setAttribute('cx', '180');
  indicator.setAttribute('cy', '18');
  indicator.setAttribute('r', '5');
  indicator.setAttribute('fill', statusColor);
  indicator.setAttribute('opacity', '0.8');
  group.appendChild(indicator);
}
