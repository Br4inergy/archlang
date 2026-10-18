> Research record, 2026-10-18, made against `main@98bd30b` (v1.43.1). Copied from the
> session's scratch: machine-local paths are replaced by `<scratch>/`, and closed-source
> and marketing material is removed. Read observations as evidence and diagnoses as
> hypotheses (the `docs/backlog.md` rule): re-measure before you build on a number.
> Programme entry: `../README.md`.

# Audit: the ArchCanvas public examples (github.com/archcanvas/archcanvas `examples/`) (10 plans), ArchLang v1.43.1

Method: every `plan.arch` recompiled with `dist/cli.js` (v1.43.1), rendered with resvg at 2000 px
(`renders/*.png`, crops `renders/crop_*.png`), plus `lint --json`, `validate --strict --json`,
`describe --json` and `compile -f json` (resolved geometry) in `json/`. Geometry checks were scripted in
`check.py` (opening-vs-wall-junction clearance, openings overlapping on one run, door sectors parsed
from the SVG against furniture, walls and other sectors, room-edge wall coverage, furniture containment
and overlap) and `win_block.py` (furniture standing in front of windows). Every defect below was
confirmed in the coordinates and checked against the render. Coordinates are in mm, plan axes (y down).

**Lint/validate output across all 10 plans:** 8 plans are completely clean. corner-cafe gives 2 × `W_OPENING_NOT_DIMENSIONED`.
studio-loft gives `W_PATH_TOO_NARROW` and `W_FIXTURE_BACK_TO_ROOM`. `validate --strict` returns the same set.

Severity: **B** = blocker (an architect would call it out at a glance), **N** = noticeable, **m** = minor.

## Shipped files vs recompile (global)

* G1 (N): the README says "If you recompile one, you get the drawing back". With v1.43.1, only
  accessible-clinic and bay-bungalow match, and only after ignoring the root `width`/`height` attributes.
  The other 8 differ (dimension and label placement), and the townhouse `plan.L0/L1.svg` use a different
  viewBox, aspect and sheet. The geometry is the same in every case, so the defects below apply to the shipped sheets too.
* G2 (tool bug, N): `compile -f json` (Plan JSON) **drops arc segments**. The shell `points` list only the
  chord vertices (bay-bungalow, gallery-wing). A `--from-json` round-trip (`probe/bay-roundtrip.png`)
  loses the bay and leaves `win_bay` floating about 1.5 m outside a straight wall.

## Per-plan defects

### accessible-clinic (fairly clean geometrically)
| id | defect | where | sev | lint |
|---|---|---|---|---|
| CA1 | Accessible WC door swings **into** the WC. The leaf sweeps the turning space, and Doc M / ADA practice wants it outward. | `d_wc` w_service x 700–1700, sector to y 6600 | N | MISSED |
| CA2 | Accessible WC pan centreline is 200 mm from the side wall. It should be 400–500 mm (no transfer geometry). | `f_wc` x 1950–2350, wall face 2350 | m | MISSED |
| CA3 | 1500 mm **single** entrance leaf. That isn't buildable/usable as one leaf; it should be a pair or leaf-and-a-half. | `d_entry` x 450–1950 | m | MISSED |
| CA4 | Consulting 1–3 and Treatment have no clinical hand-wash basin, and the "Couch" draws as a bed with pillow. | r_con1-3, r_treat | m | MISSED |
| CA5 | Jamb is 50 mm from a T-junction face. | `d_staff` span 7100–8100, w_s2 face 7050 | m | MISSED |

### bay-bungalow
| id | defect | where | sev | lint |
|---|---|---|---|---|
| BB1 | **The "round snug" has no round wall.** Circle R1200 at (5900,10800) sits inside a walled 3800×2400 rectangle (x 3400–7200, y 9600–12000, 9.1 m²). About 4.6 m² of walled floor belongs to no room and renders white. The schedule says 4.5 m². The φ2400 leader crosses the sofa and the area text is clipped. | `r_snug` | **B** | MISSED |
| BB2 | Kitchen window straddles the w_snug T-junction. The span y 8500–9700 has the wall at y 9600, so 150 mm of glazing (−150 mm clearance) is on the Entry side. | `win_kit` west wall | N | MISSED |
| BB3 | Bay window is drawn as a straight chord with sill lines floating outside the arc. `describe` gives `win_bay.room = null`. | `win_bay` | N | MISSED |
| BB4 | **The kitchen is the only route** from the front door to the rest of the house: entry(1) → kitchen(2) → living(3) → hall(4) → bedrooms/bath(5) (`access.rooms` depths). | d_kitchen / o_living | N | MISSED |
| BB5 | Dining 2200×2800 with a centred 1200×1600 table leaves 450 mm to the walls each side, so there is no room for chairs. | `f_dtable` | N | MISSED |
| BB6 | Snug has no window. Bed 2 is labelled "Single" but drawn 1200 wide with two pillows, and has no wardrobe. | | m | MISSED |

