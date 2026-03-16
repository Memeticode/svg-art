// ── Unified field sampler: combines flow + region into one query ──

import type { FlowField, FlowSample } from './flowField';
import type { RegionMap, RegionSignature } from './regionMap';

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
): FieldSampler {
  return {
    sample(xNorm: number, yNorm: number, timeSec: number): FieldSample {
      return {
        flow: flowField.sample(xNorm, yNorm, timeSec),
        region: regionMap.sample(xNorm, yNorm),
      };
    },
  };
}
