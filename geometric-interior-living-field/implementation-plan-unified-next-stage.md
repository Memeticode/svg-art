# Living Field — Unified Next-Stage Implementation Plan

---

## 1. System Doctrine Summary

The Living Field is a **slice through a larger impossible climate**. Visible geometry is a temporary consequence of forces that extend beyond the frame.

### Filtering Question

Every proposed change must answer: **does this increase climate authorship, consequence, memory, or coupling?** If not, cut it.

### Artistic Standard

**The field should feel more inevitable than designed.**

### Ten Laws (ranked by implementation priority)

1. **Climate over composition** — the image is weathered into temporary visibility
2. **Beyond-frame continuity** — major structures belong to a world larger than the viewport
3. **No stable symbols** — motifs must keep renegotiating identity
4. **Memory matters** — structures carry the imprint of where they have been
5. **Gradients are evidence** — color reveals climate and memory, never decorates
6. **Contagion matters** — nearby motifs influence one another through shared pressure
7. **Boundaries matter** — the edges between climates are fertile and unstable
8. **Time matters** — climate emphasis drifts gradually over minutes
9. **Overlap creates contradiction** — spatial instability from crossings and residue disagreement
10. **Resolution is rare** — near-completion may happen, but must fail gracefully

---

## 2. New Subsystems to Add

### 2a. Multi-Timescale Climate Engine (backbone)
Four nested field layers with independent timescales. This is the single most important addition — everything else depends on it.
- **Deep field** (~120-300s) — attractor positions, geological lane structure
- **Seasonal field** (~40-90s) — regional character drift, emphasis bias
- **Weather field** (~10-30s) — pressure front migration, curl zone emergence
- **Micro field** (~1-5s) — surface turbulence (existing, modulated by upper layers)

### 2b. Residue System
Fading visual traces after motif reorganization. Soft, restrained, temporary. Strongest on major reinterpretation events, weakest on gradual drift.

### 2c. Climate-Driven Gradients (subordinate to causality)
Gradients expose climate state — they do not create it. Primarily opacity-based directional fades aligned to flow. Added only after climate-to-motif causality is working and visible.

### 2d. Slow Climate Emphasis Drift
Not an explicit era state machine. Instead: drifting field biases that emerge from deep-field and seasonal-field interaction. Can be labeled in debug as "eras" but not engineered as rigid mode switches.

---

## 3. Existing Subsystems to Refactor

### 3a. Primitive Ontology (initial pass DONE — ongoing vigilance required)
Completed in prior pass: circle/ring removal, path expansion to 12 slots, family vocabulary rename, macro layer redesign, climate memory expansion, identity decay strengthening.

**Ongoing**: During Phases 2-5, continuously verify that generator logic, comfort scoring, family weighting, and macro forms are not reintroducing roundness or symbolic habits indirectly. The primitive ontology is not permanently finished — it is a living constraint that must be re-checked as new systems interact with form generation.

### 3b. Flow Field (`src/field/flowField.ts`)
**Current**: Single-timescale noise with 3 channels.
**Refactor**: Decompose into 4 layered generators. Deep and seasonal layers cached spatially. Weather and micro sampled per frame. Layers couple downward (deep shapes seasonal shapes weather shapes micro).

### 3c. Region Map (`src/field/regionMap.ts`)
**Current**: Purely spatial, static over time.
**Refactor**: Add temporal modulation from seasonal layer. Regional coherence, linearity, fragmentation should drift on ~60s timescales. Compute boundary proximity dynamically.

### 3d. Agent Wrapping (`src/agents/agentUpdate.ts`)
**Current**: Teleportation wrapping with small margins (0.05/0.15).
**Refactor**: Much wider margins. Ghost agents to 0.25, back to 0.15, mid to 0.10. Spawn 15-20% of agents outside viewport. No visible teleportation.

### 3e. Macro Form Factories (`src/art/macroFormFactories.ts`)
**Current**: 9 types with climate-trace aesthetics.
**Refactor**: Bias start/end positions off-screen. Coordinate with deep-field attractors. Major structures should enter and exit the viewport, not live inside it.

### 3f. Color Resolution (`src/art/colorResolvers.ts`)
**Current**: Static palette indexing, ignores depth/region/memory.
**Refactor**: Make responsive to flow direction and climate memory. Add directional opacity gradients. No per-agent gradient definitions until causality is proven.

