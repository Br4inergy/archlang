> Research record, 2026-10-18, against `main@8d1e13e` plus the programme docs commits, built CLI `archlang v1.43.1`
> (`dist/cli.js`). Read observations as evidence and diagnoses as hypotheses: re-measure before you
> build on a number. Programme entry: `../README.md`.

# First-contact audit: six briefs written by an AI author meeting ArchLang cold

**Method.** Re-ran `lint`, `validate --strict`, `describe --json` and `compile -f json` on each final `plan.arch` (all six still lint `[]`, strict ok), rendered every sheet and world-coordinate crops with resvg 0.47.0, and re-ran the prototype checkers (opening-vs-junction, nib, unwalled edge, WC side clearance, wardrobe front, dimension text in rooms, habitable rooms without windows, id-vs-room).
Then measured by hand: access and walk graph (also with the secondary exterior doors turned into windows, to see what they mask), furniture front rays (rotate 0 = back to the north, per the catalogue text of `W_FIXTURE_BACK_TO_ROOM`), stair landings, accessible WCs, kitchens, and areas against the brief.
Severity **B** blocker / **N** noticeable / **m** minor. Lint status **CAUGHT / PARTIAL / MISSED**; "masked" = the rule exists and would fire, but a second exterior door hides it. Class numbers refer to `evidence.md` §3; **new** = outside the eight classes.

## Header

| Plan | Rounds | Final lint codes | Verified defects B / N / m | Outside the eight classes |
|---|---|---|---|---|
| 1 Two-bed apartment 70 m² | 5 | none (strict ok) | 0 / 5 / 7 | 5 |
| 2 Three-bed house 110 m² | 2 | none (strict ok) | 0 / 3 / 5 | 4 |
| 3 Studio 30 m² | 4 | none (strict ok) | 0 / 3 / 4 | 3 |
| 4 Corner café, 24 seats | 5 | none (strict ok) | 1 / 6 / 4 | 3 |
| 5 Townhouse 2 × 55 m² | 3 | none (strict ok) | 2 / 2 / 4 | 4 |
| 6 Clinic 120 m² | 3 | none (strict ok) | 1 / 7 / 3 | 7 |
| **Total** | 22 | **0 codes** | **4 / 26 / 27 = 57** | **26** |

Lint caught none of the 57. Two (A2, T2) are "masked": the narrow-path rule fires once the patio or balcony door is removed. Tool-fact findings are listed per plan but not counted.

---

## 1. Two-bed apartment (`first-contact-plans/1-apartment.arch`)

