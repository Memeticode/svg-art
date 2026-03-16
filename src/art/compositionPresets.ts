// ── Composition presets: bundled tuning parameters ──

import type { MotifFamilyId, DepthBandId } from '@/shared/types';

export interface DepthBandConfig {
  id: DepthBandId;
  countWeight: number;
  scaleRange: [number, number];
  speedMultiplier: number;
  opacityRange: [number, number];
  morphRateMultiplier: number;
  brightnessBias: number;
}

export interface CompositionPreset {
  id: string;
  agentCount: number;
  minAgents: number;
  maxAgents: number;
  depthBands: Record<DepthBandId, DepthBandConfig>;
  speedRange: [number, number];
  morphDurationRange: [number, number];
  opacityBase: [number, number];
  motifWeights: Partial<Record<MotifFamilyId, number>>;
  paletteId: string;
  fieldFrequency: number;
  fieldTimeScale: number;
}

const DEFAULT_DEPTH_BANDS: Record<DepthBandId, DepthBandConfig> = {
  back: {
    id: 'back',
    countWeight: 0.35,
    scaleRange: [1.2, 2.2],
    speedMultiplier: 0.4,
    opacityRange: [0.08, 0.25],
    morphRateMultiplier: 0.6,
    brightnessBias: -0.15,
  },
  mid: {
    id: 'mid',
    countWeight: 0.45,
    scaleRange: [0.6, 1.3],
    speedMultiplier: 0.7,
    opacityRange: [0.15, 0.45],
    morphRateMultiplier: 1.0,
    brightnessBias: 0,
  },
  front: {
    id: 'front',
    countWeight: 0.2,
    scaleRange: [0.35, 0.75],
    speedMultiplier: 1.0,
    opacityRange: [0.25, 0.6],
    morphRateMultiplier: 1.3,
    brightnessBias: 0.1,
  },
};

export const COMPOSITION_PRESETS: Record<string, CompositionPreset> = {
  'quiet-basin': {
    id: 'quiet-basin',
    agentCount: 35,
    minAgents: 15,
    maxAgents: 50,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.002, 0.008],
    morphDurationRange: [12, 25],
    opacityBase: [0.1, 0.35],
    motifWeights: {
      radialCluster: 0.8,
      interruptedHalo: 1.2,
      orbitalNodes: 1.0,
      partialEnclosure: 1.3,
      splitCrescent: 0.6,
    },
    paletteId: 'deep-teal',
    fieldFrequency: 1.5,
    fieldTimeScale: 0.03,
  },
  'resonant-drift': {
    id: 'resonant-drift',
    agentCount: 45,
    minAgents: 20,
    maxAgents: 65,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.004, 0.012],
    morphDurationRange: [8, 18],
    opacityBase: [0.12, 0.4],
    motifWeights: {
      radialCluster: 1.0,
      spineRibs: 1.2,
      branchStruts: 1.0,
      orbitalNodes: 0.9,
      splitCrescent: 0.8,
    },
    paletteId: 'violet-glow',
    fieldFrequency: 2.0,
    fieldTimeScale: 0.04,
  },
  'fractal-tide': {
    id: 'fractal-tide',
    agentCount: 55,
    minAgents: 25,
    maxAgents: 80,
    depthBands: {
      ...DEFAULT_DEPTH_BANDS,
      mid: { ...DEFAULT_DEPTH_BANDS.mid, countWeight: 0.5 },
      front: { ...DEFAULT_DEPTH_BANDS.front, countWeight: 0.15 },
    },
    speedRange: [0.005, 0.015],
    morphDurationRange: [6, 14],
    opacityBase: [0.15, 0.45],
    motifWeights: {
      radialCluster: 1.3,
      interruptedHalo: 1.0,
      spineRibs: 1.1,
      branchStruts: 0.9,
      orbitalNodes: 1.2,
      splitCrescent: 1.0,
      partialEnclosure: 0.8,
    },
    paletteId: 'deep-teal',
    fieldFrequency: 2.2,
    fieldTimeScale: 0.05,
  },
  'halo-weather': {
    id: 'halo-weather',
    agentCount: 40,
    minAgents: 18,
    maxAgents: 60,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.003, 0.01],
    morphDurationRange: [10, 22],
    opacityBase: [0.1, 0.38],
    motifWeights: {
      interruptedHalo: 1.5,
      partialEnclosure: 1.3,
      splitCrescent: 1.2,
      radialCluster: 0.7,
      orbitalNodes: 0.6,
    },
    paletteId: 'pale-gold',
    fieldFrequency: 1.8,
    fieldTimeScale: 0.035,
  },
  'cathedral-flow': {
    id: 'cathedral-flow',
    agentCount: 30,
    minAgents: 12,
    maxAgents: 45,
    depthBands: {
      ...DEFAULT_DEPTH_BANDS,
      back: { ...DEFAULT_DEPTH_BANDS.back, countWeight: 0.4, scaleRange: [1.5, 2.8] },
    },
    speedRange: [0.002, 0.007],
    morphDurationRange: [15, 30],
    opacityBase: [0.08, 0.3],
    motifWeights: {
      partialEnclosure: 1.5,
      interruptedHalo: 1.2,
      spineRibs: 0.8,
      radialCluster: 0.6,
    },
    paletteId: 'mono-glass',
    fieldFrequency: 1.3,
    fieldTimeScale: 0.025,
  },
};

export const DEFAULT_PRESET_ID = 'resonant-drift';

export function getPreset(id: string): CompositionPreset {
  return COMPOSITION_PRESETS[id] ?? COMPOSITION_PRESETS[DEFAULT_PRESET_ID];
}