### 3g. Neighbor Influence (`src/agents/agentUpdate.ts`)
**Current**: Heading alignment, scale harmony, phase coherence.
**Refactor**: Add shared pressure inheritance and deformation direction propagation. Keep subtle — field should feel coupled, not socially animated.

---

## 4. Phase-by-Phase Implementation Order

### Phase 1 — Primitive Ontology Verification
**Status**: Initial pass COMPLETE (prior session). Ongoing verification required.
**Verify**: no circle-native assumptions, no halo/orbit vocabulary, 12 path slots, all families climate-named, macro layer reads as weather.
**Ongoing discipline**: At the end of each subsequent phase (2-5), re-audit:
- Are any factories generating paths that close into circles or round enclosures?
- Are comfort scores penalizing the right things?
- Are family weights drifting toward round-favoring distributions?
- Are macro forms producing rail-like or ring-like structure?

### Phase 2 — Multi-Timescale Climate Engine
**Files**: new `climateController.ts`, `flowField.ts`, `fieldSampler.ts`, `createLivingFieldApp.ts`
**Goal**: The field evolves like weather, not jitters like noise. **The climate must visibly affect the art, not just the debug overlays.**

1. Create `ClimateState` with four phase accumulators and attractor/front state
2. Create `ClimateController` — advances phases, migrates attractors, moves pressure fronts
3. Deep layer: 2-3 attractors moving via very slow noise (~0.005/s), define large-scale flow structure
4. Seasonal layer: modulates region coherence/fragmentation on ~60s cycles, phase-offset by position
5. Weather layer: 1-2 pressure fronts that cross the viewport over ~15-20s, create local convergence
6. Micro layer: existing turbulence, amplitude modulated by weather intensity
7. Coupling: deep shapes seasonal (regions near attractors are calmer), seasonal shapes weather (front direction follows dominant flow), weather modulates micro
8. Blend into existing `FlowSample`: deep 30%, seasonal 20%, weather 35%, micro 15%
9. Cache deep/seasonal in 20x20 spatial grid (refresh every 30-60 frames)
10. Wire into animation loop
11. Add `timescales` debug overlay

**Visible art requirements (not just debug)**:
- Deep attractors must produce calmer, more coherent inhabitant neighborhoods — agents near attractors should visibly settle into more aligned, less chaotic forms
- Pressure fronts must visibly deform nearby motifs as they pass — a front crossing the viewport should be readable as a wave of increased agitation and asymmetry, even without gradients
- Seasonal drift must visibly change regional behavior over longer viewing — a region that was shell-heavy 60 seconds ago should now favor different families

**Verification**: Watch the field for 3+ minutes. Attractors produce calm neighborhoods. Fronts create visible deformation waves. Seasonal drift changes regional character. `timescales` debug confirms per-layer behavior.

### Phase 3 — Off-Screen Continuity + Macro Redesign
**Files**: `agentUpdate.ts`, `agentSpawner.ts`, `macroFormFactories.ts`
**Goal**: The viewport is a window into a larger field, not a self-contained canvas. **Protect compositional breathing room — the world should feel larger, not edge-busy.**

1. Widen wrap margins: ghost 0.25, back 0.15, mid 0.10, front 0.08
2. Eliminate teleportation artifacts: agents approaching edge smoothly continue off-screen and re-enter naturally
3. Spawn 15-20% of agents in [-0.15, -0.02] and [1.02, 1.15] ranges
4. Macro forms: bias path generation so primary axis enters from one edge and exits another
5. Coordinate macro form direction with deep-field attractor flow
6. At least 15% of mid-scale forms partially clipped by viewport edges at any time
7. **Preserve quiet zones**: interior field should still have areas of low density and calm behavior — off-screen continuity adds edge activity but must not crowd the center
8. **Keep some interior anchors**: not every form should feel transient — some back-band agents can move slowly enough to feel like landmarks being weathered

**Verification**: macro structures feel like weather crossing a viewport. Edges are alive with entering/exiting geometry. But the field also breathes — there are quiet interior zones and slow-moving anchor forms. The viewport feels like a window, not an edge-busy frame.

### Phase 4 — Climate-to-Motif Causality
**Files**: `motifMemory.ts`, `agentUpdate.ts`, `targetDrift.ts`, `motifFactories.ts`
**Goal**: Local forms clearly reveal basin, lane, front, and curl history. This matters more than any secondary system. **Favor asymmetric recovery: a motif should adapt faster than it heals.**

