// ── Render types ──

import type { DepthBandId } from '@/shared/types';

export interface LayerGroups {
  back: SVGGElement;
  mid: SVGGElement;
  front: SVGGElement;
}

export const LAYER_ORDER: DepthBandId[] = ['back', 'mid', 'front'];
