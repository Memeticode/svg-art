// ── SvgScene: owns root SVG element and layer groups ──

import type { Viewport } from '@/shared/types';
import type { LayerGroups } from './renderTypes';
import { LAYER_ORDER } from './renderTypes';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgScene {
  svg: SVGSVGElement;
  defs: SVGDefsElement;
  bgGroup: SVGGElement;
  layers: LayerGroups;
  resize(viewport: Viewport): void;
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

  const bgGroup = document.createElementNS(SVG_NS, 'g');
  bgGroup.setAttribute('data-layer', 'background');
  svg.appendChild(bgGroup);

  const layers: LayerGroups = {} as LayerGroups;
  for (const band of LAYER_ORDER) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-layer', band);
    svg.appendChild(g);
    layers[band] = g;
  }

  container.appendChild(svg);

  function resize(viewport: Viewport): void {
    svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
  }

  function destroy(): void {
    svg.remove();
  }

  return { svg, defs, bgGroup, layers, resize, destroy };
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
