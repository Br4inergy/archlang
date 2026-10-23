> Research record, 2026-10-24, against `main@401c0795` (after PS2 waves 1–3 and PS3.0–PS3.8), built
> CLI `archlang v1.43.1` (`dist/cli.js`). Read observations as evidence and diagnoses as hypotheses:
> re-measure before you build on a number. Programme entry: `../README.md`. Baseline:
> `2026-10-18-first-contact.md` (the 57 defects, ids A1–K11).

# First-contact re-measurement: the old plans re-linted, the six briefs re-authored cold

## Headline

| Measure | 2026-10-18 | 2026-10-24 |
|---|---|---|
| The 57 audited defects caught by default `lint` (old plans, unchanged) | 0 / 57 | **17 / 57** (1 of 4 B, 12 of 26 N, 4 of 27 m) |
| …of the 48 the audit marked lintable (not `n/a`) | 0 / 48 | 17 / 48 |
| …with `--profile accessibility-advisory` added | — | 18 / 57 |
| Default warnings on the old plans that are false positives | — | 0 of 39 |
| Cold-authored plans: verified defects (B / N / m) | 57 (4 / 26 / 27) | **45 (2 / 24 / 19)** |
| …of which final `lint` reports | 0 | 1 |
| Plans written rooms-first (`walls from rooms`, no `wall` statement) | 0 / 6 | **6 / 6** |
| Openings-ignore-walls defects (class 1) | 4 | **0** |
| Chairs at a table facing away, final plans | 27 / 51 | 0 / 24 (24 / 24 before the lint loop) |
| `facing` clauses used | — | 0 |
| Hinged exterior doors opening the wrong way (K1) | 1 | 0 of 8 |
| Defect-corpus catch rate | 46 / 68 | 47 / 70 (two cases added, one `todo`) |

## Method

**Part 1, old plans.** `node dist/cli.js lint <plan> --json` on each of
`first-contact-plans/{1..6}-*.arch`, default ruleset and `--profile accessibility-advisory`. Each
warning was mapped to an audit defect id by plan, element and coordinates, or marked new or false
positive. The audit's own checker for wall-thickness text inside rooms (`dimin.js`, kept from the
2026-10-18 scratch) was re-run first. It reproduced every class-8 instance the audit lists (A10, H6,
S5, C11, T8, K11), so the old measurements carry over.

**Part 2, cold authoring.** Six fresh `arch-author` subagents (model sonnet), one per brief. Each got
only the brief, verbatim from the 2026-10-18 dispatch including its preamble ("metric, dimensioned,
furnished, with doors and windows, a `title`, and `dims auto` where the spec allows"). Each was
pointed at `spec.llm.md` as its only documentation and told not to read other repository files. The
instruction was: "write the plan; you may run `node dist/cli.js compile|lint` to check; stop when it
compiles". Five authors still ran the lint loop to clean, because the `arch-author` role text says to
iterate until lint is clean. The café author stopped at the first clean compile (36 warnings). It was
then asked, once and without hints, to run the same loop as the others, and it finished at one
warning it chose to keep. Both café states are reported. The final plans are in
`first-contact-plans/2026-10-24-rerun/`.

Each plan was then audited the way the baseline was:
- `describe`, Plan JSON and SVG door geometry;
- `dimin.js` for annotation;
- front rays by hand, taking `rotate 0` as back to the north (`spec.llm.md`);
- WC centrelines, stair foot and head, bed sides, worktops and kitchen-over-window runs.

The audit's `wccheck.mjs` cannot see walls derived by `walls from rooms` (it reads `wall` elements
only), so every WC was measured by hand.

**Confounders.** These are not controlled, so treat Q1 as an observation, not a controlled result:
- The 2026-10-18 author was a different agent: a lead-session teammate, with its model not recorded.
- That author had a different loop: up to 6 rounds, with `describe` and `validate --strict`.
- Today's lint is stronger. It steers the loop, and that is part of what is being measured.
- There is no walls-first control arm on today's spec.

---

## Part 1 · The 2026-10-18 plans re-linted

Default `lint` gives 39 warnings: 26 `W_SEAT_FACING_AWAY` and 13 others. All 39 are true. One is
not in the audit (townhouse, below).

