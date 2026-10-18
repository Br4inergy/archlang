> Research record, 2026-10-18, made against `main@98bd30b` (v1.43.1). Copied from the
> session's scratch: machine-local paths are replaced by `<scratch>/`, and closed-source
> and marketing material is removed. Read observations as evidence and diagnoses as
> hypotheses (the `docs/backlog.md` rule): re-measure before you build on a number.
> Programme entry: `../README.md`.

# Floor-plan audit: showcase plans (github.com/ChanMeng666/archlang-showcase) and repo examples

2026-10-18 · compiler `archlang v1.43.1` (`dist/cli.js`) · read-only on every repo.

**Method.** For each plan: `compile` → resvg PNG (full sheet plus world-coordinate crops); `lint --json`,
`validate --strict --json`, `describe --json` (in `json2/`). Then three independent checkers written
for this audit (in this folder), run over the resolved IR from `resolveAll()`:

- `geocheck.mjs`: openings that cross a wall junction, jamb nibs under 100 mm, overlapping openings,
  door sweep against walls and furniture, unwalled room edges, free wall ends, wrong-room fixtures,
  and missing defining fixtures.
- `wccheck.mjs`: distance from the WC centreline to the nearest side obstacle.
- `robecheck.mjs`: clearance in front of a wardrobe (heuristic).

`idmatch.js`, `habwin.js` and `dimin.js` check describe and the SVG: whether an element's id matches the
room describe assigns it, habitable rooms with no window, and dimension text inside room floors.

Every defect below was checked against the geometry (coordinates quoted) and, where it is visual, against
a crop. Defects that are the deliberate point of a plan are marked **(intentional)**. Railroad's whole
lint list falls in this class, as do the Micro Machines in McCallister's door swing and Dust2's stacked crates.

Severity: **B** = blocker (an architect would call it out at a glance) · **N** = noticeable ·
**m** = minor. Lint status: **CAUGHT (code)** / **PARTIAL** / **MISSED**.

---

## 1. Priority showcase plans

### railroad-apartment (`archlang-showcase/plans/railroad-apartment/plan.arch`)
The lint list is the joke; all 18 warnings are intended. Defects that are *not* intended:

| # | Defect | Elements / geometry | Sev | Lint |
|---|---|---|---|---|
| R1 | The street door cuts into the east party wall. The opening runs x 2400–3300, but the inner face of `w_east` is at 3250, so the jamb notches 50 mm into the 300 mm party wall (visible step, crop `rr-front.png`). On the west side only a 50 mm nib is left to `w_hall`. The leaf's sweep also grazes `w_east`. | `d_front` on `w_street` at 2850 w900 | N | PARTIAL: `W_DOOR_NEAR_CORNER` fires but reports a "100 mm nib" measured to the centreline. It never says the opening overlaps the wall body. |
| R2 | The TV is flagged "back to room". A TV against the hall wall, facing the sofa, is correct, so this looks like a lint false positive (FP) on the `tv` glyph orientation. | `f_tv` (1950,600) 300x1100 | m | FP |

Everything else (windowless bedrooms, bath through Bedroom 2, 600 door, fridge in swing) is intentional and caught.

### tweet-house (`plans/tweet-house/plan.arch`, 277 B) — passes strict, but:
| # | Defect | Geometry | Sev | Lint |
|---|---|---|---|---|
| T1 | **The Living room (16 m², the main room) has no window.** The one window (`at 16m`, on the east face x=6000, y 1500–2500) belongs to Bed. | describe: `windows:[{room:room_2}]` | **B** (the README calls it "a building rather than a picture") | MISSED. The label "Living" is not inferred as `uses living` (describe `uses: []`; "Living Room" also gives `[]`), so no rule can see the room. |
| T2 | **The interior partition is drawn as a 200 mm hatched exterior wall.** It is the same `exterior` polyline segment (4m,0)→(4m,4m), with rooms on both sides. | wall `w` seg 5 | N | MISSED |
| T3 | The front door swings outward over the street. | `door on w at 10m` | m | MISSED (no rule) |
| T4 | The bed stands in front of the window: bed y 100–2100 against window y 1500–2500 leaves 600 mm of glass behind the bed side. | `furniture bed at(5m,100)` | m | MISSED |

