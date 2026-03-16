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
  ghost: {
    id: 'ghost',
    countWeight: 0.08,
    scaleRange: [4.0, 8.0],
    speedMultiplier: 0.15,
    opacityRange: [0.03, 0.09],
    morphRateMultiplier: 0.3,
    brightnessBias: -0.25,
  },
  back: {
    id: 'back',
    countWeight: 0.30,
    scaleRange: [1.2, 2.2],
    speedMultiplier: 0.4,
    opacityRange: [0.08, 0.25],
    morphRateMultiplier: 0.6,
    brightnessBias: -0.15,
  },
  mid: {
    id: 'mid',
    countWeight: 0.42,
    scaleRange: [0.6, 1.3],
    speedMultiplier: 0.7,
    opacityRange: [0.22, 0.55],
    morphRateMultiplier: 1.0,
    brightnessBias: 0,
  },
  front: {
    id: 'front',
    countWeight: 0.20,
    scaleRange: [0.35, 0.75],
    speedMultiplier: 1.0,
    opacityRange: [0.35, 0.72],
    morphRateMultiplier: 1.3,
    brightnessBias: 0.1,
  },
};

export const COMPOSITION_PRESETS: Record<string, CompositionPreset> = {
  'quiet-basin': {
    id: 'quiet-basin',
    agentCount: 40,
    minAgents: 18,
    maxAgents: 55,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.002, 0.008],
    morphDurationRange: [12, 25],
    opacityBase: [0.12, 0.38],
    motifWeights: {
      radialCluster: 0.5,
      interruptedHalo: 1.2,
      orbitalNodes: 0.6,
      partialEnclosure: 1.3,
      splitCrescent: 0.7,
      kinkedSpine: 0.8,
      eccentricOrbit: 0.9,
      unfoldingFan: 1.0,
      scatterFragment: 0.6,
      driftingTendril: 1.1,
    },
    paletteId: 'deep-teal',
    fieldFrequency: 1.5,
    fieldTimeScale: 0.03,
  },
  'resonant-drift': {
    id: 'resonant-drift',
    agentCount: 50,
    minAgents: 22,
    maxAgents: 70,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.004, 0.012],
    morphDurationRange: [8, 18],
    opacityBase: [0.15, 0.45],
    motifWeights: {
      radialCluster: 0.5,
      spineRibs: 1.0,
      branchStruts: 0.9,
      orbitalNodes: 0.6,
      splitCrescent: 0.8,
      kinkedSpine: 1.2,
      eccentricOrbit: 1.0,
      unfoldingFan: 1.1,
      scatterFragment: 0.7,
      driftingTendril: 1.3,
    },
    paletteId: 'violet-glow',
    fieldFrequency: 2.0,
    fieldTimeScale: 0.04,
  },
  'fractal-tide': {
    id: 'fractal-tide',
    agentCount: 60,
    minAgents: 28,
    maxAgents: 85,
    depthBands: {
      ...DEFAULT_DEPTH_BANDS,
      mid: { ...DEFAULT_DEPTH_BANDS.mid, countWeight: 0.48 },
      front: { ...DEFAULT_DEPTH_BANDS.front, countWeight: 0.15 },
    },
    speedRange: [0.005, 0.015],
    morphDurationRange: [6, 14],
    opacityBase: [0.18, 0.5],
    motifWeights: {
      radialCluster: 0.5,
      interruptedHalo: 1.0,
      spineRibs: 1.1,
      branchStruts: 0.9,
      orbitalNodes: 0.7,
      splitCrescent: 1.0,
      partialEnclosure: 0.8,
      kinkedSpine: 1.3,
      eccentricOrbit: 1.1,
      unfoldingFan: 1.2,
      scatterFragment: 1.0,
      driftingTendril: 1.1,
    },
    paletteId: 'deep-teal',
    fieldFrequency: 2.2,
    fieldTimeScale: 0.05,
  },
  'halo-weather': {
    id: 'halo-weather',
    agentCount: 45,
    minAgents: 20,
    maxAgents: 65,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.003, 0.01],
    morphDurationRange: [10, 22],
    opacityBase: [0.12, 0.42],
    motifWeights: {
      interruptedHalo: 1.4,
      partialEnclosure: 1.3,
      splitCrescent: 1.1,
      radialCluster: 0.4,
      orbitalNodes: 0.5,
      eccentricOrbit: 1.2,
      unfoldingFan: 1.0,
      kinkedSpine: 0.7,
      scatterFragment: 0.6,
      driftingTendril: 0.8,
    },
    paletteId: 'pale-gold',
    fieldFrequency: 1.8,
    fieldTimeScale: 0.035,
  },
  'cathedral-flow': {
    id: 'cathedral-flow',
    agentCount: 35,
    minAgents: 14,
    maxAgents: 50,
    depthBands: {
      ...DEFAULT_DEPTH_BANDS,
      ghost: { ...DEFAULT_DEPTH_BANDS.ghost, countWeight: 0.12, scaleRange: [5.0, 10.0] },
      back: { ...DEFAULT_DEPTH_BANDS.back, countWeight: 0.35, scaleRange: [1.5, 2.8] },
    },
    speedRange: [0.002, 0.007],
    morphDurationRange: [15, 30],
    opacityBase: [0.10, 0.35],
    motifWeights: {
      partialEnclosure: 1.5,
      interruptedHalo: 1.1,
      spineRibs: 0.8,
      radialCluster: 0.3,
      driftingTendril: 1.3,
      unfoldingFan: 1.2,
      kinkedSpine: 0.9,
      scatterFragment: 0.5,
      eccentricOrbit: 0.8,
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