1. Strengthen existing memory channel accumulation rates (climate channels from prior pass)
2. In motif factories: use `memory.laneExposure` to stretch paths along flow direction
3. Use `memory.basinDepth` to compress scale and tighten path grouping
4. Use `memory.curlExposure` to increase arc sweep and introduce spiral bias
5. Use `memory.frontPressure` to sharpen kinks and thicken leading-edge strokes
6. Use `memory.shellCollapseBias` to fragment enclosure families
7. Use `memory.climateScarIntensity` to increase dash arrays and reduce stroke confidence
8. Deformation coupling: stronger directional stretch from `laneExposure`, stronger curl amplification from `curlExposure`
9. **Asymmetric accumulation/decay**: climate consequences should accumulate faster than they heal
   - Accumulation rates: ~2x current values when entering a climate zone
   - Decay rates: ~0.5x current values (slower healing)
   - Result: motifs carry scars of past exposure longer than they take to acquire them
   - The field feels weathered, not merely responsive
10. Climate causality should be visible within 10-15 seconds of an agent entering a distinct climate zone

**Ontology re-audit**: After Phase 4, verify that climate-driven deformation is not inadvertently producing round closure, centered symmetry, or comfortable icon shapes. If causality pushes forms toward closure (e.g., high curl → near-circles), add corrective asymmetry bias.

**Verification**: agents in high-curl regions develop curvier forms. Agents in flow lanes stretch directionally. Agents near convergence zones show compression. A motif leaving a high-curl zone retains its curl scars longer than it took to acquire them. A motif's form tells you where it has lived.

### Phase 5 — Gradients as Climate Evidence
**Files**: `colorResolvers.ts`, `SvgAgentRenderer.ts`, `SvgScene.ts`
**Goal**: Gradients expose causality that already exists. Subordinate to Phase 4.

1. Per-agent directional opacity variation: pressure-facing side of stroke more opaque, trailing side fades
2. Orientation: aligned to `memory.dominantForceAngle`
3. Implementation: quantize angles to ~16 buckets, create shared `<linearGradient>` defs in SVG
4. High `climateScarIntensity` → desaturated, lower-confidence color
5. Macro/ghost forms: 2-stop opacity fade along primary axis only
6. **Background gradient: extremely restrained** — almost subliminal drift tied to deep-field attractor positions, updated every ~30 frames. Should feel like a slow atmospheric shift, not mood lighting. If in doubt, reduce further.
7. All gradients primarily opacity-based and directional — no radial, no rainbow
8. Cap gradient defs at ~20-30 (bucket sharing)

**Verification**: gradients feel like light hitting weathered surfaces. No gradient feels decorative. Background shifts are barely perceptible — you notice them only after extended viewing. Agents show directional fade consistent with their climate exposure.

### Phase 6 — Memory + Residue
**Files**: new `ResidueSystem.ts`, `SvgScene.ts`, `AgentSystem.ts`, `SvgAgentRenderer.ts`
**Goal**: The field remembers. Traces appear after reorganization, then fade.

1. Add `residue` SVG layer between ghost and back
2. Create `ResidueSystem` with pooled DOM nodes (max 60 entries)
3. **Primary trigger**: on family-changing soft reseed, snapshot active paths into residue
4. **Secondary trigger**: on same-family reseed, if silhouette drift since last reseed exceeds a high threshold (measured as average path-coordinate displacement > 15 units), also emit residue. This captures rare major intra-family reinterpretation events. Keep threshold high — most same-family reseeds should NOT produce residue.
5. Residue rendering: single stroke per path (no taper), 50% stroke width, no glow
6. Initial opacity 0.08-0.12, linear decay over 8-15 seconds
7. Residue should be subtle — never dominate the field
8. High `climateScarIntensity` agents generate slightly longer-lived residue

**Verification**: fading traces visible after major reorganizations. Residue never clutters. Occasional intra-family residue on dramatic shape changes. Long observation reveals accumulated weathering history. Pool stays within limit.

### Phase 7 — Living Boundaries
**Files**: `regionMap.ts`, `agentUpdate.ts`, `motifMemory.ts`
**Goal**: Region dialect edges are active and fertile. **Prioritize this over contagion if tradeoffs appear — boundaries are core climate logic.**

