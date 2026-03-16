# Living Field — Claude Code Handoff

## Mission

Implement a production-quality v1 of the Living Field system in one pass, using the surrounding docs as the source of truth.

You are not being asked to brainstorm. You are being asked to execute.

## Read First

Consume these docs in order before making structural decisions:

1. `00-project-overview.md`
2. `01-architecture.md`
3. `02-implementation-spec.md`

Treat them as cumulative requirements.

## Non-Negotiables

- TypeScript-first
- fullscreen SVG renderer
- seeded determinism
- shared primitive grammar
- pooled DOM nodes
- clean module boundaries
- restrained atmospheric motion
- no toy simplifications that discard the core design

## Existing Repo Guidance

The repo may already contain useful morph-related code under `animate/svg-icons` or nearby modules.

You should:
- inspect existing code
- reuse good ideas
- extract compatible utilities
- avoid carrying forward prototype coupling if it conflicts with the required architecture

Do not blindly rewrite. Do not blindly preserve.

## Implementation Posture

Make firm engineering choices and move forward. If a detail is unspecified, choose the option that best supports:

- determinism
- maintainability
- SVG rendering stability
- aesthetic coherence
- future extensibility

## Key Product Feel

The scene should feel like:
- one living geometric ecology
- slow but active
- spatially structured
- consistently “of a piece”
- capable of rare local intensifications

The scene must not feel like:
- random icon soup
- constant visual shouting
- glitchy or structurally poppy
- generic particle fog

## Required Deliverables

Implement:
- app bootstrap and public mount API
- seeded RNG and shared math helpers
- field noise and flow sampling
- region signatures
- primitive schema and interpolation
- motif family generators
- morph agent system
- SVG scene and node pool
- palette presets and composition presets
- resize handling
- performance guardrails
- concise developer documentation

## Quality Bar

All code should be readable by a strong mid-level engineer without guesswork. Non-obvious abstractions should be briefly commented.

Avoid:
- over-cleverness
- giant god files
- weak typing
- hidden magic constants everywhere
- letting DOM state become the source of truth

## Execution Order

1. inspect repo
2. summarize implementation plan in 10–20 bullets
3. implement foundation modules
4. implement world sampling
5. implement geometry and motifs
6. implement agents
7. implement renderer
8. integrate app entrypoint
9. tune visuals
10. summarize deviations and run instructions

## Final Verification Checklist

Before finishing, verify:
- scene mounts and animates
- SVG is fullscreen
- output is deterministic by seed
- motion contains visible pockets/eddies rather than plain drift
- render nodes are pooled and stable
- code aligns with docs
- any deviations are documented plainly

## Recommended Final Summary Format

At the end, provide:
1. what was implemented
2. file/module overview
3. any deliberate deviations
4. how to run it
5. remaining polish opportunities

## Final Note

Do not shrink the ambition into a demo. Deliver the real foundation.
