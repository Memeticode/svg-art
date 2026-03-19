// ── Palette presets: restrained, luminous color systems ──

export interface PalettePreset {
  id: string;
  backgroundStops: string[];
  strokeBase: string[];
  glowAccent: string[];
  fillBase: string[];
}

export const PALETTES: Record<string, PalettePreset> = {
  'deep-teal': {
    id: 'deep-teal',
    backgroundStops: ['#060d12', '#0a1a1f', '#071215'],
    strokeBase: ['#2dd4bf', '#67e8f9', '#94a3b8', '#5eead4'],
    glowAccent: ['#06b6d4', '#22d3ee', '#14b8a6'],
    fillBase: ['rgba(45,212,191,0.10)', 'rgba(103,232,249,0.08)', 'rgba(94,234,212,0.09)'],
  },
  'violet-glow': {
    id: 'violet-glow',
    backgroundStops: ['#0c0818', '#130b25', '#0f081e'],
    strokeBase: ['#c4b5fd', '#a5b4fc', '#d8b4fe', '#bfdbfe'],
    glowAccent: ['#a78bfa', '#c084fc', '#818cf8'],
    fillBase: ['rgba(167,139,250,0.18)', 'rgba(129,140,248,0.14)', 'rgba(192,132,252,0.16)'],
  },
  'pale-gold': {
    id: 'pale-gold',
    backgroundStops: ['#0f0d08', '#161209', '#120f07'],
    strokeBase: ['#fbbf24', '#f9fafb', '#9ca3af', '#d4d4d8'],
    glowAccent: ['#f59e0b', '#fcd34d', '#e5e7eb'],
    fillBase: ['rgba(251,191,36,0.09)', 'rgba(249,250,251,0.07)', 'rgba(212,212,216,0.08)'],
  },
  'mono-glass': {
    id: 'mono-glass',
    backgroundStops: ['#09090b', '#0f0f12', '#0a0a0d'],
    strokeBase: ['#e4e4e7', '#a1a1aa', '#71717a', '#d4d4d8'],
    glowAccent: ['#f4f4f5', '#e4e4e7', '#d4d4d8'],
    fillBase: ['rgba(228,228,231,0.08)', 'rgba(161,161,170,0.06)', 'rgba(212,212,216,0.07)'],
  },
};

export const DEFAULT_PALETTE_ID = 'deep-teal';

export function getPalette(id: string): PalettePreset {
  return PALETTES[id] ?? PALETTES[DEFAULT_PALETTE_ID];
}
