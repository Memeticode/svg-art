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

// ── Stroke end: defines the width and line distribution at one end ──

export const StrokeEndSchema = z.object({
  width: z.number().min(0),           // viewport-scaled perimeter fraction
  weights: z.array(z.number().min(0)), // relative spacing per line (like CSS fr)
});
export type StrokeEnd = z.infer<typeof StrokeEndSchema>;

// ── Line position: animated position within the end width ──

export const LinePosSchema = z.object({
  tA: z.number(), // 0..1 position within A-end width
  tB: z.number(), // 0..1 position within B-end width
});
export type LinePos = z.infer<typeof LinePosSchema>;

// ── Stroke agent ──

export const StrokeAgentSchema = z.object({
  pA: z.number(),       // center perimeter position at A
  pB: z.number(),       // center perimeter position at B
  endA: StrokeEndSchema,
  endB: StrokeEndSchema,
  lineCount: z.number().int().min(1).max(5),
  // Animation state
  driftA: z.number(),
  driftB: z.number(),
  animate: z.boolean(), // whether drift/oscillation are active
  // Per-line animated positions and targets
  linePositions: z.array(LinePosSchema),
  lineTargets: z.array(LinePosSchema),
  // Crossing
  crossingT: z.number().min(0).max(1),
  crossingTarget: z.number(),
});
export type StrokeAgent = z.infer<typeof StrokeAgentSchema>;

// Keep CurveAgent as alias for backward compat during migration
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

// ── Helpers ──

/** Compute target positions (0..1) from gap weights.
 *  Lines sit edge-to-edge: first at 0, last at 1.
 *  Weights define relative gap sizes between adjacent lines.
 *  - 1 line: [0.5] (centered)
 *  - 2 lines: [0, 1] (edges, no gaps to weight)
 *  - 3+ lines: first=0, last=1, intermediates distributed by gap weights
 *
 *  gapWeights length should be lineCount - 1 (one weight per gap). */
export function weightsToPositions(lineCount: number, gapWeights: number[]): number[] {
  if (lineCount <= 1) return [0.5];
  if (lineCount === 2) return [0, 1];

  const gaps = gapWeights.slice(0, lineCount - 1);
  // Pad if not enough weights
  while (gaps.length < lineCount - 1) gaps.push(1);

  const total = gaps.reduce((a, b) => a + b, 0) || 1;
  const positions = [0];
  let cumulative = 0;
  for (let i = 0; i < gaps.length - 1; i++) {
    cumulative += gaps[i];
    positions.push(cumulative / total);
  }
  positions.push(1);
  return positions;
}
