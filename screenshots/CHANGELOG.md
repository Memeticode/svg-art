# Living Field — Visual Iteration Changelog

---

## Iteration 1 — 2026-03-18

### Target
General visibility — the field was nearly invisible.

### Observations
- Nearly all motifs invisible against dark background
- Ghost arc in bottom-left was only readable element
- Sparse population, dark uniform purple background

### Changes Made
- `compositionPresets.ts`: Increased opacity ranges across all depth bands (ghost 0.03-0.09 → 0.08-0.22, back 0.08-0.25 → 0.25-0.55, mid 0.22-0.55 → 0.45-0.80, front 0.35-0.72 → 0.60-0.92)
- `compositionPresets.ts`: Increased agent count 50 → 70, min 22 → 35, max 70 → 100
- `palettePresets.ts`: Brightened violet-glow stroke colors, increased fill alpha (0.08-0.10 → 0.14-0.18), slightly lighter background
- `SvgAgentRenderer.ts`: Lowered glow filter thresholds, added minimum stroke width 0.8
- `agentUpdate.ts`: Faster opacity convergence (lerp 0.02 → 0.05)
- `agentSpawner.ts`: Higher initial spawn opacity (biased toward upper range)
- `artDirectionConfig.ts`: Reduced quietBasinStrength 0.4 → 0.2

### Actual Effect
Motifs went from invisible to faintly readable. Still dark but significant improvement.

---

## Iteration 2 — 2026-03-18

### Target
No-circles doctrine — enforce the hard ban on circular geometry.

### Changes Made
- `pathHelpers.ts`: Added MAX_ARC_SWEEP cap (38% of TAU ≈ 137°) to arcPath() function — prevents any single arc from approaching circular closure
- `pathHelpers.ts`: Extended sweep cap to brokenArcPath()
- `postFilter.ts`: Deactivated all circle primitives and ring primitive in post-generation filter
- `agentSpawner.ts`: Applied postFilter to ghost/macro agents (previously skipped)
- `targetDrift.ts`: Applied postFilter to ghost reseeds
- `compositionPresets.ts`: Rebalanced motif weights — zeroed orbitalNodes and eccentricOrbit, reduced radialCluster/splitCrescent/brokenCrescent, boosted spineRibs/kinkedSpine/ribbedSpine/driftingTendril/pressureFragment/knotManifold/splitLobe

### Actual Effect
Dramatic geometry shift. No more obvious circles or rings. Field now dominated by:
- Linear spine/rib structures with directional character
- Small angular/diamond fragments
- Short crescent fragments (under 137° sweep)
- Crossed line compositions
Still too dark overall and too sparse in center. Motifs feel scattered rather than ecologically connected.

---

## Iteration 3 — 2026-03-19

### Target
Density, visibility, and eliminate remaining circular residue from macro forms.

### Changes Made
- `compositionPresets.ts`: Agent count 70 → 90 (min 45, max 130), opacityBase raised, ghost countWeight 0.11 → 0.13, ghost opacity 0.08-0.22 → 0.12-0.28, clusterCohesion 0.6 → 0.8
- `macroFormFactories.ts`: Capped spiral sweep in bentManifold (3-6 → 1.5-2.8), accent spirals (2-4 → 1.2-2.2). Strongly favored warpedContourVeil (1.8 base) and driftCorridor (1.5 base) over arc-based macro forms
- Reverted crude center-offset pass from postFilter (was corrupting arc parameters)

### Actual Effect
Major transformation. Field now reads as directional pressure system:
- Ghost-layer structures are parallel-curve drift corridors and contour veils — no more orbital bowls
- Mid/front motifs are spines, lattices, angular fragments — much stranger geometry
- Clear motion and reorganization visible between captures
- No circles visible in this seed
- Lower-left still empty. Geometry now too uniformly linear — needs more variety (bent forms, split lobes, manifolds)

---

## Iteration 4 — 2026-03-19

### Target
Geometric variety and final circle elimination.

### Changes Made
- `compositionPresets.ts`: Rebalanced motif weights — boosted splitLobe (1.6), semiBiologicalScaffold (1.6), unfoldingFan (1.5), knotManifold (1.5), reduced spineRibs/ribbedSpine (1.1) to reduce linear uniformity
- `macroFormFactories.ts`: Nearly eliminated partialShellField (0.15 weight), reduced pressureBand, boosted bentManifold. Capped bentManifold spiral sweeps (1.5-2.8)
- `pathHelpers.ts`: Tightened MAX_ARC_SWEEP from 38% TAU (~137°) to 28% TAU (~101°) — prevents even composite circular reading

### Actual Effect
Field character is shifting toward "alien geometric weather":
- Right side shows excellent directional drift corridors with angular fragments
- Hexagonal/pentagonal structures have emerged — novel, non-circular
- Strong motion/reorganization visible between captures
- Circular residue reduced but still present in upper-left arcs
- The geometry is becoming stranger and more original — approaching the target
- Spatial distribution is uneven — active right side, sparser left

---

## Iteration 5 — 2026-03-19

### Target
Accent/emphasis events, continuous evolution feel, anti-icon strengthening.

### Changes Made
- `artDirectionConfig.ts`: Lowered accentEventRarity 0.75 → 0.55 (more frequent emphasis pulses)
- `agentUpdate.ts`: Lowered emphasis trigger thresholds (energy 0.7→0.5, brightness 0.6→0.4), increased boost 0.15→0.25, longer pulses (2-4s → 2-5s)
- `compositionPresets.ts`: Faster morph cycles (8-18s → 6-14s), increased targetDriftStrength 0.6→0.8, lowered antiIconThreshold 0.45→0.40

