// ── Color resolution: palette + region + depth + climate → resolved colors ──

import type { PalettePreset } from './palettePresets';
import type { DepthBandConfig } from './compositionPresets';

export interface ResolvedColors {
  stroke: string;
  fill: string;
  glow: string;
}

/** Pick stroke/fill/glow from the palette based on agent properties.
 *  Climate scar intensity desaturates colors — weathered forms lose confidence. */
export function resolveColors(
  palette: PalettePreset,
  paletteOffset: number,
  _depthBand: DepthBandConfig,
  _regionBrightness: number,
  climateScarIntensity = 0,
): ResolvedColors {
  const strokeIdx = Math.floor(paletteOffset * palette.strokeBase.length) % palette.strokeBase.length;
  const glowIdx = Math.floor((paletteOffset * 1.7) * palette.glowAccent.length) % palette.glowAccent.length;
  const fillIdx = Math.floor((paletteOffset * 2.3) * palette.fillBase.length) % palette.fillBase.length;

  let stroke = palette.strokeBase[strokeIdx];
  const fill = palette.fillBase[fillIdx];
  const glow = palette.glowAccent[glowIdx];

  // Climate-scarred desaturation: weathered agents lose color confidence
  // Subtle effect — only noticeable at high scar intensity
  if (climateScarIntensity > 0.3) {
    stroke = desaturateColor(stroke, (climateScarIntensity - 0.3) * 0.5);
  }

  return { stroke, fill, glow };
}

/** Desaturate a CSS color string by mixing toward a gray of similar lightness.
 *  Amount: 0 = no change, 1 = fully desaturated. */
function desaturateColor(color: string, amount: number): string {
  // Parse hex or named colors via temporary element would be expensive,
  // so apply a simple approach: mix the color with a muted version.
  // For hex colors like #2dd4bf, reduce saturation by blending channels toward average.
  if (!color.startsWith('#') || color.length !== 7) return color;

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const avg = (r + g + b) / 3;

  const mix = Math.min(amount, 0.4); // cap at 40% desaturation
  const nr = Math.round(r + (avg - r) * mix);
  const ng = Math.round(g + (avg - g) * mix);
  const nb = Math.round(b + (avg - b) * mix);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}
