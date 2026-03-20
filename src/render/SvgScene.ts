// ── SvgScene: owns root SVG element and layer groups ──

import { CANVAS } from '@/shared/types';
import type { LayerGroups } from './renderTypes';
import { LAYER_ORDER } from './renderTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgScene {
  svg: SVGSVGElement;
  defs: SVGDefsElement;
  bgGroup: SVGGElement;
  layers: LayerGroups;
  destroy(): void;
}

export function createSvgScene(container: HTMLElement): SvgScene {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.style.position = 'fixed';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '0';

  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);

  // ── Glow filter definitions ──
  createGlowFilter(defs, 'glow-subtle', 2.5, 1.0);
  createGlowFilter(defs, 'glow-medium', 4.0, 1.15);
  createGlowFilter(defs, 'glow-bright', 6.0, 1.3);

  // ── Climate gradient buckets (16 angle directions) ──
  // Each gradient is a 2-stop opacity fade: full color → 35% opacity.
  // Agents reference the nearest angle bucket. Updated periodically by renderer.
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const grad = document.createElementNS(SVG_NS, 'linearGradient');
    grad.setAttribute('id', `climate-grad-${i}`);
    grad.setAttribute('gradientUnits', 'objectBoundingBox');
    // Direction: from pressure-facing side to trailing side
    const x1 = (0.5 + Math.cos(angle + Math.PI) * 0.5).toFixed(3);
    const y1 = (0.5 + Math.sin(angle + Math.PI) * 0.5).toFixed(3);
    const x2 = (0.5 + Math.cos(angle) * 0.5).toFixed(3);
    const y2 = (0.5 + Math.sin(angle) * 0.5).toFixed(3);
    grad.setAttribute('x1', x1);
    grad.setAttribute('y1', y1);
    grad.setAttribute('x2', x2);
    grad.setAttribute('y2', y2);

    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#ffffff');
    stop1.setAttribute('stop-opacity', '1');
    grad.appendChild(stop1);

    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#ffffff');
    stop2.setAttribute('stop-opacity', '0.35');
    grad.appendChild(stop2);

    defs.appendChild(grad);
  }

  const bgGroup = document.createElementNS(SVG_NS, 'g');
  bgGroup.setAttribute('data-layer', 'background');
  svg.appendChild(bgGroup);

  const layers: LayerGroups = {} as LayerGroups;
  for (const band of LAYER_ORDER) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-layer', band);
    // Blend modes deferred — they can cause full-screen rendering artifacts
    // in some browsers. Structural depth ambiguity comes from layered
    // opacity and scale differences, not compositing tricks.
    svg.appendChild(g);
    layers[band] = g;
  }

  // Fixed viewBox — CSS handles actual scaling to screen
  svg.setAttribute('viewBox', `0 0 ${CANVAS.width} ${CANVAS.height}`);

  container.appendChild(svg);

  function destroy(): void {
    svg.remove();
  }

  return { svg, defs, bgGroup, layers, destroy };
}

/** Create an SVG glow filter: blur + composite overlay */
function createGlowFilter(
  defs: SVGDefsElement,
  id: string,
  stdDeviation: number,
  saturation: number,
): void {
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  // Expand filter region to avoid clipping the blur
  filter.setAttribute('x', '-50%');
  filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%');
  filter.setAttribute('height', '200%');

  // Blur the source graphic
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', String(stdDeviation));
  blur.setAttribute('result', 'blur');
  filter.appendChild(blur);

  // Slightly saturate the blur if > 1.0
  if (saturation > 1.0) {
    const colorMatrix = document.createElementNS(SVG_NS, 'feColorMatrix');
    colorMatrix.setAttribute('in', 'blur');
    colorMatrix.setAttribute('type', 'saturate');
    colorMatrix.setAttribute('values', String(saturation));
    colorMatrix.setAttribute('result', 'saturated');
    filter.appendChild(colorMatrix);
  }

  // Composite: layer the blur behind the original
  const merge = document.createElementNS(SVG_NS, 'feMerge');
  const mergeBlur = document.createElementNS(SVG_NS, 'feMergeNode');
  mergeBlur.setAttribute('in', saturation > 1.0 ? 'saturated' : 'blur');
  merge.appendChild(mergeBlur);
  const mergeSource = document.createElementNS(SVG_NS, 'feMergeNode');
  mergeSource.setAttribute('in', 'SourceGraphic');
  merge.appendChild(mergeSource);
  filter.appendChild(merge);

  defs.appendChild(filter);
}
