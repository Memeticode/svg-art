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

    // High circularity: favor shell/enclosure families, suppress linear forms
    if (region.circularity > 0.6) {
      if (id === 'interruptedShell' || id === 'partialEnclosure') weight *= 2.0;
      if (id === 'brokenCrescent' || id === 'shellFragment') weight *= 1.5;
      if (id === 'kinkedSpine' || id === 'driftingTendril') weight *= 0.3;
    }

    // High linearity: favor spines/tendrils, suppress orbital forms
    if (region.linearity > 0.6) {
      if (id === 'spineRibs' || id === 'driftingTendril' || id === 'kinkedSpine') weight *= 2.0;
      if (id === 'branchStruts') weight *= 1.5;
      if (id === 'pressureResidue') weight *= 0.3;
    }

    // High fragmentation: favor scatter/kink, suppress cohesive forms
    if (region.fragmentation > 0.6) {
      if (id === 'scatterFragment' || id === 'kinkedSpine') weight *= 2.5;
      if (id === 'scaffoldArm') weight *= 0.2;
      if (id === 'partialEnclosure') weight *= 0.4;
    }

    // High stretch: favor directional fans/tendrils
    if (region.stretch > 0.6) {
      if (id === 'unfoldingFan' || id === 'driftingTendril') weight *= 2.0;
      if (id === 'scaffoldArm' || id === 'climateFront') weight *= 0.5;
    }

    // ── New tension-grammar families: regional biases ──

    // High closureTendency: favor enclosed/shell forms
    if (region.closureTendency > 0.5) {
      const ct = region.closureTendency;
      if (id === 'interruptedShell') weight *= 1 + ct * 1.5;
      if (id === 'brokenCrescent') weight *= 1 + ct * 1.2;
      if (id === 'partialEnclosure') weight *= 1 + ct * 0.8;
      // Suppress open/scatter in high-closure zones
      if (id === 'scatterFragment' || id === 'pressureFragment') weight *= 1 - ct * 0.4;
    }
    // Low closureTendency: favor fragmented/open forms
    if (region.closureTendency < 0.4) {
      const openness = 1 - region.closureTendency;
      if (id === 'scatterFragment' || id === 'pressureFragment') weight *= 1 + openness * 1.0;
      if (id === 'knotManifold') weight *= 1 + openness * 0.8;
    }

    // Linearity biases for new families
    if (region.linearity > 0.5) {
      if (id === 'ribbedSpine') weight *= 1 + region.linearity * 1.5;
      if (id === 'splitLobe') weight *= 1 + region.linearity * 0.6;
    }

    // Fragmentation biases for new families
    if (region.fragmentation > 0.5) {
      if (id === 'knotManifold') weight *= 1 + region.fragmentation * 1.3;
      if (id === 'pressureFragment') weight *= 1 + region.fragmentation * 1.5;
    }

    // Stretch biases for new families
    if (region.stretch > 0.5) {
      if (id === 'splitLobe') weight *= 1 + region.stretch * 1.2;
      if (id === 'semiBiologicalScaffold') weight *= 1 + region.stretch * 0.8;
    }

    // Density biases
    if (region.density > 0.6) {
      if (id === 'semiBiologicalScaffold') weight *= 1.5;
    }

    // Deformation aggression biases
    if (region.deformationAggression > 0.6) {
      if (id === 'pressureFragment') weight *= 1 + region.deformationAggression * 1.0;
      if (id === 'knotManifold') weight *= 1 + region.deformationAggression * 0.8;
      if (id === 'brokenCrescent') weight *= 1 + region.deformationAggression * 0.5;
    }

    return weight;
  });
}