1. Add `computeBoundaryProximity()` to regionMap: returns 0..1 based on gradient magnitude of regional signature
2. Add `boundaryProximity` to MotifMemory (instant readout, no accumulation)
3. High boundary proximity: increase deformation intensity by 30-50%
4. Shorter identity half-life near boundaries (multiply by `1 - boundaryProximity * 0.4`)
5. Family selection near boundaries: blend weights from both adjacent regions
6. Residue accumulates faster near boundaries

**Verification**: edges between climate zones are visibly more active. Forms near boundaries feel conflicted. Boundaries shift as seasonal layer evolves.

### Phase 8 — Light Contagion
**Files**: `agentUpdate.ts`, `targetDrift.ts`, `motifMemory.ts`
**Goal**: The field feels coupled through shared pressure, not imitation. **Subordinate to boundaries — if Phase 7 already produces sufficient coupling, keep Phase 8 minimal.**

1. Deformation direction propagation: blend nearby agents' `dominantForceAngle` into local deformation bias (weight 0.06, modulated by coherence)
2. Shared pressure inheritance: agents near a high-`frontPressure` neighbor accumulate `frontPressure` 20% faster
3. Destabilization cascade: on reseed, nearby agents (within `NEIGHBOR_RADIUS * 0.5`) get `persistenceAge += 1.0` (damped by distance)
4. Memory proximity: agents in tight clusters slowly share `climateScarIntensity` (lerp toward local average at rate 0.001)
5. No family contagion, no morphology blending, no brightness synchronization — those read as social behavior

**Verification**: nearby agents share deformation direction. Destabilization ripples outward subtly. No flocking or synchronization visible.

### Phase 9 — Impossible Overlap (structural, not compositing-led)
**Files**: `SvgScene.ts`
**Goal**: Spatial ambiguity from climate richness, residue disagreement, and layered depth — not from blend mode effects. **Blend modes are permission, not content.**

1. Ghost layer: `mix-blend-mode: screen` — ghost forms glow through foreground, creating ambiguous depth
2. Residue layer: `mix-blend-mode: screen` at very low opacity
3. **The real source of impossible geometry is structural**: residue at a position now occupied by different geometry at a different depth band. Ghost-scale forms sharing visual space with front-scale forms. Climate scars from one zone persisting into another.
4. If the field's climate richness, residue, and layered ambiguity don't produce spatial contradiction on their own, go back and strengthen those systems rather than adding compositing tricks
5. No cross-layer path sharing. No depth flicker. No engineered paradox.

**Verification**: occasional spatial ambiguity where ghost and foreground overlap. Residue creates temporal-spatial contradiction. Nothing reads as an intentional paradox. Ambiguity feels like a consequence of the climate, not a rendering trick.

### Phase 10 — Near-Resolution Moments (late-stage, optional)
**Files**: `antiIconEvaluator.ts`, `agentUpdate.ts`
**Goal**: Very rarely, a cluster almost resolves into coherence — then fails. Only add once the field already feels alive. **Delay until the field is independently convincing.**

1. Detect clusters where 3-5 nearby agents have similar heading, scale, and family
2. When cluster coherence exceeds threshold: temporarily reduce destabilization for ~3-4 seconds
3. After grace period: trigger enhanced destabilization (stronger impulse, opacity dip)
4. Maximum 1 event per ~90 seconds globally
5. This is polish — skip if the field already feels sufficiently alive without it

**Verification**: very rarely, a local moment of near-coherence is perceptible. It always dissolves. It feels significant because it is rare.

### Phase 11 — Slow Climate Emphasis Drift
**Files**: `climateController.ts`, `designRules.ts`, `DebugOverlays.ts`
**Goal**: The field slowly changes emphasis over minutes. Not a state machine — a drifting bias.

1. Deep-field and seasonal-field interaction naturally creates regions of varying emphasis
2. Read the current field state to derive a "climate emphasis label" (e.g., which families are currently being selected most, what deformation profile dominates)
3. Surface this as a debug overlay label (not an engine state)
4. Optionally: use seasonal phase to gently bias family weights (multiply by 0.8-1.2) toward currently-compatible families
5. No rigid era transitions, no mode switches, no explicit era state machine

**Verification**: extended viewing reveals gradual shifts in field character. Debug overlay shows drifting emphasis labels. No abrupt switches.

---

## Minimum Shippable Subset (Phases 2-5)

If work stopped after a partial implementation, this is the smallest slice of Phases 2-5 that would already yield a visibly better field:

