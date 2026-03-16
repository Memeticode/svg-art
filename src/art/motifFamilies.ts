// ── Motif family definitions and registry ──

import type { MotifFamilyId } from '@/shared/types';

export interface MotifFamilyDef {
  id: MotifFamilyId;
  /** Which other families this can morph into more readily */
  compatibleWith: MotifFamilyId[];
  /** Base weight in composition selection */
  baseWeight: number;
}

export const MOTIF_FAMILIES: Record<MotifFamilyId, MotifFamilyDef> = {
  // Original families (circles/radial forms rare — low weight)
  radialCluster: {
    id: 'radialCluster',
    compatibleWith: ['interruptedHalo', 'eccentricOrbit'],
    baseWeight: 0.6,
  },
  interruptedHalo: {
    id: 'interruptedHalo',
    compatibleWith: ['radialCluster', 'partialEnclosure', 'eccentricOrbit'],
    baseWeight: 1.0,
  },
  spineRibs: {
    id: 'spineRibs',
    compatibleWith: ['branchStruts', 'kinkedSpine', 'driftingTendril'],
    baseWeight: 1.0,
  },
  splitCrescent: {
    id: 'splitCrescent',
    compatibleWith: ['interruptedHalo', 'unfoldingFan', 'partialEnclosure'],
    baseWeight: 0.9,
  },
  branchStruts: {
    id: 'branchStruts',
    compatibleWith: ['spineRibs', 'kinkedSpine', 'scatterFragment'],
    baseWeight: 0.8,
  },
  orbitalNodes: {
    id: 'orbitalNodes',
    compatibleWith: ['eccentricOrbit', 'branchStruts'],
    baseWeight: 0.7,
  },
  partialEnclosure: {
    id: 'partialEnclosure',
    compatibleWith: ['interruptedHalo', 'splitCrescent', 'unfoldingFan'],
    baseWeight: 0.8,
  },

  // New asymmetric families
  kinkedSpine: {
    id: 'kinkedSpine',
    compatibleWith: ['spineRibs', 'branchStruts', 'scatterFragment'],
    baseWeight: 1.1,
  },
  eccentricOrbit: {
    id: 'eccentricOrbit',
    compatibleWith: ['orbitalNodes', 'interruptedHalo', 'unfoldingFan'],
    baseWeight: 1.0,
  },
  unfoldingFan: {
    id: 'unfoldingFan',
    compatibleWith: ['splitCrescent', 'partialEnclosure', 'driftingTendril'],
    baseWeight: 1.1,
  },
  scatterFragment: {
    id: 'scatterFragment',
    compatibleWith: ['kinkedSpine', 'branchStruts', 'driftingTendril'],
    baseWeight: 0.9,
  },
  driftingTendril: {
    id: 'driftingTendril',
    compatibleWith: ['spineRibs', 'unfoldingFan', 'scatterFragment'],
    baseWeight: 1.1,
  },

  // ── Tension grammar families (v2) ──
  brokenCrescent: {
    id: 'brokenCrescent',
    compatibleWith: ['splitCrescent', 'interruptedShell', 'pressureFragment'],
    baseWeight: 1.1,
  },
  splitLobe: {
    id: 'splitLobe',
    compatibleWith: ['brokenCrescent', 'unfoldingFan', 'eccentricOrbit'],
    baseWeight: 1.0,
  },
  ribbedSpine: {
    id: 'ribbedSpine',
    compatibleWith: ['spineRibs', 'kinkedSpine', 'driftingTendril'],
    baseWeight: 1.2,
  },
  interruptedShell: {
    id: 'interruptedShell',
    compatibleWith: ['partialEnclosure', 'brokenCrescent', 'pressureFragment'],
    baseWeight: 1.1,
  },
  knotManifold: {
    id: 'knotManifold',
    compatibleWith: ['eccentricOrbit', 'splitLobe', 'driftingTendril'],
    baseWeight: 0.9,
  },
  pressureFragment: {
    id: 'pressureFragment',
    compatibleWith: ['scatterFragment', 'interruptedShell', 'brokenCrescent'],
    baseWeight: 1.0,
  },
  semiBiologicalScaffold: {
    id: 'semiBiologicalScaffold',
    compatibleWith: ['ribbedSpine', 'branchStruts', 'knotManifold'],
    baseWeight: 0.8,
  },
};

export const ALL_FAMILY_IDS = Object.keys(MOTIF_FAMILIES) as MotifFamilyId[];