### mccallister-house (`plans/mccallister-house/plan.arch`)
| # | Defect | Geometry | Sev | Lint |
|---|---|---|---|---|
| M1 | **Rear-hall opening squeezed between two T-junctions.** `o_hall_rear` spans x 6900–7900. The jamb sits 50 mm from the `p_livhall` face (6850) on one side and 50 mm from the `p_kitchen` face (7950) on the other, so both nibs are 50 mm slivers (no casing possible). | `o_hall_rear` on `p_spine` | N | MISSED: `W_DOOR_NEAR_CORNER` only applies to doors, and only to corners. |
| M2 | **The powder-room WC is jammed into the corner.** Its centreline is 200 mm from `p_powder`; the minimum is about 380–400 mm. | `f_wc` x 15450–15850 | N | MISSED |
| M3 | The WC cistern backs onto the pocket-door cavity. `d_powder` slides left into x 15700–16500 of `p_pantry`, which overlaps the WC (x 15450–15850) by 150 mm (crop `mc-pantry.png`). | `d_powder`, `f_wc` | m | MISSED. `W_POCKET_RUN` checks wall length only, not fixtures on the cavity. |
| M4 | The fridge stands in front of the kitchen window: fridge x 12050–12750 against window `win_kit_n2` x 11000–12400 (350 mm overlap, crop `mc-top.png`). | `f_fridge`, `win_kit_n2` | m | MISSED |
| M5 | Guest WC only reachable through the Butler's Pantry (service zoning). | `d_powder` between `r_powder`↔`r_pantry` | m | MISSED |
| M6 | Stray wall-thickness dimension labels inside rooms ("100" in the pantry at (15450,7771), "300" in the living room). | `dims auto all` | m | MISSED (`W_DIM_INSIDE` ignores auto dims) |
| — | Micro Machines in the front-door swing | `f_micro` | (intentional) | CAUGHT `W_SWING_OBSTRUCTED` |

---

## 3. Other showcase plans