| # | Defect | Geometry (re-measured) | Sev | Class | Lint |
|---|---|---|---|---|---|
| A1 | The front door's open leaf parks across the Bedroom 2 doorway. | `d_front` hinge (3900,1625), open leaf along x 3900, y 1625–2625. `d_bed2` opening x 3600, y 1750–2650 (hall face 3650). The leaf stands 250 mm in front of 875 of the 900 mm. | N | **new** (door–door) | MISSED |
| A2 | The sofa blocks the laundry door. From the front door the walk squeezes to 400 mm. | Sofa x 5500–7700, y 6300–7200. Laundry door x 5200, y 6800–7600, face 5250, so the gap is 250 mm over 400 mm of the door. `describe.circulation` measures the laundry from the **balcony** door. With `d_bal` made a window, lint gives `W_PATH_TOO_NARROW` "Laundry … 400 mm". | N | 5 | MISSED (masked) |
| A3 | The sofa has its back to the TV, and the coffee table sits behind it. | Sofa rotate 0 (back north) at y 6300–7200. TV unit backs onto `w_p6` at y 4050–4500 and faces south. Coffee table y 5400–5900. Crop confirms. | N | **new** (relation) | MISSED |
| A4 | Two dining chairs face away from the table. | `chair_17`/`chair_18` y 6750–7200, rotate 0, south of table y 5800–6700 | m | **new** (relation) | MISSED |
| A5 | The Bedroom 2 wardrobe opens into the bed foot. | Wardrobe front y 2225, bed foot y 2650: 425 mm | N | 5 | MISSED |
| A6 | Bedroom 1's bed head stands off the wall in front of a window. | Bed rotate 180, x 900–2700, head y 8200, wall face 8375 (175 mm gap). `window_3` x 1200–2400 is wholly behind the head. | m | 5 | MISSED |
| A7 | The kitchen has no worktop, and the hob is jammed against the side wall. | Sink, stove and fridge only, x 7300–9750 on the corridor wall. Stove ends 125 mm from the east face 9875. | N | 4 / 5 | MISSED |
| A8 | WC centreline too close to the basin. | WC y 3300–3700 (centreline 3500), basin to y 3200: 300 mm | m | 5 | MISSED |
| A9 | The common corridor is drawn as `outdoor paving` and counted as the flat's outdoor area. It also left a 25 mm gap to the wall. | `outdoor_area_m2` 19.38 = corridor 13.5 + balcony 5.88. Paving ends at y 1350, wall face 1375. The balcony was snapped from 8625 to 8650 against face 8625. The scale had to drop to 1:100. | m | **new** (context) | MISSED |
| A10 | Wall-thickness dimension text inside rooms. | "100" in the hall at (4008,3138); "250" over the laundry's "4.0 m²" at (4400,8018) | m | 8 | MISSED |
| A11 | The "Bathroom" label prints over the WC symbol. | Label and WC at about (6800,3500) | m | 8 | MISSED |
| A12 | The brief's 70 m² is met only on centrelines. | Centreline 70.0, GIA 9750 × 6750 = 65.8, net 63.3, GEA 74.3 | m | **new** (area basis) | n/a |

Tool facts. `describe.access` makes the balcony sliding door an entrance, so Living is depth 1 and the laundry's walk starts on the balcony (cause of A2's mask). Absolutely placed pieces (sofa, chairs) have no `room` in `describe.furniture`, although lint does see them (probe).

## 2. Three-bed house (`first-contact-plans/2-house.arch`)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| H1 | Bedroom 2 cannot take its double bed: there is no bedside access on either side. | Wardrobe front y 5650 to bed side y 5900: 250 mm. Far bed side y 7700 to wall face 7875: 175 mm. | N | 5 | MISSED |
| H2 | The sofa is authored as a transposed footprint, so it draws a one-seat-wide, 2.2 m-deep sofa facing south, not the TV. | `sofa at (5400,5200) size 900x2200`, no rotate (catalogue sofa is about 2200 along × 900 deep). TV on the west wall x 3475–3925 faces east. Crop confirms. | N | **new** (transposed) | MISSED |
| H3 | Two dining chairs face away from the table. | `chair_11`/`chair_12` y 2850–3300, rotate 0, table y 1800–2800 | m | **new** (relation) | MISSED |
| H4 | The kitchen has no worktop. | Fridge 3900–4500, sink 4800–5600, hob 6100–6700; nothing else | N | 4 | MISSED |
| H5 | Master wardrobe front is under 600 mm. | Front y 3150 to bed side y 2600: 550 mm | m | 5 | MISSED |
| H6 | Dimension text inside rooms. | "250" master (11725,304); "150" kitchen (3654,2900); "100" ensuite (15563,3571) | m | 8 | MISSED |
| H7 | The garage is short for a car space. | Internal length y 2050–7875 = 5825 mm (a 6.0 m convention). Car 1900 wide leaves 675 / 625 mm. | m | **new** (advisory size) | n/a |
| H8 | "~110 m²" is met only on centrelines. | Habitable centreline 110.8. Habitable GIA x 3475–16275 × y 125–7875 = 99.2 m². Net 100.9. Total GIA with garage 125.2. | m | **new** (area basis) | n/a |

The author doubted two things here, and neither is a defect. Garage → utility → kitchen is a good service route. The 8 m passage is 1.1 m clear and serves five doors.