### Core slice (must complete together)
1. **Climate controller with deep layer only** — 2-3 attractors migrating slowly, producing calmer neighborhoods near attractors and more chaotic flow between them. Skip seasonal and weather layers initially.
2. **Attractor influence wired into existing flowField** — deep-layer attractors modulate the existing flow field's magnitude and coherence. Near attractors: lower turbulence, higher coherence. Between attractors: existing behavior or slightly amplified chaos.
3. **Off-screen wrap margins widened** — ghost to 0.25, back to 0.15. Spawn 10% of agents near edges. No macro form redesign needed yet.
4. **Two memory channels wired into motif factories** — `laneExposure` → directional stretch, `curlExposure` → arc sweep bias. Just these two, applied as multipliers on existing path generation parameters.

### Why this works as a minimum
- Deep attractors give the field visible spatial structure that drifts over minutes (Law 1, 8)
- Wider margins and edge-spawning make the viewport feel like a window (Law 2)
- Two memory-to-form connections make motifs reveal where they've lived (Law 4, 6)
- Total effort: ~1 new file (simplified climateController), ~4 modified files
- Leaves clean hooks for seasonal layer, weather fronts, gradients, and residue in subsequent passes

### What it defers
- Seasonal and weather layers (Phase 2 complete)
- Macro form coordination with attractors (Phase 3 complete)
- Full memory-to-form wiring (Phase 4 complete)
- All of Phases 5-11

---

## 5. Data Model Changes

### New: `ClimateState` (in new `src/field/climateController.ts`)
```
interface ClimateState {
  deepPhase: number;              // advances at ~0.005/s
  seasonalPhase: number;          // advances at ~0.015/s
  weatherPhase: number;           // advances at ~0.06/s
  deepAttractors: Vec2[];         // 2-3 slowly migrating positions
  pressureFronts: PressureFront[];  // 1-2 moving fronts
}

interface PressureFront {
  position: Vec2;     // current center in normalized space
  direction: Vec2;    // movement direction
  speed: number;      // normalized units per second
  width: number;      // influence radius
  intensity: number;  // 0..1
}
```

### New: `ResidueEntry` (in new `src/render/ResidueSystem.ts`)
```
interface ResidueEntry {
  paths: { d: string; strokeWidth: number }[];
  xPx: number; yPx: number;
  scale: number; rotationDeg: number;
  opacity: number;
  maxLifeSec: number;
  ageSec: number;
  stroke: string;
}
```

### Extended: `MotifMemory`
```
boundaryProximity: number;     // 0..1, instant readout from region map
```

### Extended: `ArtDirectionConfig`
```
contagionStrength: number;     // 0..1, default 0.3
boundaryInstability: number;   // 0..1, default 0.4
residueIntensity: number;      // 0..1, default 0.3
```

### Extended: `CompositionPreset`
```
climateTimescales?: { deep: number; seasonal: number; weather: number };
residueConfig?: { maxEntries: number; lifetimeRange: [number, number] };
```

---

## 6. Rendering Changes

### SVG Layer Structure
```
<svg>
  <defs>
    <!-- Glow filters (existing) -->
    <!-- Shared angle-bucket gradients (Phase 5) -->
  </defs>
  <g data-layer="background">
  <g data-layer="ghost" style="mix-blend-mode: screen">  <!-- Phase 9 -->
  <g data-layer="residue" style="mix-blend-mode: screen"> <!-- Phase 6 -->
  <g data-layer="back">
  <g data-layer="mid">
  <g data-layer="front">
  <g data-layer="debug">
</svg>
```

### Gradient Rendering (Phase 5)
- ~16-20 shared `<linearGradient>` definitions, quantized by angle bucket
- Agents reference nearest-bucket gradient via `stroke="url(#grad-bucket-N)"`
- Gradients are 2-stop opacity fades: pressure-facing side full opacity, trailing side 30-50%
- Updated every 3-5 frames (not every frame)
- Ghost/macro: dedicated 2-stop fade along primary axis

### Residue Rendering (Phase 6)
- Pooled DOM groups (max 60), single stroke per path, no taper
- Thin strokes (0.3-0.6px), opacity 0.04-0.12
- No glow filters
- `display: none` when recycled

---

## 7. Gradient System Design

### Principle
Gradients are subordinate to causality. They expose what the climate engine and memory system have already authored. They do not introduce new visual character. Background gradient reactivity must be extremely restrained — almost subliminal.

