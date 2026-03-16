// ── Background wash: subtle gradient that slowly evolves ──

import type { PalettePreset } from '@/art/palettePresets';
import type { Viewport } from '@/shared/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SvgBackgroundRenderer {
  update(timeSec: number): void;
  resize(viewport: Viewport): void;
  destroy(): void;
}

export function createSvgBackgroundRenderer(
  bgGroup: SVGGElement,
  defs: SVGDefsElement,
  palette: PalettePreset,
  viewport: Viewport,
): SvgBackgroundRenderer {
  // Create radial gradient
  const gradId = 'living-field-bg-grad';
  const grad = document.createElementNS(SVG_NS, 'radialGradient');
  grad.setAttribute('id', gradId);
  grad.setAttribute('cx', '50%');
  grad.setAttribute('cy', '50%');
  grad.setAttribute('r', '70%');

  const stops = palette.backgroundStops;
  for (let i = 0; i < stops.length; i++) {
    const stop = document.createElementNS(SVG_NS, 'stop');
    stop.setAttribute('offset', `${(i / (stops.length - 1)) * 100}%`);
    stop.setAttribute('stop-color', stops[i]);
    grad.appendChild(stop);
  }
  defs.appendChild(grad);

  // Background rect
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('fill', `url(#${gradId})`);
  rect.setAttribute('width', String(viewport.width));
  rect.setAttribute('height', String(viewport.height));
  bgGroup.appendChild(rect);

  function update(timeSec: number): void {
    // Very slow drift of gradient center
    const cx = 50 + Math.sin(timeSec * 0.015) * 8;
    const cy = 50 + Math.cos(timeSec * 0.012) * 6;
    grad.setAttribute('cx', `${cx.toFixed(1)}%`);
    grad.setAttribute('cy', `${cy.toFixed(1)}%`);
  }

  function resize(vp: Viewport): void {
    rect.setAttribute('width', String(vp.width));
    rect.setAttribute('height', String(vp.height));
  }

  function destroy(): void {
    rect.remove();
    grad.remove();
  }

  return { update, resize, destroy };
}
