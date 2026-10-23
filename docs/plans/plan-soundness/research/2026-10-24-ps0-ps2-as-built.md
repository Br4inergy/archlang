> Research record, 2026-10-24, against `main@57b5ff67`. The as-built notes of the landed
> plan-soundness cards of PS0, PS1 and PS2, moved here verbatim from `../README.md` (decision D4
> and §8: a landed card keeps only its id, title, status and merged PR there), with the landed part
> of PS2.11 and §7 row 2's status history. Nothing below was reworded; paths in it are relative to the programme folder (`docs/plans/plan-soundness/`).
> Table rows keep their table header. Never rewrite this file; correct a conclusion in the README
> card it affects (§8).

# Plan-soundness: landed cards as built (PS0–PS2)

## PS0 · landing notes (PS0.1, PS0.7, PS0.10–PS0.15)

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

## PS0.5

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.5 | `furniture … against wall … in <relational room>` fails with `E_FURN_AGAINST` because relational placement resolves after furniture (`src/ir.ts` ~2488). May fall out of PS3.2's reorder. *As built (PR #220):* relational rooms are now placed before every reader, so the readers (furniture side inference and `in <room>`, a door's `swing into`, a garage door's floor probe, lint's fixture paste) read `_unplaced` instead of `_rel`: a placed relational room works and draws byte for byte as its absolute twin, and a room that could not be placed, including an instance's room read from the root, is refused naming its placement error | done |

