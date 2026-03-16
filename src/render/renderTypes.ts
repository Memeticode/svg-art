// ── Render types ──

import type { DepthBandId } from '@/shared/types';

export interface LayerGroups {
  ghost: SVGGElement;
  back: SVGGElement;
  mid: SVGGElement;
  front: SVGGElement;
}

export const LAYER_ORDER: DepthBandId[] = ['ghost', 'back', 'mid', 'front'];