| Plan | # | Defect | Geometry | Sev | Lint |
|---|---|---|---|---|---|
| miraflores-raid | MR1 | **Two south windows straddle T-junctions, so partitions dead-end into the glass.** `s_vest_w` spans x 32500–34500 across `w_s3` (x 33000); `s_vest_e` spans x 41500–43500 across `w_s4` (x 43000). Each has 350 mm of glazing in the guard post and the rest in the vestibule (crop `mr-vest.png`). describe still reports `room: r_vestibule`. | `s_vest_w`, `s_vest_e` | **B** | MISSED |
| miraflores-raid | MR2 | The 2400 mm main entrance is drawn as a single hinged leaf (also Dunder Mifflin `d_entry` 1800, West Wing `d_main` 2000 and `d_rose` 1800, Bag End `d_front` 1200 is fine). | `d_main` | N | MISSED |
| miraflores-raid | MR3 | The Staff and Aides' Office area text ("35.8 m²") overprints the room's south wall (label overflow). | `r_office_a/b` | m | MISSED (`W_ROOM_LABEL_OUTSIDE` did not fire) |
| dust2 | D1 | **The title-block project value overprints the "PROJECT" caption and runs out of the frame** (crop `d2-title.png`). | `title.project` | N | MISSED |
| dust2 | D2 | The overall dimension reads **"106724.25"**: the acute miter spike of the diagonal exterior walls inflates `bbox_outer` to 106724.26. | `dims auto overall` | N | MISSED |
| evergreen-terrace | E1 | Title-block overflow ("742 Evergreen Terrace — Ground Floor" over "PROJECT", crop `et-title.png`). | title | N | MISSED |
| evergreen-terrace | E2 | The bathroom WC is in the corner: centreline 200 mm from `p_wing`, and it backs onto the `d_bath` pocket wall. | `f_wc` | N | MISSED |
| evergreen-terrace | E3 | The canted bays are glazed only on their front face; the angled sides are solid, which is not how a bay window works. | `w_front` bay segments | m | MISSED |
| villa-rotonda | V1 | Title-block overflow (crop `tb-vr.png`). | title | N | MISSED |
| villa-rotonda | V2 | **describe assigns the Camera and Scaletta windows to the Loggia.** `win_camera` (x 16250) and `win_scal` (x 8750) on the portico wall come back as `room: <q>.loggia`. describe therefore says the four `Camera` bedrooms have **no window**, while lint (no `W_BEDROOM_NO_WINDOW`) disagrees. | `*.win_camera`, `*.win_scal` | N (agent-facing facts wrong) | MISSED (tool inconsistency) |
| villa-rotonda | V3 | The flight of steps stops 700 mm short of the portico: treads `i*700` for i<10 end at y 6300, and the loggia starts at 7000. | steps loop | m | MISSED |
| villa-rotonda | V4 | Fidelity: the four quarters are a **pinwheel** (`rotate 90`), but Palladio's plan is mirror-symmetric about both axes. The four wedge voids between the drum and the band walls are where the real stairs are; the plan puts straight flights inside the "Scaletta" rooms instead. | `place quarter() … rotate` | N (fans and architects will notice) | n/a |
| west-wing | W1 | Title-block overflow (crop `tb-ww.png`). | title | N | MISSED |
| west-wing | W2 | The "Oval Office" is a rectangle with one bowed wall, not an oval. The Cabinet Room has no window, though the real one opens onto the Rose Garden (here the colonnade sits between it and the east facade). | `r_oval`, `r_cabinet` | N (fidelity) | n/a |
| west-wing | W3 | The `R7300` radius dimension runs through the Oval Office furniture. | `w_oval` | m | MISSED |
| friends-apartments | F1 | **The stairwell exit door (`d_exit`) notches 25 mm into the party wall `w_corr_east`** (opening x 10500–11500, wall face 11475; crop `fr-exit.png`). It is also an exterior door in the north wall of an upper-floor flat, so it opens onto nothing. It looks added to satisfy `W_NO_ENTRANCE`. | `d_exit` on `w_common_n` | N | MISSED (`W_DOOR_NEAR_CORNER` silent here) |
| friends-apartments | F2 | The two front doors don't face each other as the accDescr and the show have it: Apt 20 spans y 4700–5700 and Apt 19 spans y 3700–4700. | `d20_front`, `d19_front` | m | n/a |
| friends-apartments | F3 | Windows `window_2` and `window_3` on `w20_west` sit with 50 mm nibs between `w20_kit_s`/`w20_bed_n` and the balcony railing. | | m | MISSED |
| friends-apartments | F4 | The title-block value touches the "PROJECT" caption with no gap (crop `tb-fr.png`). | | m | MISSED |
| bag-end | BE1 | The **`R1800` radius dimension overprints the "Entrance Hall" label** and the round-door swing (crop `be-hall.png`). | `w_porch` dim | N | MISSED |
| bag-end | BE2 | Furniture label "Presses" spills out of its piece and across the wall into the Bathroom ("resses"). The room label "Wardrobes" is wider than the 1.9 m room and crosses its walls. The "Spare Bedroom" and "Bathroom" labels overprint the bed and WC (crop `be-north.png`). | `f_press`, room labels | N | MISSED |
| bag-end | BE3 | The Best Bedroom bed headboard covers half of each window (bed x 3600–5100; windows 3100–4100 and 4600–5600). The wardrobe front faces the bed head 200 mm away. | `f_bed`, `f_robe` | m | MISSED |
| bag-end | BE4 | `o_arch` leaves 50 mm wall slivers at both jambs (`w_tun_n`/`w_tun_s` faces). | `o_arch` | m | MISSED |
| bag-end | — | Spare Bedroom has no window | | (book-accurate: the north rooms are buried) | CAUGHT `W_BEDROOM_NO_WINDOW` |
| dunder-mifflin | DM1 | Two open WCs side by side in each restroom with no cubicles (commercial restroom). | `f_wcm1/2`, `f_wcw1/2` | m | MISSED |
| dunder-mifflin | DM2 | Stray thickness dimensions inside the Accounting room, Bullpen and Reception ("300", "100", "200"). | auto dims | m | MISSED |
| skeld | SK1 | `o_shield_w` is crossed by the hull corner (150 mm) and leaves a jagged sliver (crop `sk-shield.png`). The "Shields" label sits on the South Hall/Shields wall. | | m | MISSED |

