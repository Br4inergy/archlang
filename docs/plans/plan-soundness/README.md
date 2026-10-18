# Plan-soundness programme: professional rules and taste for ArchLang

**Status:** open. Planned 2026-10-18 against `main@98bd30b` (v1.43.1). The owner delegated the four
programme decisions (§3) and asked for this document to drive implementation in later sessions.

**What this is.** ArchLang draws what an author writes, faithfully. It does not yet know what the
drawing *means* as architecture. An LLM meeting the language for the first time therefore writes plans
that compile, lint clean and are still wrong: a door across a wall junction, two rooms with no wall
between them, a living room reached through two bedrooms, a dimension whose text lies. This programme
makes ArchLang itself carry the profession's rules and taste, so the language **guides** (forms that
make the wrong thing hard to write), **checks** (rules that read the facts it already computes),
**reasons about change** (what follows an edit, what must stay, what must be re-checked) and
**judges quality** (a scored, sourced taste report), while keeping every iron law.

**How to use this document (for a new session).**

1. Read §1–§5 here (about 15 minutes). Read `evidence.md` before touching code.
2. The research behind each decision is in `research/`, and the per-plan defect audits are in `audits/`.
   Minimal reproductions are in `repro/` (see `repro/README.md`).
3. Pick the first card in §6 whose status is `todo` and whose dependencies are done. Each card states
   its goal, design, acceptance and open questions.
4. You are expected to **think, not just execute**. §8 lists what is still unknown and how to extend
   this plan. If the evidence contradicts a card, correct the card here, say why, and carry on.
5. Usual gates apply: `AGENTS.md`, `CLAUDE.md`, `docs/agents/*`, and the `docs/backlog.md` floor gate
   and merge protocol.

---

## 1. The evidence in one page (detail: `evidence.md`)

- **About 120 verified defects across about 30 plans; lint caught a handful.** The plans audited:
  - the ArchCanvas public examples (10 plans), with 6 blockers;
  - the ArchLang showcase (12 plans);
  - ArchLang's own `examples/`;
  - one reconstructed published plan (`repro/family-apartment.arch`).

  Default lint on that reconstructed plan returns only fixture-rotation warnings. One `arch fix` run
  plus one hand edit makes it pass `validate --strict` with every architectural defect still present.
- **The flagship example is wrong and lints clean.** `examples/two-bed.arch` says "central corridor".
  Its access graph is a chain: hall → bathroom → master bedroom → kitchen/living → bedroom 2.
  `arch lint` returns `[]`.
- **The facts exist; no rule reads them.** On the family-apartment reconstruction, `describe --json`
  already knows that:
  - the front door opens into the kitchen;
  - the living room is 4 doors deep;
  - `d_living_bed3` actually joins bedroom 3 and bathroom 2;
  - `win_bed1` lights bedroom 2;
  - the living room touches bedrooms 3 and 4 with no wall (geometric adjacency without an access
    edge), while the walking grid walks straight through the missing wall.
- **Change has no consequences.** Making the studio example's living room 500 mm wider needs about
  24 literal edits. Changing only the room size drives the room through a wall that stays put, and
  lint reports only "rooms overlap (allowed)" and "unreachable". A `dim` whose text says 4500 over a
  4000 span lints clean.
- **Missed defect classes, most common first:**
  1. openings that ignore walls: across a T-junction, overlapping each other, or with nibs under 100 mm;
  2. space not enclosed or not assigned: a shared edge with no wall, walled area with no room;
  3. circulation and privacy: through-bedroom, through-bath, bath onto living or kitchen, kitchen as
     the only link;
  4. rooms missing what defines them: bedroom without bed, bath without shower, kitchen without worktop;
  5. fixture clearances: 20 WCs 200 mm from a side wall, a wardrobe facing a bed 150 mm away, a
     fridge in front of a window;
  6. windowless living rooms (the label "Living" is not even classified as `living`);
  7. stair safety: a door swing over the top tread, a void at the stair head;
  8. annotation collisions: auto dimensions inside rooms, title-block overflow.

