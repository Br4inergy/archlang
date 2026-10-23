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
  `arch lint` returns `[]`. *(PS3.6, PR #227: re-laid with every room off the corridor, in the room-graph form.)*
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
- *Measured* (2026-10-21, measured by PR #222, `scripts/probe-rooms-tiling.ts`): the four
  clause-free preconditions of ADR 0028 §3 were decided exactly, per storey and per group, over
  every directory of `.arch` plans except the agent gallery, which stays out of every pinned corpus.
  The 4 `test/resolve-order` plans that diagnose on purpose are skipped and listed.
  - (a) with no exclusions: 15 of 279 storeys refused (5.4 %).
  - (b) with the reviewed except list: also 15 of 279. So (b) is under the quarter.
  - All 15 refusals are `E_ROOM_NOT_RECTANGLE`. No decidable storey overlaps, fails to tile or has
    a run under the partition.
  - 13 of the 15 are undecided on tiling, because a non-rectilinear polygon or a circle room covers
    no cell of the grid exactly. The other 2 (`courtyard-house`, `hillside-villa` level 2) are
    rectilinear polygons that otherwise tile.
  - Except list: 70 of the corpus's 71 no-use rooms are enclosed floor, so "no use kind means
    outdoor" was applied per plan, not automatically. The list holds one room, the
    `hillside-villa` level 1 terrace. It changes no share, because that storey is refused for
    `r_office` anyway.
  - Literal reading (all 71 no-use rooms excepted): 16 of 279 refused (5.7 %): 15
    `E_ROOM_NOT_RECTANGLE` and 1 `E_ROOMS_NOT_TILING`. D5 holds under either reading.
  - Outside the headline, the first-contact plans refuse 4 of 7 storeys, all on a polygon room.
    Three of the four are rectilinear L-shapes that otherwise tile (§8 question 4).

**D6. The default profile keeps the dwelling-reading rules on; a plan opts out by reading as
non-residential, not by choosing a profile.** (2026-10-20, amends PS2.18's card; does not touch D3.)
- PS2.18 as filed would have moved PS2.8's kitchen daylight arm, PS2.6 (`W_WET_ROOM_DOOR`) and
  PS2.7 (`W_ENTRANCE_INTO_PRIVATE`) into the residential profiles and had the default profile file
  a coverage skip. The default profile is the one a first-contact agent runs on a house, so that
  would have silenced the three rules exactly where the audit found their defects
  (`evidence.md`: the hall→bath→bedroom chain, the kitchen with no window). Instead the plan is
  read as a *dwelling* unless it carries positive non-residential evidence: a room with use `office`
  and no room with use `bedroom` or `living` (the living clause was added when an inline test
  fixture, Living + Office + Hall + Bath, would otherwise have read as an office), or a label from a
  short non-residential word list, measured against every corpus label before it shipped: café,
  restaurant, clinic, consulting, servery, classroom and staff room read non-residential outright;
  the ambiguous words lobby, reception, waiting, shop and meeting do so only when the plan has no
  bedroom and no living room (review round 1 showed "Reception room", a UK sitting room, and
  "Entrance Lobby" turning a house into an office; "reception room" now classifies as living through
  the PS2.19 fallback, a bare "Reception" stays ambiguous). A non-residential plan files
  the typed skip `non-dwelling` for those arms; `residential-basic` asserts a dwelling and runs them
  unconditionally. `describe()` never learns the reading; no `UseKind` is added. *Refined the same
  day:* `W_WET_ROOM_DOOR`'s kitchen arm (a bath or WC door onto a kitchen, or onto the fixture zone
  of a kitchen+living room) stays on under every reading, because a WC opening onto a food-handling
  area is a defect in any building; only its dining, living and leaf-less-opening arms decline. The
  corpus case `wc-off-dining` (from 4-cafe) is re-cast as a dwelling and a café twin `wc-off-servery`
  pins the arm that stays.
- *Why:* the two first-contact plans the card cites (4-cafe, 6-clinic) both carry that evidence, and
  no residential example or eval golden does; the heuristic is therefore decided by measurement, and
  the acceptance for PS2.18 is that no residential corpus row loses a warning.
- *Reverse if:* PS2.14's dwelling declaration lands (the declaration then decides and the word list
  is retired), or the word list misreads a residential plan in the corpus or the fuzz, or a third
  rule needs the reading (then it belongs in a declaration, not a heuristic).

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

Landed: PS0.1 (`between` from wall-face probes at centre and jambs, additive `straddles`; PR #196),
PS0.7 (the label classifier emits `living`/`dining`; a living alias yields to any other kind
but dining; PR #197), and in PR #211: PS0.11 (`W_ROOM_TOO_SMALL` reads the room's use: WC 1.1 m²,
bath 2.0 m², store/utility/hall/circulation/entry exempt, knob `minRoomAreaByUseM2` merged per use;
a profile that sets the generic floor, `accessibility-advisory`'s 5 m², holds every room to it, since
no researched accessible per-use table exists yet), PS0.12 (a window on an arc edge is attributed
from the shape: face probes, else through the arc's chord; PS2.8's `arc-window-unattributed` skip
kept only where that fails) and PS0.10 (`describe().access.mainEntrance` and
`depthFromMainEntrance`; width never decides: no door into a bedroom, bath or WC is a candidate,
and the basis is `entry-room` (the one door into an entry, hall or circulation room, only when every
other door opens into a service room), `street` (the one hinged door facing `site.street`) or `sole`;
the fact refuses with `tie`, `no-candidate` or `upper-storey` (a storey a shaft arrives on, PS0.3's
question), declared to the coverage report as `no-main-entrance`. `W_PATH_TOO_NARROW`,
`W_ROOM_VIA_PRIVATE` and `W_WET_ROOM_DOOR` judge a route from the main entrance; garage doors and
doors into rooms it cannot reach from inside stay ways in; a room with its own door from outside is
judged by that door, and reported in its own words when the main entrance cannot reach it).

Landed 2026-10-20 in PR #214 (… aac48b2; one red-team round, no blocker): PS0.13 (the occupancy
grid seeds a doorway that sits exactly on a cell line from both cells, so `W_ROOM_NO_CLEAR_PATH`
reads the same under every D4 placement; corpus `lint()` byte-identical over 272 files) and PS0.14
(`describe()`'s net-area walk is charged to a count, `MAX_NET_PROBE_WORK` = 20,000,000, before it
runs; a room past it omits `net_area_m2` as ADR 0027's third named case, and the 125 × 300 comb
that took 52–97 s now returns in milliseconds). The red team measured that the cap is per room:
200 distinct comb rooms each just under it still cost `describe()` 172.6 s, three times faster than
before but unbounded per plan, since `describe()` draws nothing and so never meets the drawing
budget (ADR 0022 §4). That is PS0.15.

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.2 | `compile -f json` (Plan JSON) drops arc segments; a round trip loses a bay and floats its window (`audits/archcanvas-public-examples.md` G2) | todo |
| PS0.3 | Multi-storey `describe`: upper-storey rooms report `reachable:false` though a stair reaches them; an exterior door on an upper storey counts as an entrance (`audits/showcase-and-examples.md` §5.10) | todo |
| PS0.4 | `diffPlans` reports a pure move as "resized +0.0 m²", ignores an opening whose `between` changed, and has no wall section (`research/associativity.md` §1.2). Extend additively | todo |
| PS0.5 | `furniture … against wall … in <relational room>` fails with `E_FURN_AGAINST` because relational placement resolves after furniture (`src/ir.ts` ~2488). May fall out of PS3.2's reorder. *As built (PR #220):* relational rooms are now placed before every reader, so the readers (furniture side inference and `in <room>`, a door's `swing into`, a garage door's floor probe, lint's fixture paste) read `_unplaced` instead of `_rel`: a placed relational room works and draws byte for byte as its absolute twin, and a room that could not be placed, including an instance's room read from the root, is refused naming its placement error | done |
| PS0.6 | `suggest` connects an unreachable room to *any* reachable neighbour, a bedroom included (`src/suggest.ts` ~364-395), against `skills/archlang/SKILL.md`'s own advice. Rank by neighbour use (hall/circulation/living first, bedroom and bath last) | todo |
| PS0.8 | `W_PATH_TOO_NARROW` measures pinches on the 100 mm grid and missed a 500 mm diagonal between a bench and a jamb (`repro/gallery-bench-pinch.arch`, `audits/archcanvas-public-examples.md` GW3). Re-measure the case first: the repro lints with the warning in isolation | todo |
| PS0.9 | `describe` assigns a window between an enclosed room and a covered loggia to the loggia, so lint and describe disagree on bedroom windows (`audits/showcase-and-examples.md` villa-rotonda) | todo |
| PS0.13 | `W_ROOM_NO_CLEAR_PATH` is not equivariant under mirror x. Found 2026-10-19 by `test/equivariance-fuzz.test.ts` (unseeded) on a PR unrelated to circulation and reproduced on `main@6b6a42c`: a 2 × 2 m room with a 700 mm door at 5 % and two WCs at (0,51) 400×300 and (357,0) 300×300 raises the code only when placed with `mirror x`. The fuzz test fails whenever its random draw hits the class, so any PR's CI can go red on it. Either fix the walk (`src/lint/rules/circulation.ts`) or pin the class in the oracle with its witness; the plan is in the owner's scratch note (`plan-soundness-impl/fuzz-mx/`) until fixed. *As built (PR #214):* the walk was right; the seed was wrong. A doorway centre on a cell line was seeded into one cell chosen by the sign of the coordinate, so `mirror x` moved the seed. Both cells are seeded now (`src/analyze/occupancy.ts`). The witness is pinned in `test/d4-oracle.ts`; the red team's aimed fuzz (3 seeds, 2,200 cases) found 0 non-equivariant cases on the branch against 7 of 600 on main. A doorway authored 1e-6 mm off a line still reads differently under D4 (any absolute tolerance has that edge; the nav grid snaps exactly), noted, not fixed | done |
| PS0.14 | `describe()`'s net-area integral is super-linear on a room polygon with hundreds of vertices whose edges cross hundreds of free-standing walls: 52–97 s on `main@90ae6bf` for a 125-partition × 300-tooth comb room (the inside test walks every ring vertex per boundary piece, pieces ≈ 4·S·T). No shipped plan is near it (corpus max 56 vertices), but `compile()` is bounded by law and `describe()` runs in the playground thread. Charge pieces × ring vertices to a count before the integral, or bin the ring for the inside test; PS2.4's `FaceBudget` already refuses the lint side (PR #204 round 3). *As built (PR #214):* `MAX_NET_PROBE_WORK` (20,000,000) is charged after the split and before the walk as 2 × pieces × (nearby band boxes and edges + the fullest y-band of the ring); the inside test bins the ring by y. A room past it omits `net_area_m2` (ADR 0027, third case, `too-much-work`); no shipped room is charged more than 175,000. Per room only; the per-plan total is PS0.15 | done |
| PS0.15 | `describe()`'s net-area work has a cap per room but no total per plan. Measured by PR #214's red team on `aac48b2`: 200 distinct 45-wall × 60-tooth comb rooms, each under `MAX_NET_PROBE_WORK`, cost `describe()` 172.6 s (50 rooms 19.7 s; main 60.3 s for the same 50). `compile()` meets the drawing budget only when a schedule is drawn; `describe()` draws nothing (ADR 0022 §4), so the step budget is its only bound and the playground thread is still exposed. Add a per-call total (a count, charged before each room's walk; rooms past it omit the figure for the same reason) or make the per-room charge count against one plan-level meter. No shipped plan is near it | todo |
| PS0.16 | `set` value parsing: `parseSetValue` reads a bare identifier before `,`/`)` as a word (like `swing: out`), so `set door(width: W)` and `set door(width: hall.cx)` silently become the string "W"/"hall.cx" and have no effect, with no diagnostic (predates PR #221, found in its review; a door's explicit `width` overrides `set`, so the effect was never visible). Decide: a bound name or a dotted datum name as a `set` value is an expression; a bare word stays a word only for word-valued keys. Also: `set door(swing: inward\|outward)` is silently ignored like any unknown enum word there (PS3.8); fix it with this card | todo |
| PS0.20 | Plan JSON: a door carrying both `swing` and `swing_building` that contradict each other (e.g. `swing: "out"` with `swing_building: "outward"` where outward resolves to `in`) is accepted silently; `swing_building` wins on input and the `swing` value is never read (found in PR #229's review). Consider a warning on import, or document `swing` as informational there | todo |
| PS0.17 | `describe` keys: `outdoor` and `fences` are missing from `PER_STOREY_OPTIONAL_KEYS` (`src/describe.ts`), so `describe --level N` can leave another storey's surfaces standing, and from `DESCRIBE_KEYS` (`src/cli/commands-analyze.ts`), so `--select outdoor` is refused (found in PR #223, which added `derived_walls` to both; not fixed there) | todo |
| PS0.18 | Plan JSON round trip turns a label-only "Hall" into `uses entry`: the room classifies `uses hall`, `room_type` `Entrance`, and the projection maps `Entrance` back to `entry` (`src/plan-json.ts`), so the compiled-back plan's `describe()` differs. Found in PR #227, where `examples/relational.arch`'s new hall authors `uses hall` to round-trip. Decide the honest mapping (carry the classified `uses`, or map `Entrance` to the use that produced it) | todo |
| PS0.19 | A window's `facing` fact is not equivariant under a pure translation. Found on 2026-10-23 by `test/equivariance-fuzz.test.ts` on PR #230's Windows CI leg. The seed is random per run: fast-check `{ seed: 1736625303, path: "29:2:2:2:10:10:10:10:10:10:11:11:20:20:20:20:20:20:20:20:20:20:20:20" }`, shrunk 23 times, `g = t`. It reproduces locally, and also on an archived `main@0d2dbc04` tree, so it is not caused by PR #230; it also reproduces off CI, so it is not CI-specific. The shrunk plan is a 6 × 6 m shell (100) with partitions (80) at x 2000 and 4000 and at y 3300, six rooms in a 3 × 2 grid, and `window id=o0 on w_v1 at 55% width 600`, placed `at (20000,20000)`. `windows[g.o0].facing` is `E` on P₀ and `S` translated. Likely cause (not yet proven): `55%` of the 6000 run resolves to y = 0.55 × 6000 = 3300.0000000000005. That is an ulp off the room corner at (2000,3300), so P₀ has no tie and reads `E`. Translated by 20000, the position rounds to exactly 23300, so it lands on the corner, the `facing-tie` convention (N/S before E/W) applies, and it reads `S`. `facing-tie` covers only axis-swapping elements, and `float-translation` covers only lint, so neither class absorbs this case. Fix, as its own PR after #230: resolve `at <pct>%` exactly as `len * pct / 100` (3300 here), and pin this shrunk plan in the fuzz suite's list of known witnesses, so it runs on every CI job | todo |

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
earlier PRs); `examples/two-bed.arch` is left warning (3 × `W_ROOM_VIA_PRIVATE`) for PS3.6 (fixed there, PR #227). The
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

Landed 2026-10-20 (wave 3): PS2.19 and PS2.17 in PR #216 (ef7dc46 … acc619f; six review rounds, the last three on the quoted-hint verification, after which the owner capped the loop at two rounds per PR); PS2.18 in PR #217 (d35dabb … 2483e16, D6; two rounds). Corpus catch rate on `main@06c6b56`: 46/68 (openings 16/16, space 6/6, circulation 11/11, defining 5/5, daylight 4/4; clearances 4/17, stair 0/4, annotation 0/5 untouched; the +1 case is the café pair `wc-off-servery`). Lint moved only where the rows say: eleven examples, the gallery two-bed and the overview fence gained a `counter` (PS2.17); the two café plans and four eval office goldens lost their dwelling-only warnings (PS2.18, `lintWarnings` 4→3, 2→1, 7→6, 7→6 in `eval/judge-fixture.json`); `coverage.unclassifiedRooms` shrank on 37 plans (PS2.19). No digest was re-pinned except `two-bed-min-area.laundered` (e621f33b→f34b4450, the corner counter now quoted with `rotate 180`). PS0.13 and PS0.14 are PR #214 (see PS0).

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.1 | `W_OPENING_AT_JUNCTION` | For every opening kind (door, window, cased opening): another wall's body intersects the opening's clear span on the host run, or either jamb's nib to a meeting wall face is under max(`minJunctionNibMm` 100 mm, host thickness × `junctionNibThicknessRatio` 0.5), measured at the face, configurable by profile. *As built (PR #201):* a new rule beside `W_DOOR_NEAR_CORNER`, which keeps its output byte-for-byte; the corner check runs for doors only where that rule is silent; a cased opening flush with a meeting wall is exempt. *Known gap:* two collinear walls meeting end to end never pair, so an opening across their joint is not reported | done |
| PS2.2 | `W_OPENING_OVERLAP` | Two openings on one host run whose along-run spans intersect, or whose separating pier is thinner than a mullion (`minMullionMm` 100). *As built (PR #201):* the two leaves of a double door are exempt and move as a pair under `fix`. *Known gap:* the check is per pair of openings on a host, quadratic in openings per wall; fine at corpus sizes, revisit if a wall ever carries hundreds | done |
| PS2.3 | `W_CONNECTOR_AMBIGUOUS` | An access edge with `ambiguous: true`, or one whose clear span covers more than one room on a face (`describe()` reports this as the additive `straddles` list since PS0.1 landed; the edge stays in the graph with a measured `between`). The message names the rooms on each side. *As built (PR #201):* a straddled room counts only when the clear span covers ≥ `minStraddleCoverMm` (100) of it, net of the meeting wall's body, so a 1 mm overrun is not reported | done |
| PS2.4 | `W_BOUNDARY_NO_WALL` | Two rooms share an edge run longer than a doorway with no wall or opening on it, unless both rooms' authored `uses` form an open-plan pair (kitchen/dining/living) or a fixed counter stands in the gap (a café servery is a deliberate boundary, `audits/2026-10-18-first-contact.md` C-plan). Plus its dual: a walled face with no room covering ≥ 95 % (unassigned floor), and rooms outside the closed exterior ring (`W_ROOM_OUTSIDE_SHELL`). Generalises `largestPerimeterGap` beyond wet rooms. After it lands, a test pins that circulation-reachable implies access-reachable. *As built (PR #204):* three codes. `W_BOUNDARY_NO_WALL` (`maxBoundaryGapMm` 900): collinear runs merged before the gap is taken; a wall counts as cover by its body (± half thickness + 50 mm), a perpendicular wall body crossing the line splits the run; a counter counts only where it straddles the line and closes the stretch only if what it leaves open totals ≤ a doorway (wall stubs are judged by the largest contiguous stretch, decided). `W_FLOOR_UNASSIGNED` (95 % cover, ≥ 0.5 m²): closed faces from the joined wall bodies with a loop nesting tree; a sealed face (no door, no window, no bordering room) is not reported (library's drum spandrels). `W_ROOM_OUTSIDE_SHELL` (0.1 m²): judged only when ≥ 50 % of the room's floor lies inside walled faces, otherwise silent (ADR 0005). All face work is charged to a `FaceBudget` before it runs (wall contacts 1600, faces 400, loops per grid cell 64, Σ face curves 20 000, face × room pairs 10 000, point tests 2e8); a refused storey files the coverage skip `enclosure-budget` naming the cap. No corpus storey is refused (max 31 faces, 64 contacts). "Circulation-reachable implies access-reachable" does not hold yet on three plans (relational's open-plan join, two `W_BOUNDARY_NO_WALL` cases); pinned as known counterexamples. `bath-open-side` raises both `W_ROOM_NOT_ENCLOSED` and this code (decided: different facts). Follow-ups: PS2.21 | done |
| PS2.5 | `W_ROOM_VIA_PRIVATE` | Remove a bedroom or bath/WC from the access graph: does any other room (not its own ensuite, wardrobe, storage or balcony) become unreachable? Generalises `W_BATH_VIA_BEDROOM` (keep that code; this is the general case). ResPlan: 0.03–0.06 % of real dwellings do this, so a warning is safe. *As built (PR #199):* seeded from every door to the ground but balcony doors, so a patio door could still mask the route; seeded from the main entrance only since PS0.10 (PR #211), with garage doors and doors into rooms the main entrance cannot reach from inside kept as ways in, and a room with its own door to the ground never reported; a stair landing inside a bedroom is not a cut point; one warning per cut room, not one per room behind it. *Known gap:* a room reachable through either of two parallel private rooms (bedroom A or bedroom B, never a public route) is not reported, because removing one leaves the other | done |
| PS2.6 | `W_WET_ROOM_DOOR` | A bath/WC whose only connector is a leaf-less opening to a habitable room; a bath/WC door onto a kitchen or dining room (GB 50096 5.4.3); a bath with two or more connectors acting as a passage (the PS2.5 test covers part of this). *Revised in PR #203 (decided 2026-10-19):* a bath door onto a room that is a kitchen AND the living room counts only where the door really opens onto the kitchen zone: a kitchen fixture (sink, hob, oven, fridge, worktop, island, dishwasher; not a microwave) nearer than `wetDoorKitchenProximityMm` (1500, GB 50096 5.3.5's single-row kitchen width) from the doorway's room-side face, compared in whole mm. Such a room with no kitchen fixture files the coverage skip `no-kitchen-fixtures`. A kitchen alone, a dining room alone and a kitchen+dining room (no living) warn unconditionally as before; living or dining without kitchen stays exempt (taste layer). The earlier blanket exemption of any kitchen that was also living/dining went beyond the clause; a use-flag narrowing was tried first and made five eval goldens and laneway-house warn (door 2.7–4.6 m from the kitchen), which is what the proximity test fixes. The GB 50096-2011 5.4.3 wording is unverified online; `research/design-taste.md` and `research/prior-art.md` read it differently Since PS2.18 the dining, leaf-less and passage arms decline on a plan that reads as non-residential; the kitchen arm does not | done (PR #199, #203) |
| PS2.7 | `W_ENTRANCE_INTO_PRIVATE` | The exterior door's room is a bedroom or bath (ResPlan: never). Kitchen entry is advice-level under profiles only. `examples/garden-house.arch` moved its garage door to swing into the kitchen so the rule reports nothing there. Since PS2.18 it declines on a plan that reads as non-residential (it never fired on one) | done (PR #199) |
| PS2.8 | `W_HABITABLE_NO_WINDOW` | Extend the bedroom rule to living, dining and kitchen (needs PS0.7). *As built (PR #200):* a room with a window whose host is an arc segment is skipped, not judged, until PS0.12 attributes it (`hillside-villa`'s bay was glazed and dimensioned instead). *Resolved by PS2.18:* the kitchen arm declines on a plan that reads as non-residential (an office kitchenette has no daylight duty), with a `non-dwelling` skip | done |
| PS2.9 | `W_ROOM_MISSING_DEFINING` | A furnished room missing its defining piece: bedroom without a bed, bath without a shower or tub, kitchen without a sink, hob or worktop. Reuse `FURNISH_TABLE`'s required marks, so the rule and furnish can never contradict (furnish's never-worse gate re-lints its own output). *Decided 2026-10-18:* the defining set is exactly the row's required marks (kitchen = sink + hob, and since PS2.17 a worktop); `finish` stays fill-only (M.22 unchanged). *As built (PR #200):* defining sets come from `FURNISH_TABLE`'s required marks via `src/lint/defining.ts` (table moved to `src/furnish-table.ts`); `W_ROOM_NO_FIXTURE`'s hint quotes the defining set. `furnish` judges each use on its finished pieces and tries the lint's own placement search before giving a use up; a use it cannot complete is left out whole, so `finish` never writes a use the rule would then report (fuzz counterexample pinned in `test/lint-room-contents.test.ts`). Fuzz against the previous main, 1,600 random plans: 34 baths gained a tub or shower, 44 baths that used to get a WC and basin are now left empty (PS2.20), kitchens unchanged. The worktop follow-up is PS2.17 | done |
| PS2.10 | `W_DIM_TEXT_MISMATCH` | A hand `dim … text "<number>"` whose number differs from the measured span beyond rounding. Non-numeric text is exempt | todo |
| PS2.11 | Clearance family | WC centreline to side obstacle (default 400, `us` 381, accessible 450–500); front of a wardrobe ≥ 600; hob-to-fridge gap; tall unit (fridge, wardrobe, bookcase) covering a window; a door swing over a stair footprint or its landing; a void at a stair's arrival; stair pitch versus storey height; `W_DOORWAY_BLOCKED` extended to leaf-less openings; a single hinged leaf over 1200 mm (and a double-leaf `door` kind, since authors fake one with two leaves that clash); door–door interference (an open leaf parked across another doorway's approach, which `W_SWING_OBSTRUCTED` does not compare); a transposed footprint on a directional piece (`size WxH` with the depth on the long axis instead of a `rotate`, drawn turned and stretched). Each is a separate code; split into cards as they start. Wardrobe front and bed sides are declarations or profile values, never defaults (PS3.7). Fresh instances: `audits/2026-10-18-first-contact.md` T1, T3, H2, C4, A1, K4. *As built (PR #228, with PS3.7):* the seat check `W_SEAT_FACING_AWAY` (a chair, office chair or outdoor chair within `seatTableReachMm` 600 of a table or desk in the same room whose front ray enters none of them within that reach; on by default, every profile inherits it; hint names the nearest table and `facing <id>`, no fix). First-contact plans: 51 seats at a table, 26 warn; the audit's 27th is café `chair_29`, south of its table and facing south, whose ray enters the next table 550 mm away. It found 17 chairs on 8 examples, all fixed in that PR. "Front of a wardrobe ≥ 600" is met by the `clear front` declaration: re-measured, a 600 default would warn on 3 of the 11 example wardrobes (`garden-loft` 100, `tiny-house` 300, `furnished-flat` 450 mm). The other bullets stay open | todo |
| PS2.12 | Annotation collisions | Auto-dimension text inside a room floor, over a symbol or over a label; title-block text wider than its row. Extend `W_DIM_INSIDE` to `dims auto`; drafting only, never `describe()` | todo |
| PS2.13 | Lint coverage report | `lint --json` gains an appended `coverage` block: rule families run, skipped (with why: no `uses`, no brief, no `site`, no multi-storey, no dwelling declared, no operable-window data) and unclassified rooms. Human output prints one line when something was skipped. Purely additive JSON. *As built (PR #203):* `lintWithCoverage()` runs the rules once and returns `{diagnostics, coverage}`; `lint()` is its `diagnostics`, byte-identical (812 hashes, 0 moved). Every rule declares a `family`; a rule declines through `ctx.skip(reason, room?)`, typed reasons in `src/lint/coverage.ts` (`no-uses`, `no-site`, `single-storey`, `arc-window-unattributed`, `non-rectangular-room`, `no-entrance`, `balcony-only-entrance`, `unsupported-host-geometry`, `no-kitchen-fixtures`, `enclosure-budget`, `no-main-entrance`, since PS2.18 `non-dwelling` and since PS2.17 `hint-budget`; reserved `no-brief`, `no-dwelling`, `no-operable-window-data`). `lint --json` appends `coverage` after `diagnostics`; the human line goes to stderr, never under `--quiet`, and `no-site` is filed only when a habitable room has a window (126 of 171 corpus files print a line, was 167). `describe()` reads none of it. *Open:* the MCP server and VS Code extension do not surface `coverage` yet (version bump); a degenerate nav grid is still a silent decline (TODO at the seam). `coverage.unclassifiedRooms` lists the rooms the vocabulary cannot read (PS2.19 narrowed the list) | done |
| PS2.14 | Dwelling declaration | A zone-level marker that groups rooms into a dwelling, `describe().dwellings`, common area, and the derived party wall (the ladder rung). Needs an ADR. Unblocks the across-dwellings rule (GB 50096 5.4.4 / GB 55038-2025 4.1.7: a WC over another household's bedroom, living, kitchen or dining) and the shared-corridor checks. Corrects `research/design-taste.md` R19's default of "one level = one dwelling": that fires inside a single house and misses flats, so R19 runs only where dwellings are declared and otherwise reports a coverage skip (`research/2026-10-18-furniture-and-multistorey.md` B1, B9, B12) | todo |
| PS2.15 | `W_SHAFT_FOOTPRINT_MISMATCH` | Same-id stair/lift runs on adjacent storeys whose footprints do not overlap. The facts exist already; ship with PS2.11's arrival-void check (`…multistorey.md` B4) | todo |
| PS2.16 | Egress necessary-condition checks | `uk-residential-advisory`: `W_INNER_ROOM` (ADB 2.11/2.12, 3.7/3.8: a habitable room whose only route to the exit passes through another room, with its exemptions). `us-residential-advisory`: bedroom escape-window failures provable from gross sizes (IRC R310: width < 508 mm, sill > 1118 mm, area < 0.33 m²); never a pass claim without an `openable` window fact (`…multistorey.md` B10–B11). A non-residential advisory profile for the same family: escape-door swing in the direction of travel and leaf type, exits on separate sides, public/staff zoning, accessible WC pan offset and basin reach (first-contact café and clinic, K1, K9, K10, C6, K8). Blocked on facts, not rules, and listed as such: wet-stack risers, fire ratings, protected-stair enclosure, sprinkler-dependent limits | todo |
| PS2.17 | Kitchen worktop | The corpus case `missing-defining-contents/kitchen-no-worktop` is still `todo` after PS2.9 because the defining set is the row's required marks and `counter` is optional. Decide between making `counter` a required kitchen mark (every furnished kitchen then gains or loses a counter: run the fuzz comparison of PS2.9 and explain the moved rows) and a profile rule `W_KITCHEN_NO_WORKTOP` that reads the same table (no furnish movement). Default to the profile rule unless the fuzz shows furnish already places a counter in nearly every kitchen. *Decided 2026-10-20:* the kitchen row requires a `counter` (or `worktop`), from the fuzz: the row had no counter item and 0 of 738 fuzzed kitchens got one, and a separate `W_KITCHEN_NO_WORKTOP` could not avoid moving `finish` (its never-worse gate counts every gained code). *As built (PR #216):* `finish` tries the worktop's 600 mm module beside the hob, then against any wall, then the 400 mm module beside the hob, then against any wall, and never moves the sink and stove; the lint hints' placement search tries the same two sizes (review round 1 caught it trying only 600); 21 of 738 fuzzed kitchens (2.85 %, all ≤ 1.95 m wide) are left out whole, never written without one; in 146 the counter takes the fridge's place and 30 living+kitchen rooms lose the living use whole. Eleven examples, the gallery two-bed and the overview fence gained a counter; the first-contact plans are left reporting it. *Review rounds 2–3:* a quoted set is re-linted with its pieces standing before it is quoted, against only the rules a pasted set was measured to move (`readsFurniture` on `fixture-back-to-room`, `wet-room-door` when the room is or opens onto a bath or WC, `path-too-narrow` only when a piece stands within the minimum walk width of a doorway, the wall across or another piece; `test/fixtures/hint-paste-gained-codes.json` pins the list), and a set that would gain a finding is not quoted; a 400 mm counter in a bottom corner is quoted with `rotate 180`. The re-lint is counted, never timed: `MAX_HINT_VERIFICATIONS` (64 passes) and `MAX_HINT_WALK_ROOMS` (128 rooms walked) per lint run, charged before the work; past either the hint says the placement was unverified and the run files one `hint-budget` coverage skip (corpus maximum 4 passes, 80 rooms; 50 empty kitchens lint at 2.1× main, was 147× before the gating). *Review round 4:* the walk gate also reads the obstacles the nav grid blocks on inside the room (wall stubs, stairs, lifts, voids, from the grid's own inputs), and `circuitous-path` is flagged too: on multi-room fuzz a quoted kitchen set closed the way through a room and sent the walk round (6 of 2,318 sets). Findings are compared by full message, so a set that worsens an existing squeeze or detour ratio is declined like one that creates it; no corpus row moved. *Review round 5 (last by the capped loop):* the gate measures the gap to another piece as a rectangle gap (edges in line or a corner touch count, touching is the narrowest), reads a corner pocket for any doorway opening into it, pads the gap to a piece or obstacle by one nav cell and every threshold by the grid's growth past 2500 m² (read from the grid's own cell functions), and tests the pass budget before any geometry. Residue accepted as nits: a pasted set that only changes an existing squeeze's door-attribution clause at the same width is not a gain; the hint's promise holds on the corpus and fuzz, with constructed geometry residue to be filed as cards, not rounds | done |
| PS2.18 | Profile scoping of dwelling-reading rules | PS2.8's kitchen arm, PS2.6 and PS2.7 assume a dwelling. An office kitchenette, a café kitchen or a clinic WC off a waiting room is not the defect those rules describe (first-contact café and clinic plans). Until PS2.14 declares dwellings, scope those arms to the residential advisory profiles and have the default profile report a PS2.13 skip ("no dwelling declared") rather than a warning. *Decided 2026-10-20 (D6):* the inverse: the default profile judges every plan as a dwelling unless it reads as non-residential. *As built (PR #217):* `dwellingReading` (`src/analyze/dwelling.ts`) marks a plan non-residential when it has an office use and no bedroom or living room, or a label carrying a café, shop, clinic, school or office word (`src/vocabulary.ts`); otherwise it is a dwelling. On a non-residential plan, under the default ruleset and `accessibility-advisory`, `W_HABITABLE_NO_WINDOW`'s kitchen arm, `W_WET_ROOM_DOOR`'s dining, leaf-less and passage arms and `W_ENTRANCE_INTO_PRIVATE` decline with a `non-dwelling` coverage skip; `W_WET_ROOM_DOOR`'s kitchen arm judges every plan (food hygiene). `residential-basic` sets `assumeDwelling` and judges every plan; the playground defaults to the default ruleset. Measured: 37 of 341 corpus plans read non-residential, none with a bedroom; lint moved only on the two café plans (the WC onto the seating) and four eval office goldens (a kitchenette's daylight); corpus case `wc-off-dining` re-cast as a dwelling, new café pair `wc-off-servery` pins the arm that stays (46/68). *Open:* the kitchen-arm message still cites GB 50096 5.4.3 on a café; a shop with a flat above reads non-residential as a whole and a hotel floor (guest rooms are bedrooms) reads as a dwelling; all wait on PS2.14 | done |
| PS2.19 | Vocabulary gaps | In the first-contact plans, labels `Wardrobe`, `Closet`, `Dressing`, `Nursery`, `Study`, `Store`, `Office` and `Balcony` classify to no use at all, so every use-reading rule is blind on them and PS2.5's exemption for a bedroom's own wardrobe or balcony cannot see the room it exempts. Extend `roomUses`/`classifyLabelUses` with those kinds (each a byte-identity re-measure with the swap-back proof, as PS0.7 was) and report unclassified rooms in PS2.13's coverage block. *Corrected 2026-10-20:* the premise does not hold as written; every first-contact room authors `uses`, so none was unclassified, and the listed words are furniture labels or not rooms there. *As built (PR #216):* a fallback vocabulary read only when the primary one leaves a label empty, so every label that classified before keeps its answer (pinned against the verbatim previous classifier): storage (store, closet, wardrobe, pantry, larder; aliases dressing, linen, cellar), office (office, study; consulting), utility (utility, laundry; plant, boiler), nursery → bedroom ("day nursery", a childcare room, stays unclassified) and water closet → WC; extended in PR #217 after a "Great room / Master / Study" house read as an office: great room, reception room, drawing room (and aliases snug, den) → living, read last and only when no other fallback word matched; guest room, kids room, children's room, master suite → bedroom, and the alias master unless the label also names a store, office or utility room. Balcony, terrace, studio, gallery, meeting and staff room stay unclassified and show in the coverage block. Two corpus rows moved in `describe()` only (furnished-flat's Utility, the eval office's Open Office, which `finish` now gives a desk); the 1 m² "Closet" catalogue example became "Nook" | done |
| PS2.20 | Furnish: shower and tub placement | After PS2.9, 44 of 1,600 fuzzed baths are left empty because neither the stage's candidates nor the lint's placement search finds a tub or shower position, where the previous main wrote a WC and basin. Measure what those rooms have in common (size, door and window positions) and extend the candidate set (a shower in the corner the door does not swing into; a tub along the long wall with the door at its foot) before anyone concludes the rooms are too small | todo |
| PS2.21 | Enclosure budget follow-ups | From PR #204's final red-team: (1) the point-test charge assumes every curve crosses every other (`piecesBound ≈ 2c²` × ring vertices), so a plain round room drawn with ≥ 300 vertices is refused on `point-tests` although it crosses nothing; count only curve pairs whose boxes meet so finely drawn curved rooms stay measured (corpus max today is 56 vertices, aquarium's concourse). (2) The slowest admitted shape, a 50-partition × 30-tooth comb room, lints in ~1.6 s vs 0.44 s on main: bounded, not a hang, but twice the figure the PR body quotes. (3) `W_BOUNDARY_NO_WALL` sits outside the `FaceBudget` (ring × ring per room pair plus runs × wall segments), the same class as the ring-pair analyses `describe()` already pays; two interlocking 2000-tooth combs go 23 s → 35 s. Give it a count bound beside the existing ring-pair cost | todo |
| PS2.22 | `W_ALIAS_MATCH` quotes a room id | For a room with no label the alias rule classifies the id and then writes it into the message ('Room "r_carport" reads as a garage only from the indirect term "carport"'), the one lint message that names an id; PS2.19's fallback words widen it (`r_plant`, `r_boiler`, `r_cellar`, `r_linen`, `r_nursery`; found by PR #216's red team). Word the unlabelled case without the id (the room's storey and position, or "an unlabelled room") and pin that no lint message over the corpus contains a room id | todo |
| PS2.23 | Authored wall beside a derived line | An authored wall 1 mm (any non-zero distance) off a `walls from rooms` derived line is kept beside the derived wall, not merged (ADR 0028 §3 coexistence): two parallel bands nearly on top of each other. Lint it: an authored straight wall parallel to a derived segment, overlapping it along its length, whose centreline is closer than half the thicker wall's thickness, almost always meant to lie on the line (found by PR #223's red team) | todo |
| PS2.24 | Wall meeting an open run mid-span | An authored wall perpendicular to a `walls from rooms` `open between` run, ending on it mid-span, is neither refused (it is not collinear, so not `E_WALL_BETWEEN_OPEN`) nor excused: today it only warns through `W_OPENING_AT_JUNCTION` (a wall standing inside the opening). Decide the rule: refuse it as `E_WALL_BETWEEN_OPEN`, or a lint finding with its own hint (give the opening a `width` that clears the wall, or move the wall). No code yet (found by PR #224's red team) | todo |
| PS2.25 | `W_DOOR_NEAR_CORNER` disagrees with the junction measure | `W_DOOR_NEAR_CORNER` measures from a different point than the junction measure `E_OPENING_NIB` and `W_OPENING_AT_JUNCTION` share (`src/opening-junctions.ts`), so a relational door placed at the nib hint's "nearest legal position" (650 from end on a 400 mm host meeting a thinner wall) still warns. Fix: measure the corner from the meeting wall's face, or have the nib hint skip candidates that would warn. No code yet (found by PR #225's red team) | todo |
| PS2.26 | `W_SWING_OBSTRUCTED` at exactly 0 mm short | Under `accessibility-advisory` the rule fires on `examples/two-bed.arch` with a swing that needs 1050 mm of clear radius and measures 1050 mm ("0 mm short", found by PR #227's red team). The boundary should be `<`, not `≤`: decide, fix, and explain the corpus movement in that PR | todo |
| PS2.27 | `W_FACING_BLOCKED` | A declared `facing` whose front ray crosses a wall body before it reaches its target (a TV facing a sofa through a partition). Walls only: a coffee table between a sofa and its TV is the arrangement. Deferred from PS3.7 (ADR 0029) | todo |
| PS2.28 | Undeclared sofa → TV check | A sofa or loveseat in a room with a `tv`/`tv_unit` whose front ray misses it (the audit's A3, H2, T3: 3 of 3 sofas). Out of PS3.7's scope, which judges only seats at tables; measure the corpus first, and decide what a sofa facing a view instead means | todo |

### PS3 · Relation-first authoring (D1 + D5; needs an ADR)

**PS3.1 · ADR: rooms may be primary; walls and openings may be derived from room relations.**
Drafted 2026-10-20 as `docs/adr/0028-rooms-primary-derived-walls.md` (status Proposed until the
first derived form lands with its byte-identity law). Settled there: datums are frame words
(`top|bottom|left|right`, `cx|cy`; compass aliases only on north-up plans, `E_DATUM_COMPASS`
otherwise, and only in the root frame); polygon/circle rooms expose no datum
(`E_ROOM_NOT_RECTANGLE`); snapping stays "snap the evaluated value" (ADR 0004); `walls from rooms`
has exactly three clauses (`open between A and B [width]` which always derives an opening,
`between A and B thickness t`, `except R …`), holes legal only under exact `outdoor`/`void` cover,
preconditions decided exactly with no tolerance row; derived walls have NO author-facing id and are
addressed by relation (`between A and B`, `on A.top`, PS3.5's `containing`, and PS3.7's
`against <room>.<edge>` pulled forward so furniture can back onto a derived partition); a canonical
direction rule for derived walls (inner courtyard rings run counter-clockwise so `swing in` keeps
its meaning); `open` spans the clear span between meeting wall faces; a `void` hole derives no wall; an authored wall exactly on a derived line wins over the shared span and the
drop is reported in `describe().derived_walls[]`; relational openings refuse a short nib
(`E_OPENING_NIB`, same measure as `W_OPENING_AT_JUNCTION`) instead of sliding and a door's position
is required; the resolve-order byte-identity sweep, diagnostics order included, is PS3.2's gate. The
original brief follows.
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

**PS3.0 · `walls from rooms` (D5).** `done` (parts A–C: PRs #222, #223, #224)
- Closed-form: rectilinear union outline for the exterior ring; every shared edge run of two rooms
  becomes one partition segment unless an `open between` clause names the pair. Steps charged per
  room pair and per sweep before allocating.
- Derived walls carry ids an opening can host on (`partition between A and B` as the hint name;
  settle the scheme in PS3.1 so `door between A and B` and `on <wall>` both work).
- Acceptance: the defect-corpus cases of class 2 (space not enclosed/assigned) are unwritable in
  this form (a test tries each and gets the refusal or a wall); the widening drill moves every wall
  and door with the room; byte identity for plans not using the form.
- *Probe (part A):* `scripts/probe-rooms-tiling.ts` with its reviewed list
  `scripts/probe-rooms-tiling.except.json` (PR #222) measures the four clause-free preconditions
  per storey and per group (root and each `place`d instance), on a cell grid charged to the step
  meter. It uses the group's most frequent `partition` thickness, or 100 mm when there is none.
  Result: (a) 15/279, (b) 15/279, all `E_ROOM_NOT_RECTANGLE` (13 of them undecided on tiling); the
  literal no-use reading gives 16/279. On the 264 passing storeys the form would derive at most 59
  partition runs (median 1) and 36 ring vertices (median 4), and 262 of them already have an
  authored wall collinear with a derived segment. The agent gallery is left out, because
  `test/agent-gallery.test.ts` keeps its plans outside every pinned corpus. `test/rooms-tiling-probe.test.ts` plants each
  refusal and pins the shares, the literal reading and the per-directory counts.
- *As built, part B (PR #223):* `walls from rooms exterior <t> partition <t> [{ except … }]` is one
  element (`src/elements/walls-from-rooms.ts`) over the pure derivation `src/room-tiling.ts`; a
  group holding it resolves rooms, the hole covers, the authored walls, then the statement, then
  the openings (`ElementDef.yieldsWalls`/`dependsOn`/`rewall`). Derived walls are `ir.walls`,
  never elements, carry `_derived`, and are named only by relation in every hint and fix
  (`src/wall-ref.ts`). `test/walls-from-rooms.test.ts` pins probe agreement (the 15 refusals,
  codes and rooms), the twins of `studio.arch`/`two-bed.arch` (SVG and lint byte-identical;
  the `describe()` differences listed in the PR), the widening drill and the class-2 corpus (5
  gain their walls, the round snug refuses); `test/walls-from-rooms-digests.test.ts` the digest
  table. Not yet: `open between` and `between … thickness` (they fail to parse by name), and the
  relational openings of PS3.4.
- *As built, part C (PR #224):* the two pair clauses. `between A and B thickness t` sets that
  partition's thickness. `open [id=] between A and B [width]` keeps the pair's partition derived
  as a host and derives a leaf-less opening across its clear span: the run less, at each end, half
  the thickest wall perpendicular to it through that end (with `width`, centred on that span).
  The opening is an ordinary `ROpening` that enters `ir.elements` after the statement
  (`ElementDef.yieldsElements`). Its id is `A|B:open` unless the clause gives one, it carries
  `_derived`, and its span is the clause's. Refusals, each on the clause:
  - `E_WALL_BETWEEN_NOT_ADJACENT`;
  - `E_WALL_BETWEEN_ROOM` (also polygon, circle or excepted rooms);
  - `E_WALL_BETWEEN_OPEN` (an authored wall on the run, or an authored door/window/opening hosted
    on it, through `ElementDef.auditGroup`);
  - `E_WALL_BETWEEN_WIDTH`;
  - `E_WALL_BETWEEN_DUP`.
  Plan JSON carries `walls_from_rooms.open[]`/`between[]`. The twins (a hand-placed opening, an
  authored partition taking over) are pinned in `test/walls-from-rooms-clauses.test.ts`, and the
  clause plans are pinned in the digest table. ADR 0028 is Accepted. Red-team round 1:
  - `W_OPENING_AT_JUNCTION` excuses a derived opening's jamb on the thickest meeting wall's face;
    the thinner wall's pier beside it is not a nib.
  - `E_WALL_BETWEEN_OPEN` for a position-hosted opening fires only on overlap with the voided
    span.

**PS3.2 · Resolve order and room-edge datums.** `done` (PRs #220, #221)
- Resolve rooms and relational placement before walls, then freeze a datum table.
- Ids are assigned before resolve, so the registry order can stay.
- Proof: the byte-identity sweep including `compile().diagnostics`.
- *As built, part A (PR #220):* `resolveGroup` (`src/ir.ts`) resolves each group (root or `place`d instance) as rooms, relational placement, a frozen datum table (`src/room-datums.ts`: each rectangular room's edges and centre, the root's axes; internal only, read through `datumTablesOf`), walls, then openings and the rest in registry order. Diagnostics are buffered per kind and flushed in registry order, then placement's, and the `axes` block's are held to their old step, so a resolution that completes reports exactly what it did. The table charges one step per room the group sees (descendants again in each ancestor) and per axis. `test/resolve-order-byte-identity.test.ts` pins a diagnosing corpus with `compile().diagnostics` and its order, measured on `main` before the reorder; the 470-row per-payload sweep moved nothing under the reorder commit; the PS0.5 commit and the `E_PLACE_REF` message moved 7 rows, listed in PR #220. A resolution stopped by `E_STEP_LIMIT` reports, deterministically, the diagnostics raised before the crossing in the new order, and that set may differ from the old walls-first pass (ADR 0028 §1).
- *As built, part B (PR #221):* a dotted name whose last segment is `top|bottom|left|right|cx|cy` (or a compass alias) is read from the group's frozen table by every statement after the rooms (`src/room-datums.ts` `tableReader`, installed by `resolveGroup` through `withDatumReader` in `src/expr.ts`); before the table (expansion, `let`, plan settings, the room pass) it is `E_DATUM_BEFORE_ROOMS`. Refusals: `E_DATUM_COMPASS`, `E_DATUM_NAME`, `E_ROOM_NOT_RECTANGLE`, `E_DATUM_UNPLACED`, `E_UNKNOWN_REF` for an unknown room. A read costs the one step of the name; the first read in a group under `place` also builds its instance-id set, one step per element. `test/room-edge-datums.test.ts` pins the swap-back law (datum plan == literal twin, every storey, diagnostics included) and a digest table; every existing digest suite is unchanged.

**PS3.3 · `wall … between A and B` and `wall … around [ids]`.** `done` (PR #226)
- Closed-form interval intersection and rectilinear union outline.
- Steps are charged per read and per sweep.
- *As built (PR #226), with these lead rulings:*
  - **Grammar.** `wall [id=] <category> thickness <t> [material …] [height <h>] between <A>
    and <B> | around [<A> …]`, written in place of the point body.
  - **Geometry.** It is the `walls from rooms` derivation, shared rather than copied:
    `src/room-tiling.ts` exports `sweepRooms` (non-rectangle, overlap, edge sweep) and
    `linkRings` (rings, pinch, components, holes), and adds `deriveBetween` and
    `deriveAround`. `between` runs from the run's smaller-y-then-x end. `around` is closed
    and clockwise from its smallest-y-then-x vertex.
  - **Rooms** are read from the group's frozen datum table (`ResolveCtx.datums`, through
    `src/wall-relation.ts`). Walls already resolve after the rooms (PS3.2 part A), so the
    resolve order is unchanged.
  - **Refusals**, each tested on its span:
    - `E_ROOMS_OVERLAP` (also a room listed twice, on the name);
    - `E_WALL_BETWEEN_NOT_ADJACENT` (also one room twice);
    - `E_ROOM_NOT_RECTANGLE`, `E_DATUM_UNPLACED` and `E_UNKNOWN_REF`, on the name;
    - `E_PARTITION_TOO_SHORT` (the run shorter than the wall's thickness);
    - `E_ROOMS_NOT_TILING`;
    - `E_WALL_BETWEEN_OPEN` (the #224 audit, unchanged: such a wall is an authored wall).
    The catalogue entries name the forms, each with an executed pairwise line.
  - **Holes.** `around` refuses every hole, even one exactly covered. One wall is one ring,
    so a courtyard needs `walls from rooms`. The covers also resolve after authored walls in a
    group without that statement, and honouring a `void` there would change the resolve
    order per node.
  - **A refused wall** has no points and joins no wall list. Its id is recorded
    (`ResolveCtx.unplacedWall`), so an opening `on` it, furniture `against wall` it or a
    `dim radius` of it says it "could not be placed (see its own error)"
    (`E_ATTACH_WALL_REF`, `E_FURN_AGAINST`, `E_DIM_CURVE_REF`; red team round 1). ADR 0028 §4
    and §6 carry dated amendments for the hole rule and the row shape.
  - **Afterwards** it is an ordinary authored wall. It keeps the author's id, category,
    thickness, material and height, and its hosting, lint, heights and coexistence are a
    typed wall's. It carries only `_relation`.
  - **Facts.** `describe()` gains `derived_walls[]` rows `{from: "between"|"around", name: <id>,
    between|around}` and `freedom.walls.relational`, both present only when such a wall
    exists. The rows follow source order with the statement's own rows.
  - **Plan JSON** exports the wall by its resolved points: the round trip keeps the geometry
    and drops the relation, as for an opening placed `at axis`.
  - **Bounds.** An `around` wall counts `4n` toward `MAX_ELEMENTS` at expansion
    (`ElementDef.expansionCharge`), and the sweep charges `n log n + 3n` before it runs.
  - **Proof.** `test/wall-between-around.test.ts` holds:
    - the twins: SVG and lint byte-identical, describe apart from the pairwise facts;
    - the twins beside `walls from rooms` (takeover with the drop reported);
    - a `door between` hosted on the wall;
    - all eight frames;
    - the widening drill.
    Every existing digest suite is unchanged, and `test/wall-between-around-digests.test.ts`
    pins the new rows.

**PS3.4 · `door|opening between A and B [at <pos>]`, `… on <room>.<edge>`.** `done` (PR #225)
- Resolve to the shared wall. Enforce the nib (refuse, do not slide).
- `window on <room>.<edge> [at …]` picks the exterior wall segment on that edge.
- Hosted offsets on existing forms: `on <wall> at 150 from end`, `on <wall> at 150 from <room>.<edge>`,
  `on <wall> at axis 3`.
- *Corrected 2026-10-22:* the title's `at <t>` is dropped. ADR 0028 §5's position words are the
  whole set: `center`, `<mm> from start|end|<room>.<edge>`, `axis <label>`. A plain `at <mm>`
  or `at <pct>%` on a relational form is refused (`E_OPENING_DATUM`).
- *As built (PR #225), with these lead rulings:*
  - **Grammar.** `door|opening … between <A> and <B> [at <pos>]` and `door|window|opening … on
    <room>.<edge> [at <pos>]`. `window … between` is a parse error.
  - **Position.** Every offset is to the opening's **centre**, as `on <wall> at <mm>` always
    was. It is measured along the shared run or the edge, from its smaller-x/y end. A door or a
    cased opening must write a position; §5 is silent on the cased opening, so it is refused,
    not defaulted. A window on an edge defaults to `center`, as §5 says.
  - **Host.** The host is the one straight wall body on the run, derived or authored.
    - None: `E_OPENING_NO_SHARED_WALL`. On an edge, a partition there also counts as none.
    - More than one: `E_OPENING_HOST_AMBIGUOUS`. A coexistence `~n` piece is never chosen, so
      an authored span beside a derived remainder refuses.
    - No shared run: the reused `E_WALL_BETWEEN_NOT_ADJACENT`.
    - A pair declared `open`: `E_WALL_BETWEEN_OPEN`, spanned on the door's clause, with the
      `open` clause as a related span. The derived partition carries `_derived.open`.
  - **Nib.** `src/opening-junctions.ts` now holds the junction measure, moved there verbatim
    from `W_OPENING_AT_JUNCTION`. Lint and the resolver share it, together with the default nib
    values (`DEFAULT_RULESET` reads them from there).
    - `E_OPENING_NIB` also covers a meeting wall inside the span, and a span past the run or
      its host.
    - The hint names the nearest legal position, grid-snapped and checked, in the author's own
      words (`at 600 from end`).
    - The hosted-datum forms (`on <wall> at … from …`, `axis`) are NOT refused: they warn
      exactly as their `on <wall> at <x>` twins do, and are byte-identical to them.
  - **Datums.** A room edge is read through the group's own datum reader (`ResolveCtx.datums`),
    so `E_DATUM_COMPASS`, `E_ROOM_NOT_RECTANGLE` and `E_UNKNOWN_REF` hold there. On a hosted
    wall a datum line must cross its straight run at exactly one point.
  - **Facts.** `describe()` gains a `relation` (as written) on the opening's row and a
    `freedom.openings.relational` count, both present only when such an opening exists. The
    `open between` derived opening keeps `placement: "absolute"`, as decided in PS3.0 part C:
    changing it would move the pinned PS3.0 digest rows, and §6 does not require it.
  - **Lint.** Move hints quote `between A and B at <n> from <anchor>` (or the `on <room>.<edge>`
    form), keeping the anchor the author wrote (`end`, or an edge through an end of the run),
    else `start`. So the swap-back law lints byte for byte only when no move hint fires.
  - **Plan JSON.** A root-level relational opening carries `relation {between|edge, at?}`
    beside its resolved `x`/`y`, round-tripped. One placed `at axis <label>` is exported by its
    `x`/`y` alone: Plan JSON carries no axes, so the relation would not re-import.
  - **Tests.** Every refusal is spanned and tested in `test/openings-between.test.ts`, together
    with the twins, the instance frames (rotate 90, mirror x and both) and the widening drill.

**PS3.5 · Semantic selectors.** `done` (PR #230)
- `segment north|south|east|west`, or `segment containing <room>.<edge>`, aliasing `segment <n>`.
- Refuse unless exactly one segment matches.
- *As built* (`src/segment-select.ts`):
  - **Where.** Wherever `segment <n>` is accepted: `against wall … segment` and `dim radius …
    segment`. `dim radius` measures an arc and a selector picks only straight segments, so
    there it is always refused (`E_SEGMENT_SELECT`) rather than being a parse error.
  - **Compass.** Picks the straight, axis-aligned segment of a CLOSED wall whose outward face,
    the side away from the floor, looks that way.
    - The floor is the side the ring encloses, from the exact shoelace orientation. It flips
      on a derived courtyard ring (`_derived.ring === "inner"`).
    - An open wall, a derived partition included, has no floor side and is refused; `side` is
      not read. Arcs and diagonals face nothing.
    - Caveat: an authored closed ring drawn round a courtyard still counts its enclosed side
      as the floor.
    - Legal only where datum compass words are (a north-up root), otherwise `E_DATUM_COMPASS`.
      The flag reaches the selector through `DatumAccess.compass`.
  - **Containing.** The edge is read through `ctx.datums.read`, so every datum refusal holds. A
    match is a straight segment exactly on the edge line with a positive overlap. Open walls
    and components work, the latter in local words.
  - **Refusal.** `E_SEGMENT_SELECT`, spanned on the selector, gives the match count and the
    candidate `segment <n>` numbers; for a compass word it also says which way each faces. A
    refused piece raises no follow-on `E_FURN_AGAINST`.
  - **Derived walls.** Reached only by category, as `segment <n>` is: `against wall exterior`
    with one ring, and `against wall partition` with one partition.
  - **Parse.** A bare compass word after `segment` is the selector, and a variable of that name
    is written `segment (east)`. The printer parenthesises it, and this is noted in the
    CHANGELOG. `containing` is a selector only before a dotted name, so it breaks nothing.
  - **Facts.** `_authored.segment` holds the resolved index, plus the internal
    `segmentSelect` text. `describe()` shows nothing new. Plan JSON has an additive
    `segment_select`, validated by `SEGMENT_SELECT_RE` and re-emitted in place of the number.
  - **Steps.** The compass scan charges one step per vertex, one per segment and one more;
    `containing` charges one for the read, one per segment and one more. Both are charged
    before they run.
  - **Tests.** `test/segment-select.test.ts` has the twins (padded so the spans match) on an
    authored ring, an open polyline, a derived ring and partition, and a component under all
    eight frames, plus a control that tells a selector from a different number. It also covers
    the refusals, the parse, the format and Plan JSON round trips, and the budget. The digest
    table is `test/segment-select-digests.test.ts`.

**PS3.6 · Teach it.** `done` (PR #227)
- `spec.llm.md` and `skills/archlang/SKILL.md` lead with a minimal room-graph example (rooms, then
  `wall between`, then `door between`). Prior art: a minimal task-scoped grammar helps; the full
  grammar does not.
- Rewrite `examples/two-bed.arch` (after PS2.5 flags it) and `examples/relational.arch` (G.12's live
  repro) in the new forms.
- Respect the `spec.llm.md` size cap rules (trim duplication first).
- *As built (PR #227):*
  - **Lead example.** `LEAD_EXAMPLE` in `scripts/gen-llm-spec.ts`, under "Start here: rooms first"
    right after the seven rules: three rooms (`living` at the origin, `hall` and `bedroom`
    `right-of`), `walls from rooms … { open between living and hall }`, a front door
    `on hall.bottom at center`, `door between hall and bedroom at 800 from start`, two windows
    `on <room>.<edge>` and one furniture piece. 0 compile diagnostics and 0 lint warnings, pinned in
    `test/spec-forms.test.ts`, which also compiles every `arch` fence of the page. It replaces the
    embedded `examples/attached.arch`, so the spec went down from 29,965 to 28,910 characters. The
    umbrella skill carries the same text verbatim. `test/task-skills.test.ts` allows that one
    fence and no other.
  - **`two-bed`'s geometry.** Old: kitchen/living (0,0) 4000×5000, master (4000,0) 6000×5000,
    bedroom 2 (0,5000) 4000×3000, bath (4000,5000) 3000×3000, hall (7000,5000) 3000×3000, so
    the access graph was a chain. New, in the same 10000×8000 shell: kitchen/living (0,0)
    4000×8000, master (4000,0) 6000×3600, hall (4000,3600) 6000×1400 (the corridor; front door
    at its east end), bath (4000,5000) 2400×3000, bedroom 2 `right-of` the bath 3600×3000. Every
    room is at access depth 2, through the hall. The hall opens to the living room by
    `open between`. 0 warnings (it had 3 × `W_ROOM_VIA_PRIVATE`). `accessibility-advisory` reports 6:
    `W_SWING_OBSTRUCTED`, `W_DOOR_CLEARANCE` and 4 × `W_PATH_TOO_NARROW`, all from the profile's
    wider door and path minimums (the old plan had 3 of the same kind beside its 3
    `W_ROOM_VIA_PRIVATE`).
  - **`relational`.** It had 7 warnings: 3 × `W_ROOM_DISCONNECTED`, `W_ROOM_NOT_ENCLOSED` and
    3 × `W_BOUNDARY_NO_WALL`. All 7 came from the missing derived walls, and none was kept. It
    gained a hall room (8000×1200) between the day rooms and bed/bath, so the bath is not reached
    through the bedroom. Its walls and openings are derived. It has 0 warnings.
  - **Swap-back.** `test/walls-from-rooms/two-bed.arch` and `relational.arch` are now the
    hand-typed twins: walls as points, openings `on <wall> at <mm>`. They are SVG- and
    `lint()`-identical to the examples. The relational twin uses `grid 25` (see PS3.10).

**PS3.10 · Snap a derived open-pair opening to the grid?** `todo`
- `open between`'s derived opening centres on the clear span exactly. That can be a half-grid
  position, which a typed `at` on the same `grid` cannot reach (`relational.arch`: 2025 and 2525
  on `grid 50`, between a 200 mm ring's face and a 100 mm partition's).
- Decide whether the derived centre should snap to the plan grid, toward the inside of the clear
  span, so that a typed twin always exists. A snapped centre would move the PS3.0 part C digest
  rows, so it needs its own PR with the rows explained.

**PS3.7 · Furniture relations: `facing <id>`, `against <wall|room.edge>`, `clear front|sides <mm>`.**
`done` (PR #228; ADR 0029, with an ADR 0017 amendment)
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
- *As built (PR #228):*
  - **Forms.** `against <room>.<edge> [offset <mm>]` (ADR 0028 §5a: the back on the room-side face of
    the one wall on the edge line, or on the line; refusals reuse `E_FURN_AGAINST`, a run declared
    `open between` included); `[rotate … | facing <id>]`; `clear front <mm>`, `clear sides <mm>`.
  - **`facing`.** Of the four turns, the one whose front ray (front-edge midpoint, outward) enters
    the target nearest; targets are furniture, rectangular rooms and openings of the piece's own
    group, in any source order. It is settled in one pass after the group resolves
    (`ElementDef.settle`), charged `1 + |group| + 4` steps, and never moves a footprint, so mutual
    facing needs no cycle rule. Refusals: `E_FACING_TARGET`, `E_FACING_MISS`, `E_FACING_TIE`,
    `E_FACING_CONFLICT`, `E_FACING_SYMMETRIC`, `E_FACING_TRANSPOSED` (catalogued footprints only;
    sofas wait for PS3.11).
  - **`clear`.** A declaration only, measured in closed form against solid pieces, straight wall
    bodies and hinged swings; `W_FURN_CLEAR_FRONT`, `W_FURN_CLEAR_SIDES`; a declared `clear front`
    replaces the catalogue's `W_FURN_CLEARANCE` for that piece only when at least as deep (the
    catalogue's clearance is a floor; red team round 1). An obstacle must overlap a zone with
    positive area.
  - **Facts and identity.** `describe()` gains `relation`, `facing` and `clear {declared, measured}`
    on a furniture row, and `freedom.furniture.relational`, each only when written; Plan JSON gains
    `against_edge`, `facing`, `clear_front`, `clear_sides`. With the seat rule off, every corpus
    digest suite was unchanged by the forms. Twins, all eight frames, every refusal and the budget
    are pinned in `test/furniture-relations.test.ts`; a digest table in
    `test/furniture-relations-digests.test.ts`.
  - **The undeclared check** is PS2.11's `W_SEAT_FACING_AWAY` (as-built note there).

**PS3.11 · Sofa and couch footprints.** `todo` (after a corpus sweep)
- `sofa`/`couch` carry no catalogued footprint, so `E_FACING_TRANSPOSED` cannot see the audit's
  transposed sofas (H2, T3) and `against wall` cannot omit their `size`. Add a footprint (about
  2000-2200 along x 900 deep) once a sweep shows which corpus rows move (`finish`, the LSP hover,
  the fixture paste and the defining-piece rule read it), and explain each.

**PS3.8 · Building-relative swing and offset wording.** `done` (PR #229; as built below)
- **As built.** `swing inward|outward` resolves to `in|out` from the one face of the host that has
  floor (the `garage` probe); floor on both faces or neither is `E_SWING_SIDE` on the word, and the
  door keeps its default swing. `in` is the right of the wall's drawn direction on the page.
  `spec.llm.md` says so with the K1 example. Plan JSON adds `swing_building` beside the resolved
  `swing`. The unknown-word parse error lists all four words. Twins (both directions, loop, ring,
  barn), all eight frames with a plan-space oracle, refusals and round trips are in
  `test/swing-building.test.ts`; a digest table is in `test/swing-building-digests.test.ts`. Every
  existing digest suite was unchanged. `set door(swing: inward)` waits for PS0.16.
- `swing in|out` and `at <pos>` are relative to the wall's drawn direction; an author who drew a
  wall right-to-left put a fire exit's `swing out` opening inward and a living window in the
  laundry (`audits/2026-10-18-first-contact.md` K1 and the v1 apartment). Add `swing inward|outward`
  (relative to the building: towards or away from the room floor on the host) and define `in`/`out`
  in `spec.llm.md` with a one-line example. PS3.4's `from <room.edge>` offsets fix the `at` half.
- A plain lint for an exterior door on a public building whose leaf swings into the floor belongs
  to PS2.16's non-residential profile, not here.

**PS3.9 · Plan JSON for a component that derives its walls.** `todo` (after PS3.0)
- Plan JSON has no per-component record, so a plan whose `place`d component holds `walls from rooms`
  is refused at projection (`E_JSON_DERIVED_IN_INSTANCE`, PR #223) rather than lose the derived
  walls. Design an additive per-instance (or per-component) record that carries the statement as
  written, with a round-trip law, and retire the refusal.

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
| 2 | PS2.1–PS2.9, PS2.13 | Defect-corpus catch rate ≥ 90 % for classes 1, 2, 3, 4 and 6, with no false positive on the clean twins; every corpus `lint()` movement is explained (two-bed is expected to start warning: fix the example, see PS3.6). *Corrected 2026-10-19:* class 5 (clearances) belongs to PS2.11 in row 5, so it was removed from this row's acceptance. *Status:* wave 1 landed 2026-10-19 (PRs #199, #201, #200): classes 1, 3, 6 at 100 %, class 4 at 3/4 (PS2.17), class 2 at 1/6 waiting on PS2.4; overall 33/53 on `main@cc165f4`. Wave 2 landed 2026-10-19 (PRs #203, #204, #211): classes 1, 2, 3, 6 at 100 %, class 4 at 4/5 (80 %, below the bar until PS2.17 lands); overall 44/67 on `main@fcb3074` (the +1 is A2, the balcony-door-masked laundry, caught by PS0.10's main entrance; T2 still refuses without `site`). Wave 3 landed 2026-10-20 (PRs #214, #216, #217): classes 1, 2, 3, 4, 6 at 100 %, overall 46/68 on `main@06c6b56`; this row's acceptance is met (class 5 is row 5). Next: PS3.1 landed as ADR 0028 (PR #215, Proposed), then PS3.2 and PS3.6 |
| 3 | PS3.1, PS3.2, PS3.0, PS3.3, PS3.4 | ADR merged; byte-identity law green; `relational.arch` lints clean with walls derived; the 500 mm widening drill moves walls and doors with the room; the class-2 corpus cases are unwritable in the D5 form. *Status 2026-10-22 (PS3.0 done, PR #224):* met: ADR 0028 merged and Accepted; byte-identity law green (every digest suite unchanged, the PS3.0 table pinned); the class-2 corpus cases are refused or gain their walls in the D5 form; the widening drill moves the walls and the door with the room (`test/walls-from-rooms/widen.arch`). Remaining: rewriting `examples/relational.arch` and `examples/two-bed.arch` in the headline form (PS3.6), and PS3.3. *2026-10-22 (PS3.4 done, PR #225):* relational openings landed, and the widening drill now moves a `door between` and a `window on <room>.<edge>` with the room (`test/openings-between.test.ts`). *2026-10-23 (PS3.3 done, PR #226):* the pairwise forms landed, and the drill moves a `wall … between` and a `wall … around` ring with the room (`test/wall-between-around.test.ts`). Remaining: the PS3.6 rewrites of `examples/relational.arch` and `examples/two-bed.arch`. *2026-10-23 (PS3.6 done, PR #227): fully met, every bullet:* ADR merged (0028, Accepted); byte-identity law green (every moved digest row is one of the two rewritten examples or the two-bed twin, each explained in the re-pin commit); `relational.arch` lints clean with walls derived (597210c7: 0 warnings, was 7); `two-bed.arch` lints clean in the same form (a60e9124: 0 warnings, was 3 × `W_ROOM_VIA_PRIVATE`); the widening drill moves walls and doors with the room; the class-2 corpus cases are unwritable in the D5 form. Defect-corpus catch rate unchanged at 46/68 |
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
9. **Should a `let` be able to hold a room-edge datum?** PS3.2 part B (PR #221) refuses it
   (`E_DATUM_BEFORE_ROOMS`: a `let` is evaluated once, at expansion, before any room is placed).
   The alternative considered and declined there was a deferred `let`, evaluated where it is read;
   it forks `let` into two evaluation modes, so it becomes a card only if authors ask for it.

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