### compact-bedsit
| id | defect | where | sev | lint |
|---|---|---|---|---|
| CB1 | "Bath" has **no shower or tub**, only a basin and WC. | `r_bath` | N | MISSED |
| CB2 | Kitchen is sink + hob + fridge butted together with no worktop, and the fridge is directly against the hob. (The same template is in courtyard, studio-loft, townhouse and family-house.) | f_sink/f_stove/f_fridge | m | MISSED |
| CB3 | The 6.4 m² "Wardrobe" room is empty. | `r_store` | m | MISSED |

### corner-cafe
| id | defect | where | sev | lint |
|---|---|---|---|---|
| CC1 | **Entrance door and corner window overlap by 400 mm** on the chamfered wall. Along shell seg3 the door is at s 1350–2850 and the window at s 250–1750. The glazing runs into the door opening and the outward leaf sweeps over it (`crop_cafe_entry.png`). | `d_entry` + `win_corner` | **B** | MISSED (only W_OPENING_NOT_DIMENSIONED) |
| CC2 | Barn-door opening ends exactly on the w_k T-junction. The last 50 mm sits behind the wall body and there is no jamb. | `d_kitchen` w_spine y 2800–4000, w_k at y 4000 | N | MISSED |
| CC3 | WC door jamb is 25 mm from the shell inner face (8875). | `d_wc` y 7950–8850 | m | MISSED |
| CC4 | Service counter is flush against the spine wall with no staff aisle behind it. | `f_bar` 6300–6900 × 4600–7400 | N | MISSED |
| CC5 | 8 café tables (900×900), no chairs, 700 mm apart. Seating is impossible as drawn. | f_t1..t8 | N | MISSED |
| CC6 | Staff room is empty and reached only via kitchen → store. | `r_staff` | m | MISSED |

### courtyard-apartment
| id | defect | where | sev | lint |
|---|---|---|---|---|
| CY1 | The "Courtyard" is an **interior room** inside the exterior shell, joined to Living by a **leafless** 1600 opening. As drawn, Living is open to the weather. Its 27.28 m² is counted in the 92.4 m² total. | `r_court`, `o_court` | **B** | MISSED |
| CY2 | Fridge stands fully in front of the north window (600 mm overlap) and the hob overlaps it by 350 mm. | `win_n` x 1500–3300 | N | MISSED |
| CY3 | Wardrobe covers 150 mm of the bedroom window. | `f_ward` / `win_bed` 5500–7100 | m | MISSED |
| CY4 | Axis line C runs through the "40.3 m²" label and the "2200" dimension text. | | m | MISSED |

### family-house
| id | defect | where | sev | lint |
|---|---|---|---|---|
| FH1 | **Garden bifold (x 1000–3400) overlaps the living window (x 0–1800) by 800 mm.** The window also starts at x=0, so its glazing runs through the NW corner (−100 mm clearance) (`crop_family_garden.png`). | `d_garden` + `win_living` | **B** | MISSED |
| FH2 | **Free-standing wall fragments.** o_hall (w_spine x 3100–4300) contains the end of w_kitchen at (3200,4400) (−150 mm clearance). That leaves a loose 100×200 nub at (3200, 4450–4650) and an 800 mm piece of w_spine (x 2300–3100) touching nothing (`crop_family_stub.png`). | o_hall / o_kitchen / o_kit_hall | **B** | MISSED |
| FH3 | Study desk stands 50 mm in front of the hall→entry opening and blocks 400 of its 1200 mm, on the main route from the front door. | `f_desk` x 10400–12000 y 5950–6750 vs `o_entry` x 9600–10800 | N | MISSED |
| FH4 | Hob is partly under the kitchen window (400 mm). | `win_kitchen` y 5500–6900 | m | MISSED |
| FH5 | "Living / Dining" has no dining table. Beds 2/3 are labelled "Single" but drawn with double pillows. The "Bedroom 3" label overlaps its bed. | | m | MISSED |

### gallery-wing
| id | defect | where | sev | lint |
|---|---|---|---|---|
| GW1 | **Partitions stop at the chord of the curved facade.** w_s2 ends at (13000,17000) while the south bow reaches y≈18667, so Shop and Cafe are connected through an open strip about 1.67 m deep (`crop_gallery_southbow.png`). Both bow segments are outside every room (white). `win_n2` and `win_cafe` get `room=null`. | south bow, w_s2 | **B** | MISSED |
| GW2 | Areas are understated. Each bow segment (R9000, chord 10000) is about 10.3 m² and is excluded, so the 442 m² schedule is about 20.6 m² short. | r_g2, r_shop/r_cafe | N | MISSED |
| GW3 | Bench sits 400 mm inside Gallery B's 3 m opening. The only way past is 500 mm, diagonally between the bench corner (11800,10000) and the jamb corner (11500,10400), and the same on the east side (14200/14500). describe reports bottleneck 900, and there is no warning. A probe with the bench widened to fully cover the opening does fire W_PATH_TOO_NARROW, so this is a grid false negative. | `f_bench2` vs `o_g2` | N | MISSED |
| GW4 | 2400 mm **single** leaf main entrance swinging out over the footway. | `d_main` | N | MISSED |
| GW5 | "Shop" is typed `uses storage`. A public gallery has one pan in a single WC. The café has no sink. | | m | MISSED |