## 2. Diagnosis: three layers, one loop

1. **Authoring model: coordinates first, relations absent.**
   - Walls and rooms do not know each other ("Rooms describe space; walls are drawn separately").
   - An opening is a centre point plus a width and never names the rooms it joins.
   - Across the corpus, 100 % of walls, 94 % of rooms and about half of openings and furniture are
     absolute.
   - An LLM must hold a topology in its head and hand-propagate every number. LLMs are reliable at
     relations and unreliable at propagating coordinates (FloorplanQA; `research/prior-art.md`).
   - Every system that reaches near-zero invalid plans makes invalid states unwritable: a door is
     defined by the two spaces it joins (FML 2026, HypergraphFormer 2026, IFC hosting).
2. **Checking: facts computed, rules missing, coverage silent.**
   - 25 lint rules exist (`src/lint/rules/index.ts`). Only one, `W_BATH_VIA_BEDROOM`, asks what
     kind of room a route passes through.
   - Several rules are scoped to one room type: enclosure checks wet rooms only, "missing fixture"
     covers bath and kitchen only, and "near corner" covers doors at L-corners only.
   - A clean lint means "nothing I know how to check failed", but nothing says what was not checked.
     For example, rooms without a classified `uses` silently skip every program rule.
   - `between` is decided from an opening's centre point only, and `ambiguous` is a field, not a
     diagnostic (`src/analyze.ts` ~272-295).
3. **Change: no dependencies, no invariants, no impact report.**
   - `describe().freedom` says *how* a position was authored, never *on what* it depends.
   - `diffPlans()` labels a move as a resize and has no wall section.
   - No source form says "this must stay".
4. **The loop around it.** A generator that repairs against lint inherits every blind spot above:
   what lint cannot see ships. The fix is in ArchLang (more facts read, honest coverage, a `next`
   field) and in each consumer's gating. Consumer-side changes are tracked by their owners and are
   not part of this repository.

## 3. Decisions taken for this programme

The owner delegated these on 2026-10-18. Each records what would reverse it.

**D1. Relations first, as additive forms, with walls derivable from rooms.**
- Add room-edge datums (`living.east`), `wall … between A and B`, `wall … around [A B C]`,
  `door|opening between A and B [at …]`, `window on <room>.<edge> …`, hosted offsets measured from a
  wall end, a room edge or an axis, and semantic segment selectors.
- Wall-first authoring stays fully legal. Plans not using the new forms stay byte-identical.
- This closes backlog **G.12** and needs a new ADR (card PS3.1) before code.
- *Why:* it is the single change that makes "the room grows, the walls follow" true. It removes three
  defect classes at the point of writing, and it matches how LLMs succeed (prior art). It is
  closed-form with every target named, so ADR 0004/0005 allow it in `compile()`.
- *Reverse if:* the resolve-order change (rooms and relational placement before walls) cannot be made
  byte-identical, or `place`-frame semantics for datums cannot be made sound. In that case ship datums
  in wall points only and keep `between` as an explicit `arch` transform.

**D2. Validity in `lint`, quality in a separate taste score.**
- Only plain defects become `W_*` lint rules (§6 PS2).
- Professional quality goes to `arch score --taste <profile>` (PS5): 0–1, sourced, capped at 0.5
  while any validity rule fails, never gating.
- *Why:* taste is profile- and culture-dependent, and putting it in `lint()` would move the lint
  output across the whole corpus for every tweak. A separate meter can evolve freely, and agents can
  still optimise it.
- *Reverse if:* agents measurably ignore a separate score.

**D3. Advisory profiles are named honestly.**
- Thresholds from codes ship as `cn-residential-advisory`, `uk-residential-advisory` and
  `us-residential-advisory` (plus the existing `accessibility-advisory`), never as `gb50096` or `irc`
  (ADR 0005; `src/lint/ruleset.ts` ~113-118).
