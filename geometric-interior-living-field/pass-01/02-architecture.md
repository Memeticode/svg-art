# Living Field — Architecture

## Architectural Goal

Separate the system into layers that each own a clear concern:

- deterministic world sampling
- geometric state generation
- agent lifecycle and motion
- SVG rendering
- composition/palette tuning
- app bootstrap and orchestration

The renderer must not own the simulation logic. The field must not own the motif generation rules. The art layer must not mutate DOM directly.

## Top-Level Module Layout

```text
src/
  app/
    main.ts
    createLivingFieldApp.ts
    animationLoop.ts
    resizeObserver.ts
    runtimeConfig.ts

  shared/
    rng.ts
    math.ts
    easing.ts
    lerp.ts
    clamp.ts
    types.ts
    perf.ts

  field/
    flowField.ts
    regionMap.ts
    fieldSampler.ts
    noise.ts
    vector.ts

  geometry/
    primitiveTypes.ts
    primitiveState.ts
    stateFactory.ts
    stateInterpolation.ts
    stateMutation.ts
    constraints.ts
    bounds.ts

  art/
    motifFamilies.ts
    motifFactories.ts
    palettePresets.ts
    compositionPresets.ts
    designRules.ts

  agents/
    MorphAgent.ts
    AgentSystem.ts
    agentSpawner.ts
    agentUpdate.ts
    depthBands.ts

  render/
    SvgScene.ts
    SvgPool.ts
    SvgAgentRenderer.ts
    SvgBackgroundRenderer.ts
    colorResolvers.ts
    renderTypes.ts
```

## Layer Responsibilities

### `shared/`
Low-level deterministic helpers.

Owns:
- seeded RNG
- math helpers
- interpolation helpers
- utility types
- small performance helpers

Must not know about SVG or motifs.

### `field/`
Defines the invisible world.

Owns:
- vector field generation
- curl/turbulence sampling
- region lookup
- local density/energy/coherence metrics

Must not know about DOM.

### `geometry/`
Defines the common shape language.

Owns:
- primitive schema
- geometry state structures
- interpolation between states
- mutation/deformation helpers
- geometry invariants

Must not know about viewport composition beyond local normalized coordinates.

### `art/`
Defines aesthetic authoring decisions.

Owns:
- motif families
- palette sets
- composition presets
- weighting rules
- taste constraints

This is the “design brain.”

### `agents/`
Turns the invisible world and art rules into living entities.

Owns:
- agent state
- spawning
- target reseeding
- inertia
- movement through field
- depth assignment
- life cycle progression

### `render/`
Owns stable SVG DOM infrastructure.

Owns:
- root SVG scene
- node pooling
- layer groups
- attribute application
- minimal DOM write batching

Must not re-derive simulation decisions.

### `app/`
Orchestrates everything.

Owns:
- bootstrap
- animation loop
- resize propagation
- preset selection
- runtime lifecycle

## Data Flow

```text
Seed + viewport + preset
  -> field world
  -> art preset config
  -> agent spawn decisions
  -> agent updates over time
  -> geometry state snapshots
  -> renderer applies snapshots to SVG nodes
```

There should be a one-way flow from world state to render state.

## Core Runtime Objects

### `LivingFieldApp`
Main orchestrator.

Suggested responsibilities:
- initialize modules
- create SVG scene
- seed systems
- start/stop animation
- handle resize
- expose destroy method

### `FlowField`
Samples directional motion and turbulence.

Suggested API:
- `sample(xNorm, yNorm, time)`
- returns direction, magnitude, curl, turbulence

### `RegionMap`
Returns soft regional characteristics.

Suggested API:
- `sample(xNorm, yNorm)`
- returns region signature including coherence, brightness tendency, motif biases, stretch bias, tempo bias

### `MorphAgent`
Mutable per-agent runtime object.

Contains:
- position / velocity
- depth band
- energy
n- phase
- current state
- source state
- target state
- morph progress
- motif family id
- local color/palette state
- opacity / scale / rotation

### `AgentSystem`
Owns the collection of active agents and their update steps.

### `SvgScene`
Owns root SVG groups and viewport scaling.

### `SvgPool`
Preallocates and reuses SVG nodes for agents.

## State Model

Every renderable agent should resolve to a pure snapshot such as:

```ts
interface AgentRenderSnapshot {
  id: string;
  xPx: number;
  yPx: number;
  scale: number;
  rotationDeg: number;
  opacity: number;
  zIndexBand: number;
  colorway: ResolvedColorway;
  primitiveState: PrimitiveState;
}
```

The renderer should consume only this snapshot shape.

## Primitive Grammar

A common grammar should support at least:

- path primitives
- circle primitives
- ring primitives

The initial implementation should stay compatible with the conceptual 16-primitive system:

- 8 path slots
- 7 circle slots
- 1 ring slot

Even if some slots are inactive for a given motif, the state schema should remain stable to make interpolation straightforward.

## Coordinate Systems

Use clear coordinate spaces:

1. **World normalized space**: `0..1` for viewport-relative logic
2. **Local motif space**: centered local coordinates for primitive generation
3. **Screen pixel space**: final render coordinates

Do not mix these casually.

## Depth Model

At minimum, use three bands:

- background: larger, dimmer, slower
- midground: primary field body
- foreground: fewer, sharper, slightly brighter

Depth should influence:
- opacity
- scale
- speed
- morph tempo
- event frequency

## Resize Strategy

On resize:
- update viewport dimensions
- rebuild world scaling if needed
- preserve deterministic field characteristics where possible
- respawn only if necessary
- avoid visually jarring full reset unless explicitly intended

## Performance Rules

- preallocate arrays where practical
- keep per-frame allocations low
- reuse SVG nodes
- separate computation from DOM writes
- avoid reading layout during animation
- throttle expensive resize recalculations

## Error Handling Philosophy

This is a visual system. Fail softly.

- validate preset ranges
- clamp risky values
- skip invalid primitives instead of crashing the frame loop
- prefer visible degradation over total failure

## Documentation Rule

Any non-obvious abstraction should carry a concise comment explaining why it exists.
