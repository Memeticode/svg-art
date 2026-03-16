// ── Depth band utilities ──

import type { DepthBandId } from '@/shared/types';
import type { DepthBandConfig } from '@/art/compositionPresets';
import type { Rng } from '@/shared/rng';

const BAND_ORDER: DepthBandId[] = ['ghost', 'back', 'mid', 'front'];

/** Assign a depth band based on weighted ratios */
export function assignDepthBand(
  bands: Record<DepthBandId, DepthBandConfig>,
  rng: Rng,
): DepthBandId {
  return rng.weightedPick(BAND_ORDER, (id) => bands[id].countWeight);
}

/** Get the SVG layer index for rendering order */
export function depthBandLayerIndex(band: DepthBandId): number {
  return BAND_ORDER.indexOf(band);
}