- Every number cites its source in a doc comment.
- A value remembered rather than read in the standard (marked [M] in `research/design-taste.md`) is
  verified before it ships in a message.

**D4. This document lives here; private follow-ups live privately.**
- The language programme is public: `docs/plans/plan-soundness/`, not published to the site.
- Consumer (ArchCanvas) loop changes and marketing-asset corrections are tracked in the owner's
  private repositories.
- Cards land and are deleted here as `docs/backlog.md` does (cite the closing commit).
  `CHANGELOG.md` stays the only record of what shipped.

## 4. Principles: what "professional rules and taste" means here

**Four layers, treated differently:**

| Layer | Meaning | Mechanism | Gates? |
|---|---|---|---|
| Valid | Geometry and topology are not self-contradictory: an opening sits on a wall and clear of junctions, rooms are enclosed, rooms are reachable | `W_*` lint | `validate --strict` |
| Advisory code | Sourced numeric thresholds: areas, widths, daylight ratio, fixture clearances | Lint profiles (D3) | Opt-in |
| Intent | This project's contract: brief-given sizes, room program, "these two must connect" | intent brief, `keep` (PS4) | Yes, except adjacency and reachability, which stay advisory by iron law |
| Taste | Privacy gradient, day/night zoning, light on two sides, alignment, proportion, façade rhythm | `score --taste` (PS5) | Never |

**The hold-fixed ladder: what stays when a number changes.** Higher tiers hold, and lower tiers follow:

> site and lot → structural axes → stair and lift shafts → wet stacks → façade opening rhythm →
> entrance → partitions → room sizes → doors → furniture

- An edit that crosses tiers (moving a wet stack to widen a room) must be explicit.
- The ladder is enforced by hosting (openings follow their wall, furniture its anchor), by `keep`
  declarations, and by `impact`'s ordering. It is never enforced by prompt text.
- Default for a hosted door: hold it to the **nearer corner or room edge**, not the wall start.
  `at %` is right for a centred window and wrong for most doors.

**Rules of engagement for every new check:**
- Read facts, never guess from ids or labels: the label-regex inference ADR 0005 calls dishonest.
- Derive positions from the shape, never a bounding box (iron law).
- Pair every topology rule with a size or width floor, or an agent will satisfy it by shrinking rooms
  to slivers (RLVR floor-plan reward-hacking, `research/prior-art.md` §6).
- Messages give the measured fact with numbers first, then one line of reason with its source, then
  geometric options whose preconditions were checked against adjacency, then an "accept if" clause.
  No "shrink until silent" fixes. Machine fixes only where the edit is unique (ADR 0011).
- Report coverage: a skipped rule family is visible, not silent.

## 5. Guardrails (do not re-litigate)

- `compile()` stays pure, sync, deterministic and bounded. Charge steps before allocating.
  Budgets are counts, never time.
- No layout optimizer inside `compile()`. A solver is an explicit source-to-source transform only
  (ADR 0006).
- A new language form ships a byte-identity law (SHA-256 of SVG + `describe()` + `lint()`, plus
  `compile().diagnostics` when the resolver is reached).
- New `W_*` codes append to `LINT_RULES`. Any movement of corpus `lint()` output is explained per
  rule in the commit and test ledger, never blessed.
- Lint messages name things as a person would and never quote ids; ids go only in `hint`.
- Intent adjacency and reachability assertions stay advisory (`gate: false`).
- Never claim a model-loop gain or its absence, and never run the paid eval (T3 is declined for good).
- Never fix a defect by editing a golden. A new rule that fires on an example is either a real defect
  in the example (fix the example, explain it) or a false positive (fix the rule).

## 6. Workstreams and cards

Status words: `todo`, `doing`, `done` (delete the card once landed), `parked`.
Dependencies are by card id. Each card's gate is the backlog floor gate plus what it lists.

