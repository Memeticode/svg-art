# Living Field — Implementation Spec

This document is written so an implementer can build the system in one pass.

## 1. Bootstrapping Contract

Create an entrypoint that can mount the background into a container element.

Suggested public API:

```ts
export interface CreateLivingFieldOptions {
  seed?: string | number;
  preset?: string;
  container?: HTMLElement;
  pauseWhenHidden?: boolean;
}

export interface LivingFieldAppHandle {
  start(): void;
  stop(): void;
  destroy(): void;
  resize(): void;
  setPreset(name: string): void;
}

export function createLivingFieldApp(options?: CreateLivingFieldOptions): LivingFieldAppHandle;
```

Default behavior:
- mount to `document.body` if no container is provided
- create a full-bleed SVG element
- automatically start animation

## 2. Deterministic Randomness

Implement a seeded RNG utility first.

Requirements:
- string or numeric seed support
- reproducible float generation
- range helpers
- weighted choice helper
- shuffle helper
- sign helper

Suggested exported surface:

```ts
interface Rng {
  next(): number;           // 0..1
  float(min: number, max: number): number;
  int(min: number, max: number): number;
  bool(probability?: number): boolean;
  sign(): 1 | -1;
  pick<T>(items: readonly T[]): T;
  weightedPick<T>(items: readonly T[], getWeight: (item: T) => number): T;
}
```

Use a small, reliable PRNG. Keep it internal and deterministic.

## 3. Core Math Utilities

Implement:
- clamp
- lerp
- inverse lerp
- smoothstep
- mapRange
- angle lerp / angle wrap
- vector helpers (`length`, `normalize`, `dot`, `rotate`, `fromAngle`)
- easing helpers

These should be reusable across field, geometry, and agents.

## 4. Noise and Field Sampling

Implement a lightweight deterministic noise module.

Requirements:
- 2D value or gradient noise
- optional domain warping helper
- enough stability for continuous field motion

Then implement `FlowField`.

Suggested shape:

```ts
interface FlowSample {
  angle: number;
  magnitude: number;
  vx: number;
  vy: number;
  curl: number;
  turbulence: number;
  pressure: number;
}
```

Sampling inputs:
- normalized x
- normalized y
- time seconds

Field behavior goals:
- mostly slow drift
- some swirl zones
- not uniformly chaotic
- coherent over local neighborhoods

Implementation guidance:
- blend 2–3 low-frequency noise layers
- compute angle from noise
- derive curl from neighboring samples or from a second channel
- expose pressure/turbulence separately

## 5. Region Map

Implement a soft regional coherence layer on top of the field.

A region is not a hard tile. It is a sampled signature.

Suggested output:

```ts
interface RegionSignature {
  coherence: number;        // how strongly local behavior aligns
  density: number;          // spawn tendency / occupancy target
  brightness: number;       // brightness tendency
  circularity: number;      // bias toward ring/radial motifs
  linearity: number;        // bias toward rib/spine motifs
  fragmentation: number;    // bias toward broken structures
  stretch: number;          // elongation tendency
  tempo: number;            // morph speed tendency
  paletteShift: number;     // palette interpolation hint
}
```

Guidance:
- derive these from multiple low-frequency noise channels
- keep them spatially smooth
- use them as biases, not absolutes

## 6. Primitive State Schema

Create a stable shared geometry schema.

### 6.1 Primitive slots

Use a fixed-size schema so all motifs are interpolable.

```ts
interface PathPrimitiveState {
  active: boolean;
  d: string;
  strokeWidth: number;
  opacity: number;
  dashArray: number[];
}

interface CirclePrimitiveState {
  active: boolean;
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  opacity: number;
  fillAlpha: number;
}

interface RingPrimitiveState {
  active: boolean;
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  opacity: number;
  gapStart: number;
  gapEnd: number;
}

interface PrimitiveState {
  paths: [
    PathPrimitiveState,
    PathPrimitiveState,
    PathPrimitiveState,
    PathPrimitiveState,
    PathPrimitiveState,
    PathPrimitiveState,
    PathPrimitiveState,
    PathPrimitiveState,
  ];
  circles: [
    CirclePrimitiveState,
    CirclePrimitiveState,
    CirclePrimitiveState,
    CirclePrimitiveState,
    CirclePrimitiveState,
    CirclePrimitiveState,
    CirclePrimitiveState,
  ];
  ring: RingPrimitiveState;
}
```

