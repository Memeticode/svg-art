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

  // Otherwise, bias toward compatible families
  const candidates = ALL_FAMILY_IDS.filter(id => id !== currentFamily);
  return rng.weightedPick(candidates, (id) => {
    let weight = familyWeights[id] ?? 1.0;
    if (def.compatibleWith.includes(id)) weight *= 2.5;
    // Region biases
    if (region.circularity > 0.6 && (id === 'interruptedHalo' || id === 'radialCluster' || id === 'partialEnclosure')) {
      weight *= 1.3;
    }
    if (region.linearity > 0.6 && (id === 'spineRibs' || id === 'branchStruts')) {
      weight *= 1.3;
    }
    return weight;
  });
}