### PS0 · Bugs found by the audit (independent; file and fix first)

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.1 | `between` uses only an opening's centre point, so a wide opening across a junction is silently given to one side. An opening centred on a T-junction of an exterior wall reports an interior `a↔b` door (`exterior:false, ambiguous:false`) and the plan then raises `W_NO_ENTRANCE` (`repro/door-on-tee.arch`). Decide `between` from both jamb probes; surface undecidable cases (see PS2.3) | todo |
| PS0.2 | `compile -f json` (Plan JSON) drops arc segments; a round trip loses a bay and floats its window (`audits/archcanvas-public-examples.md` G2) | todo |
| PS0.3 | Multi-storey `describe`: upper-storey rooms report `reachable:false` though a stair reaches them; an exterior door on an upper storey counts as an entrance (`audits/showcase-and-examples.md` §5.10) | todo |
| PS0.4 | `diffPlans` reports a pure move as "resized +0.0 m²", ignores an opening whose `between` changed, and has no wall section (`research/associativity.md` §1.2). Extend additively | todo |
| PS0.5 | `furniture … against wall … in <relational room>` fails with `E_FURN_AGAINST` because relational placement resolves after furniture (`src/ir.ts` ~2488). May fall out of PS3.2's reorder | todo |
| PS0.6 | `suggest` connects an unreachable room to *any* reachable neighbour, a bedroom included (`src/suggest.ts` ~364-395), against `skills/archlang/SKILL.md`'s own advice. Rank by neighbour use (hall/circulation/living first, bedroom and bath last) | todo |
| PS0.7 | The label classifier never emits `living`/`dining` (`src/vocabulary.ts` ~212-216): "Living", "Living Room" and "Kitchen / Living" lose their living use, so every living-room rule is blind on label-only plans. Decide the honest rule (exact-word labels only?) and record it | todo |
| PS0.8 | `W_PATH_TOO_NARROW` measures pinches on the 100 mm grid and missed a 500 mm diagonal between a bench and a jamb (`repro/gallery-bench-pinch.arch`, `audits/archcanvas-public-examples.md` GW3). Re-measure the case first: the repro lints with the warning in isolation | todo |
| PS0.9 | `describe` assigns a window between an enclosed room and a covered loggia to the loggia, so lint and describe disagree on bedroom windows (`audits/showcase-and-examples.md` villa-rotonda) | todo |

### PS1 · The defect corpus (do this before PS2; it is the yardstick)

**PS1.1 · `test/defect-corpus/`: one minimal plan per verified defect class, each pinned to the code
that must fire.** `todo`
- *Goal:* a red guard that every class in §1 is caught, and a clean twin per case that must stay
  silent, to control false positives.
- *Seeds:* `repro/*.arch`, the coordinates in `audits/*.md`, and the class list in §1.
- *Shape:* a reduced copy of the defect, not the whole source plan (licences are fine; size matters).
  Header comment: class, origin, expected code. A table-driven test asserts `lint()` codes per file.
- *Acceptance:* at least 40 cases spanning all eight classes. Each case starts red (expected code
  absent today; mark it `todo` in the table) and flips green as PS2 lands. The test reports the
  catch rate.
- *Open:* should the corpus also feed `eval:ci` as a non-gating metric? Read `.claude/rules/eval-dataset.md`
  first: the holdout rules apply.

### PS2 · Validity checks that read existing facts (small, high yield)

