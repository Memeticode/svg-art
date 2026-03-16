// ── Design rules: taste constraints for motif reseeding ──

import type { MotifFamilyId } from '@/shared/types';
import type { RegionSignature } from '@/field/regionMap';
import type { Rng } from '@/shared/rng';
import { MOTIF_FAMILIES, ALL_FAMILY_IDS } from './motifFamilies';

/** Decide the next family for a morph reseed.
 *  Usually stays within the current family; sometimes shifts. */
export function pickNextFamily(
  currentFamily: MotifFamilyId,
  region: RegionSignature,
  rng: Rng,
  familyWeights: Partial<Record<MotifFamilyId, number>>,
): MotifFamilyId {
  const def = MOTIF_FAMILIES[currentFamily];

  // In high-coherence regions, strongly prefer staying in the same family
  const stayProbability = 0.6 + region.coherence * 0.3 - region.fragmentation * 0.2;
  if (rng.bool(stayProbability)) {
    return currentFamily;
  }

  // Otherwise, bias toward compatible families with strong regional shaping
  const candidates = ALL_FAMILY_IDS.filter(id => id !== currentFamily);
  return rng.weightedPick(candidates, (id) => {
    let weight = familyWeights[id] ?? 1.0;
    if (def.compatibleWith.includes(id)) weight *= 2.5;

    // ── Multiplicative regional morphology biases ──

    // High circularity: favor halos/orbits, suppress linear forms
    if (region.circularity > 0.6) {
      if (id === 'interruptedHalo' || id === 'eccentricOrbit') weight *= 2.0;
      if (id === 'partialEnclosure' || id === 'radialCluster') weight *= 1.5;
      if (id === 'kinkedSpine' || id === 'driftingTendril') weight *= 0.3;
    }

    // High linearity: favor spines/tendrils, suppress orbital forms
    if (region.linearity > 0.6) {
      if (id === 'spineRibs' || id === 'driftingTendril' || id === 'kinkedSpine') weight *= 2.0;
      if (id === 'branchStruts') weight *= 1.5;
      if (id === 'orbitalNodes') weight *= 0.3;
    }

    // High fragmentation: favor scatter/kink, suppress cohesive forms
    if (region.fragmentation > 0.6) {
      if (id === 'scatterFragment' || id === 'kinkedSpine') weight *= 2.5;
      if (id === 'radialCluster') weight *= 0.2;
      if (id === 'partialEnclosure') weight *= 0.4;
    }

    // High stretch: favor directional fans/tendrils
    if (region.stretch > 0.6) {
      if (id === 'unfoldingFan' || id === 'driftingTendril') weight *= 2.0;
      if (id === 'radialCluster' || id === 'eccentricOrbit') weight *= 0.5;
    }

    return weight;
  });
}