## 3. Studio (`first-contact-plans/3-studio.arch`)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| S1 | The bathroom opens straight onto the living/kitchen/dining room, not the entrance. | Sliding `d_bath` x 3900–4700 on y 2200, facing the kitchenette 2.0 m away. The entrance room does not touch the bathroom. | N | 3 (PS2.6) | MISSED |
| S2 | The alcove's double bed has no usable sides. | Bed x 125–2125, y 400–1800. North side 275 mm (face 125), south side 350 mm (face 2150). | N | 5 | MISSED |
| S3 | The kitchenette has no worktop, and a dining chair stands beside the hob. | Hob x 3200–3800, 300 mm to the sink. `chair_13` x 2550–3000 is 200 mm from the hob. The table corner (3200,4350) touches the hob's front zone (`W_FURN_CLEARANCE` passes at 0 mm). | N | 4 / 5 | MISSED |
| S4 | A dining chair faces away from the table, against the window. | `chair_13` y 4400–4850, rotate 0, in front of `window_3` x 1800–3000 | m | **new** (relation) | MISSED |
| S5 | Annotation collisions. | "100" in the alcove (838,1971); "250" in the bathroom (3800,304); the alcove's "7.9 m²" sits on the partition line y 2200 | m | 8 | MISSED |
| S6 | The entrance takes 15 % of a 30 m² flat. | Entrance 4.48 m², plus a 4-room split of a one-room brief | m | **new** (space efficiency) | n/a |
| S7 | Area basis. | Centreline 30.0, GIA 5750 × 4750 = 27.3, net 26.3 | m | **new** (area basis) | n/a |

## 4. Corner café (`first-contact-plans/4-cafe.arch`)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| C1 | The staff WC window is crossed by the WC/store partition, so the partition dies into the glass. | `window_8` x 7100–7700 on the south wall. `w_v3` body x 7550–7650 crosses it for 100 mm, and 50 mm of glazing lights the store. The checker reports a junction crossing; crop confirms. | **B** | 1 | MISSED |
| C2 | The "double" entrance is two leaves with a 68 mm wall pier between them. The pier came from nudging leaf b 27 mm to clear `W_SWING_OBSTRUCTED`. | Leaf a ends at (901,8101), leaf b starts at (949,8149) on the 45° chamfer (48 × √2 = 68 mm) | N | 1 (PS2.2) | MISSED |
| C3 | 12 of the 24 chairs face away from their tables: every chair south of a table. | `chair_4,5,9,10,14,15,19,20,23,26,29,32`, all rotate 0. 24 chairs are present (counted). | N | **new** (relation) | MISSED |
| C4 | The bar counter is a transposed footprint. It draws a 1180 mm counter plus a stool, leaving a 680 mm visual gap into the servery, and its customer side faces along the partition, not the seating. | `bar_counter at (5650,3650) size 700x1900`, no rotate (catalogue 1800 along × 600 deep). Counter top y 3650–4830, stool about y 5310–5510, partition end about 5510. The model's footprint closes the gap; the drawing does not. | N | **new** (transposed) | MISSED |
| C5 | The staff WC opens straight onto the servery, a food-handling room. The accessible WC opens straight onto the seating (m on its own). | `d_swc` x 6400–7200 on `w_h2` (servery `uses kitchen`); `d_awc` x 700–1700 on `w_wc1` | N | 3 (PS2.6) | MISSED |
| C6 | Accessible WC: the pan has no wall for a grab rail, and the basin is out of reach from the seat. | WC centreline x 1500. Nearest side face is 2350 (850 mm away), the other 125 (1375 mm). Basin x 1900–2350, y 1600–2200, while the WC front is at y 825. Turning circle fits (clear 1775 × 1725); 1000 mm sliding door. | N | 5 (accessible) | MISSED |
| C7 | The approach to the accessible WC door narrows to 775 mm. | T5 north chair x 475–925, y 3050–3500, 400 mm from the door face 2650 over door x 700–1700 | m | 5 | MISSED |
| C8 | The kitchen has a domestic sink, hob and fridge plus a free prep table: no worktop and no wash-hand basin. The servery (`uses kitchen`) has no sink. | East wall x 9225–9875; prep table x 7200–8600, y 1500–2300 | N | 4 | MISSED (the checker flags the servery) |
| C9 | The separately drawn walls meet the chamfer with notched corners, and the outer box is inflated. | Notches at (0,7200) and (1800,9000). `bbox_outer` 10301.78 × 9301.78 against a 10250 × 9250 shell. | m | **new** (oblique join) | MISSED |
| C10 | The hand dimensions read "851.36" and "849.94" for 850 mm leaves, and are drawn at offset 0 through the leaves. | `dim (281,7481)->(883,8083) offset 0` and its twin. The jambs were hand-computed with square roots. | m | 8 | MISSED |
| C11 | Auto-dimension text inside rooms, and two door swings drawn through the dimension chains. | "250" accessible WC (513,304); "150" (6254,2775) and "100" (8938,3371) in the kitchen; `d_back` and `d_delivery` arcs cross the chains | m | 8 | MISSED |