Each is an advisory `W_*` appended to `LINT_RULES`, with catalogue entry, `explain` text, fix prose
(§4 format) and a defect-corpus case. Prototype checkers that found these defects exist in the
owner's audit scratch. Re-derive them from this text rather than asking for them.

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.1 | `W_OPENING_AT_JUNCTION` | For every opening kind (door, window, cased opening): another wall's body intersects the opening's clear span on the host run, or either jamb's nib to a meeting wall face is under max(100 mm, host thickness), configurable by profile. Supersedes the door-only, L-corner-only scope of `W_DOOR_NEAR_CORNER`; decide whether to widen that rule or add this one beside it (byte-identity of existing output matters) | todo |
| PS2.2 | `W_OPENING_OVERLAP` | Two openings on one host run whose along-run spans intersect, or whose separating pier is thinner than a mullion (100 mm) | todo |
| PS2.3 | `W_CONNECTOR_AMBIGUOUS` | An access edge with `ambiguous: true`, or (after PS0.1) jamb probes that disagree. The message names the rooms on each side | todo |
| PS2.4 | `W_BOUNDARY_NO_WALL` | Two rooms share an edge run longer than a doorway with no wall or opening on it, unless both rooms' authored `uses` form an open-plan pair (kitchen/dining/living). Plus its dual: a walled face with no room covering ≥ 95 % (unassigned floor), and rooms outside the closed exterior ring (`W_ROOM_OUTSIDE_SHELL`). Generalises `largestPerimeterGap` beyond wet rooms. After it lands, a test pins that circulation-reachable implies access-reachable | todo |
| PS2.5 | `W_ROOM_VIA_PRIVATE` | Remove a bedroom or bath/WC from the access graph: does any other room (not its own ensuite, wardrobe, storage or balcony) become unreachable? Generalises `W_BATH_VIA_BEDROOM` (keep that code; this is the general case). ResPlan: 0.03–0.06 % of real dwellings do this, so a warning is safe | todo |
| PS2.6 | `W_WET_ROOM_DOOR` | A bath/WC whose only connector is a leaf-less opening to a habitable room; a bath/WC door onto a kitchen or dining room (GB 50096 5.4.3); a bath with two or more connectors acting as a passage (the PS2.5 test covers part of this) | todo |
| PS2.7 | `W_ENTRANCE_INTO_PRIVATE` | The exterior door's room is a bedroom or bath (ResPlan: never). Kitchen entry is advice-level under profiles only | todo |
| PS2.8 | `W_HABITABLE_NO_WINDOW` | Extend the bedroom rule to living and kitchen (needs PS0.7) | todo |
| PS2.9 | `W_ROOM_MISSING_DEFINING` | A furnished room missing its defining piece: bedroom without a bed, bath without a shower or tub, kitchen without a sink, hob or worktop. Reuse `FURNISH_TABLE`'s required marks. Also let `finish`/furnish top up partly furnished rooms (backlog M.22); decide whether that stays fill-only | todo |
| PS2.10 | `W_DIM_TEXT_MISMATCH` | A hand `dim … text "<number>"` whose number differs from the measured span beyond rounding. Non-numeric text is exempt | todo |
| PS2.11 | Clearance family | WC centreline to side obstacle (default 400, `us` 381, accessible 450–500); front of a wardrobe ≥ 600; hob-to-fridge gap; tall unit (fridge, wardrobe, bookcase) covering a window; a door swing over a stair footprint or its landing; a void at a stair's arrival; stair pitch versus storey height; `W_DOORWAY_BLOCKED` extended to leaf-less openings; a single hinged leaf over 1200 mm. Each is a separate code; split into cards as they start | todo |
| PS2.12 | Annotation collisions | Auto-dimension text inside a room floor, over a symbol or over a label; title-block text wider than its row. Extend `W_DIM_INSIDE` to `dims auto`; drafting only, never `describe()` | todo |
| PS2.13 | Lint coverage report | `lint --json` gains an appended `coverage` block: rule families run, skipped (with why: no `uses`, no brief, no `site`, no multi-storey) and unclassified rooms. Human output prints one line when something was skipped. Purely additive JSON | todo |

### PS3 · Relation-first authoring (D1; needs an ADR)

**PS3.1 · ADR: rooms may be primary; walls and openings may be derived from room relations.** `todo`
- Settle: grammar; datum names (`north/south/east/west` plus aliases, `cx/cy`, `axis n`);
  refusal codes (`E_WALL_BETWEEN_NOT_ADJACENT`, `E_WALL_BETWEEN_AMBIGUOUS`, polygon/circle rooms
  refused like relational placement); `place`-frame semantics; grid snapping; how `around` treats
  holes and multiple components (refuse).
