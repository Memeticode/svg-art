// ── Color resolution: palette + region + depth → resolved colors ──

import type { PalettePreset } from './palettePresets';
import type { DepthBandConfig } from './compositionPresets';

export interface ResolvedColors {
  stroke: string;
  fill: string;
  glow: string;
}

/** Pick stroke/fill/glow from the palette based on agent properties */
export function resolveColors(
  palette: PalettePreset,
  paletteOffset: number,
  _depthBand: DepthBandConfig,
  _regionBrightness: number,
): ResolvedColors {
  const strokeIdx = Math.floor(paletteOffset * palette.strokeBase.length) % palette.strokeBase.length;
  const glowIdx = Math.floor((paletteOffset * 1.7) * palette.glowAccent.length) % palette.glowAccent.length;
  const fillIdx = Math.floor((paletteOffset * 2.3) * palette.fillBase.length) % palette.fillBase.length;

  return {
    stroke: palette.strokeBase[strokeIdx],
    fill: palette.fillBase[fillIdx],
    glow: palette.glowAccent[glowIdx],
  };
}
