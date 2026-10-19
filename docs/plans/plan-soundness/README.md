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
- **Fresh plans confirm it (2026-10-18).** Six briefs written cold by an AI author from `spec.llm.md`
  alone end lint-clean and strict-clean with 57 verified defects, 4 of them blockers; lint caught
  none, and 26 fall outside the eight classes below (`audits/2026-10-18-first-contact.md`).
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

**D5. The headline relation-first form derives every wall from the room tiling, not one wall per
pair.** (2026-10-18, amends D1; does not reverse it.)
- D1's pairwise forms (`wall … between A and B`, `wall … around […]`) still ship, but they are the
  mixed-authoring forms. The form an agent reaches for first is one statement that derives the whole
  wall set from the rooms: the exterior ring is the outline of the room union, every shared room
  edge becomes a partition, and an open-plan join is stated as an exception
  (`walls from rooms exterior 200 partition 100 { open between kitchen and living }`; grammar
  settled in PS3.1).
- *Why:* with pairwise forms the author must still enumerate every pair, so the most frequent
  "space not enclosed" defect (a shared edge with no wall) is still writable by omission. With a
  whole-tiling derivation it is unrepresentable: a wall exists on every shared edge unless the
  author wrote `open`. That is the HypergraphFormer/BSP property (`research/prior-art.md` §1.1),
  reached in closed form. It also removes "unassigned floor" and "room outside the shell" by
  construction, because the shell *is* the room union.
- *Measured premise* (`research/2026-10-18-room-tiling.md`): in 26 of the 34 top-level examples
  the rooms' area sum equals the plan's centreline bbox area exactly, i.e. rooms already tile the
  building, and 236 of 246 rooms are rectangles. The form therefore fits how plans are written
  today, not a hoped-for style.
- *Preconditions it refuses on* (ADR 0005: refuse, never choose): rooms that overlap, a union
  with a hole or more than one component, a non-rectilinear room in the set, a room not snapped
  to the grid. Each is an `E_*` with the offending rooms named. A plan with corridors written as
  rooms satisfies them; a plan whose corridor is "the leftover" does not, and that is the point.
- *Reverse if:* the PS3.1 ADR finds that the exception list (`open between …`, thickness per edge,
  a load-bearing line) grows past three clauses, or the tiling preconditions reject more than a
  quarter of the corpus. Then the pairwise forms stay the headline and this one is dropped.

## 4. Principles: what "professional rules and taste" means here

**Four layers, treated differently:**

| Layer | Meaning | Mechanism | Gates? |
|---|---|---|---|
| Valid | Geometry and topology are not self-contradictory: an opening sits on a wall and clear of junctions, rooms are enclosed, rooms are reachable | `W_*` lint | `validate --strict` |
| Advisory code | Sourced numeric thresholds: areas, widths, daylight ratio, fixture clearances | Lint profiles (D3) | Opt-in |
| Intent | This project's contract: brief-given sizes, room program, "these two must connect" | intent brief, `keep` (PS4) | Yes, except adjacency and reachability, which stay advisory by iron law |
| Taste | Privacy gradient, day/night zoning, light on two sides, alignment, proportion, façade rhythm | `score --taste` (PS5) | Never |

**The hold-fixed ladder: what stays when a number changes.** Higher tiers hold, and lower tiers follow:

> the brief's given numbers → site and lot → party walls and unit boundaries → structural axes →
> stair and lift shafts → wet stacks → façade opening rhythm → entrance → partitions → room sizes →
> doors → furniture → annotations

- Three rungs were missing from the first draft (2026-10-18): the **brief's given numbers** sit
  above everything else because they are the one thing the user said (PS4.4 makes them checkable);
  **party walls and unit boundaries** sit between the lot and the structure, because a wall shared
  with a neighbour never moves to widen a room (the multi-dwelling work in §8 needs this rung);
  **annotations** sit at the bottom, because a dimension or label follows what it measures and
  never holds anything (`W_DIM_TEXT_MISMATCH` is the check that it did follow).
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