- Design input: `research/associativity.md` §4 P1/P6/P7.

**PS3.2 · Resolve order and room-edge datums.** `todo` (after PS3.1)
- Resolve rooms and relational placement before walls, then freeze a datum table.
- Ids are assigned before resolve, so the registry order can stay.
- Proof: the byte-identity sweep including `compile().diagnostics`.

**PS3.3 · `wall … between A and B` and `wall … around [ids]`.** `todo`
- Closed-form interval intersection and rectilinear union outline.
- Steps are charged per read and per sweep.

**PS3.4 · `door|opening between A and B [at <t> | <mm> from <end|room edge> | center]`.** `todo`
- Resolve to the shared wall. Enforce the nib (refuse, do not slide).
- `window on <room>.<edge> [at …]` picks the exterior wall segment on that edge.
- Hosted offsets on existing forms: `on <wall> at 150 from end`, `on <wall> at 150 from <room>.<edge>`,
  `on <wall> at axis 3`.

**PS3.5 · Semantic selectors.** `todo`
- `segment north|south|east|west`, or `segment containing <room>.<edge>`, aliasing `segment <n>`.
- Refuse unless exactly one segment matches.

**PS3.6 · Teach it.** `todo`
- `spec.llm.md` and `skills/archlang/SKILL.md` lead with a minimal room-graph example (rooms, then
  `wall between`, then `door between`). Prior art: a minimal task-scoped grammar helps; the full
  grammar does not.
- Rewrite `examples/two-bed.arch` (after PS2.5 flags it) and `examples/relational.arch` (G.12's live
  repro) in the new forms.
- Respect the `spec.llm.md` size cap rules (trim duplication first).

### PS4 · The change model: what follows, what stays, what breaks

**PS4.1 · `describe --facts depends` (opt-in).** `todo`
- Per element: `on` (ids it derives from: host wall, relational room, anchor room, datums) and
  `params` (the `let` names it reads; `src/cursor.ts` already walks references for LSP).
- Plans not asking for it are unchanged.

**PS4.2 · `arch impact`.** `todo` (after PS0.4, PS4.1)
- `arch impact plan.arch --set NAME=value` (or `--against old.arch`) twin-compiles through the one
  pipeline (the shape of `reroll`) and reports:
  - **moved**, **resized** and **re-hosted** elements, each with its `depends` chain as the "why";
  - **held**: elements that did not move although a dependency did. This is the "should have
    followed" signal;
  - **broke/healed**: the diagnostic delta, keyed by code and element, including `keep` violations.
- This is the executable answer to "change one number: what changes, what must not".

**PS4.3 · `keep` invariants (checked, never solved, by `compile()`).** `todo` (needs an ADR addendum)
- Vocabulary: `keep align …`, `keep equal …`, `keep offset <x> from <y> <mm>`, `keep min clear <room> <mm>`,
  `keep on axis <n> <wall>`, `keep stacked <room> on levels …`, `keep fixed …`.
- Grades `hard`/`soft`/`advisory` (the IFC `IfcConstraintEnum` ladder).
- `W_KEEP_VIOLATED` reports a signed residual in mm.
- A static DOF/redundancy/conflict fact goes under `--facts depends`.
- A `keep` draws nothing and moves nothing.

**PS4.4 · Brief-bound dimensions (provenance).** `todo`
- Sizes stated by the user's brief become intent assertions that `validate --intent` measures from
  geometry (room count and area exist already; add a room width/depth and an exact-size assertion).
- An edit that breaks one fails the gate. Every other number is free to flex.
- This is the machine form of "know what to keep" (ADAI's bound dimension targets,
  `research/adai-sketchup.md` idea 1).
- Check the intent schema's drift and generator rules before adding fields.

### PS5 · The taste layer and the review sheet (D2)