### Strategy
1. Get climate-to-motif causality visibly working (Phase 4) before adding any gradients
2. Gradients should make existing causality more legible, not add new information
3. Primarily opacity-based directional fades — no hue rainbows, no radial spotlights
4. Per-agent gradient orientation comes from `memory.dominantForceAngle` (already computed)
5. Climate-scarred agents get lower-confidence color (desaturated, reduced opacity range)
6. Background gradient: almost subliminal drift tracking deep-field attractors — if in doubt, reduce further

### Implementation
- Shared gradient pool: ~16 angle buckets, each a 2-stop linear gradient
- Agents assigned to nearest bucket (no per-agent gradients — too expensive, too decorative)
- Gradient stops: palette base color at 100% opacity → same color at 35% opacity
- Orientation rotates with bucket angle
- Update all bucket gradients every 5 frames

---

## 8. Dynamic Field Evolution Design

### Architecture
```
ClimateController
  ├── DeepFieldLayer      (period ~180s, 2-3 attractors)
  ├── SeasonalFieldLayer   (period ~60s, regional modulation)
  ├── WeatherFieldLayer    (period ~15s, pressure fronts)
  └── MicroFieldLayer      (existing turbulence, modulated)
```

### Deep Field Layer
- 2-3 attractors in normalized [0,1] space, positions driven by very slow noise
- Each attractor has a strength (0.3-1.0) and influence radius (0.2-0.5)
- Flow near attractors: pulled inward, calmer, more coherent
- Flow between attractors: more chaotic, higher turbulence
- Attractors should not oscillate rapidly — they drift like continents

### Seasonal Field Layer
- Modulates regionMap parameters via multiplicative factors
- Coherence oscillates: `coherence *= 0.7 + 0.3 * sin(seasonalPhase + spatialOffset)`
- Fragmentation counter-cycles coherence
- Linearity modulated independently with different phase offset
- Creates slowly shifting "climate zones" that aren't locked to attractors

### Weather Field Layer
- 1-2 pressure fronts: position, direction, speed, width, intensity
- Fronts move across viewport following deep-layer dominant flow direction
- Front creates: enhanced convergence, increased curl perpendicular to front, directional bias
- Front influence: gaussian falloff from center line
- When a front passes, agents experience a wave of increased pressure, deformation, and potential reseed

### Micro Field Layer
- Existing noise channels, largely unchanged
- Amplitude modulated: `microAmplitude *= 0.5 + weatherIntensityAtPoint * 0.5`
- Near deep attractors: reduced micro turbulence (calmer zones)
- Result: micro behavior responds to upper-layer weather state

### Blending
- Deep: 30% (structural direction, attractor pull)
- Seasonal: 20% (regional modulation, emphasis drift)
- Weather: 35% (local dynamics, fronts, active weather)
- Micro: 15% (surface texture, turbulence)
- Existing `FlowSample` interface unchanged — blending happens inside `createFlowField`

### Caching Strategy
- Deep layer: cache 20x20 grid, refresh every 60 frames
- Seasonal layer: cache 20x20 grid, refresh every 30 frames
- Weather layer: sampled per-agent per-frame (front position changes meaningfully each frame)
- Micro layer: sampled per-agent per-frame (existing behavior)

---

## 9. Overlap / Impossible-Geometry Strategy

### Principle
Impossible geometry must be **emergent**, never engineered. Blend modes are **permission**, not content. Spatial contradiction should arise from climate richness, residue disagreement, and layered depth ambiguity — not from compositing effects.

### What to Use
- **Ghost layer `mix-blend-mode: screen`**: structural permission for ghost forms to show through foreground
- **Residue disagreement**: residue traces at positions now occupied by different geometry imply two incompatible spatial readings — this is the primary source of impossible geometry
- **Scale/depth contradiction**: ghost forms (large, dim) sharing visual space with front forms (small, bright) create natural depth confusion

### What to Avoid
- Cross-layer path sharing (too mechanical)
- Depth flicker (too designed, reads as a "feature")
- Any mechanism that explicitly detects overlap and generates paradox
- Anything that reads as an intentional Escher effect
- Relying on blend modes as content rather than structural permission

### Evaluation
If the field's climate, residue, and layered ambiguity don't produce spatial contradiction on their own, go back and strengthen those systems. Do not add overlap mechanics. The impossible should be a consequence of richness, not a feature.

---

## 10. Memory / Contagion / Residue Design