The servery has a deliberate 1800 mm unwalled edge to the seating (the checker reports it). It is a design choice, not counted, but PS2.4 must not fire on it (see the closing section).

## 5. Townhouse (`first-contact-plans/5-townhouse.arch`)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| T1 | There is no landing at the foot of the stair, and the front-door swing covers the only floor there. | Stair `st` (150,6200) 900 × 3400, `dir up`, entered at y 9600. Front wall face 9875 leaves 275 mm. `g_front` x 1050–1950, hinged at x 1050, sweeps x 1050–1950, y 8975–9875. The open leaf lies along the flight's side. | **B** | 7 (PS2.11) | MISSED |
| T2 | The sofa blocks the hall-to-living opening. From the front door, Living and Kitchen/Dining are unreachable, so the day rooms are reached only through the garden. | Sofa x 2400–3300, y 7200–9200, 250 mm in front of `g_o_hl` (x 2100, y 7500–8500) over its full width. Circulation measures both rooms from `g_patio`. With the patio door made a window, lint gives `W_PATH_TOO_NARROW` 200 mm for both. | **B** | 5 (leaf-less opening) | MISSED (masked) |
| T3 | The sofa is a transposed footprint, drawn one seat wide, 2 m deep, facing south. It does not face the TV on the east party wall. | `size 900x2000`, no rotate. TV x 4925–5375 faces west. Crop confirms. | N | **new** (transposed) | MISSED |
| T4 | Two dining chairs face away from the table. | `chair_12`/`chair_13` y 5100–5550, rotate 0, table y 4200–5100 | m | **new** (relation) | MISSED |
| T5 | The kitchen has no worktop, and the fridge covers part of the window. | Fridge x 150–750 against `window_2` x 600–1800 (150 mm); sink and hob only otherwise | N | 4 / 5 | MISSED |
| T6 | Circulation is 22 m² of 110 m². | Hall 8.4 m²; the landing is 13.6 m², which is 25 % of the upper floor | m | **new** (space efficiency) | n/a |
| T7 | The upper partition stands on no lower wall. | `f_v1` at x 1200 runs over the middle of the 2100-wide hall (L0 walls at x 0 and 2100) | m | **new** (stacking) | n/a |
| T8 | Dimension text inside rooms. | L0: "100" WC (613,5771), "250" kitchen (5196,3038). L1: "100" bedroom 1 (688,4171), "250" landing (5196,5200). | m | 8 | MISSED |

Several stair checks pass:
- Same-id footprints are identical on both storeys, so PS2.15 would be silent, correctly.
- There is no void at the arrival. The flight tops out at y 6200 onto 1750 mm of landing.
- 13 risers of 208 mm in a 3400 mm run is within limits.

