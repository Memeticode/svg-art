// ── Render types ──

import type { DepthBandId } from '@/shared/types';

export interface LayerGroups {
  ghost: SVGGElement;
  residue: SVGGElement;
  back: SVGGElement;
  mid: SVGGElement;
  front: SVGGElement;
}

/** Rendering order: ghost, residue (fading traces), back, mid, front */
export type LayerId = DepthBandId | 'residue';
export const LAYER_ORDER: LayerId[] = ['ghost', 'residue', 'back', 'mid', 'front'];