### Memory (existing, strengthened in Phase 4)
19 existing channels + 1 addition (`boundaryProximity`). The key new work is wiring memory more strongly into form generation with **asymmetric accumulation/decay**:
- Lane exposure → directional stretch (accumulates ~2x, decays ~0.5x)
- Basin depth → scale compression (accumulates ~2x, decays ~0.5x)
- Curl exposure → arc sweep bias (accumulates ~2x, decays ~0.5x)
- Front pressure → leading-edge emphasis (accumulates ~2x, decays ~0.5x)
- Climate scar intensity → dash arrays, reduced confidence (accumulates ~1.5x, decays ~0.3x — scars linger longest)

The asymmetric rates mean motifs adapt to new climate faster than they heal from old exposure. The field feels weathered, not merely responsive.

### Contagion (Phase 8, kept light, subordinate to boundaries)
| Mechanism | Weight | Modulator |
|-----------|--------|-----------|
| Deformation direction propagation | 0.06 | region.coherence |
| Shared pressure inheritance | 20% faster accumulation | proximity |
| Destabilization cascade | +1.0s persistenceAge on nearby reseed | distance falloff |
| Memory proximity (climateScarIntensity) | lerp at 0.001 | tight cluster only |

What is NOT included:
- Family contagion (reads as imitation)
- Morphology blending (reads as flocking)
- Brightness synchronization (reads as dance)

### Residue (Phase 6)
- Pool: 60 entries max
- Primary trigger: family-changing soft reseed
- Secondary trigger: same-family reseed with silhouette drift > 15 units (high threshold — rare)
- Rendering: single stroke, 50% width, no taper, no glow
- Initial opacity: 0.08-0.12
- Decay: linear over 8-15 seconds
- Residue is evidence, not decoration — too much = clutter

---

## 11. Performance Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-timescale field computation | 4 layer samples per agent per frame | Cache deep/seasonal in 20x20 grid (refresh 30-60 frames). Only weather + micro per-frame. |
| Gradient DOM overhead | SVG `<defs>` growth | Shared angle-bucket gradients (~20 total). No per-agent defs. Update every 5 frames. |
| Residue DOM growth | Extra path elements | Pool 60 groups. Single stroke per path (no taper). `display: none` when recycled. |
| Pressure front computation | Gaussian distance per agent per front | 1-2 fronts max. Front influence is a simple distance check per agent. |
| Blend mode rendering cost | GPU compositing on ghost/residue layers | Only 2 layers use blend modes. Ghost already has fewest visible elements. |

### Budget
- **Target**: 60fps, 130 agents, 60 residue entries
- **DOM cap**: ~5200 (36 paths/agent * 130 + 360 residue + 20 gradients + misc)
- **Per-frame**: < 12ms for update + render
- **Field cache**: 800 cached samples (2 grids x 20x20), refreshed staggered

---

## 12. Debug Tooling Plan

### Existing (keep all 8 modes from prior pass)
`regions`, `flow`, `density`, `families`, `comfort`, `climate`, `memory`, `causality`

### New Debug Modes

**`timescales`** — Multi-timescale decomposition
- Four quadrants showing deep, seasonal, weather, micro contributions as flow arrows
- Deep attractor positions shown as circles
- Pressure front positions shown as lines
- Most important debug mode for Phase 2

**`boundaries`** — Region dialect boundary visualization
- Contour lines where `boundaryProximity > 0.5`
- Intensity shows instability strength

**`residue`** — Residue system debug
- Bright outlines on active residue entries
- Pool utilization counter (current/max)

**`contagion`** — Neighbor influence
- Light lines between agents with active pressure sharing
- Destabilization cascade shown as brief red flashes

**`emphasis`** — Climate emphasis drift (Phase 11)
- Text label showing current dominant field character
- Family weight bias visualization

**`ontology`** — Primitive ontology audit (ongoing)
- Highlight agents whose current paths show high closure/symmetry scores
- Flag any factory output that approaches circular or icon-like geometry
- Useful for Phase 1 re-verification during Phases 2-5

### Access
- URL parameter: `?debug=timescales,boundaries`
- All debug rendering skipped when no modes active

---

## 13. Acceptance Criteria

### Primitive Ontology (ongoing)
- [x] No circle-native assumptions in engine
- [x] No halo/orbit vocabulary
- [x] 12 path-native slots
- [x] Families named around shell/scaffold/spine/manifold/fragment
- [x] Macro layer reads as climate traces
- [ ] Re-verified after each of Phases 2-5: no roundness or symbolic habits reintroduced