Tool facts. The top-level `describe` caption and totals cover L0 only: "a 4-room floor plan, 55 m² total". Every L1 room reports `reachable:false` (PS0.3).

## 6. Clinic (`first-contact-plans/6-clinic.arch`)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| K1 | The fire exit written `swing out` opens **into** the building, against the escape direction. The author's log calls it "a swing-out fire door". | `d_fire` x 13700–14700 on `w_s`, which is drawn west to east. `out` is the wall's −normal side (`src/geometry.ts` `doorSwing`), here north. The arc sweeps y 7100–7875 inside the corridor; crop confirms. | **B** | **new** (direction-relative clause / egress) | MISSED |
| K2 | The fire door jamb is 50 mm from the corridor partition face. The author moved it there to clear `W_DOOR_NEAR_CORNER` at the building corner. | Jamb 13700, `w_v6` face 13650 | N | 1 | MISSED |
| K3 | The corridor door fills the corridor end, with 50 mm nibs on both sides. | `d_corr` y 3900–4900; faces of `w_h1` at 3850 and `w_h2` at 4950 | N | 1 | MISSED |
| K4 | The corridor door's open leaf parks across the staff-room door. | `d_corr` hinge (10850,3900); open leaf along y about 3900, x 10850–11850. `d_staff` x 11350–12250 at y 3800: 450 mm covered, 50 mm off | N | **new** (door–door) | MISSED |
| K5 | The waiting seats cannot be used. Five chairs in a column all face south, each 200 mm from the back of the next. Eight chairs in two rows face the same way, with 50 mm from row 1's seat front to row 2's backrest. | x 200–650, pitch 650. Rows at y 4900–5350 and 5400–5850. | N | **new** (relation) | MISSED |
| K6 | Both patient chairs in every consulting room face away from the desk. The staff room's two south chairs face away too: 8 of the 13 chairs at a table. | Patient chairs y 1800–2250, rotate 0, desk y 1000–1700 (× 3 rooms); staff chairs y 2350–2800 | N | **new** (relation) | MISSED |
| K7 | The reception desk faces away from the entrance. Its staff chair is on the south side, so the receptionist sits with their back to the door and to the window 875 mm behind. | Desk x 6200–8600, y 6200–7000, rotate 0; main door x 3300–4700 at y 8000; crop confirms | N | **new** (relation) | MISSED |
| K8 | Accessible WC: the pan has no grab-rail wall, and the basin is out of reach. | Pan centreline x 12200, 1350 mm from both side faces (10850, 13550). Basin x 13100–13550, y 5900–6500, WC front y 5750. Turning circle and the 1000 mm sliding door are fine. | N | 5 (accessible) | MISSED |
| K9 | Consulting doors open straight onto the waiting room, 1050 mm from the nearest seats. The staff corridor is a plain door off the waiting room. | `d_c1..3` on `w_h1`; seat row 1 at y 4900; `d_corr` | m | **new** (non-residential zoning) | n/a |
| K10 | Both exits are on the south façade, and the second is reached only through the staff corridor. Seen from Consulting 1's door they are 43° apart. The main exit is a sliding door. | From (1800,3800) to (4000,8000) and to (14200,8000) | m | **new** (egress, PS2.16) | n/a |
| K11 | Dimension text inside rooms. | "100" Consulting 1 (2900,3571); "250" store (14063,304) | m | 8 | MISSED |

---

## Classes not in the taxonomy

1. **Furniture not facing its companion piece** (A3, A4, H3, S4, C3, K5, K6, K7, T4).
   - No plan contains a single `rotate` clause.
   - 27 of the 51 chairs at a table face away from it.
   - All 3 sofas with a TV face elsewhere.
   - The reception desk faces away from the door.
   - Every waiting row faces the backs of the next.
