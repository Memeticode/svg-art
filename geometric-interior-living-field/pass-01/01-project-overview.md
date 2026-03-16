# Living Field — Project Overview

## Purpose

Build a full-viewport web background that renders a continuously evolving geometric field using **SVG**, **TypeScript**, and deterministic generative logic. The piece should feel alive without becoming noisy: soft drift, local memory, regional coherence, occasional bright events, and a shared visual grammar derived from the alien geometric designs in `animate/svg-icons`.

This system is intended to be a real application background, not a demo toy. It should be reusable, configurable, and cleanly architected so future work can extend it without rewriting the foundations.

## Product Vision

The page should present a single living composition:

- always changing
- never obviously repeating
- visually unified across the viewport
- spatially structured rather than random
- expressive through motion, density, scale, and morphing
- elegant enough to sit behind application UI without overwhelming it

The user should perceive:

- pockets of gathered structure
- eddies and swirl zones
- quiet basins
- lanes of directional flow
- occasional moments of local synchronization
- layered depth

## What It Is

This is:

- a deterministic SVG generative field
- driven by shared geometric primitives
- rendered with pooled SVG nodes
- organized around flow, regions, motifs, and morph agents
- designed for long-running ambient animation

## What It Is Not

This is not:

- a fixed icon morph gallery
- a random screensaver
- a particle-only simulation
- a WebGL-first renderer
- a one-off hand-authored animation timeline

## Visual Source Language

The existing `svg-icons` work should be treated as the **ancestral design language**, not as a finite set of assets to replay. The implementation should extract the underlying geometry and produce variations that remain visibly related.

Recurring visual ideas to preserve:

- radial clusters
- interrupted rings
- spines and ribs
- crescents and arcs
- orbiting nodes
- asymmetric bilateral tension
- branching struts
- partial enclosures
- layered circles and path structures

## Core Engineering Principles

1. **Pure state first**  
   Geometry should exist as TypeScript state, not be encoded directly in DOM mutations.

2. **Determinism**  
   A seed must produce materially consistent results.

3. **Shared grammar**  
   All motifs should derive from one common primitive/state schema.

4. **Taste over noise**  
   Randomness must be constrained through authored ranges and regional coherence.

5. **Stable rendering**  
   Use pooled SVG nodes and per-frame attribute updates. Avoid churn.

6. **Progressive complexity**  
   The system should be implementable in a dependency order that yields a working result early.

## Desired Runtime Characteristics

- Full viewport SVG surface
- 20–80 active agents by default depending on viewport/device
- 3 depth bands minimum
- seeded generation
- smooth animation loop
- responsive resize handling
- graceful lower-density behavior on weaker devices

## v1 Boundaries

The first version should include:

- one fullscreen background scene
- a seeded flow field
- a region system that influences behavior
- a motif family system based on shared primitives
- morph agents with inertia
- pooled SVG rendering
- palette/theme presets
- composition presets
- tunable parameters for density, speed, and brightness

v1 does **not** need:

- live editor UI
- export pipeline
- touch interaction
- canvas/WebGL fallback
- audio reactivity
- persisted configuration storage

## Success Criteria

The implementation is successful when:

- it feels like one coherent organism rather than many unrelated shapes
- the motion looks continuous and spatially aware
- the field can run indefinitely without obvious looping
- the code is clean enough to hand off and extend
- the scene works as an application background without dominating foreground UI

## Recommended Stack

- TypeScript
- existing app/site framework already in the repo
- native SVG DOM APIs
- `requestAnimationFrame`
- no heavy rendering dependency unless the repo already requires one

## Final Instruction to the Implementer

Do not build a toy. Build the foundation for a durable ambient visual system.