## PS0.13

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.13 | `W_ROOM_NO_CLEAR_PATH` is not equivariant under mirror x. Found 2026-10-19 by `test/equivariance-fuzz.test.ts` (unseeded) on a PR unrelated to circulation and reproduced on `main@6b6a42c`: a 2 × 2 m room with a 700 mm door at 5 % and two WCs at (0,51) 400×300 and (357,0) 300×300 raises the code only when placed with `mirror x`. The fuzz test fails whenever its random draw hits the class, so any PR's CI can go red on it. Either fix the walk (`src/lint/rules/circulation.ts`) or pin the class in the oracle with its witness; the plan is in the owner's scratch note (`plan-soundness-impl/fuzz-mx/`) until fixed. *As built (PR #214):* the walk was right; the seed was wrong. A doorway centre on a cell line was seeded into one cell chosen by the sign of the coordinate, so `mirror x` moved the seed. Both cells are seeded now (`src/analyze/occupancy.ts`). The witness is pinned in `test/d4-oracle.ts`; the red team's aimed fuzz (3 seeds, 2,200 cases) found 0 non-equivariant cases on the branch against 7 of 600 on main. A doorway authored 1e-6 mm off a line still reads differently under D4 (any absolute tolerance has that edge; the nav grid snaps exactly), noted, not fixed | done |

## PS0.14

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.14 | `describe()`'s net-area integral is super-linear on a room polygon with hundreds of vertices whose edges cross hundreds of free-standing walls: 52–97 s on `main@90ae6bf` for a 125-partition × 300-tooth comb room (the inside test walks every ring vertex per boundary piece, pieces ≈ 4·S·T). No shipped plan is near it (corpus max 56 vertices), but `compile()` is bounded by law and `describe()` runs in the playground thread. Charge pieces × ring vertices to a count before the integral, or bin the ring for the inside test; PS2.4's `FaceBudget` already refuses the lint side (PR #204 round 3). *As built (PR #214):* `MAX_NET_PROBE_WORK` (20,000,000) is charged after the split and before the walk as 2 × pieces × (nearby band boxes and edges + the fullest y-band of the ring); the inside test bins the ring by y. A room past it omits `net_area_m2` (ADR 0027, third case, `too-much-work`); no shipped room is charged more than 175,000. Per room only; the per-plan total is PS0.15 | done |

## PS0.19

| Card | Bug (re-measure first; the evidence is in the cited file) | Status |
|---|---|---|
| PS0.19 | A window's `facing` fact was not equivariant under a pure translation. Found on 2026-10-23 by `test/equivariance-fuzz.test.ts` on PR #230's CI (fast-check seed 1736625303, path "29:2:2:2:10:10:10:10:10:10:11:11:20:20:20:20:20:20:20:20:20:20:20:20", `g = t`); it reproduced on `main` too. The shrunk plan is a 6 × 6 m shell with partitions at x 2000 and 4000 and at y 3300, six rooms in a 3 × 2 grid, and `window id=o0 on w_v1 at 55% width 600`, placed 20 m out. `(55 / 100) × 6000` is 3300.0000000000005, an ulp off the room corner (2000,3300), so P₀ had no tie and read `E`; translated, the ulp rounded away, the window sat on the corner, and the `facing-tie` convention (N/S first) read `S`. **As built:** `percentOf` (`src/attach.ts`) reads the percentage as the decimal it was written as (`n / 10^k`, k ≤ 6), multiplies the run by the integer `n` and divides once, so a percentage whose true length is a double resolves to it exactly. `resolveAttachment` is the only place a percent position becomes a length (furniture, dims and hosted datums take no percentage; datum hosts refuse one). Measured over `examples/` and `test/`: 5 positions change by an ulp (`hexagon-pavilion.arch` p_ne, p_nw, p_se; `museum-wing.arch` o1; `test/fixtures/schedule-sheet.arch` door_1, 3400.0000000000005 → 3400), every one snapped or printed to the same output, so no digest, golden or snapshot row moved. The `float-translation` class's witness was this same ulp, so it now spells the position `at 12000 * 0.55`, a computed mm position that still carries the ulp (the class stays open for lint). The shrunk plan is pinned in the fuzz suite's counterexamples, with a unit table in `test/attach.test.ts` | done |

## PS1.1

**PS1.1 · `test/defect-corpus/`** landed 2026-10-18 (PR #195, commit df00ab5): 53 defect cases with
clean twins across all eight classes, headers parsed by `test/defect-corpus.test.ts`, catch rate
printed per class (7/53 at landing, all from existing rules). A `todo` case is also asserted NOT to
fire, so a PS2 rule that starts catching one turns the test red until its header says `done`.
Proposed code names for PS2.4/PS2.11/PS2.12 live in the folder README and are the names PS2 uses.

## PS1.2

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
- *2026-10-24 (`audits/2026-10-24-first-contact-rerun.md`):* two more cases with twins.
  - `clearances/seat-facing-away` is `done` (`W_SEAT_FACING_AWAY`; its twin uses `facing`).
  - `circulation-privacy/fire-door-inward` is K1 reduced. Lint is silent, so it is `todo` with the proposed `W_EXIT_SWINGS_INWARD` (PS2.16); its twin uses `swing outward`.
  - The corpus is now 70 cases and the catch rate 47/70.

## PS2 · landing notes (waves 1–3)

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

## PS2.1

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.1 | `W_OPENING_AT_JUNCTION` | For every opening kind (door, window, cased opening): another wall's body intersects the opening's clear span on the host run, or either jamb's nib to a meeting wall face is under max(`minJunctionNibMm` 100 mm, host thickness × `junctionNibThicknessRatio` 0.5), measured at the face, configurable by profile. *As built (PR #201):* a new rule beside `W_DOOR_NEAR_CORNER`, which keeps its output byte-for-byte; the corner check runs for doors only where that rule is silent; a cased opening flush with a meeting wall is exempt. *Known gap:* two collinear walls meeting end to end never pair, so an opening across their joint is not reported | done |

## PS2.2

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.2 | `W_OPENING_OVERLAP` | Two openings on one host run whose along-run spans intersect, or whose separating pier is thinner than a mullion (`minMullionMm` 100). *As built (PR #201):* the two leaves of a double door are exempt and move as a pair under `fix`. *Known gap:* the check is per pair of openings on a host, quadratic in openings per wall; fine at corpus sizes, revisit if a wall ever carries hundreds | done |

## PS2.3

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.3 | `W_CONNECTOR_AMBIGUOUS` | An access edge with `ambiguous: true`, or one whose clear span covers more than one room on a face (`describe()` reports this as the additive `straddles` list since PS0.1 landed; the edge stays in the graph with a measured `between`). The message names the rooms on each side. *As built (PR #201):* a straddled room counts only when the clear span covers ≥ `minStraddleCoverMm` (100) of it, net of the meeting wall's body, so a 1 mm overrun is not reported | done |

## PS2.4

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.4 | `W_BOUNDARY_NO_WALL` | Two rooms share an edge run longer than a doorway with no wall or opening on it, unless both rooms' authored `uses` form an open-plan pair (kitchen/dining/living) or a fixed counter stands in the gap (a café servery is a deliberate boundary, `audits/2026-10-18-first-contact.md` C-plan). Plus its dual: a walled face with no room covering ≥ 95 % (unassigned floor), and rooms outside the closed exterior ring (`W_ROOM_OUTSIDE_SHELL`). Generalises `largestPerimeterGap` beyond wet rooms. After it lands, a test pins that circulation-reachable implies access-reachable. *As built (PR #204):* three codes. `W_BOUNDARY_NO_WALL` (`maxBoundaryGapMm` 900): collinear runs merged before the gap is taken; a wall counts as cover by its body (± half thickness + 50 mm), a perpendicular wall body crossing the line splits the run; a counter counts only where it straddles the line and closes the stretch only if what it leaves open totals ≤ a doorway (wall stubs are judged by the largest contiguous stretch, decided). `W_FLOOR_UNASSIGNED` (95 % cover, ≥ 0.5 m²): closed faces from the joined wall bodies with a loop nesting tree; a sealed face (no door, no window, no bordering room) is not reported (library's drum spandrels). `W_ROOM_OUTSIDE_SHELL` (0.1 m²): judged only when ≥ 50 % of the room's floor lies inside walled faces, otherwise silent (ADR 0005). All face work is charged to a `FaceBudget` before it runs (wall contacts 1600, faces 400, loops per grid cell 64, Σ face curves 20 000, face × room pairs 10 000, point tests 2e8); a refused storey files the coverage skip `enclosure-budget` naming the cap. No corpus storey is refused (max 31 faces, 64 contacts). "Circulation-reachable implies access-reachable" does not hold yet on three plans (relational's open-plan join, two `W_BOUNDARY_NO_WALL` cases); pinned as known counterexamples. `bath-open-side` raises both `W_ROOM_NOT_ENCLOSED` and this code (decided: different facts). Follow-ups: PS2.21 | done |

## PS2.5

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.5 | `W_ROOM_VIA_PRIVATE` | Remove a bedroom or bath/WC from the access graph: does any other room (not its own ensuite, wardrobe, storage or balcony) become unreachable? Generalises `W_BATH_VIA_BEDROOM` (keep that code; this is the general case). ResPlan: 0.03–0.06 % of real dwellings do this, so a warning is safe. *As built (PR #199):* seeded from every door to the ground but balcony doors, so a patio door could still mask the route; seeded from the main entrance only since PS0.10 (PR #211), with garage doors and doors into rooms the main entrance cannot reach from inside kept as ways in, and a room with its own door to the ground never reported; a stair landing inside a bedroom is not a cut point; one warning per cut room, not one per room behind it. *Known gap:* a room reachable through either of two parallel private rooms (bedroom A or bedroom B, never a public route) is not reported, because removing one leaves the other | done |

## PS2.6

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.6 | `W_WET_ROOM_DOOR` | A bath/WC whose only connector is a leaf-less opening to a habitable room; a bath/WC door onto a kitchen or dining room (GB 50096 5.4.3); a bath with two or more connectors acting as a passage (the PS2.5 test covers part of this). *Revised in PR #203 (decided 2026-10-19):* a bath door onto a room that is a kitchen AND the living room counts only where the door really opens onto the kitchen zone: a kitchen fixture (sink, hob, oven, fridge, worktop, island, dishwasher; not a microwave) nearer than `wetDoorKitchenProximityMm` (1500, GB 50096 5.3.5's single-row kitchen width) from the doorway's room-side face, compared in whole mm. Such a room with no kitchen fixture files the coverage skip `no-kitchen-fixtures`. A kitchen alone, a dining room alone and a kitchen+dining room (no living) warn unconditionally as before; living or dining without kitchen stays exempt (taste layer). The earlier blanket exemption of any kitchen that was also living/dining went beyond the clause; a use-flag narrowing was tried first and made five eval goldens and laneway-house warn (door 2.7–4.6 m from the kitchen), which is what the proximity test fixes. The GB 50096-2011 5.4.3 wording is unverified online; `research/design-taste.md` and `research/prior-art.md` read it differently Since PS2.18 the dining, leaf-less and passage arms decline on a plan that reads as non-residential; the kitchen arm does not | done (PR #199, #203) |

## PS2.7

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.7 | `W_ENTRANCE_INTO_PRIVATE` | The exterior door's room is a bedroom or bath (ResPlan: never). Kitchen entry is advice-level under profiles only. `examples/garden-house.arch` moved its garage door to swing into the kitchen so the rule reports nothing there. Since PS2.18 it declines on a plan that reads as non-residential (it never fired on one) | done (PR #199) |

## PS2.8

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.8 | `W_HABITABLE_NO_WINDOW` | Extend the bedroom rule to living, dining and kitchen (needs PS0.7). *As built (PR #200):* a room with a window whose host is an arc segment is skipped, not judged, until PS0.12 attributes it (`hillside-villa`'s bay was glazed and dimensioned instead). *Resolved by PS2.18:* the kitchen arm declines on a plan that reads as non-residential (an office kitchenette has no daylight duty), with a `non-dwelling` skip | done |

## PS2.9

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.9 | `W_ROOM_MISSING_DEFINING` | A furnished room missing its defining piece: bedroom without a bed, bath without a shower or tub, kitchen without a sink, hob or worktop. Reuse `FURNISH_TABLE`'s required marks, so the rule and furnish can never contradict (furnish's never-worse gate re-lints its own output). *Decided 2026-10-18:* the defining set is exactly the row's required marks (kitchen = sink + hob, and since PS2.17 a worktop); `finish` stays fill-only (M.22 unchanged). *As built (PR #200):* defining sets come from `FURNISH_TABLE`'s required marks via `src/lint/defining.ts` (table moved to `src/furnish-table.ts`); `W_ROOM_NO_FIXTURE`'s hint quotes the defining set. `furnish` judges each use on its finished pieces and tries the lint's own placement search before giving a use up; a use it cannot complete is left out whole, so `finish` never writes a use the rule would then report (fuzz counterexample pinned in `test/lint-room-contents.test.ts`). Fuzz against the previous main, 1,600 random plans: 34 baths gained a tub or shower, 44 baths that used to get a WC and basin are now left empty (PS2.20), kitchens unchanged. The worktop follow-up is PS2.17 | done |

## PS2.13

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.13 | Lint coverage report | `lint --json` gains an appended `coverage` block: rule families run, skipped (with why: no `uses`, no brief, no `site`, no multi-storey, no dwelling declared, no operable-window data) and unclassified rooms. Human output prints one line when something was skipped. Purely additive JSON. *As built (PR #203):* `lintWithCoverage()` runs the rules once and returns `{diagnostics, coverage}`; `lint()` is its `diagnostics`, byte-identical (812 hashes, 0 moved). Every rule declares a `family`; a rule declines through `ctx.skip(reason, room?)`, typed reasons in `src/lint/coverage.ts` (`no-uses`, `no-site`, `single-storey`, `arc-window-unattributed`, `non-rectangular-room`, `no-entrance`, `balcony-only-entrance`, `unsupported-host-geometry`, `no-kitchen-fixtures`, `enclosure-budget`, `no-main-entrance`, since PS2.18 `non-dwelling` and since PS2.17 `hint-budget`; reserved `no-brief`, `no-dwelling`, `no-operable-window-data`). `lint --json` appends `coverage` after `diagnostics`; the human line goes to stderr, never under `--quiet`, and `no-site` is filed only when a habitable room has a window (126 of 171 corpus files print a line, was 167). `describe()` reads none of it. *Open:* the MCP server and VS Code extension do not surface `coverage` yet (version bump); a degenerate nav grid is still a silent decline (TODO at the seam). `coverage.unclassifiedRooms` lists the rooms the vocabulary cannot read (PS2.19 narrowed the list) | done |

## PS2.17

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.17 | Kitchen worktop | The corpus case `missing-defining-contents/kitchen-no-worktop` is still `todo` after PS2.9 because the defining set is the row's required marks and `counter` is optional. Decide between making `counter` a required kitchen mark (every furnished kitchen then gains or loses a counter: run the fuzz comparison of PS2.9 and explain the moved rows) and a profile rule `W_KITCHEN_NO_WORKTOP` that reads the same table (no furnish movement). Default to the profile rule unless the fuzz shows furnish already places a counter in nearly every kitchen. *Decided 2026-10-20:* the kitchen row requires a `counter` (or `worktop`), from the fuzz: the row had no counter item and 0 of 738 fuzzed kitchens got one, and a separate `W_KITCHEN_NO_WORKTOP` could not avoid moving `finish` (its never-worse gate counts every gained code). *As built (PR #216):* `finish` tries the worktop's 600 mm module beside the hob, then against any wall, then the 400 mm module beside the hob, then against any wall, and never moves the sink and stove; the lint hints' placement search tries the same two sizes (review round 1 caught it trying only 600); 21 of 738 fuzzed kitchens (2.85 %, all ≤ 1.95 m wide) are left out whole, never written without one; in 146 the counter takes the fridge's place and 30 living+kitchen rooms lose the living use whole. Eleven examples, the gallery two-bed and the overview fence gained a counter; the first-contact plans are left reporting it. *Review rounds 2–3:* a quoted set is re-linted with its pieces standing before it is quoted, against only the rules a pasted set was measured to move (`readsFurniture` on `fixture-back-to-room`, `wet-room-door` when the room is or opens onto a bath or WC, `path-too-narrow` only when a piece stands within the minimum walk width of a doorway, the wall across or another piece; `test/fixtures/hint-paste-gained-codes.json` pins the list), and a set that would gain a finding is not quoted; a 400 mm counter in a bottom corner is quoted with `rotate 180`. The re-lint is counted, never timed: `MAX_HINT_VERIFICATIONS` (64 passes) and `MAX_HINT_WALK_ROOMS` (128 rooms walked) per lint run, charged before the work; past either the hint says the placement was unverified and the run files one `hint-budget` coverage skip (corpus maximum 4 passes, 80 rooms; 50 empty kitchens lint at 2.1× main, was 147× before the gating). *Review round 4:* the walk gate also reads the obstacles the nav grid blocks on inside the room (wall stubs, stairs, lifts, voids, from the grid's own inputs), and `circuitous-path` is flagged too: on multi-room fuzz a quoted kitchen set closed the way through a room and sent the walk round (6 of 2,318 sets). Findings are compared by full message, so a set that worsens an existing squeeze or detour ratio is declined like one that creates it; no corpus row moved. *Review round 5 (last by the capped loop):* the gate measures the gap to another piece as a rectangle gap (edges in line or a corner touch count, touching is the narrowest), reads a corner pocket for any doorway opening into it, pads the gap to a piece or obstacle by one nav cell and every threshold by the grid's growth past 2500 m² (read from the grid's own cell functions), and tests the pass budget before any geometry. Residue accepted as nits: a pasted set that only changes an existing squeeze's door-attribution clause at the same width is not a gain; the hint's promise holds on the corpus and fuzz, with constructed geometry residue to be filed as cards, not rounds | done |

## PS2.18

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.18 | Profile scoping of dwelling-reading rules | PS2.8's kitchen arm, PS2.6 and PS2.7 assume a dwelling. An office kitchenette, a café kitchen or a clinic WC off a waiting room is not the defect those rules describe (first-contact café and clinic plans). Until PS2.14 declares dwellings, scope those arms to the residential advisory profiles and have the default profile report a PS2.13 skip ("no dwelling declared") rather than a warning. *Decided 2026-10-20 (D6):* the inverse: the default profile judges every plan as a dwelling unless it reads as non-residential. *As built (PR #217):* `dwellingReading` (`src/analyze/dwelling.ts`) marks a plan non-residential when it has an office use and no bedroom or living room, or a label carrying a café, shop, clinic, school or office word (`src/vocabulary.ts`); otherwise it is a dwelling. On a non-residential plan, under the default ruleset and `accessibility-advisory`, `W_HABITABLE_NO_WINDOW`'s kitchen arm, `W_WET_ROOM_DOOR`'s dining, leaf-less and passage arms and `W_ENTRANCE_INTO_PRIVATE` decline with a `non-dwelling` coverage skip; `W_WET_ROOM_DOOR`'s kitchen arm judges every plan (food hygiene). `residential-basic` sets `assumeDwelling` and judges every plan; the playground defaults to the default ruleset. Measured: 37 of 341 corpus plans read non-residential, none with a bedroom; lint moved only on the two café plans (the WC onto the seating) and four eval office goldens (a kitchenette's daylight); corpus case `wc-off-dining` re-cast as a dwelling, new café pair `wc-off-servery` pins the arm that stays (46/68). *Open:* the kitchen-arm message still cites GB 50096 5.4.3 on a café; a shop with a flat above reads non-residential as a whole and a hotel floor (guest rooms are bedrooms) reads as a dwelling; all wait on PS2.14 | done |

## PS2.19

| Card | Rule | Test (on the resolved plan) | Status |
|---|---|---|---|
| PS2.19 | Vocabulary gaps | In the first-contact plans, labels `Wardrobe`, `Closet`, `Dressing`, `Nursery`, `Study`, `Store`, `Office` and `Balcony` classify to no use at all, so every use-reading rule is blind on them and PS2.5's exemption for a bedroom's own wardrobe or balcony cannot see the room it exempts. Extend `roomUses`/`classifyLabelUses` with those kinds (each a byte-identity re-measure with the swap-back proof, as PS0.7 was) and report unclassified rooms in PS2.13's coverage block. *Corrected 2026-10-20:* the premise does not hold as written; every first-contact room authors `uses`, so none was unclassified, and the listed words are furniture labels or not rooms there. *As built (PR #216):* a fallback vocabulary read only when the primary one leaves a label empty, so every label that classified before keeps its answer (pinned against the verbatim previous classifier): storage (store, closet, wardrobe, pantry, larder; aliases dressing, linen, cellar), office (office, study; consulting), utility (utility, laundry; plant, boiler), nursery → bedroom ("day nursery", a childcare room, stays unclassified) and water closet → WC; extended in PR #217 after a "Great room / Master / Study" house read as an office: great room, reception room, drawing room (and aliases snug, den) → living, read last and only when no other fallback word matched; guest room, kids room, children's room, master suite → bedroom, and the alias master unless the label also names a store, office or utility room. Balcony, terrace, studio, gallery, meeting and staff room stay unclassified and show in the coverage block. Two corpus rows moved in `describe()` only (furnished-flat's Utility, the eval office's Open Office, which `finish` now gives a desk); the 1 m² "Closet" catalogue example became "Nook" | done |

## PS2.11 · as built in part (PR #228)

*As built (PR #228, with PS3.7):* the seat check `W_SEAT_FACING_AWAY` (a chair, office chair or outdoor chair within `seatTableReachMm` 600 of a table or desk in the same room whose front ray enters none of them within that reach; on by default, every profile inherits it; hint names the nearest table and `facing <id>`, no fix). First-contact plans: 51 seats at a table, 26 warn; the audit's 27th is café `chair_29`, south of its table and facing south, whose ray enters the next table 550 mm away. It found 17 chairs on 8 examples, all fixed in that PR. "Front of a wardrobe ≥ 600" is met by the `clear front` declaration: re-measured, a 600 default would warn on 3 of the 11 example wardrobes (`garden-loft` 100, `tiny-house` 300, `furnished-flat` 450 mm). The other bullets stay open

## §7 row 2 · status history

*Status:* wave 1 landed 2026-10-19 (PRs #199, #201, #200): classes 1, 3, 6 at 100 %, class 4 at 3/4 (PS2.17), class 2 at 1/6 waiting on PS2.4; overall 33/53 on `main@cc165f4`. Wave 2 landed 2026-10-19 (PRs #203, #204, #211): classes 1, 2, 3, 6 at 100 %, class 4 at 4/5 (80 %, below the bar until PS2.17 lands); overall 44/67 on `main@fcb3074` (the +1 is A2, the balcony-door-masked laundry, caught by PS0.10's main entrance; T2 still refuses without `site`). Wave 3 landed 2026-10-20 (PRs #214, #216, #217): classes 1, 2, 3, 4, 6 at 100 %, overall 46/68 on `main@06c6b56`; this row's acceptance is met (class 5 is row 5). Next: PS3.1 landed as ADR 0028 (PR #215, Proposed), then PS3.2 and PS3.6