### Multi-Timescale Climate (Phase 2)
- [ ] Attractors visibly migrate over ~3 minutes
- [ ] **Attractor neighborhoods produce calmer, more coherent inhabitants**
- [ ] Regional character drifts over ~60 seconds
- [ ] **Pressure fronts visibly deform nearby motifs as they pass**
- [ ] **Seasonal drift visibly changes regional behavior over longer viewing**
- [ ] Field never abruptly re-randomizes
- [ ] `timescales` debug confirms distinct per-layer behavior

### Off-Screen Continuity (Phase 3)
- [ ] Macro forms frequently enter/exit at viewport edges
- [ ] 15%+ of mid-scale forms partially clipped at any time
- [ ] Viewport never feels self-contained
- [ ] No visible teleportation at edges
- [ ] **Quiet interior zones and slow anchor forms preserved — not edge-busy**

### Climate-to-Motif Causality (Phase 4)
- [ ] Agents in high-curl regions develop curvier forms within 10-15 seconds
- [ ] Agents in flow lanes stretch directionally
- [ ] Agents near convergence zones show compression
- [ ] **Motifs adapt to new climate faster than they heal from old exposure**
- [ ] A motif's form tells you where it has lived
- [ ] Memory channels converge to steady-state (no unbounded growth)

### Gradients (Phase 5)
- [ ] Directional opacity variation visible on agent strokes
- [ ] Gradients are primarily opacity-based, not rainbow
- [ ] Climate-scarred agents show lower-confidence color
- [ ] No gradient feels decorative — all reveal causality
- [ ] **Background shifts are almost subliminal — barely perceptible**

### Memory + Residue (Phase 6)
- [ ] Fading traces visible after major reorganization events
- [ ] **Rare intra-family residue on dramatic shape changes (high threshold)**
- [ ] Residue is subtle, never dominates
- [ ] Pool stays within 60-entry limit
- [ ] Long observation reveals accumulating weatheredness

### Living Boundaries (Phase 7)
- [ ] Region dialect edges are visibly more active
- [ ] Forms near boundaries feel conflicted
- [ ] Boundaries shift as seasonal layer evolves

### Contagion (Phase 8)
- [ ] Nearby agents share deformation direction subtly
- [ ] Destabilization ripples outward after reseed events
- [ ] No flocking, no synchronization, no imitation

### Impossible Overlap (Phase 9)
- [ ] Ghost forms glow through foreground via blend mode
- [ ] **Residue creates temporal-spatial contradiction (structural, not compositing-led)**
- [ ] Nothing reads as an intentional paradox

### Global Artistic Criterion
- [ ] **The field feels more inevitable than designed**
- [ ] The field feels like a living, unresolved climate
- [ ] Visible geometry is a temporary consequence of larger forces
- [ ] Longer viewing is rewarding — the system changes meaningfully over minutes
- [ ] 60fps on mid-range hardware
- [ ] Every feature serves climate authorship, consequence, memory, or coupling

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `src/field/climateController.ts` | Multi-timescale state + attractor/front management |
| `src/render/ResidueSystem.ts` | Residue entry pool, rendering, lifecycle |

### Modified Files (by phase)
| Phase | Files |
|-------|-------|
| 2 — Climate Engine | `flowField.ts`, `fieldSampler.ts`, `createLivingFieldApp.ts`, `animationLoop.ts` |
| 3 — Off-Screen | `agentUpdate.ts`, `agentSpawner.ts`, `macroFormFactories.ts` |
| 4 — Causality | `motifMemory.ts`, `agentUpdate.ts`, `targetDrift.ts`, `motifFactories.ts` |
| 5 — Gradients | `colorResolvers.ts`, `SvgAgentRenderer.ts`, `SvgScene.ts`, `SvgBackgroundRenderer.ts` |
| 6 — Residue | `SvgScene.ts`, `AgentSystem.ts` |
| 7 — Boundaries | `regionMap.ts`, `agentUpdate.ts`, `motifMemory.ts` |
| 8 — Contagion | `agentUpdate.ts`, `targetDrift.ts`, `motifMemory.ts` |
| 9 — Overlap | `SvgScene.ts` |
| 10 — Near-Resolution | `antiIconEvaluator.ts`, `agentUpdate.ts` |
| 11 — Emphasis Drift | `climateController.ts`, `designRules.ts` |
| Debug | `DebugOverlays.ts` |