2. **Transposed footprint on a directional piece**: `at … size WxH` with the long side on the depth axis instead of a `rotate`. The glyph is drawn turned and stretched (H2, T3, C4). Lint and `describe` are both silent.
3. **Door–door interference**: an open leaf parks across another doorway's approach (A1, K4). `W_SWING_OBSTRUCTED` compares swings only.
4. **Entrance masking (lint blind spot)**: walk and reachability are measured from the nearest exterior door, so a patio or balcony door hides a blocked route from the front door (T2 living + kitchen, A2 laundry). Single-storey sibling of PS0.3.
5. **Direction-relative clauses**: `swing in|out` is relative to the wall's drawn direction, like `at <pos>`, not to the building. An exterior `swing out` opened inward (K1). The v1 apartment's living window landed in the laundry by the same rule; the author fixed that by hand.
6. **Context modelled inside the plan**: a common corridor drawn as paving and counted in the unit's outdoor area (A9).
7. **Area basis**: every brief area was met on centrelines, with no GIA fact (A12, H8, S7). GIA is 6–10 % below the briefed number.
8. **Non-residential zoning and egress**: public and staff separation, exit placement and escape-door type (K9, K10; the K1 swing).
9. **Space efficiency (taste)**: circulation share (T6, S6).
10. **Vertical stacking**: an upper partition on no lower wall (T7).
11. **Oblique wall joins**: notched corners and an inflated `bbox_outer` (C9).
12. **Repair pressure (mechanism, not a defect count)**: lint fixes pushed the author into other classes.
    - `W_DOOR_NEAR_CORNER` moved the fire door into a tee with a 50 mm nib (K2).
    - `W_SWING_OBSTRUCTED` produced a 68 mm pier (C2).
    - The use-blind `W_ROOM_TOO_SMALL` inflated the café staff WC to 1.6 × 3.4 m and deleted the house's linen store. A probe with a 1.5 × 1.5 m WC and cupboard fires it twice; a 700 mm door then also fails the 700 mm walk.

## Author doubts that were right / wrong

**Right:**
- Plan 1, "`at` flips on walls drawn right to left; nothing warns when an opening lands in the wrong room". It did: v1's south window was in the laundry. The same convention later flipped the clinic fire door (K1).
- Plan 1, "the balcony door counts as an entrance; do rules start from it?" They do, and that hides A2.
- Plan 1, "no concept of a corridor outside the unit" (A9).
- Plan 1, "a windowless bathroom gets no complaint": correct allowance, since an internal bathroom is fine.
- Plan 2, "I could not check whether the sofa faces the TV": it does not (H2).
- Plan 4, "`W_ROOM_TOO_SMALL` is not use-aware": confirmed by probe.
- Plan 4, "no accessibility reasoning" (C6).
- Plan 4, "I could not tell whether lint checks chairs": half of them face away (C3).
- Plan 5, "top-level `describe` shows only the ground floor": confirmed.
- Plan 5, "nothing compares the two floors' walls" (T7).
- Plan 5, "no void needed at the stair": correct.
- Plan 6, "no notion of exits or fire doors": confirmed, and worse, because the believed swing-out door swings in (K1).
- Plan 6, "nothing stops patients wandering into staff areas" (K9).

**Wrong:**
- Plan 2's worries about the garage-via-utility route and the 9.6 m² passage: both are sound.
- Plan 4, "the counter in a gap stops customers walking into the servery": true in the model, false in the drawing (C4).
- Plan 5, "the hall is too tight for a cabinet, a layout fault of mine": the real hall fault is T1, which nobody saw.
- Plan 6, "I sized the accessible WC by feel": the room is large enough, but the pan and basin layout fails (K8).
- Plan 1, "unsure whether separate walls join cleanly": clean at right angles, notched at the café's 45° chamfer (C9).

**Not re-measured:**
- Studio: a chair may reach a wall centreline unflagged (the author removed the case).
- Clinic: `W_SWING_OBSTRUCTED` fires at "0 mm short".
- Townhouse: `W_NO_ENTRANCE` after renaming the stair.

## What the language made hard (log confusion → defect)