### garden-office (no blocker found)
| id | defect | where | sev | lint |
|---|---|---|---|---|
| GO1 | Desks float 500 mm off the walls (anchor inset 500, not flush) with no chairs. "The studio takes the garden facade" but there is no garden door. | f_desk1/2 | m | MISSED |

### studio-loft
| id | defect | where | sev | lint |
|---|---|---|---|---|
| SL1 | **Double bed fills the 1800-wide alcove and blocks its only opening.** The alcove is unreachable (`walkDistance null`). | `f_bed` vs `o_alcove` | **B** | **CAUGHT** W_PATH_TOO_NARROW (but shipped anyway) |
| SL2 | Bed is oriented with its depth along the wall. | `f_bed` | N | **CAUGHT** W_FIXTURE_BACK_TO_ROOM |
| SL3 | Hob and sink are under `win_n`, and the fridge overlaps it by 150 mm. | x 600–2200 | m | MISSED |

### two-storey-townhouse
| id | defect | where | sev | lint |
|---|---|---|---|---|
| TT1 | Fridge stands fully in front of the kitchen's south window (600 mm) and the hob overlaps it by 300 mm (`crop_town_kitchen.png`). | `win_kit_s` x 4000–5600 | N | MISSED |
| TT2 | L1 draws the stair with the same cut/break-line symbol as L0. There is no balustrade or void, and the landing's 15.36 m² includes the 2.7 m² void. | `stair` L1 | m | MISSED |
| TT3 | Double beds have 400 mm side access to the wall (inset 400). | f_bed1/f_bed2 L1 | m | MISSED |
| ok | Stair registration was verified: the same bbox (300,2600, 900×3000) on both levels, UP runs S→N, and DN starts at N. | | | |

## Proposed checks for the missed classes

1. **Opening–opening overlap on one run.** For openings hosted on the same wall run, the along-run
   intervals [s−w/2, s+w/2] must be separated by ≥ a mullion (100 mm). This catches CC1 and FH1. No such rule exists today.
2. **Opening jamb vs any wall junction.** For every door, window and leafless opening, take every
   other wall axis that meets or crosses the host axis at s_c. The clearance is
   `dist(s_c, span) − t_other/(2·sinθ)`, and it must be ≥ a nib (≈ host thickness, or 75 mm min). A negative
   value (the wall is inside the span) is an error. This catches BB2, FH1 (corner), FH2, CC2, CC3 and CA5.
   `W_DOOR_NEAR_CORNER` is door-only and explicitly excludes T-junctions and walls ending on a straight run.
3. **Wall-graph integrity after cutting openings.** Every wall piece left after subtracting the opening voids must
   connect at ≥ 1 end to another wall. Flag free-standing fragments, e.g. < 1000 mm, or any piece with both ends free.
   This catches FH2.
4. **Room ⇔ walled-face consistency.** Planarise the wall centrelines (arcs included) into faces. Each face must be
   ≥ 95 % covered by room polygons, and each room edge must lie on a wall or opening (generalise
   `W_ROOM_NOT_ENCLOSED`, which today only checks bathrooms). This catches BB1, GW1 and GW2, and also gives a room to
   windows on arcs (BB3, GW1 `room=null`).
5. **Furniture in front of glazing or openings.** A tall category (fridge, wardrobe, bookcase) whose back edge is within
   150 mm of a wall face must not overlap a window span. Warn on a hob under a window. Extend
   `W_DOORWAY_BLOCKED` to leafless openings: no furniture within 600 mm in front of the opening span.
   This catches CY2, CY3, TT1, FH3 and GW3. Also, measure W_PATH_TOO_NARROW pinches by exact polygon distance,
   not the 100 mm grid (GW3's 500 mm diagonal passed).
6. **Programme completeness by `uses`.** `bath` requires a shower or tub. `kitchen` requires a counter ≥ 600 next to the
   hob/sink. A dining table needs a ≥ 750 mm chair ring to walls/obstacles. Café/dining tables need spacing
   ≥ 1500. A service counter needs ≥ 900 clear on one long side. This catches CB1, CB2, BB5, CC4, CC5 and FH5.
7. **Circulation semantics.** The kitchen must not be a cut vertex between the entrance and bedrooms/bath (an analogue of
   `W_BATH_VIA_BEDROOM`), which catches BB4. A leafless opening between a habitable room and a room
   labelled or used as outdoor (courtyard, patio, garden) should warn, and outdoor rooms should be excluded from totals (CY1).
8. **Door leaf sanity.** A single swing leaf > 1200 mm should warn and suggest a pair (CA3, GW4). In an accessible WC
   the door must swing out, and the pan centreline must be 400–500 mm from the side wall (CA1, CA2).