---

## 4. Repo examples (`archlang/examples/*.arch`, used by the docs and playground)

lint/validate are clean on all of these except the codes noted.

| Example | # | Defect | Geometry | Sev | Lint |
|---|---|---|---|---|---|
| **two-bed** | X1 | **Circulation runs through the bathroom.** Front door → Hall → *Bathroom* → *Master Bedroom* → *Kitchen/Living* → Bedroom 2 (describe depths 1/2/3/4/5). The living space and the second bedroom can only be reached through the bath and the master bedroom. The bath has two doors and is a thoroughfare. | `door_5` (hall↔bath), `door_4` (bath↔bed1), `door_2` (bed1↔kitchen) | **B** (the first example many users open) | MISSED. Only `W_BATH_VIA_BEDROOM` exists, and it fires the other way round. |
| **hillside-villa** L1 | X2 | **The Living room (28.8 m², "the arc bay") has no window.** The bay is a solid arc wall with no glazing; the only light is the garden door. | `r_living`, `shell` arc | **B** | MISSED (no living rule; see T1) |
| hillside-villa L1 | X3 | `o_entry_dining` (x 4300–6700 on `w_l1_band_w`) is crossed by the living/dining partition `w_liv_din` (x 4800), which leaves a free-standing 150 mm pier inside the opening. | | N | MISSED |
| hillside-villa L1 | X4 | The garage opens straight into the Study. | `d_garage_int` | N (zoning) | MISSED |
| **hillside-villa** L2 | X5 | **The Ensuite→Landing door swings over the top tread of the stair.** `d_en2_corr` spans x 4550–5250 and swings out into the landing, sweeping y 2600–3300. The stair starts at x 4900, y 2700, and its DN end is at the west (crop `hv-stair.png`). | `d_en2_corr`, `stair` | **B** (safety) | MISSED (swing checks ignore stairs) |
| hillside-villa L2 | X6 | The Bedroom 2 wardrobe faces the bed 100 mm away (bed x 1300–2800, wardrobe 2900–3500). | `bed_1`, `wardrobe_3` | N | MISSED |
| hillside-villa | X7 | **The stair is too steep:** a 2200 mm run for a 3000 mm storey (default `STOREY_HEIGHT`) gives about 9 risers of 333 mm. | `stair` 2200x1000 | N | MISSED |
| hillside-villa L2 | X8 | All three ensuites put the WC centreline 200 mm from the wall. The two ensuites with a second door onto the landing make "ensuite" bathrooms shared. | `en*.wc_3`, `d_en2_corr`/`d_en3_corr` | m | MISSED |
| **two-storey** L2 | X9 | **The void is at the head of the stair.** The up-flight arrives at y 1500 (north end); `void gallery` covers (100,200)–(1000,1300), so the top-of-stair landing is a hole. | `stair`, `void id=gallery` | **B** (safety) | MISSED |
| two-storey L2 | X10 | `d_bed2` (y 3650–4550) fills the whole gap between the `bed_w` and `bath_w` faces with 0 nibs. The partition dead-ends on the jamb. | `d_bed2` on `hall_w` | N | MISSED |
| two-storey | X11 | Stair 2600 run for 2700 mm → about 11 risers of 245 mm (over the 220 UK / 197 IRC limits). The bath WC centreline is 200 mm from the wall. | | m | MISSED |
| **garden-house** L1 | X12 | **An open WC and basin stand in the Utility room, which is also the passage from the hall to the garage** (`d_util` hall↔util, `d_gar` util↔garage). | `r_util uses utility wc`, `wc` | N | MISSED |
| garden-house L1 | X13 | The drawing overflows the sheet: the north arrow is clipped at the top edge. | | N | CAUGHT `W_DRAWING_OVERFLOW` |
| garden-house L2 | X14 | describe makes the balcony door `d_balcony` the storey's "entrance", so Bedroom 1 comes out at depth 1. | describe L2 access | m (tool) | — |
| townhouse | X15 | The WC is in the corner (centreline 200 mm) on all three storeys. Stair: 3200 run for 3000 → about 13 risers of 231 mm. A "300" thickness dimension is printed over the stair on every storey. | `wc_*`, `st`, auto dims | N | MISSED |
| furnished-flat | X16 | The kitchen is unreachable: the armchair blocks `opening_1`. | | N | CAUGHT `W_PATH_TOO_NARROW` (no culprit named) |
| furnished-flat | X17 | The Bedroom 2 window jamb is 50 mm from the `w_bed` partition. | `window_6` | m | MISSED |
| laneway-house | X18 | The bath WC centreline is 200 mm from `w_hall`, and the WC sits beside the pocket cavity. Stray "200" in the Bath and "100" in the Bedroom. | `wc_10` | N | MISSED |
| courtyard-house | X19 | `d_court_l` has a 0 mm nib to the courtyard corner. `o_gal_w`/`o_gal_e` have 50 mm nibs. `w_entry_l` is 50 mm from `w_band_n`. The bath WC centreline is 200 mm from the wall. Four stray thickness dimensions. | | m | MISSED |
| tiny-house | X20 | The route to the wet room squeezes to 400 mm between the bed and the bench. | | N | CAUGHT `W_PATH_TOO_NARROW` |
| tiny-house | X21 | The WC centreline is 200 mm from `w_wet`. The "1850" dimension text sits on its own dimension line. | | m | MISSED |
| bungalow | X22 | A free-standing "┬" pier (spine stub x 2700–3800 plus a 300 mm leg of `w_kitchen`) stands between `o_kitchen` and `o_living`. | | m | MISSED |
| studio | X23 | Same family as S1/S3. The "Bedroom" label touches the east wall. The double bed has 300 mm on one side. | | m | MISSED |
| attached | X24 | The bed side covers the bedroom window. The flat has no kitchen or bath (a strip-layout demo). | | m | — |
| accessible | X25 | The Living room has no window. | | m | MISSED |
| library | X26 | `o_hall_lobby` spans the full centreline width between `w_hall_n`/`w_staff_s` and `w_lobby_s`, so all three walls dead-end 100 mm into the opening. | | m | MISSED |
| all multi-storey | X27 | describe `levels[n].access.rooms[*].reachable` is **false** for every upper-storey room (two-storey, townhouse, hillside), but `vertical.reachable_levels` says [1,2(,3)]. Agents that read per-level access get a false "unreachable". | describe | N (tool) | — |
| 28 sheets | X28 | **`dims auto all` puts wall-thickness tier labels ("100/150/200/300") inside rooms.** They land on doors (now.svg), on stairs (townhouse) and inside bedrooms (two-storey). List from `dimin.js`: dunder-mifflin, mccallister, now.svg, bungalow, classroom-block, clinic, corner-cafe, courtyard-house, gallery-l, garden-loft, hillside L1/L2, laneway, library, materials, museum*, practice-office, sheet-notes, townhouse L1–L3, transit-hall, two-storey L1/L2. | `A-ANNO-DIMS` | N | MISSED (`W_DIM_INSIDE` exists but does not cover auto chains) |
| 10 sheets | X29 | Title-block value overflow (estimated, then confirmed visually on 5): dust2, evergreen, west-wing, villa-rotonda, friends (touching), plus examples museum-wings and transit-hall (estimated 660/2100 mm over). | `title.project` | N | MISSED |