| Confusion in the log | Spec passage (`spec.llm.md`) | Defects |
|---|---|---|
| A wall's `at <pos>` runs from the drawn start, so it silently flips on walls drawn right to left. | Line 53: `on <wall> at <pos>` = "mm along the wall". Line 53: `[swing in\|out\|into <roomId>]`, where `in`/`out` are never defined. | v1 window in the laundry; K1 |
| "`at` size is plan W×H but not which way the sofa faces". | Line 56: "`at` size is plan W×H … `against` size is along×depth"; "`rotate` is `at`/`in`-only". The spec never says rotate 0 means back to the north; only a lint catalogue text does. | H2, T3, C4, and all 27 chairs facing away |
| No double-door kind, so two leaves were composed and nudged to silence the swing rule. | Line 53: the door kinds | C2 |
| No accessible flag, exit or fire-door concept, staff/public zone semantics, or party-wall category. | Line 53 door kinds; `zone` is metadata only. Line 51 wall categories ("e.g. exterior/partition"). | C6, K1, K8, K9, K10, T7 |
| The 4 m² room floor applies to WCs and cupboards. | `W_ROOM_TOO_SMALL` (not use-aware) | C5's oversized staff WC; plan 2's dropped store |
| No neighbouring-space concept. | Outdoor kinds only | A9 |
| No furniture geometry in `describe`. | `describe` lists furniture without x/y | Authors read `compile -f json`, and nobody inspected front directions |

## What this changes in the plan

1. **The thesis holds on fresh plans.** Six lint-clean, strict-clean plans carry 57 verified defects (4 B, 26 N), lint caught none of them, and 26 fall outside the eight classes.
2. **Several cards are supported with new instances:**
   - PS2.1/PS2.2: C1, C2, K2, K3.
   - PS2.6: S1, C5.
   - PS2.9: none of the five kitchens has a worktop.
   - PS2.11: T1, T2, and the C6/K8 pan offset needing the accessible profile.
   - PS2.12: 16 auto-dimension labels inside rooms on all 7 sheets.
3. **PS3.7 now has the evidence §8 Q7 lacked.** There are 0 `rotate` clauses in 6 plans, 27 of 51 chairs at a table face away, 3 of 3 sofas miss the TV, and the reception desk faces away from the door. Raise its priority, and add an undeclared lint: "a seat's front ray misses every table or desk within 600 mm".
4. **Amend PS2.4.** A fixed counter in a gap must count as a boundary (café servery), or the rule fires on a deliberate design.
5. **New PS0 card.** Seed reachability and the walk from the main entrance, not the nearest exterior door: a patio or balcony door masked T2 and A2. This is PS0.3's single-storey sibling.
6. **New language card.** Add building-relative swing wording (`swing outward|inward`, or `into exterior`) and define `in`/`out` in `spec.llm.md`. K1 is a fire exit opening the wrong way.
7. **New rules in the PS2.11 family:**
   - door–door interference (A1, K4);
   - a transposed footprint on a directional piece (H2, T3, C4), or have PS3.7's `facing` refuse it.
8. **Guard against repair pressure (§4 rules of engagement).**
   - Make `W_ROOM_TOO_SMALL` use-aware.
   - Land PS2.1 before more corner fixes are suggested, since K2 is a corner fix that moved the door into a tee.
   - Add a double-leaf door kind (C2).
9. **Extend PS2.16 to a non-residential profile:** escape-door swing and type, exits on separate sides, public/staff zoning, and accessible WC pan offset and basin reach.
10. **Add two facts.**
    - GIA beside the centreline area, for PS4.4 briefs (A12, H8, S7).
    - A context element for shared corridors and neighbours, for PS2.14 (A9).
    - Also re-run this audit after PS2 lands, as §8 Q8 asks.

## Files

- `first-contact-plans/<n>-<brief>.arch`: the six final plans exactly as the author left them (the
  evidence; no test walks this folder). The author's intermediate versions, logs, CLI outputs, crops
  and probes were kept outside the repository.