**PS5.1 · `taste()` and `arch score --taste <profile> [--json]`.** `todo` (after PS0.7; benefits from PS2)
- Shape: `research/design-taste.md` §5.1 (coverage first, six subscores, criteria with source,
  evidence and advice code, capped at 0.5 while any validity rule fails).
- Start with R3 (privacy gradient), R6 (furniture–use match), R7 (daylight ratio), R9 (proportion
  from the shape), R11 (kitchen–dining link), R12 (aspect), R14 (living at the integration core,
  from the existing `--facts syntax`), R15 (day/night zoning), R16 (corner doors), R17 (axis economy)
  and R18 (regularity).
- Calibrate on the corpus plus the ResPlan priors in that report (§4 has the method and caveats).

**PS5.2 · Profiles.** `todo`
- `cn-`, `uk-` and `us-residential-advisory`, each a partial ruleset with sourced numbers.
- R4 (area and short side by use), R8 (corridor width by destination), R10 (WC clearances) and R37
  (bedroom escape window, `us`).

**PS5.3 · `validate --json` gains `next`.** `todo`
- The one diagnostic to fix first, chosen by fixed precedence: errors, then validity, then intent,
  then profile, then taste.
- Prior art: a checker that returns the most important specific critique works about as well as
  returning all of them, and far better than "try again".

**PS5.4 · `arch preview --review`.** `todo`
- A review sheet: the plan with the access graph overlaid, each flagged element ringed with its code,
  plus zoomed crops of every flagged junction.
- Agents look at pictures well when told where to look ("not opened = not seen").
- Drawing-only; it never changes `describe()` or `lint()`.

### PS6 · `arch solve` (explicit transform; last)

**PS6.1 · ADR addendum to 0006, then `arch solve`.** `parked` until `keep` has real use
- Exact rational elimination for equalities (DOF is a decision, not a float threshold) and
  Bellman-Ford for difference constraints (a negative cycle names the conflicting `keep`s).
- Authored values are the lowest-priority anchors, applied in hold-fixed-ladder order.
- It refuses when under-determined, its budget is counted, and it emits source plus a change log.
- Design: `research/associativity.md` §4 P5.

### PS7 · Staged authoring for agents

**PS7.1 · Stages as a first-class idea.** `todo` (after PS2, PS3.4)
- Stages: brief → room graph → zoning on a grid → walls (derived) → openings → fixtures and
  furniture → drafting.
- `validate --stage <s>` runs only the rules meaningful up to that stage. SKILL's loop advances only
  when a stage is clean.
- Prior art and ADAI agree: decide low-frequency things first; early proportional errors cascade.

**PS7.2 · `arch context --level starter`.** `todo`
- A one-screen starter for weak models: the same truth as the full context, less of it.

**PS7.3 · Rule packs as data.** `parked`
- Profiles and taste rules described as versioned data, each with applicability, check, failure exit,
  sources, and draft/verified-on-corpus state.
- Only if PS5 shows the rule count outgrowing code-defined profiles.

## 7. Suggested order and acceptance

| Order | Cards | Done when |
|---|---|---|
| 1 | PS0.1, PS0.7, PS1.1 | The corpus exists and reports a catch rate; the two fact bugs are fixed |
| 2 | PS2.1–PS2.9, PS2.13 | Defect-corpus catch rate ≥ 90 % for classes 1–6, with no false positive on the clean twins; every corpus `lint()` movement is explained (two-bed is expected to start warning: fix the example, see PS3.6) |
| 3 | PS3.1–PS3.4 | ADR merged; byte-identity law green; `relational.arch` lints clean with walls derived; the 500 mm widening drill moves walls and doors with the room |
| 4 | PS0.4, PS4.1, PS4.2 | The widening drill's `impact` names every moved, held and broken item correctly |
| 5 | PS5.1–PS5.3, PS2.10–PS2.12 | The taste score separates the corpus's known-bad from known-good plans monotonically |
| 6 | PS4.3, PS4.4, PS3.5, PS3.6, PS5.4, PS7.x | — |
| 7 | PS6.1 | — |