### 6.2 Coordinate convention

All primitive coordinates should live in a **local motif space**, e.g. `-50..50` or `-1..1`. Pick one and use it everywhere.

### 6.3 Inactive primitives

Inactive slots must still exist with safe defaults.

## 7. Geometry Helpers

Implement:
- primitive constructors
- safe defaults / zero state
- path generation helpers for arcs, ribs, crescents, spokes, bends
- ring path resolver for visible SVG application
- dash array interpolation
- opacity/stroke interpolation

## 8. Interpolation Rules

Implement interpolation between any two `PrimitiveState` values.

Requirements:
- stable slot-to-slot interpolation
- numeric interpolation for primitive attributes
- path interpolation strategy that assumes motif families generate compatible path command structures per slot

Important rule:
Do **not** attempt arbitrary SVG path normalization across unrelated commands in v1. Instead, ensure motif family generators produce compatible path command formats for each path slot they use.

That means motif families must share slot semantics.

## 9. Motif Families

Implement 5–8 motif families.

Recommended families:

1. `radialCluster`
2. `interruptedHalo`
3. `spineRibs`
4. `splitCrescent`
5. `branchStruts`
6. `orbitalNodes`
7. `partialEnclosure`

Each family should expose a factory like:

```ts
interface MotifGenerationContext {
  rng: Rng;
  region: RegionSignature;
  flow: FlowSample;
  depthBand: DepthBand;
  energy: number;
}

function createMotifState(family: MotifFamilyId, ctx: MotifGenerationContext): PrimitiveState;
```

### Family design rules

- preserve family identity strongly
- allow mutation within authored ranges
- use region and flow values as bias inputs
- do not produce totally unrecognizable outputs

### Slot semantics

Define and document which path slots correspond to which semantic role.
Example:
- path 0–1: major arcs
- path 2–4: ribs/struts
- path 5–7: accents
- circles 0–2: core nodes
- circles 3–6: orbitals/accents
- ring: enclosure field

This is critical to interpolation quality.

## 10. Palette System

Implement palette presets with restrained, luminous palettes.

Recommended baseline palette families:
- deep teal / cyan / silver
- violet / blue / magenta glow
- pale gold / frost / smoke
- monochrome glass

Suggested model:

```ts
interface PalettePreset {
  id: string;
  backgroundStops: string[];
  strokeBase: string[];
  glowAccent: string[];
  fillBase: string[];
}
```

Support mild palette interpolation using `RegionSignature.paletteShift` and depth.

## 11. Composition Presets

Implement a preset layer that bundles:
- agent counts
- depth band ratios
- speed ranges
- opacity ranges
- motif family weights
- palette preset
- field tuning

Suggested presets:
- `quiet-basin`
- `resonant-drift`
- `fractal-tide`
- `halo-weather`
- `cathedral-flow`

## 12. Depth Bands

Implement depth band definitions.

```ts
type DepthBandId = 'back' | 'mid' | 'front';

interface DepthBandConfig {
  id: DepthBandId;
  countWeight: number;
  scaleRange: [number, number];
  speedMultiplier: number;
  opacityRange: [number, number];
  morphRateMultiplier: number;
  brightnessBias: number;
}
```

## 13. Morph Agent Model

Implement a mutable runtime agent object.

Suggested structure:

```ts
interface MorphAgent {
  id: string;
  alive: boolean;
  xNorm: number;
  yNorm: number;
  vx: number;
  vy: number;
  heading: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  energy: number;
  ageSec: number;
  phase: number;
  morphProgress: number;
  morphDurationSec: number;
  sourceState: PrimitiveState;
  targetState: PrimitiveState;
  currentState: PrimitiveState;
  family: MotifFamilyId;
  depthBand: DepthBandId;
  paletteOffset: number;
  reseedCooldownSec: number;
}
```

## 14. Agent Spawning

Spawn agents according to:
- composition preset counts
- region density
- depth band ratios
- seeded randomness

Spawn distribution guidance:
- avoid perfectly uniform placement
- use rejection sampling or weighted samples influenced by region density
- keep some breathing room between initial agents

## 15. Agent Update Loop

