// ── Composition presets: bundled tuning parameters ──

import type { MotifFamilyId, DepthBandId } from '@/shared/types';
import type { ArtDirectionConfig } from './artDirectionConfig';

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
  artDirection?: Partial<ArtDirectionConfig>;
}

const DEFAULT_DEPTH_BANDS: Record<DepthBandId, DepthBandConfig> = {
  ghost: {
    id: 'ghost',
    countWeight: 0.17,
    scaleRange: [3.0, 11.0],
    speedMultiplier: 0.15,
    opacityRange: [0.05, 0.16],
    morphRateMultiplier: 0.3,
    brightnessBias: -0.08,
  },
  back: {
    id: 'back',
    countWeight: 0.33,
    scaleRange: [1.5, 3.0],
    speedMultiplier: 0.4,
    opacityRange: [0.20, 0.48],
    morphRateMultiplier: 0.6,
    brightnessBias: -0.05,
  },
  mid: {
    id: 'mid',
    countWeight: 0.33,
    scaleRange: [0.5, 1.4],
    speedMultiplier: 0.7,
    opacityRange: [0.40, 0.78],
    morphRateMultiplier: 1.0,
    brightnessBias: 0,
  },
  front: {
    id: 'front',
    countWeight: 0.17,
    scaleRange: [0.25, 0.65],
    speedMultiplier: 1.0,
    opacityRange: [0.55, 0.90],
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
      scaffoldArm: 0.25,
      shellFragment: 1.0,
      pressureResidue: 0.3,
      partialEnclosure: 1.1,
      splitCrescent: 0.7,
      kinkedSpine: 0.8,
      climateFront: 0.7,
      unfoldingFan: 1.0,
      scatterFragment: 0.6,
      driftingTendril: 1.1,
      brokenCrescent: 1.1,
      splitLobe: 0.9,
      ribbedSpine: 1.0,
      interruptedShell: 1.2,
      knotManifold: 0.8,
      pressureFragment: 0.9,
      semiBiologicalScaffold: 0.7,
    },
    paletteId: 'deep-teal',
    fieldFrequency: 1.5,
    fieldTimeScale: 0.03,
    artDirection: {
      quietBasinStrength: 0.6,
      swirlLegibility: 0.4,
      identityHalfLife: 8,
      targetDriftStrength: 0.4,
      antiIconThreshold: 0.40,
    },
  },
  'resonant-drift': {
    id: 'resonant-drift',
    agentCount: 90,
    minAgents: 45,
    maxAgents: 130,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.004, 0.012],
    morphDurationRange: [6, 14],
    opacityBase: [0.25, 0.60],
    motifWeights: {
      scaffoldArm: 0.1,
      spineRibs: 1.1,
      branchStruts: 1.3,
      pressureResidue: 0.0,
      splitCrescent: 0.3,
      kinkedSpine: 1.4,
      climateFront: 0.0,
      unfoldingFan: 1.5,
      scatterFragment: 1.2,
      driftingTendril: 1.2,
      brokenCrescent: 0.4,
      splitLobe: 1.6,
      ribbedSpine: 1.1,
      interruptedShell: 1.4,
      knotManifold: 1.5,
      pressureFragment: 1.3,
      semiBiologicalScaffold: 1.6,
    },
    paletteId: 'violet-glow',
    fieldFrequency: 2.0,
    fieldTimeScale: 0.04,
    artDirection: {
      swirlLegibility: 0.7,
      regionalDialectStrength: 2.0,
      identityHalfLife: 3,
      targetDriftStrength: 1.0,
      antiIconThreshold: 0.22,
      clusterCohesion: 0.8,
      softReseedThreshold: 0.60,
    },
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
      scaffoldArm: 0.2,
      shellFragment: 0.9,
      spineRibs: 1.1,
      branchStruts: 0.9,
      pressureResidue: 0.3,
      splitCrescent: 1.0,
      partialEnclosure: 0.8,
      kinkedSpine: 1.3,
      climateFront: 0.8,
      unfoldingFan: 1.2,
      scatterFragment: 1.0,
      driftingTendril: 1.1,
      brokenCrescent: 1.0,
      splitLobe: 1.1,
      ribbedSpine: 1.1,
      interruptedShell: 1.0,
      knotManifold: 1.2,
      pressureFragment: 1.3,
      semiBiologicalScaffold: 0.8,
    },
    paletteId: 'deep-teal',
    fieldFrequency: 2.2,
    fieldTimeScale: 0.05,
    artDirection: {
      swirlLegibility: 0.8,
      closureBreakStrength: 1.0,
      asymmetryBias: 0.7,
      identityHalfLife: 3,
      targetDriftStrength: 0.8,
      antiIconThreshold: 0.30,
    },
  },
  'shell-weather': {
    id: 'shell-weather',
    agentCount: 45,
    minAgents: 20,
    maxAgents: 65,
    depthBands: DEFAULT_DEPTH_BANDS,
    speedRange: [0.003, 0.01],
    morphDurationRange: [10, 22],
    opacityBase: [0.12, 0.42],
    motifWeights: {
      shellFragment: 1.2,
      partialEnclosure: 1.1,
      splitCrescent: 1.1,
      scaffoldArm: 0.25,
      pressureResidue: 0.3,
      climateFront: 0.9,
      unfoldingFan: 1.0,
      kinkedSpine: 0.7,
      scatterFragment: 0.6,
      driftingTendril: 0.8,
      brokenCrescent: 1.2,
      splitLobe: 0.8,
      ribbedSpine: 0.9,
      interruptedShell: 1.3,
      knotManifold: 0.7,
      pressureFragment: 0.8,
      semiBiologicalScaffold: 0.7,
    },
    paletteId: 'pale-gold',
    fieldFrequency: 1.8,
    fieldTimeScale: 0.035,
    artDirection: {
      closureBreakStrength: 1.0,
      arcClosureCap: 0.0,
      identityHalfLife: 6,
      targetDriftStrength: 0.5,
      antiIconThreshold: 0.32,
    },
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
      partialEnclosure: 1.3,
      shellFragment: 1.0,
      spineRibs: 0.8,
      scaffoldArm: 0.2,
      driftingTendril: 1.3,
      unfoldingFan: 1.2,
      kinkedSpine: 0.9,
      scatterFragment: 0.5,
      climateFront: 0.6,
      pressureResidue: 0.2,
      brokenCrescent: 0.9,
      splitLobe: 1.0,
      ribbedSpine: 1.0,
      interruptedShell: 1.4,
      knotManifold: 0.8,
      pressureFragment: 0.7,
      semiBiologicalScaffold: 1.0,
    },
    paletteId: 'mono-glass',
    fieldFrequency: 1.3,
    fieldTimeScale: 0.025,
    artDirection: {
      macroFieldPresence: 1.0,
      quietBasinStrength: 0.5,
      deformationLag: 0.6,
      identityHalfLife: 9,
      targetDriftStrength: 0.4,
      antiIconThreshold: 0.40,
    },
  },
};

export const DEFAULT_PRESET_ID = 'resonant-drift';

export function getPreset(id: string): CompositionPreset {
  return COMPOSITION_PRESETS[id] ?? COMPOSITION_PRESETS[DEFAULT_PRESET_ID];
}
