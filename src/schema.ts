// Core schemas: zod definitions for all data models.
// These are the source of truth for types throughout the app.

import { z } from 'zod';

// ── Viewport ──

export const ViewportSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
});
export type Viewport = z.infer<typeof ViewportSchema>;

// ── Flow ──

// Every flow component is a vector: angle + magnitude.
// This gives each component a direction and intensity.
export const FlowVectorSchema = z.object({
  angle: z.number(),
  magnitude: z.number(),
});
export type FlowVector = z.infer<typeof FlowVectorSchema>;

export const FlowComponentSchema = z.enum([
  'direction',
  'curl',
  'compression',
]);
export type FlowComponent = z.infer<typeof FlowComponentSchema>;

export const FlowSampleSchema = z.object({
  direction: FlowVectorSchema,   // which way the flow pushes, how hard
  curl: FlowVectorSchema,        // axis of rotation, how much spin
  compression: FlowVectorSchema, // direction of squeeze/stretch, how intense
});
export type FlowSample = z.infer<typeof FlowSampleSchema>;

// ── Flow effects (which components influence the curve) ──

export const FlowEffectsSchema = z.object({
  direction: z.boolean(),
  curl: z.boolean(),
  compression: z.boolean(),
});
export type FlowEffects = z.infer<typeof FlowEffectsSchema>;

export const DEFAULT_FLOW_EFFECTS: FlowEffects = {
  direction: true,
  curl: true,
  compression: false, // not wired into buildPath yet
};

// ── Interactions ──

export const StrokeTargetSchema = z.enum([
  'drift',
  'spread',
  'curvature',
  'crossing',
]);
export type StrokeTarget = z.infer<typeof StrokeTargetSchema>;

export const FlowInteractionSchema = z.object({
  source: FlowComponentSchema,
  target: StrokeTargetSchema,
  strength: z.number().min(0).max(1),
});
export type FlowInteraction = z.infer<typeof FlowInteractionSchema>;

// ── Curve agent ──

export const CurveAgentSchema = z.object({
  pA: z.number(),
  pB: z.number(),
  driftA: z.number(),
  driftB: z.number(),
  spreadA: z.number(),
  spreadB: z.number(),
  spreadDriftA: z.number(),
  spreadDriftB: z.number(),
  crossingT: z.number().min(0).max(1),
  crossingTarget: z.number(),
});
export type CurveAgent = z.infer<typeof CurveAgentSchema>;

// ── Debug config ──

export const AgentConfigSchema = z.object({
  overrideGlobals: z.boolean(),
  crossing: z.boolean(),
  spreadMin: z.number(),
  spreadMax: z.number(),
  interactions: z.array(FlowInteractionSchema).optional(),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const GlobalConfigSchema = z.object({
  crossing: z.boolean(),
  spreadMin: z.number(),
  spreadMax: z.number(),
  interactions: z.array(FlowInteractionSchema),
});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

export const ResolvedConfigSchema = z.object({
  crossing: z.boolean(),
  spreadMin: z.number(),
  spreadMax: z.number(),
  interactions: z.array(FlowInteractionSchema),
});
export type ResolvedConfig = z.infer<typeof ResolvedConfigSchema>;

// ── Defaults ──

export const DEFAULT_INTERACTIONS: FlowInteraction[] = [
  { source: 'direction', target: 'drift', strength: 0.5 },
  { source: 'direction', target: 'curvature', strength: 0.7 },
  { source: 'curl', target: 'crossing', strength: 0.3 },
  { source: 'compression', target: 'spread', strength: 0.4 },
];

export const FLOW_COMPONENTS = FlowComponentSchema.options;
export const STROKE_TARGETS = StrokeTargetSchema.options;