WC-in-corner (centreline 200 mm from a wall, against a 380–400 mm minimum) is **systemic**: 20 instances across
evergreen, mccallister, courtyard, garden-house, hillside (×4), laneway, materials, terrace-row (×4), tiny-house, townhouse (×3),
two-storey (`wccheck.mjs`). It probably comes from the `anchor … flush size 400x700` idiom and the furnish table.

---

## 5. Proposed checks for the MISSED classes (exact geometry/graph)

1. **OPENING_CROSSES_WALL / NIB_TOO_SMALL** (MR1, R1, F1, M1, X3, X10, S3, BE4, SK1, X26). For every opening on host segment
   H, with span [t0,t1] along H, build its rectangle (span × H.thickness+40). Intersect it with the body rectangle of every
   other wall segment. Any overlap area > 400 mm² is an error: name the crossing wall and the overlap length.
   Separately, for every near-perpendicular wall touching H's centreline band, nib = distance from the jamb to that wall's
   face along H. Warn when 0 ≤ nib < max(100, H.thickness/2). Apply to `window` and `opening`, not only `door`.
   (`geocheck.mjs` implements both. On this corpus it had no false positives.)
2. **HABITABLE_NO_WINDOW** (T1, X2, X25). Any room whose uses ∩ {living, kitchen, dining, bedroom, office} ≠ ∅ with zero
   windows attributed in describe. This needs the label vocabulary to infer `living` from "Living"/"Living Room"
   (today it returns `uses: []`).