Per-frame update should:

1. sample flow at current position
2. sample region signature
3. update velocity with inertia
4. advance position with wrap or soft reposition behavior
5. update heading / rotation
6. update energy and phase
7. update morph progress
8. if morph completes and cooldown allows, reseed target state
9. derive current interpolated state
10. resolve render snapshot

### Motion guidance

Use smoothing, not direct snapping.

```ts
velocity = lerpVec(velocity, flowVector * speedTarget, responseFactor)
```

### Boundary behavior

Prefer soft wrapping or offscreen recycle with deterministic reseeding. Avoid bouncing.

## 16. Morph Reseeding Rules

Do not constantly switch motif families.

Use these heuristics:
- usually mutate within the current family
- occasionally switch to a compatible neighboring family
- switch more readily in fragmented/turbulent regions
- remain stable longer in high-coherence regions

## 17. Current State Derivation

Every frame:
- interpolate `sourceState -> targetState` by `morphProgress`
- apply small deformation offsets influenced by flow turbulence and phase
- clamp unsafe values

Micro-deformations should be subtle. They should suggest living motion, not destroy motif structure.

## 18. Render Snapshot

Before writing to DOM, resolve each agent to a render snapshot.

```ts
interface AgentRenderSnapshot {
  id: string;
  xPx: number;
  yPx: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  depthBand: DepthBandId;
  primitiveState: PrimitiveState;
  resolvedStroke: string;
  resolvedFill: string;
}
```

## 19. SVG Renderer

### 19.1 Scene structure

Create:
- root SVG
- defs block if needed
- background group
- back layer group
- mid layer group
- front layer group

### 19.2 Node pool

Each agent should own a stable group with:
- up to 8 path elements
- up to 7 circle elements
- 1 ring representation (likely a path)

A pooled group should be created once and updated thereafter.

### 19.3 DOM updates

For each agent per frame:
- set group transform
- set group opacity
- update active/inactive elements
- update path `d`
- update circle attrs
- update stroke/fill/width/opacity attrs

Do not query DOM state back during animation.

## 20. Background Layer

Add a subtle background wash.

Simple v1 options:
- SVG rect with gradient fill
- very slow hue/stop interpolation across the palette preset

Keep it restrained.

## 21. Timing and Animation Loop

Use `requestAnimationFrame`.

Maintain:
- absolute time seconds
- delta seconds with clamping

Clamp delta to avoid giant jumps on tab restore.

Pause behavior:
- if configured, pause updates when `document.hidden`

## 22. Resize Handling

On resize:
- update viewport size
- recompute px transforms from normalized coordinates
- optionally rescale counts if preset rules demand it
- keep current agents if possible

Do not hard reset unless necessary.

## 23. Performance Guardrails

Implement:
- low allocation update loops
- static arrays where practical
- DOM node reuse
- agent count scaling based on viewport area
- upper cap for mobile-like narrow screens

Optional:
- reduced motion support
- lower density when `prefers-reduced-motion` is set

## 24. Minimal Testing Targets

If repo setup permits, add tests for:
- seeded RNG reproducibility
- interpolation of numeric primitive attributes
- motif generators producing valid primitive arrays of fixed size
- region sampler output ranges
- flow field deterministic sample stability

## 25. Default Aesthetic Tuning

Tune for restraint.

Recommended defaults:
- average opacity low-to-medium
- motion speed slow
- morph durations 6–20 seconds depending on band/region
- bright accents sparse
- stronger coherence in some large soft zones
- visible but not exaggerated eddies

## 26. Implementation Sequence

Follow this order exactly unless the repo forces a small adjustment:

1. inspect existing repo modules
2. create shared types and seeded RNG
3. build math/noise helpers
4. implement flow field
5. implement region map
6. implement primitive schema and zero state
7. implement interpolation helpers
8. implement motif families
9. implement depth bands and composition presets
10. implement agent spawning and update loop
11. implement SVG scene and pool
12. connect render snapshots to renderer
13. add background wash
14. tune default preset
15. add concise docs/tests

## 27. Definition of Done

The work is done when:
- the background mounts and runs
- it fills the viewport
- the field has coherent motion
- geometry feels related across agents
- the renderer uses stable pooled SVG nodes
- the system is deterministic by seed
- the code matches the architecture docs closely
