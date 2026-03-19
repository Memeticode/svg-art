// ── Unified field sampler: combines flow + region into one query ──
// Region signatures are now modulated by seasonal climate layer.

import type { FlowField, FlowSample } from './flowField';
import type { RegionMap, RegionSignature } from './regionMap';
import type { ClimateController } from './climateController';
import { clamp } from '@/shared/math';

export interface FieldSample {
  flow: FlowSample;
  region: RegionSignature;
}

export interface FieldSampler {
  sample(xNorm: number, yNorm: number, timeSec: number): FieldSample;
}

export function createFieldSampler(
  flowField: FlowField,
  regionMap: RegionMap,
  climate?: ClimateController,
): FieldSampler {
  return {
    sample(xNorm: number, yNorm: number, timeSec: number): FieldSample {
      const flow = flowField.sample(xNorm, yNorm, timeSec);
      const baseRegion = regionMap.sample(xNorm, yNorm);

      // Without climate, return unmodulated region
      if (!climate) {
        return { flow, region: baseRegion };
      }

      // Apply seasonal modulation to region properties
      const seasonal = climate.sampleSeasonal(xNorm, yNorm);

      // Attractor calm also influences regional coherence
      const attractor = climate.sampleAttractors(xNorm, yNorm);

      const region: RegionSignature = {
        ...baseRegion,
        coherence: clamp(baseRegion.coherence * seasonal.coherenceMod + attractor.calmFactor * 0.2, 0, 1),
        fragmentation: clamp(baseRegion.fragmentation * seasonal.fragmentationMod * (1 - attractor.calmFactor * 0.3), 0, 1),
        linearity: clamp(baseRegion.linearity * seasonal.linearityMod, 0, 1),
      };

      return { flow, region };
    },
  };
}