3. **THOROUGHFARE through wet room or bedroom** (X1, X12, M5). On the describe door graph from the entrances, for each
   room, find the shortest path. Flag when an interior vertex of any shortest path to a non-wet room has uses ⊇ {bath|wc}.
   Flag when an interior vertex is a bedroom and the target is not that bedroom's ensuite. Flag a `wc`-use room with
   ≥ 2 doors in which one target is a garage, kitchen or living room.
4. **DOOR_SWING_OVER_STAIR / VOID_AT_STAIR_HEAD** (X5, X9). Treat each stair's footprint (plus a 900 mm landing
   rectangle beyond each entry edge from `entryEdges()`) as an obstacle for the door quarter-disc test. For each `void`,
   test its intersection with each stair's arrival landing rectangle on that storey.
5. **FIXTURE_SIDE_CLEARANCE / FRONT_CLEARANCE** (M2, E2, X15 …; S1, X6, BE3). WC: the perpendicular distance from the pan
   centreline to the nearest wall face or fixture whose span overlaps the pan depth must be ≥ 400. Wardrobe/robe: the front
   face is the face opposite the backing wall; clear depth in front must be ≥ 600 (550 sliding). Hob↔fridge or tall unit
   lateral gap ≥ 300 (S2).
6. **ANNOTATION_COLLISION** (X28, BE1, BE2, MR3, W3, title overflow X29/D1/E1/V1/W1). After layout, take the bbox of each
   text run (font metrics × chars). Flag dimension text whose anchor lies inside any room floor polygon when it belongs
   to an auto chain. Flag text bboxes that intersect door/stair/furniture glyph bboxes or other labels. Flag a title-block
   value whose width exceeds (row width − caption width − padding); in that case shrink or wrap the value.
7. **WALL_CATEGORY_MISMATCH** (T2). An `exterior` wall segment with a room polygon on both sides of its centreline
   (probe ±(t/2+50) mm at the midpoint).
8. **STAIR_PITCH** (X7, X11, X15). With rise = storey height, risers n = ceil(rise/220) and required run ≥ (n−1)×220.
   Flag a flight shorter than that, or a riser > 220 (UK) / 197 (IRC profile).
9. **WINDOW_BEHIND_FURNITURE** (M4, N2, T4, BE3). The window span projected 600 mm into the room intersects a full-height
   piece (fridge, wardrobe, tall unit) or the side of a bed or basin.
10. **DESCRIBE consistency** (V2, X14, X27). A window between an enclosed room and a covered loggia/outdoor room should be
    assigned to the enclosed room (lint and describe must agree). An exterior door on a storey above the lowest is not an
    "entrance". Per-level `access.rooms[*].reachable` should seed from the stair stops when `vertical.reachable_levels`
    contains that level. Overall `dims` should round or exclude acute-miter spikes (D2).

## 6. Files

- Renders: `renders2/*.png` and crops `rr-front, mc-pantry, mc-top, now-bath, be-hall, be-north, d2-title, et-title,
  tb-ww, tb-vr, tb-mr, tb-fr, tb-mc, mr-vest, fr-exit, sk-shield, hv-stair`.
- CLI JSON: `json2/<plan>.{lint,validate,describe}.json`.
- Checkers: `geocheck.mjs`, `wccheck.mjs`, `robecheck.mjs`, `dumpf.mjs`, `idmatch.js`, `habwin.js`, `dimin.js`,
  `showlint.js`, `crop.sh`. Outputs are in `geo/`.
