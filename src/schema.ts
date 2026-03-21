// Core schemas: zod definitions for all data models.

import { z } from 'zod';

// ── Viewport ──

export const ViewportSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

// ── Flow ──

export const FlowVectorSchema = z.object({
  angle: z.number(),
  magnitude: z.number(),
});
export type FlowVector = z.infer<typeof FlowVectorSchema>;

export const FlowComponentSchema = z.enum(['direction', 'curl', 'compression']);
export type FlowComponent = z.infer<typeof FlowComponentSchema>;

export const FlowSampleSchema = z.object({
  direction: FlowVectorSchema,
  curl: FlowVectorSchema,
  compression: FlowVectorSchema,
});
export type FlowSample = z.infer<typeof FlowSampleSchema>;

// ── Flow effects ──

export const FlowEffectsSchema = z.object({
  direction: z.boolean(),
  curl: z.boolean(),
  compression: z.boolean(),
});
export type FlowEffects = z.infer<typeof FlowEffectsSchema>;

export const DEFAULT_FLOW_EFFECTS: FlowEffects = {
  direction: true,
  curl: true,
  compression: false,
};

// ── Interactions ──

export const StrokeTargetSchema = z.enum(['drift', 'spread', 'curvature', 'crossing']);
export type StrokeTarget = z.infer<typeof StrokeTargetSchema>;

export const FlowInteractionSchema = z.object({
  source: FlowComponentSchema,
  target: StrokeTargetSchema,
  strength: z.number().min(0).max(1),
});
export type FlowInteraction = z.infer<typeof FlowInteractionSchema>;

// ── Stroke agent ──
// Each stroke has 2 edges. Each edge has independent width at the A and B ends.

export const StrokeAgentSchema = z.object({
  pA: z.number(),       // center perimeter position at A
  pB: z.number(),       // center perimeter position at B
  // Per-edge widths (perimeter fraction offsets from center)
  edge1A: z.number().min(0), // edge 1 offset at A end
  edge1B: z.number().min(0), // edge 1 offset at B end
  edge2A: z.number().min(0), // edge 2 offset at A end
  edge2B: z.number().min(0), // edge 2 offset at B end
  // Animation state
  driftA: z.number(),
  driftB: z.number(),
  animate: z.boolean(), // whether drift is active
  // Crossing
  crossed: z.boolean(),
  crossPoint: z.number().min(0).max(1), // where along A→B the cross occurs
});
export type StrokeAgent = z.infer<typeof StrokeAgentSchema>;

// Keep CurveAgent as alias for backward compat
export type CurveAgent = StrokeAgent;

// ── Defaults ──

export const DEFAULT_INTERACTIONS: FlowInteraction[] = [
  { source: 'direction', target: 'drift', strength: 0.5 },
  { source: 'direction', target: 'curvature', strength: 0.7 },
  { source: 'curl', target: 'crossing', strength: 0.3 },
  { source: 'compression', target: 'spread', strength: 0.4 },
];

export const FLOW_COMPONENTS = FlowComponentSchema.options;
export const STROKE_TARGETS = StrokeTargetSchema.options;
