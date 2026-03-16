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