The drill used in rows 3 and 4: `repro/widen-before.arch` → `repro/widen-after.arch`, and the studio
example widened by 500 mm (`repro/README.md`).

## 8. Room to think: open questions and how to extend this plan

This plan is a hypothesis about what will make AI-written plans professional. Treat it that way.

**Open questions worth a fresh investigation:**
1. **Are rooms or walls the better primary for LLM authors?** D1 bets on rooms. A small, unpaid
   experiment can test it: author the corpus briefs both ways with the CLI loop and compare defect
   counts on the PS1 corpus. Do not run or cite the paid eval.
2. **Where is the boundary between a fact and taste in each culture?** For example, a kitchen as the
   entry room is normal in some housing stocks. Profiles may need a `residential-generic` that is
   deliberately quiet.
3. **Which diagnostic wording repairs best?** No controlled study exists for a spatial DSL
   (`research/prior-art.md` "Gaps"). The defect corpus plus a local, unpaid loop could measure it.
4. **Can `between`-style forms cover non-rectilinear rooms?** Polygon and circle rooms are refused
   in v1 of PS3. What would an honest extension be?
5. **What would make `impact` a planning tool, not just a report?** For example, "list the edits that
   keep every `keep` true".
6. **Multi-dwelling and multi-storey rules.** Toilet over habitable room below (GB 50096 5.4.4,
   mandatory), wet-stack alignment, and units sharing a corridor. These need a dwelling concept
   ArchLang lacks.
7. **Furniture semantics.** Facing targets (a TV faces the sofa or bed, a bed head is against a wall,
   dining chairs face the table) as relations rather than rotations (ADAI's semantic reconstruction,
   `research/adai-sketchup.md` idea 7).
8. **Anything the audits missed.** Run a fresh audit on new plans after PS2 lands. The defect classes
   in §1 came from about 30 plans and are surely incomplete.

**How to extend this document:**
- **New evidence:** add a dated file under `research/` or `audits/`. Never rewrite an old report;
  correct its conclusions here in the card it affects, with a one-line reason.
- **A new idea:** add a card in the right workstream with goal, design, acceptance and open
  questions, and mark which prior evidence supports it. If it changes a decision in §3, add a new
  decision (D5, …) that names what it supersedes and why. Owner-reserved choices (iron laws,
  releases, paid eval) still go to the owner.
- **A card lands:** delete it (cite the commit in the place that referenced it), update §7, and
  record the release story in `CHANGELOG.md` only.
- **A card turns out wrong:** say so in the card, keep the reason, and change course. Symptoms have
  been reliable; stated causes have been wrong about as often as right (`docs/backlog.md`).
- **When the programme is done:** fold the lasting decisions into ADRs, delete this folder, and
  archive the research outside the repository, as the backlog does with closed entries.

## 9. Files in this folder

- `README.md`: this plan.
- `evidence.md`: what was measured, the bug list and the defect taxonomy.
- `research/checks-inventory.md`: every current check, the authoring-model facts, governing ADRs,
  and the gap list with code locations.
- `research/prior-art.md`: LLM floor-plan work, rule checking, codes and thresholds, DSL design
  evidence.
- `research/associativity.md`: Revit, ArchiCAD, FreeCAD, IFC/Bonsai, Sweet Home 3D, SolveSpace and
  Topologic at source level, plus the full P1–P7 design (datums, `between`, `impact`, `keep`,
  `solve`, the ladder, selectors).
- `research/design-taste.md`: 37 sourced rules, ResPlan priors (16,317 plans) and the score design.
- `research/adai-sketchup.md`: lessons from a staged, evidence-gated SketchUp agent (ideas only;
  CPAL licence).
- `audits/archcanvas-public-examples.md`, `audits/showcase-and-examples.md`: per-plan defects with
  coordinates.
- `repro/`: minimal reproductions (see its README).