| Plan | Audit defects | Caught now | Caught by | Missed |
|---|---|---|---|---|
| 1 Apartment | 12 | 3 | A2 `W_PATH_TOO_NARROW` (laundry 400 mm, now measured from `d_front`: PS0.10 unmasked it); A4 `W_SEAT_FACING_AWAY` ×2; A7 `W_ROOM_MISSING_DEFINING` (worktop half; the hob against the side wall is missed) | A1, A3, A5, A6, A8, A9, A10, A11, A12 |
| 2 House | 8 | 2 | H3 `W_SEAT_FACING_AWAY` ×2; H4 `W_ROOM_MISSING_DEFINING` | H1, H2, H5, H6, H7, H8 |
| 3 Studio | 7 | 2 | S3 `W_ROOM_MISSING_DEFINING` (worktop half; the chair by the hob is missed); S4 `W_SEAT_FACING_AWAY` | S1, S2, S5, S6, S7 |
| 4 Café | 11 | 5 | C1 `W_OPENING_AT_JUNCTION` (`window_8`, 100 mm of `w_v3` in the span); C2 `W_OPENING_OVERLAP` (69 mm pier); C3 `W_SEAT_FACING_AWAY` ×11 of the 12 chairs; C5 `W_WET_ROOM_DOOR` (the staff WC onto the servery; the accessible-WC half is silent); C8 `W_ROOM_MISSING_DEFINING` ×2 (kitchen worktop, servery sink and stove) | C4, C6, C7, C9, C10, C11 |
| 5 Townhouse | 8 | 2 | T4 `W_SEAT_FACING_AWAY` ×2; T5 `W_ROOM_MISSING_DEFINING` (worktop half; the fridge over `window_2` is missed) | T1, T2, T3, T6, T7, T8 |
| 6 Clinic | 11 | 3 | K2 and K3 `W_OPENING_AT_JUNCTION` (50 mm jambs); K6 `W_SEAT_FACING_AWAY` ×8 (all 8 of the audit's chairs) | K1, K4, K5, K7, K8, K9, K10, K11 |
| **Total** | **57** | **17** | B 1 / 4 (C1) · N 12 / 26 · m 4 / 27 | 40 |

Notes:
- **New finding, not in the audit:** townhouse `g_front`, `W_OPENING_AT_JUNCTION`. The jamb at x 1950 is 100 mm from the hall/living partition face at 2050, and the rule needs 125. The audit measured this door for T1 but did not see the nib. It is a true class-1 defect, minor.
- **C3 partial:** café `chair_29` (the T7 south chair) is the chair the PS2.11 as-built note names. Its ray enters T8 550 mm away, behind T8's own north chair, so the rule counts it as facing a table.
- **Still missed, by why:**
  - Furniture relations other than seat-to-table: A3 sofa/TV, K5 waiting rows, K7 reception desk.
  - Transposed footprints: H2, T3, C4 (`W_FOOTPRINT_TRANSPOSED`, `todo`).
  - Door–door interference: A1, K4 (`W_LEAF_ACROSS_DOORWAY`, `todo`).
  - Stair foot: T1 (`W_SWING_OVER_STAIR`, `todo`).
  - T2 is still masked: with no `site` the main entrance is refused, so the patio door still seeds the walk (corpus `masked-route-patio-door`, `todo`).
  - K1, the fire door opening inward: no rule reads an exit's swing.
  - Clearances: A5, A6, A8, H1, H5, S2, C6, C7, K8.
  - Every annotation defect: A10, A11, H6, S5, C10, C11, T8, K11.
  - The audit's context, area-basis and taste rows. Nine of these were `n/a`.
- **Accessibility profile.** It adds one plausible catch: café `W_PATH_TOO_NARROW` "Accessible WC" at 790 mm. The message names no door, so the pinch is furniture: likely C7 (the audit measured 775). It also re-reports A2 (`W_DOORWAY_BLOCKED`, sofa 300 mm) and C2 (`W_SWING_OBSTRUCTED`, leaves 81 mm short).
- **Accessibility profile, the rest.** These are profile thresholds the audit did not judge the residential briefs against (800 mm doors, 900 mm walks, 1050 mm swing radii); I count them neither caught nor false.
- **False positives.** There are 0 under the default ruleset. Under the accessibility profile there are 3, all the use-blind `W_ROOM_TOO_SMALL` the audit already named as repair pressure (§12):
  - apartment laundry, 4 m²;
  - townhouse WC, 4.2 m²;
  - studio entrance, 4.48 m². The audit's S6 says this entrance is too large, not too small.

---

## Part 2 · The six briefs, cold-authored on today's spec

### Forms used (§8 Q1: rooms-first or walls-first)

| Plan | `walls from rooms` | `wall` statements | `door between` | `on <room>.<edge>` | `open between` | relational rooms | `swing inward`/`outward` | `swing in`/`out` | `facing` | `rotate` |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Apartment | 1 | 0 | 4 | 9 | 0 | `right-of`, `below` | 1 | 0 | 0 | 0 |
| 2 House | 1 | 0 | 11 | 12 | 1 | — | 1 | 0 | 0 | 0 |
| 3 Studio | 1 | 0 | 1 | 4 | 1 | `right-of`, `below` | 0 | 0 | 0 | 0 |
| 4 Café | 1 | 0 | 4 | 6 | 1 | `right-of`, `below` | 2 | 0 | 0 | 2 (chairs, in a loop) |
| 5 Townhouse | 2 (one per level) | 0 | 7 | 13 | 1 | `right-of` | 0 | 0 | 0 | 0 |
| 6 Clinic | 1 | 0 | 6 | 8 | 1 | `strip`, `below` | 2 | 0 | 0 | 3 |

**All six cold authors wrote rooms-first.** There are 0 hand-drawn walls, every interior door is
`door between`, and every exterior opening is hosted on a room edge. The 2026-10-18 authors wrote
walls-first in six of six. The class the rooms-first form was meant to remove is gone:
- 0 openings-ignore-walls defects, against 4 (C1, C2, K2, K3).
- `E_OPENING_NIB` refused the nibs at compile time. The clinic author hit it and moved the door.
- The `at`-flips-on-reversed-walls confusion (v1 apartment, K1) did not recur: no plan writes a wall
  direction.

New authoring confusions appeared instead. Several authors reported them:
- Which end `from start` and `against … offset` count from.
- Clause order: `label` before `uses`, and the kind keyword before `on`.
- Missing default footprints for `in … anchor`.
- Whether `in … anchor` sizes are plan W×H or along×depth.

### Verified defects per plan

Severity and class follow the baseline audit. Lint is the final plan's default lint.

**1 · Apartment** (9000 × 8000 centreline, GIA 68.6 m²; final lint 0)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| NA1 | The kitchen has no worktop, and the room is typed `uses living` only, so no kitchen rule sees it | sink, stove and fridge on `living.left`; no counter; `living` has `uses living` | N | 4 | MISSED (typing) |
| NA2 | The fridge stands over the living window and the hob sits under it | `window_1` y 1350–3150 on x 0; fridge y 1050–1750, stove y 2150–2850, both against that wall | N | 5 | MISSED |
| NA3 | Both double beds are flush in a corner, so one long side has no access | bed 1 x 7300–8900, east face 8900; bed 2 the same in the south-east corner | N | 5 | MISSED |
| NA4 | The dining table has no chairs | `table_6` 1600 × 900, no seat in the plan | m | 4 | MISSED |
| NA5 | Bedroom 1 is reached only through the living/dining/kitchen | `door between living and bed1`; no hall door | m | 3 | MISSED |
| NA6 | Wall-thickness text inside rooms | "100" (5729,3575), "200" (2775,279) | m | 8 | MISSED |

**2 · House** (12500 × 9800, 122.5 m² with the garage; final lint 0)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| NH1 | The kitchen/dining room has no table or chairs, and is typed `uses kitchen` only | furniture: counter, sink, stove, fridge | N | 4 | MISSED (typing) |
| NH2 | The sofa is anchored `bottom-right flush` but not turned. It faces the kitchen partition 0 mm away, with its back to the TV, and stands across 1000 mm of the 2400 mm living/kitchen opening | `sofa_l` y 6550–7450, rotate 0; `tv_unit` y 5050–5550; `open between` x 8550–10950 | N | **new** (relation) | MISSED |
| NH3 | The hall-to-passage door swings into the 1.2 m passage. The open leaf stands across it and leaves 250 mm | leaf along x 5750, y 4100–5000; passage clear y 3850–4950 | N | **new** (leaf across a corridor) | MISSED |
| NH4 | The garage is too short for a car | internal 3375 × 4575 | N | **new** (advisory size) | n/a |
| NH5 | The front door's open leaf parks 250 mm in front of the kitchen doorway | leaf along x 6700, y 8800–9800; kitchen door face 6950, y 8250–9150 (350 of 900 covered) | m | **new** (door–door) | MISSED |
| NH6 | The fridge side stands 300 mm into the east kitchen window | fridge y 7550–8250 at the east face; `window_8` y 7950–9450 | m | 5 | MISSED |
| NH7 | Bed heads in bedrooms 2 and 3 stand 325 mm off the wall, in front of the windows | `anchor top-left flush inset 300`; bed y 450, face 125 | m | 5 | MISSED |
| NH8 | The passage is 15 m² with dead ends at both ends | 12.5 × 1.2 m serving four doors | m | **new** (space efficiency) | n/a |
| NH9 | Wall-thickness text inside rooms | "100" (9700,4593), "300" (8550,508) | m | 8 | MISSED |

**3 · Studio** (6000 × 5000, 30 m²; final lint 0)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| NS1 | The kitchenette has no worktop, and the room is typed `uses living` only | sink, stove and fridge on `living.top` | N | 4 | MISSED (typing) |
| NS2 | The fridge stands over the window, and the hob is 100 mm from the fridge | `window_2` x 800–2200; fridge x 1400–2000; stove x 2100–2700 | N | 5 | MISSED |
| NS3 | There is no sleeping alcove (the brief asks for one). The double bed sits flush in a corner, its long side across the west window | bed x 100–1700, y 2900–4900; `window_1` y 1750–3250 | N | 5 / brief | MISSED |
| NS4 | The sofa is anchored `bottom-right flush` but not turned, so it faces the south wall 0 mm away with its back to the room | `sofa_l` y 4000–4900, rotate 0 | N | **new** (relation) | MISSED |
| NS5 | Wall-thickness text inside rooms | "100" (4729,1275), "200" (450,279) | m | 8 | MISSED |

**4 · Café** (12000 × 7500, 90 m²; compile-only 36 warnings, final lint 1)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| NC1 | The servery has a bar counter and nothing else. Its `uses kitchen` was deleted to silence `W_ROOM_MISSING_DEFINING` | `service` untyped; it held `uses kitchen` at compile-only | N | 4 | MISSED (silenced) |
| NC2 | The counter has no service side: customers and staff share the servery, and the bar backs onto the wall | `bar_counter` x 9500–11900, back to the south; seating reaches the servery through a 1500 mm gap | N | **new** (counter zoning) | MISSED |
| NC3 | The staff WC opens straight onto the food store and is reached only through it. The door was moved there to clear `W_WET_ROOM_DOOR` and `W_CIRCUITOUS_PATH` | `door between staffwc and store` | N | 3 | MISSED |
| NC4 | Accessible WC: no grab-rail wall, the basin is out of reach from the pan, and the door swings into the room | pan centreline x 8500, 950 mm to both side faces; basin x 9000–9450, y 5700–6300; pan front y 6700 | N | 5 (accessible) | MISSED |
| NC5 | The kitchen's only worktop is one 600 mm module, and there is no wash-hand basin | `counter` 600 × 600 | N | 4 | MISSED (presence only) |
| NC6 | The accessible WC opens straight onto the seating | `door between seating and accwc` | m | 3 | **CAUGHT** `W_WET_ROOM_DOOR` (kept by the author; the rule cites a residential code) |
| NC7 | The "entrance on the corner" is a door 600 mm from the corner, not a corner entrance | `entrance` x 600–1800 on the south wall | m | **new** (brief) | n/a |
| NC8 | The hob sits wholly under the kitchen window | stove y 3400–4000; `window_5` y 3250–4150 | m | 5 | MISSED |
| NC9 | Wall-thickness text inside rooms | "100" (9125,1593), "200" (6350,458) | m | 8 | MISSED |

**5 · Townhouse** (5500 × 10000 per level; final lint 0)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| NT1 | The stair has no foot landing and is entered from the side. The hall door opens onto the flight's flank, and its leaf swings over the treads | `st` x 4200–5300, y 300–2700, `dir up` (foot at y 2700, face 2950: 250 mm); `door between hall and stairg` y 1050–1850, x 4000, swings into `stairg` | **B** | 7 | MISSED |
| NT2 | The stair head has no landing. On level 1 the flight arrives at y 300, 175 mm from the north face, and the stair room's only way out is the opening at the far end, over the well | `dir down` entered at y 300; `opening between landing and stairu` at y 3000 | **B** | 7 | MISSED |
| NT3 | The sofa is a transposed footprint, as in T3: drawn one seat wide, 2.2 m deep, facing south, not the TV | `sofa … size 900x2200`, no rotate; TV on the east wall | N | **new** (transposed) | MISSED |
| NT4 | The ground-floor WC pan centreline is 225 mm from the side wall | pan x 150–550, west face 125 | N | 5 | MISSED |
| NT5 | Bathroom pan centreline 225 mm from the side wall, and the basin stands 250 mm in front of the pan | pan x 4950–5350 (face 5375), front y 5250; basin y 5500–6000 on the same line | N | 5 | MISSED |
| NT6 | The bedroom 1 double bed is flush in a corner | x 2350–3950, east face 3950 | N | 5 | MISSED |
| NT7 | The hob abuts the fridge | stove y 8600–9200, fridge y 9200–9800 | m | 5 | MISSED |
| NT8 | The dining table has no chairs | `table` 1800 × 900 | m | 4 | MISSED |
| NT9 | Wall-thickness text inside rooms (both levels) | L0 "100" (850,6093); L1 "100" (2275,2593); "300" on both | m | 8 | MISSED |

Not counted: windows on both side walls, which fits a detached or end-terrace house rather than the
party walls the 2026-10-18 author assumed. The brief does not say.

**6 · Clinic** (12000 × 10000, 120 m²; final lint 0)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| NK1 | There is no seat in the building. Consulting desks have no chairs, the staff room has no table or chair, and the waiting room has one 2 m sofa | furniture list | N | 4 | MISSED |
| NK2 | Accessible WC: no grab-rail wall, the basin is out of reach, and the door swings in | pan centreline x 7500, 1450 mm to both side faces; basin x 8450–8950; `door between corr and wc` swings into the WC | N | 5 (accessible) | MISSED |
| NK3 | The second exit is reachable only through the staff room | `door on staff.right … swing outward`; the corridor has no exit | N | **new** (egress, PS2.16) | n/a |
| NK4 | The receptionist has 450 mm behind the desk | desk y 6500–7200; corridor partition face 6050 | N | 5 | MISSED |
| NK5 | The waiting sofa faces the façade 500 mm away, with its back to reception | `sofa_l` y 8600–9500, rotate 0; wall face 9900 | m | **new** (relation) | MISSED |
| NK6 | Patients have free access to the staff room and the store: the waiting room opens to the corridor that serves them | `open between corr and wait`, 1500 mm | m | **new** (zoning, K9) | n/a |
| NK7 | Wall-thickness text inside rooms | "100" (1188,5593), "200" (2575,458) | m | 8 | MISSED |

### Then and now

| Plan | Defects 10-18 (B/N/m) | Defects 10-24 (B/N/m) | Final lint caught, 10-18 | Final lint caught, 10-24 |
|---|---|---|---|---|
| 1 Apartment | 12 (0/5/7) | 6 (0/3/3) | 0 | 0 |
| 2 House | 8 (0/3/5) | 9 (0/4/5) | 0 | 0 |
| 3 Studio | 7 (0/3/4) | 5 (0/4/1) | 0 | 0 |
| 4 Café | 11 (1/6/4) | 9 (0/5/4) | 0 | 1 |
| 5 Townhouse | 8 (2/2/4) | 9 (2/4/3) | 0 | 0 |
| 6 Clinic | 11 (1/7/3) | 7 (0/4/3) | 0 | 0 |
| **Total** | **57 (4/26/27)** | **45 (2/24/19)** | **0** | **1** |

By class:

| Class | 10-18 | 10-24 |
|---|---|---|
| 1 Openings ignore walls | 4 | 0 |
| 2 Enclosure | 0 | 0 |
| 3 Circulation and privacy | 2 | 3 |
| 4 Defining contents | 5 | 8 (3 hidden by room typing, 1 silenced) |
| 5 Clearances | 11 | 14 |
| 6 Daylight | 0 | 0 |
| 7 Stair | 1 | 2 |
| 8 Annotation | 8 | 6 |
| new: furniture relation | 9 | 3 |
| new: transposed footprint | 3 | 1 |
| new: door–door and leaf across a corridor | 2 | 2 |
| new: other (brief, egress, zoning, size, context, area, taste) | 12 | 6 |

**Final lint catches about nothing in both runs, by construction:** both sets of authors repaired
until lint was clean. The yardstick is the defects that survive the loop, which fell from 57 to 45
(blockers 4 → 2), with the class mix shifting:
- Class 1 is gone (rooms-first).
- Seat turns are gone (lint-driven).
- Clearances and defining contents went up.

**What the loop caught.** The café's compile-only state is the one snapshot of what lint catches
before an author repairs. It had 36 warnings:
- 24 `W_SEAT_FACING_AWAY`, every chair;
- 2 `W_ROOM_MISSING_DEFINING`, 2 `W_WET_ROOM_DOOR`, 1 `W_HABITABLE_NO_WINDOW`;
- 1 `W_PATH_TOO_NARROW`, 1 `W_CIRCUITOUS_PATH`;
- 2 `W_SWING_OBSTRUCTED`, 2 `W_DOORWAY_BLOCKED`, 1 `W_FURNITURE_OVERLAP`.

The author fixed most of them honestly. It cleared two by moving the defect elsewhere (repair
pressure, as in baseline §12):
- It deleted the servery's `uses kitchen` (NC1).
- It routed the staff WC through the food store (NC3).

**Defects hidden by typing.** In three of the eight class-4 defects a rule exists but cannot see the
defect, because the room is not typed for the use its contents show:
- apartment `living` holds a kitchen run;
- studio `living` holds a kitchenette;
- café servery untyped after the repair.

### §8 Q8: the furniture turn and the door swing

- **Seats at tables.**
  - Only the café drew chairs: 24, against 51 in the baseline. The other five plans have no chair at a table: three dining tables or desks stand with none (NA4, NT8, NK1), and the house has no table at all.
  - The café author used `rotate`, and got all 24 inverted. Its compile-only source puts `rotate 180` on the chairs north of each table and none on the chairs south of it, so every chair faces away. The spec's line "rotate 0 = back north" did not stop that.
  - `W_SEAT_FACING_AWAY` reported all 24. The author fixed them with `rotate`, not `facing`, so the final count is 0 / 24.
  - **`facing` was used 0 times in 6 plans.**
- **Sofas and TVs.**
  - 1 of 3 sofas with a TV faces it (the apartment). Before, it was 0 of 3. The house sofa has its back to the TV (NH2). The townhouse sofa is transposed (NT3, the same `size 900x2200` mistake as T3; the author wrote "I assumed the size is plan width by height").
  - Two more seats face a wall (NS4, NK5).
  - The pattern is `in <room> anchor <edge> flush`. It turns a bed's head to the anchored wall (`rotate 180` resolved for `anchor bottom`) but not a sofa's back, so an anchored sofa faces the wall it is flush against.
- **Doors.**
  - All 8 hinged exterior doors open the intended way:
    - café and clinic exits `swing outward`;
    - dwelling front doors `swing inward` or `into <hall>`.
  - `swing in`/`out` (wall-relative) was written 0 times, and `inward`/`outward` 6 times. Every interior door uses `swing into <room>`, which resolved as the author intended.
  - The K1 class did not recur. The door faults that remain are placement, not direction:
    - a leaf across a corridor (NH3);
    - a leaf parked before a doorway (NH5);
    - a leaf over a stair (NT1);
    - accessible-WC doors opening into the WC (NC4, NK2).

### §8 Q1: rooms-first versus walls-first

Given today's spec, a cold author chooses rooms-first unprompted: 6 of 6, with 33 `door between`
and 0 `wall` statements. Against the walls-first baseline:
- class 1 fell from 4 to 0;
- no opening landed in the wrong room;
- total surviving defects fell 57 → 45.

The rooms-first gain is concentrated in class 1 and in swing wording (K1). It does not reach:
- furniture (clearances 11 → 14);
- room typing.

These were not isolated (see Confounders): a controlled answer needs a walls-first arm on today's
spec, unpaid and local, as Q1 asks.

---

## Defects lint still misses: candidate cards

Numbered for the lead; not added to `../README.md`. The existing `todo` codes that would have
caught surviving instances:
- `W_FURNITURE_OVER_WINDOW`: NA2, NS2, NH6, NC8; T5.
- `W_HOB_FRIDGE_GAP`: NS2, NT7.
- `W_WC_SIDE_CLEARANCE`: NT4, NT5; A8.
- `W_SWING_OVER_STAIR`: NT1; T1.
- `W_STAIR_HEAD_VOID`: NT2.
- `W_FOOTPRINT_TRANSPOSED`: NT3; H2, T3, C4.
- `W_LEAF_ACROSS_DOORWAY`: NH5; A1, K4.
- `W_DIM_INSIDE` widening: every plan.

The ones below have no card.

- **PS2.30 · Room use inferred from contents.** A room holding a kitchen sink, stove or fridge but not typed `kitchen` (or untyped) gets `W_ROOM_USE_MISSING`, or the kitchen rules run on the inferred use. NA1, NS1, NC1. NC1 shows that deleting the type is the cheapest way to silence `W_ROOM_MISSING_DEFINING`.
- **PS2.31 · A table or desk with no seat.** A dining table or desk with no chair within `seatTableReachMm`. NA4, NT8, NK1. Also a waiting room's seat count, as a profile value.
- **PS2.32 · A seat or sofa facing a wall.** A sofa or seat whose front ray meets a wall face within 600 mm: NS4, NK5, NH2's front. A sibling of PS2.28. Also make `in <room> anchor <edge> flush` turn a sofa's back to the anchored wall as it does a bed's head, or say in `spec.llm.md` that it does not.
- **PS2.33 · An open leaf across a corridor.** An open leaf in a circulation room that leaves under 700 mm past it: NH3. A sibling of `W_LEAF_ACROSS_DOORWAY`.
- **PS2.34 · Stair foot and head landings, and side entry.** A landing shallower than the flight width at the foot or head, and a door or opening onto a flight's flank (NT1, NT2; T1). Extends PS2.11's stair bullets, which today name only the swing and the void.
- **PS2.35 · A wet-room door onto a food store.** `W_WET_ROOM_DOOR` reaches `kitchen` and `dining` only. A WC opening onto a store in a plan with a kitchen should count (NC3).
- **PS2.36 · Accessible WC door swing.** An accessible WC whose hinged door opens inward (NC4, NK2). Fold it into PS2.16 with the pan offset and basin reach.
- **PS2.37 · `W_WET_ROOM_DOOR` on non-residential plans.** NC6 cites GB 50096 (residential) on a café's public WC, and the author kept it as wrong for the building type. Decide whether the rule should defer to a non-residential profile.

Not lint: NH4 garage depth and NS3 missing alcove (brief and size, PS4.4); NC2 counter zoning and
NK6 public/staff zoning (PS2.16).

## Corpus (card PS1.2)

Two cases were added with clean twins:
- `test/defect-corpus/clearances/seat-facing-away.arch`: `done`, `W_SEAT_FACING_AWAY`. Its twin uses `facing t_dine`.
- `test/defect-corpus/circulation-privacy/fire-door-inward.arch`: K1 reduced. Lint says nothing today, so the case is `todo` with the proposed code `W_EXIT_SWINGS_INWARD` (PS2.16, added to the folder README's proposed list). Its twin uses `swing outward`.

Catch rate: 46 / 68 → **47 / 70**:
- clearances 5 / 18;
- circulation-privacy 11 / 12;
- every other class unchanged.

## Files

- `first-contact-plans/2026-10-24-rerun/<n>-<brief>.arch`: the six final plans as the cold authors left them.
- The café's compile-only version, the lint JSON, the SVGs and the checker runs were kept outside the repository.