Landed: PS0.1 (`between` from wall-face probes at centre and jambs, additive `straddles`; PR #196)
and PS0.7 (the label classifier emits `living`/`dining`; a living alias yields to any other kind
but dining; PR #197).

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.2 | `compile -f json` (Plan JSON) drops arc segments; a round trip loses a bay and floats its window (`audits/archcanvas-public-examples.md` G2) | todo |
| PS0.3 | Multi-storey `describe`: upper-storey rooms report `reachable:false` though a stair reaches them; an exterior door on an upper storey counts as an entrance (`audits/showcase-and-examples.md` §5.10) | todo |
| PS0.4 | `diffPlans` reports a pure move as "resized +0.0 m²", ignores an opening whose `between` changed, and has no wall section (`research/associativity.md` §1.2). Extend additively | todo |
| PS0.5 | `furniture … against wall … in <relational room>` fails with `E_FURN_AGAINST` because relational placement resolves after furniture (`src/ir.ts` ~2488). May fall out of PS3.2's reorder | todo |
| PS0.6 | `suggest` connects an unreachable room to *any* reachable neighbour, a bedroom included (`src/suggest.ts` ~364-395), against `skills/archlang/SKILL.md`'s own advice. Rank by neighbour use (hall/circulation/living first, bedroom and bath last) | todo |
| PS0.8 | `W_PATH_TOO_NARROW` measures pinches on the 100 mm grid and missed a 500 mm diagonal between a bench and a jamb (`repro/gallery-bench-pinch.arch`, `audits/archcanvas-public-examples.md` GW3). Re-measure the case first: the repro lints with the warning in isolation | todo |
| PS0.9 | `describe` assigns a window between an enclosed room and a covered loggia to the loggia, so lint and describe disagree on bedroom windows (`audits/showcase-and-examples.md` villa-rotonda) | todo |
| PS0.10 | Reachability and the walk are seeded from every exterior door, so a patio or balcony door masks a route blocked from the front door: `W_ROOM_UNREACHABLE`/`W_PATH_TOO_NARROW` stay silent on a sofa across the hall→living opening (`audits/2026-10-18-first-contact.md` T2, A2; proven by turning the secondary door into a window). Single-storey sibling of PS0.3. Decide the honest fact: report per-entrance reachability, or name a main entrance (the one on `site.street`, else the widest leafed exterior door) and report the rest as secondary | todo |
| PS0.11 | `W_ROOM_TOO_SMALL` is use-blind (one 4 m² floor), so repairing it inflated a café staff WC to 1.6 × 3.4 m and deleted a linen store (`audits/2026-10-18-first-contact.md` "repair pressure"). Make the floor use-aware (WC, store, utility exempt or at their own floor) before more agents repair against it | todo |
| PS0.12 | A window hosted on an arc wall segment gets `room: null` in `describe().windows[]` (the bay-window case, `audits/archcanvas-public-examples.md` BB3; `examples/hillside-villa.arch` living-room bay). Every window rule and the daylight facts are blind on bays, so PS2.8 skips rooms with an unattributed arc window instead of guessing. Attribute from the shape: probe one thickness off the arc's concave and convex faces at the window centre | todo |
| PS0.13 | `W_ROOM_NO_CLEAR_PATH` is not equivariant under mirror x. Found 2026-10-19 by `test/equivariance-fuzz.test.ts` (unseeded) on a PR unrelated to circulation and reproduced on `main@6b6a42c`: a 2 × 2 m room with a 700 mm door at 5 % and two WCs at (0,51) 400×300 and (357,0) 300×300 raises the code only when placed with `mirror x`. The fuzz test fails whenever its random draw hits the class, so any PR's CI can go red on it. Either fix the walk (`src/lint/rules/circulation.ts`) or pin the class in the oracle with its witness; the plan is in the owner's scratch note (`plan-soundness-impl/fuzz-mx/`) until fixed | todo |
| PS0.14 | `describe()`'s net-area integral is super-linear on a room polygon with hundreds of vertices whose edges cross hundreds of free-standing walls: 52–97 s on `main@90ae6bf` for a 125-partition × 300-tooth comb room (the inside test walks every ring vertex per boundary piece, pieces ≈ 4·S·T). No shipped plan is near it (corpus max 56 vertices), but `compile()` is bounded by law and `describe()` runs in the playground thread. Charge pieces × ring vertices to a count before the integral, or bin the ring for the inside test; PS2.4's `FaceBudget` already refuses the lint side (PR #204 round 3) | todo |

### PS1 · The defect corpus (do this before PS2; it is the yardstick)

**PS1.1 · `test/defect-corpus/`** landed 2026-10-18 (PR #195, commit df00ab5): 53 defect cases with
clean twins across all eight classes, headers parsed by `test/defect-corpus.test.ts`, catch rate
printed per class (7/53 at landing, all from existing rules). A `todo` case is also asserted NOT to
fire, so a PS2 rule that starts catching one turns the test red until its header says `done`.
Proposed code names for PS2.4/PS2.11/PS2.12 live in the folder README and are the names PS2 uses.

**PS1.2 · Fold the first-contact instances into the corpus.** Landed 2026-10-19 (PR #203,
84df654 … fdf8231): 14 new cases with clean twins (corpus 53 → 67), four `done` at landing (C1, C2,
C5, C8), two new proposed codes in the folder README (`W_LEAF_ACROSS_DOORWAY`,
`W_FOOTPRINT_TRANSPOSED`). Instances outside the eight classes were listed in the PR body by the
audit's proposed class, not turned into cases. The S1 case (bath off an open-plan kitchen/living) is
the stronger variant: the audit's own studio measures 2025 mm door-to-sink and lies beyond PS2.6's
1500 mm default, a taste question (R2).
- Reduce the `audits/2026-10-18-first-contact.md` defects into cases: a seat facing away from its
  table, a transposed directional footprint, door–door interference, the masked route behind a
  patio door (PS0.10), the tee-crossed WC window, the stair foot under a door swing, the fire door
  swinging inward, a kitchen with no worktop. Same header scheme, clean twins, and the new codes
  added to the folder README's proposed list.
- *Open (carried from PS1.1):* should the corpus also feed `eval:ci` as a non-gating metric? Read
  `.claude/rules/eval-dataset.md` first: the holdout rules apply.

### PS2 · Validity checks that read existing facts (small, high yield)

Each is an advisory `W_*` appended to `LINT_RULES`, with catalogue entry, `explain` text, fix prose
(§4 format) and a defect-corpus case. Prototype checkers that found these defects exist in the
owner's audit scratch. Re-derive them from this text rather than asking for them.

Landed 2026-10-19 (wave 1): PS2.5–PS2.7 in PR #199 (e54f586, a512a72); PS2.1–PS2.3 in PR #201
(990bd75 … 3445cac); PS2.8–PS2.9 in PR #200 (4a32ce1 … 88c8dfe). Corpus catch rate on
`main@cc165f4`: 33/53 (openings 14/14, circulation 8/8, defining 3/4, daylight 4/4; space 1/6,
clearances 3/10, stair 0/3, annotation 0/4 untouched). Corpus `lint()` movement, explained per
rule in each PR: 71 corpus files moved on lint only; 7 examples were edited so the new rules
report nothing on them (accessible, relational, hillside-villa, practice-office, two-storey,
corner-cafe, terrace-row, plus courtyard-house, furnished-flat, library and garden-house in the
earlier PRs); `examples/two-bed.arch` is left warning (3 × `W_ROOM_VIA_PRIVATE`) for PS3.6. The
reconstructed `repro/family-apartment.arch` went from no architectural warning to 13 (5 at
junctions, 2 overlaps, 1 ambiguous connector, 1 route through a private room, 1 wet-room door,
3 missing defining pieces). Follow-ups from the reviews are cards PS2.17–PS2.20 and the notes on
the landed rows.

Landed 2026-10-19 (wave 2): PS2.13 in PR #203 (76d62a1 … e3bb959; with PS1.2 and a revision of
PS2.6, see its row); PS2.4 in PR #204 (6354d78 … ae84ec3, three red-team rounds). Corpus catch rate
on `main@600eaaf`: 43/67 (openings 16/16, space 6/6, circulation 10/10, daylight 4/4, defining 4/5;
clearances 3/17, stair 0/4, annotation 0/5 untouched). `repro/family-apartment.arch` now also reports
2 × `W_BOUNDARY_NO_WALL` (evidence.md §1 defect 2, the missing living/bedroom wall) and
`repro/widen-after.arch` reports `W_ROOM_OUTSIDE_SHELL` (the widening drill). Example edits with
reasons in PR #204: aquarium's two galleries extended to the north wall (121 m² each was in no room)
and its concourse polygon widened around the drum; courtyard-house's courtyard drawn as an `outdoor`
surface; relational keeps its deliberate warnings. PS0.10–PS0.12 are PR #211 (see PS0).

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.1 | `W_OPENING_AT_JUNCTION` | For every opening kind (door, window, cased opening): another wall's body intersects the opening's clear span on the host run, or either jamb's nib to a meeting wall face is under max(`minJunctionNibMm` 100 mm, host thickness × `junctionNibThicknessRatio` 0.5), measured at the face, configurable by profile. *As built (PR #201):* a new rule beside `W_DOOR_NEAR_CORNER`, which keeps its output byte-for-byte; the corner check runs for doors only where that rule is silent; a cased opening flush with a meeting wall is exempt. *Known gap:* two collinear walls meeting end to end never pair, so an opening across their joint is not reported | done |
| PS2.2 | `W_OPENING_OVERLAP` | Two openings on one host run whose along-run spans intersect, or whose separating pier is thinner than a mullion (`minMullionMm` 100). *As built (PR #201):* the two leaves of a double door are exempt and move as a pair under `fix`. *Known gap:* the check is per pair of openings on a host, quadratic in openings per wall; fine at corpus sizes, revisit if a wall ever carries hundreds | done |
| PS2.3 | `W_CONNECTOR_AMBIGUOUS` | An access edge with `ambiguous: true`, or one whose clear span covers more than one room on a face (`describe()` reports this as the additive `straddles` list since PS0.1 landed; the edge stays in the graph with a measured `between`). The message names the rooms on each side. *As built (PR #201):* a straddled room counts only when the clear span covers ≥ `minStraddleCoverMm` (100) of it, net of the meeting wall's body, so a 1 mm overrun is not reported | done |
| PS2.4 | `W_BOUNDARY_NO_WALL` | Two rooms share an edge run longer than a doorway with no wall or opening on it, unless both rooms' authored `uses` form an open-plan pair (kitchen/dining/living) or a fixed counter stands in the gap (a café servery is a deliberate boundary, `audits/2026-10-18-first-contact.md` C-plan). Plus its dual: a walled face with no room covering ≥ 95 % (unassigned floor), and rooms outside the closed exterior ring (`W_ROOM_OUTSIDE_SHELL`). Generalises `largestPerimeterGap` beyond wet rooms. After it lands, a test pins that circulation-reachable implies access-reachable. *As built (PR #204):* three codes. `W_BOUNDARY_NO_WALL` (`maxBoundaryGapMm` 900): collinear runs merged before the gap is taken; a wall counts as cover by its body (± half thickness + 50 mm), a perpendicular wall body crossing the line splits the run; a counter counts only where it straddles the line and closes the stretch only if what it leaves open totals ≤ a doorway (wall stubs are judged by the largest contiguous stretch, decided). `W_FLOOR_UNASSIGNED` (95 % cover, ≥ 0.5 m²): closed faces from the joined wall bodies with a loop nesting tree; a sealed face (no door, no window, no bordering room) is not reported (library's drum spandrels). `W_ROOM_OUTSIDE_SHELL` (0.1 m²): judged only when ≥ 50 % of the room's floor lies inside walled faces, otherwise silent (ADR 0005). All face work is charged to a `FaceBudget` before it runs (wall contacts 1600, faces 400, loops per grid cell 64, Σ face curves 20 000, face × room pairs 10 000, point tests 2e8); a refused storey files the coverage skip `enclosure-budget` naming the cap. No corpus storey is refused (max 31 faces, 64 contacts). "Circulation-reachable implies access-reachable" does not hold yet on three plans (relational's open-plan join, two `W_BOUNDARY_NO_WALL` cases); pinned as known counterexamples. `bath-open-side` raises both `W_ROOM_NOT_ENCLOSED` and this code (decided: different facts). Follow-ups: PS2.21 | done |
| PS2.5 | `W_ROOM_VIA_PRIVATE` | Remove a bedroom or bath/WC from the access graph: does any other room (not its own ensuite, wardrobe, storage or balcony) become unreachable? Generalises `W_BATH_VIA_BEDROOM` (keep that code; this is the general case). ResPlan: 0.03–0.06 % of real dwellings do this, so a warning is safe. *As built (PR #199):* seeded from the main entrance only, so a balcony or patio door does not mask the route; a stair landing inside a bedroom is not a cut point; one warning per cut room, not one per room behind it. *Known gap:* a room reachable through either of two parallel private rooms (bedroom A or bedroom B, never a public route) is not reported, because removing one leaves the other | done |
| PS2.6 | `W_WET_ROOM_DOOR` | A bath/WC whose only connector is a leaf-less opening to a habitable room; a bath/WC door onto a kitchen or dining room (GB 50096 5.4.3); a bath with two or more connectors acting as a passage (the PS2.5 test covers part of this). *Revised in PR #203 (decided 2026-10-19):* a bath door onto a room that is a kitchen AND the living room counts only where the door really opens onto the kitchen zone: a kitchen fixture (sink, hob, oven, fridge, worktop, island, dishwasher; not a microwave) nearer than `wetDoorKitchenProximityMm` (1500, GB 50096 5.3.5's single-row kitchen width) from the doorway's room-side face, compared in whole mm. Such a room with no kitchen fixture files the coverage skip `no-kitchen-fixtures`. A kitchen alone, a dining room alone and a kitchen+dining room (no living) warn unconditionally as before; living or dining without kitchen stays exempt (taste layer). The earlier blanket exemption of any kitchen that was also living/dining went beyond the clause; a use-flag narrowing was tried first and made five eval goldens and laneway-house warn (door 2.7–4.6 m from the kitchen), which is what the proximity test fixes. The GB 50096-2011 5.4.3 wording is unverified online; `research/design-taste.md` and `research/prior-art.md` read it differently | done (PR #199, #203) |
| PS2.7 | `W_ENTRANCE_INTO_PRIVATE` | The exterior door's room is a bedroom or bath (ResPlan: never). Kitchen entry is advice-level under profiles only. `examples/garden-house.arch` moved its garage door to swing into the kitchen so the rule reports nothing there | done (PR #199) |
| PS2.8 | `W_HABITABLE_NO_WINDOW` | Extend the bedroom rule to living, dining and kitchen (needs PS0.7). *As built (PR #200):* a room with a window whose host is an arc segment is skipped, not judged, until PS0.12 attributes it (`hillside-villa`'s bay was glazed and dimensioned instead). *Open:* the kitchen arm reads a dwelling; an office kitchenette has no daylight duty, so scope it to a residential profile or a dwelling declaration (PS2.14, PS2.18) | done |
| PS2.9 | `W_ROOM_MISSING_DEFINING` | A furnished room missing its defining piece: bedroom without a bed, bath without a shower or tub, kitchen without a sink, hob or worktop. Reuse `FURNISH_TABLE`'s required marks, so the rule and furnish can never contradict (furnish's never-worse gate re-lints its own output). *Decided 2026-10-18:* the defining set is exactly the row's required marks (kitchen = sink + hob), so a kitchen without a worktop stays uncaught until a follow-up either makes `counter` a required kitchen mark (furnish/finish output moves; explain it) or adds a profile rule; `finish` stays fill-only (M.22 unchanged). *As built (PR #200):* defining sets come from `FURNISH_TABLE`'s required marks via `src/lint/defining.ts` (table moved to `src/furnish-table.ts`); `W_ROOM_NO_FIXTURE`'s hint quotes the defining set. `furnish` judges each use on its finished pieces and tries the lint's own placement search before giving a use up; a use it cannot complete is left out whole, so `finish` never writes a use the rule would then report (fuzz counterexample pinned in `test/lint-room-contents.test.ts`). Fuzz against the previous main, 1,600 random plans: 34 baths gained a tub or shower, 44 baths that used to get a WC and basin are now left empty (PS2.20), kitchens unchanged. The worktop follow-up is PS2.17 | done |
| PS2.10 | `W_DIM_TEXT_MISMATCH` | A hand `dim … text "<number>"` whose number differs from the measured span beyond rounding. Non-numeric text is exempt | todo |
| PS2.11 | Clearance family | WC centreline to side obstacle (default 400, `us` 381, accessible 450–500); front of a wardrobe ≥ 600; hob-to-fridge gap; tall unit (fridge, wardrobe, bookcase) covering a window; a door swing over a stair footprint or its landing; a void at a stair's arrival; stair pitch versus storey height; `W_DOORWAY_BLOCKED` extended to leaf-less openings; a single hinged leaf over 1200 mm (and a double-leaf `door` kind, since authors fake one with two leaves that clash); door–door interference (an open leaf parked across another doorway's approach, which `W_SWING_OBSTRUCTED` does not compare); a transposed footprint on a directional piece (`size WxH` with the depth on the long axis instead of a `rotate`, drawn turned and stretched). Each is a separate code; split into cards as they start. Wardrobe front and bed sides are declarations or profile values, never defaults (PS3.7). Fresh instances: `audits/2026-10-18-first-contact.md` T1, T3, H2, C4, A1, K4 | todo |
| PS2.12 | Annotation collisions | Auto-dimension text inside a room floor, over a symbol or over a label; title-block text wider than its row. Extend `W_DIM_INSIDE` to `dims auto`; drafting only, never `describe()` | todo |
| PS2.13 | Lint coverage report | `lint --json` gains an appended `coverage` block: rule families run, skipped (with why: no `uses`, no brief, no `site`, no multi-storey, no dwelling declared, no operable-window data) and unclassified rooms. Human output prints one line when something was skipped. Purely additive JSON. *As built (PR #203):* `lintWithCoverage()` runs the rules once and returns `{diagnostics, coverage}`; `lint()` is its `diagnostics`, byte-identical (812 hashes, 0 moved). Every rule declares a `family`; a rule declines through `ctx.skip(reason, room?)`, typed reasons in `src/lint/coverage.ts` (`no-uses`, `no-site`, `single-storey`, `arc-window-unattributed`, `non-rectangular-room`, `no-entrance`, `balcony-only-entrance`, `unsupported-host-geometry`, `no-kitchen-fixtures`, `enclosure-budget`, `no-main-entrance`; reserved `no-brief`, `no-dwelling`, `no-operable-window-data`). `lint --json` appends `coverage` after `diagnostics`; the human line goes to stderr, never under `--quiet`, and `no-site` is filed only when a habitable room has a window (126 of 171 corpus files print a line, was 167). `describe()` reads none of it. *Open:* the MCP server and VS Code extension do not surface `coverage` yet (version bump); a degenerate nav grid is still a silent decline (TODO at the seam) | done |
| PS2.14 | Dwelling declaration | A zone-level marker that groups rooms into a dwelling, `describe().dwellings`, common area, and the derived party wall (the ladder rung). Needs an ADR. Unblocks the across-dwellings rule (GB 50096 5.4.4 / GB 55038-2025 4.1.7: a WC over another household's bedroom, living, kitchen or dining) and the shared-corridor checks. Corrects `research/design-taste.md` R19's default of "one level = one dwelling": that fires inside a single house and misses flats, so R19 runs only where dwellings are declared and otherwise reports a coverage skip (`research/2026-10-18-furniture-and-multistorey.md` B1, B9, B12) | todo |
| PS2.15 | `W_SHAFT_FOOTPRINT_MISMATCH` | Same-id stair/lift runs on adjacent storeys whose footprints do not overlap. The facts exist already; ship with PS2.11's arrival-void check (`…multistorey.md` B4) | todo |
| PS2.16 | Egress necessary-condition checks | `uk-residential-advisory`: `W_INNER_ROOM` (ADB 2.11/2.12, 3.7/3.8: a habitable room whose only route to the exit passes through another room, with its exemptions). `us-residential-advisory`: bedroom escape-window failures provable from gross sizes (IRC R310: width < 508 mm, sill > 1118 mm, area < 0.33 m²); never a pass claim without an `openable` window fact (`…multistorey.md` B10–B11). A non-residential advisory profile for the same family: escape-door swing in the direction of travel and leaf type, exits on separate sides, public/staff zoning, accessible WC pan offset and basin reach (first-contact café and clinic, K1, K9, K10, C6, K8). Blocked on facts, not rules, and listed as such: wet-stack risers, fire ratings, protected-stair enclosure, sprinkler-dependent limits | todo |
| PS2.17 | Kitchen worktop | The corpus case `missing-defining-contents/kitchen-no-worktop` is still `todo` after PS2.9 because the defining set is the row's required marks and `counter` is optional. Decide between making `counter` a required kitchen mark (every furnished kitchen then gains or loses a counter: run the fuzz comparison of PS2.9 and explain the moved rows) and a profile rule `W_KITCHEN_NO_WORKTOP` that reads the same table (no furnish movement). Default to the profile rule unless the fuzz shows furnish already places a counter in nearly every kitchen | todo |
| PS2.18 | Profile scoping of dwelling-reading rules | PS2.8's kitchen arm, PS2.6 and PS2.7 assume a dwelling. An office kitchenette, a café kitchen or a clinic WC off a waiting room is not the defect those rules describe (first-contact café and clinic plans). Until PS2.14 declares dwellings, scope those arms to the residential advisory profiles and have the default profile report a PS2.13 skip ("no dwelling declared") rather than a warning | todo |
| PS2.19 | Vocabulary gaps | In the first-contact plans, labels `Wardrobe`, `Closet`, `Dressing`, `Nursery`, `Study`, `Store`, `Office` and `Balcony` classify to no use at all, so every use-reading rule is blind on them and PS2.5's exemption for a bedroom's own wardrobe or balcony cannot see the room it exempts. Extend `roomUses`/`classifyLabelUses` with those kinds (each a byte-identity re-measure with the swap-back proof, as PS0.7 was) and report unclassified rooms in PS2.13's coverage block | todo |
| PS2.20 | Furnish: shower and tub placement | After PS2.9, 44 of 1,600 fuzzed baths are left empty because neither the stage's candidates nor the lint's placement search finds a tub or shower position, where the previous main wrote a WC and basin. Measure what those rooms have in common (size, door and window positions) and extend the candidate set (a shower in the corner the door does not swing into; a tub along the long wall with the door at its foot) before anyone concludes the rooms are too small | todo |
| PS2.21 | Enclosure budget follow-ups | From PR #204's final red-team: (1) the point-test charge assumes every curve crosses every other (`piecesBound ≈ 2c²` × ring vertices), so a plain round room drawn with ≥ 300 vertices is refused on `point-tests` although it crosses nothing; count only curve pairs whose boxes meet so finely drawn curved rooms stay measured (corpus max today is 56 vertices, aquarium's concourse). (2) The slowest admitted shape, a 50-partition × 30-tooth comb room, lints in ~1.6 s vs 0.44 s on main: bounded, not a hang, but twice the figure the PR body quotes. (3) `W_BOUNDARY_NO_WALL` sits outside the `FaceBudget` (ring × ring per room pair plus runs × wall segments), the same class as the ring-pair analyses `describe()` already pays; two interlocking 2000-tooth combs go 23 s → 35 s. Give it a count bound beside the existing ring-pair cost | todo |

### PS3 · Relation-first authoring (D1 + D5; needs an ADR)

**PS3.1 · ADR: rooms may be primary; walls and openings may be derived from room relations.** `todo`
- Settle: grammar; datum names (`north/south/east/west` plus aliases, `cx/cy`, `axis n`);
  refusal codes (`E_WALL_BETWEEN_NOT_ADJACENT`, `E_WALL_BETWEEN_AMBIGUOUS`, polygon/circle rooms
  refused like relational placement); `place`-frame semantics; grid snapping; how `around` treats
  holes and multiple components (refuse).
- D5's whole-tiling form: its grammar, its exception clauses (`open between A and B` at least;
  decide whether a per-edge thickness or a `bearing` line is worth a clause), its refusal codes
  (`E_ROOMS_OVERLAP`, `E_ROOMS_NOT_TILING` for a hole or a second component, non-rectilinear room,
  unsnapped edge), and how a hand-written wall coexists with the derived set (proposal: a derived
  partition that coincides with an authored wall is dropped, an authored wall elsewhere is kept;
  pin both by test).
- Design input: `research/associativity.md` §4 P1/P6/P7; `research/2026-10-18-room-tiling.md`.

**PS3.0 · `walls from rooms` (D5).** `todo` (after PS3.1 and PS3.2; may land before or with PS3.3)
- Closed-form: rectilinear union outline for the exterior ring; every shared edge run of two rooms
  becomes one partition segment unless an `open between` clause names the pair. Steps charged per
  room pair and per sweep before allocating.
- Derived walls carry ids an opening can host on (`partition between A and B` as the hint name;
  settle the scheme in PS3.1 so `door between A and B` and `on <wall>` both work).
- Acceptance: the defect-corpus cases of class 2 (space not enclosed/assigned) are unwritable in
  this form (a test tries each and gets the refusal or a wall); the widening drill moves every wall
  and door with the room; byte identity for plans not using the form.

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

**PS3.7 · Furniture relations: `facing <id>`, `against <wall|room.edge>`, `clear front|sides <mm>`.**
`todo` (after PS3.2; needs an ADR 0017 amendment)
- Declared by the author, derived in closed form, reported as facts, checked by lint, never solved.
  `facing` takes the quarter-turn whose front ray first enters the target rectangle; no hit or a
  tie is refused. `facing` excludes `rotate`/`against wall` on the same piece. `clear front|sides`
  are opt-in declarations measured against solid pieces, wall faces and swings; never a catalogue
  default (a 550 mm wardrobe default once warned on `examples/garden-loft.arch`, so PS2.11's
  "front of a wardrobe ≥ 600" becomes a declaration or profile value, re-measured first).
- Facts appear in `describe()` only when declared (byte identity). Output set is D4 turns only, so
  no glyph gains handedness; add a mirror-equivariance test.
- Design: `research/2026-10-18-furniture-and-multistorey.md` §A.4.
- *Priority raised 2026-10-18:* the first-contact audit found 0 `rotate` clauses in six plans, 27 of
  51 chairs at a table facing away, 3 of 3 sofas missing their TV and a reception desk facing away
  from the door. Pair the form with an undeclared check in PS2.11: a seat whose front ray misses
  every table or desk within 600 mm. `facing` also refuses a transposed footprint.

**PS3.8 · Building-relative swing and offset wording.** `todo` (spec + grammar)
- `swing in|out` and `at <pos>` are relative to the wall's drawn direction; an author who drew a
  wall right-to-left put a fire exit's `swing out` opening inward and a living window in the
  laundry (`audits/2026-10-18-first-contact.md` K1 and the v1 apartment). Add `swing inward|outward`
  (relative to the building: towards or away from the room floor on the host) and define `in`/`out`
  in `spec.llm.md` with a one-line example. PS3.4's `from <room.edge>` offsets fix the `at` half.
- A plain lint for an exterior door on a public building whose leaf swings into the floor belongs
  to PS2.16's non-residential profile, not here.

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
- Add a gross-internal-area fact beside the centreline area (`describe().totals`), because every
  first-contact brief was "met" on centrelines and the finished floor came out 6–10 % under the
  brief (`audits/2026-10-18-first-contact.md` A12, H8, S7). The brief binds to the fact the client
  means.

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
| 1 | PS0.1, PS0.7, PS1.1 | Done 2026-10-18: PS0.7 in PR #197 (ad58551, dfd1737), PS1.1 in PR #195 (df00ab5), PS0.1 in PR #196 (1e0c2d9, e81a136; also closed backlog C.4). Corpus catch rate 7/53 |
| 2 | PS2.1–PS2.9, PS2.13 | Defect-corpus catch rate ≥ 90 % for classes 1, 2, 3, 4 and 6, with no false positive on the clean twins; every corpus `lint()` movement is explained (two-bed is expected to start warning: fix the example, see PS3.6). *Corrected 2026-10-19:* class 5 (clearances) belongs to PS2.11 in row 5, so it was removed from this row's acceptance. *Status:* wave 1 landed 2026-10-19 (PRs #199, #201, #200): classes 1, 3, 6 at 100 %, class 4 at 3/4 (PS2.17), class 2 at 1/6 waiting on PS2.4; overall 33/53 on `main@cc165f4`. Wave 2 landed 2026-10-19 (PRs #203, #204; PS0.10–PS0.12 in PR #211): classes 1, 2, 3, 6 at 100 %, class 4 at 4/5 (80 %, below the bar until PS2.17 lands); overall 43/67 on `main@600eaaf`. Wave 3 is PS2.17–PS2.19, PS0.13, PS0.14, then PS3.1 (ADR with D5) and PS3.6 |
| 3 | PS3.1, PS3.2, PS3.0, PS3.3, PS3.4 | ADR merged; byte-identity law green; `relational.arch` lints clean with walls derived; the 500 mm widening drill moves walls and doors with the room; the class-2 corpus cases are unwritable in the D5 form |
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
   counts on the PS1 corpus. Do not run or cite the paid eval. *Scheduled:* it needs the PS3 forms
   to exist, so it runs after row 3 of §7. Until then the first-contact experiment under question 8
   measures the wall-first baseline (`audits/2026-10-18-first-contact.md`, once written).
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
   ArchLang lacks. *Researched 2026-10-18* (`research/2026-10-18-furniture-and-multistorey.md`
   Part B): became cards PS2.14–PS2.16. Still open: wet-stack rules need a riser fact and no
   authoritative spacing number was found; several clause texts were read only from secondary
   sources (the file's verification log says which) and must be read in the standard before a
   number ships in a message (D3).
7. **Furniture semantics.** Facing targets (a TV faces the sofa or bed, a bed head is against a wall,
   dining chairs face the table) as relations rather than rotations (ADAI's semantic reconstruction,
   `research/adai-sketchup.md` idea 7). *Researched 2026-10-18* (same file, Part A): became card
   PS3.7. Still open: no evidence on how often agents get a furniture turn wrong; the first-contact
   audit should count it.
8. **Anything the audits missed.** Run a fresh audit on new plans after PS2 lands. The defect classes
   in §1 came from about 30 plans and are surely incomplete. *First round done 2026-10-18*
   (`audits/2026-10-18-first-contact.md`): six briefs written cold by an AI author from
   `spec.llm.md` alone, all six lint-clean and strict-clean, carry 57 verified defects (4 blockers),
   lint caught none, and 26 fall outside the eight classes. Twelve new classes are listed there;
   the ones that became cards: furniture not facing its companion (PS3.7), transposed footprints and
   door–door interference (PS2.11), entrance masking (PS0.10), direction-relative wording (PS3.8),
   area basis (PS4.4), non-residential egress and zoning (PS2.16), repair pressure (PS0.11 and the
   order "land PS2.1 before more corner fixes are suggested"). Still uncarded: context modelled
   inside the plan (a common corridor as paving; PS2.14's dwelling work should give it a home),
   vertical stacking of partitions, oblique joins inflating `bbox_outer`, circulation share (taste).
   Re-run after PS2 lands, and count the furniture turn.

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
- `research/2026-10-18-room-tiling.md`: do rooms already tile the building? (the D5 premise).
- `research/2026-10-18-furniture-and-multistorey.md`: furniture relations in Holodeck, Infinigen,
  LayoutVLM, IFC, Revit and Sweet Home 3D, plus twelve multi-storey/multi-dwelling rules with clause
  numbers and a fact-sufficiency table (cards PS3.7, PS2.14–PS2.16).
- `audits/archcanvas-public-examples.md`, `audits/showcase-and-examples.md`: per-plan defects with
  coordinates.
- `audits/2026-10-18-first-contact.md` and `audits/first-contact-plans/*.arch`: six briefs written
  cold by an AI author, lint-clean, 57 verified defects, twelve classes outside the taxonomy.
- `repro/`: minimal reproductions (see its README).
