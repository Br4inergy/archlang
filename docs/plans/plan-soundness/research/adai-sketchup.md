> Research record, 2026-10-18, made against `main@98bd30b` (v1.43.1). Copied from the
> session's scratch: machine-local paths are replaced by `<scratch>/`, and closed-source
> and marketing material is removed. Read observations as evidence and diagnoses as
> hypotheses (the `docs/backlog.md` rule): re-measure before you build on a number.
> Programme entry: `../README.md`.

# ADAI SketchUp Skill + Managed MCP: what ArchLang can borrow

Source: github.com/laowang-wy/adai-sketchup-skill-mcp (v0.5.39, CPAL-1.0: borrow ideas, never code or text).
Read: README, skill/SKILL.md, references/{parameter-dependency-contract, semantic-validation,
shared-architectural-foundation, quality-check-contract, geometry-guard, change-focused-review,
instance-layout-contract, scoped-operations, hierarchical-component-workflow, weak-model-starter,
source-dimensions}.md, bundled-ref-packs/adai-cad-building-ref, modeling-method-cards.json,
managed-project.js (revise_from / patch preview paths, ~L2600-2740, ~L3020).

## What it is
A Skill + MCP that drives SketchUp through managed transactions: staged construction, a real
readback of the geometry after every write, rendered views the agent must actually look at, a
structured review per stage, and a finish gate. The model is never trusted to self-certify.

## Ideas worth taking (ranked for ArchLang)

1. **Bound dimension targets: the "what must stay" list.** `task_profile.dimension_targets`
   binds a user-confirmed size once (object, axis, expected, tolerance, source). The program
   measures the real geometry; a mismatch blocks review; finish needs every bound target measured
   as passing; changing a bound target is a *task change*, not a normal edit.
   → ArchLang: provenance on numbers. Brief-given values (room count, a 4 m living width, the
   lot) become declared invariants that `validate` measures from geometry. Every other number is
   free to flex. That is exactly "know what to keep and what may change".

2. **Low-to-high frequency staging with a gate per stage** (hierarchical-component-workflow):
   datum/levels → massing → level system → vertical systems → component kits (prototype first,
   then instances) → detail → finish. "A weak model fails when it decides all five scales in one
   batch; early proportional errors spread through hundreds of objects."
   → ArchLang: program/brief → room graph (topology) → zoning + rectangles on a grid → walls
   (derived) → openings → fixtures/furniture → drafting. Each stage has its own checks, and a
   later stage's checks are meaningless until earlier ones pass. `validate --stage <s>` and a
   staged SKILL loop.

3. **Dependency graph with fingerprints and upstream-ordered recheck** (parameter-dependency
   contract, `revise_from`): a changed parameter invalidates its consumers and only them; the
   report lists what to recheck in upstream-first order; unrelated branches are untouched; a
   consumer that "copies the new hash" without regeneration still fails.
   → ArchLang: `arch impact old.arch new.arch` built on `diffPlans()` + describe `input_graph`:
   what moved, what stayed, which invariants broke, which checks must rerun, in dependency order.

4. **Hosted, typed edit operations that keep their relations**: `update_wall_opening` changes
   one opening, keeps the others, and the window frame follows; walls own their openings.
   → ArchLang: make hosting the default model: openings live on a wall (or on the boundary
   between two rooms), positioned by offset from a wall end/room edge, so a moved wall carries
   them. Absolute `at (x,y)` stays legal but lint names it a "free-floating" opening.

5. **Patch preview: write set + protected objects before applying**: the preview lists the
   target, what will be written, what is protected, which evidence is invalidated, and needs
   confirmation. → ArchLang `arch fix --dry-run` already does part; extend to an edit-intent
   preview: "this edit moves 3 walls, 2 doors; keeps the bath stack; breaks invariant X".

6. **Honest status vocabulary**: `provided / unverified / pass / fail / invalid / not_run`;
   "tool success ≠ architectural correctness"; a report of only passing + unsupported checks is
   `unverified`, never pass. → ArchLang lint/validate should report *coverage*: which rule
   families ran, which were skipped and why (e.g. no `uses` tags → program checks skipped; no
   brief → intent unverified). A clean lint today silently means "nothing I know how to check
   failed".

7. **Semantic reconstruction before detail**: record each object's role, front axis, facing
   target, host wall side, confidence; "never judge from a bounding box or a block name"; a TV
   faces the sofa/bed, dining chairs face the table, a bed head is against a wall.
   → ArchLang taste rules as *relations*: bed head-to-wall, sofa faces TV/window, WC not facing
   the door, desk near window. Names (`win_bed1`) are checked against geometry ("this window's id
   says bed1 but it lights Bedroom 2").

8. **Mandatory visual review with structured observations** (`visual_review={state,
   observations, inspected_views}`; "not opened = not seen"). → ArchLang: `arch preview
   --review` producing a review sheet: the plan + an overlay of the access graph, the problem
   elements circled with their codes, plus zoomed crops of each flagged junction. Agents look at
   pictures well when told where to look.

9. **Prototype first, then instances**: validate one representative bay/unit before replication.
   → ArchLang components/`place`: lint the component in isolation, then instances.

10. **Experience packs (REF) as versioned data**: per-stage cards with *applicability, minimal
    action, how to check, failure exit, sources*, `state: draft|verified` + evidence; matched by
    topic and stage, read on demand. → ArchLang rule profiles (`residential-cn`, `-uk`, `-us`,
    `clinic`) as versioned data packs with sources and a verified-on-corpus state.

11. **Guided vs autonomous modes, short starter card for weak models** (weak-model-starter):
    the same truth, two depths of hand-holding. → ArchLang `arch context --level starter`.

12. **Task card with `next_call`**: every response says the next executable action.
    → `validate --json` returns `next`: the single most important fix, in stage order.

## What not to copy
- Heavy evidence-signing/ceremony and per-host binding: ArchLang is a pure compiler; its
  truth is recomputed from source every time, so most of ADAI's anti-forgery machinery is moot.
- Licence: CPAL-1.0 is reciprocal; take ideas only.
