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
  radialCluster: {
    id: 'radialCluster',
    compatibleWith: ['interruptedHalo', 'orbitalNodes'],
    baseWeight: 1.2,
  },
  interruptedHalo: {
    id: 'interruptedHalo',
    compatibleWith: ['radialCluster', 'partialEnclosure'],
    baseWeight: 1.0,
  },
  spineRibs: {
    id: 'spineRibs',
    compatibleWith: ['branchStruts', 'splitCrescent'],
    baseWeight: 1.0,
  },
  splitCrescent: {
    id: 'splitCrescent',
    compatibleWith: ['interruptedHalo', 'spineRibs'],
    baseWeight: 0.9,
  },
  branchStruts: {
    id: 'branchStruts',
    compatibleWith: ['spineRibs', 'orbitalNodes'],
    baseWeight: 0.8,
  },
  orbitalNodes: {
    id: 'orbitalNodes',
    compatibleWith: ['radialCluster', 'branchStruts'],
    baseWeight: 1.0,
  },
  partialEnclosure: {
    id: 'partialEnclosure',
    compatibleWith: ['interruptedHalo', 'splitCrescent'],
    baseWeight: 0.7,
  },
};

export const ALL_FAMILY_IDS = Object.keys(MOTIF_FAMILIES) as MotifFamilyId[];