### Actual Effect
Field feels significantly more alive:
- Brighter accent areas visible — emphasis pulses producing readable bright moments
- Much more dramatic evolution between A→B captures (12s gap shows major reorganization)
- Lattice structures form, shift, and reform — approaching "structures trying and failing to resolve"
- Connected drift corridors create visual flow across the field
- The field reads as "mathematical weather" / "notation under pressure"
- Circular residue minimal — geometry is predominantly directional/angular/fragmented

---

## Iteration 6 — 2026-03-19

### Target
Ecological connection, regional variation, flow-field imprinting on motif geometry.

### Changes Made
- `agentUpdate.ts`: Strengthened neighbor heading alignment (0.15→0.25), scale harmony (0.005→0.012), phase coherence (0.03→0.06) — nearby motifs echo each other more
- `agentUpdate.ts`: Stronger deformation bias — always active (min 0.3), overall higher intensity (0.8→1.0 base), lower deformationAggression threshold (0.3→0.1), stronger memory influence (0.5→0.7)
- `artDirectionConfig.ts`: Increased regionalDialectStrength 1.5 → 2.0
- `targetDrift.ts`: Added minimum drift floor — no motif is ever structurally static (min deformationAggression 0.15, min flow.magnitude 0.1)
- `stateMutation.ts`: Increased directional bias multiplier (0.5→0.8) for more visible flow imprinting
- `pathHelpers.ts`: Made arcPath() produce elliptical arcs (ry = 55-85% of rx with slight axis tilt) — breaks circular read at primitive level

### Actual Effect
Major improvement in field character:
- Motifs now visibly stretch along flow direction
- Nearby motifs share heading alignment — local clusters read as related
- Drift corridors create dramatic spatial composition (crossed X-patterns)
- Angular/pentagonal accent structures are visible and bright
- No circles visible in best seeds — elliptical arcs break circular read
- The field now reads as "alien geometric weather" with "pressure systems made visible"
- Motion between 15-second captures shows significant reorganization

### Status
The field has reached a reasonable baseline:
- Visibility: ✓ readable from dim to moderately bright
- No-circles: ✓ mostly eliminated, occasional short arc fragments
- Strange geometry: ✓ directional lattices, angular fragments, crossed corridors
- Continuous evolution: ✓ visible reorganization over 12 seconds
- Regional variation: partial — some seeds show uneven spatial distribution
- Accent events: ✓ emphasis pulses producing brighter moments
- Ecological connection: partial — drift corridors create flow, but local cluster relationships could be stronger

---

## Iteration 7 — 2026-03-19

### Target
User feedback: scatter parallel line chunks, smooth morph transitions, cascade layers at different scales.

### Changes Made

**Scatter parallel chunks:**
- `macroFormFactories.ts`: Rewrote `driftCorridor()` and `warpedContourVeil()` — each path now gets per-path angle jitter (±0.25-0.3 rad), varied length (25-85px), random perpendicular offset (±20), stagger along flow direction (±15-20), stronger curvature (±12-15), 15% chance of being inactive, more varied dash patterns

**Smooth morph transitions:**
- `targetDrift.ts`: On reseed, morphProgress starts at 0.08 (not 0) so interpolation begins near current state. Stagger profile is blended 70/30 old/new instead of fully replaced. Brief opacity dip (×0.90) softens visual transition

**Cascade layers:**
- `compositionPresets.ts`: Ghost countWeight 0.13→0.17, scale 4-8x→3-11x (wider variety). Back countWeight 0.30→0.33, scale 1.2-2.2x→1.5-3.0x (bridges ghost-mid gap). Mid/front slightly reduced to compensate

### Actual Effect
- Parallel block problem completely solved — ghost structures now scatter as varied atmospheric curves
- More visible depth layering — large ghost sweeps overlay smaller mid-scale structures
- Tangled, weather-like texture in dense areas
- Morph smoothness needs real-time verification but structural changes should reduce snaps

---

## Iteration 8 — 2026-03-19

### Target
User feedback: parallax, fix flickering, per-layer flow, remove dashes, chaotic line morphing.

### Changes Made

**Parallax:**
- `AgentSystem.ts`: Time-based per-layer parallax drift — each band drifts at different speed/amplitude/phase, creating constant depth separation. Ghost: slow/tiny drift, Front: faster/larger drift. No mouse tracking.
- `createLivingFieldApp.ts`: Pass timeSec to getSnapshots

**Per-layer flow:**
- `agentUpdate.ts`: Each band now samples flow at different time scale (ghost: 0.4x, back: 0.7x, mid: 1.0x, front: 1.3x) and spatial offset. Deeper layers see a slower, slightly shifted flow field.

**Fix flickering:**
- `agentUpdate.ts`: Reduced emphasis amplitude 0.25→0.15, slower pulse frequency 0.8→0.6, opacity lerp slowed 0.05→0.025
- `stateMutation.ts`: Complete rewrite — replaced single-frequency sinusoidal jitter with multi-frequency `smoothChaos()` using 3 layered incommensurate sine waves. Much smoother temporal evolution.

**Remove dashes:**
- `SvgAgentRenderer.ts`: Always remove stroke-dasharray attribute
- `macroFormFactories.ts`: All dashArray set to []
- `motifFactories.ts`: All 93 dashArray occurrences set to []

**Chaotic line morphing:**
- `stateMutation.ts`: Every path coordinate now drifts via multi-frequency chaos + flow-directional bias. Endpoints drift more than control points (endpointFactor). Stroke width and opacity also drift smoothly per-path for line-based variety without dashes.

### Actual Effect
Dramatic transformation — field is now:
- All solid flowing lines, no dashes
- Organic tangled structures that look alive
- Strong depth layering visible
- Dramatic evolution between captures
- Dense areas have beautiful complexity
- Needs real-time verification for parallax and flicker fixes

---
