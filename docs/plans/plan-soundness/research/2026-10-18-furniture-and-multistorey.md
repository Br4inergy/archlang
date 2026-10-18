# Furniture relations and multi-storey rules: desk research for README §8 questions 7 and 6

Date 2026-10-18. Made against `main@8d1e13e` (v1.43.1 era). Desk research only, repository untouched.
Tags: **[V]** verified against the primary text or source code, **[S]** secondary source,
**[M]** from memory or not verifiable here. Every claim carries a URL unless it is a repo fact.
Fetched source material was kept outside the repository; every claim carries its URL.

## 0. Findings in brief

1. Every system surveyed gives each piece a canonical **front** in its own frame and derives rotation from a
   relation to a target. None offers a checked-only relation. The closest precedents are IFC's `IfcRelPositions`
   (a declared relation that "shall not be used to calculate the geometry") and LayoutVLM's self-consistent
   decoding (a relation is kept only if the numbers already satisfy it).
2. Handed relations (`left of`, `in front of`) are the weak spot. LayoutVLM drops them on purpose, I-Design needs a
   Refiner to order siblings, Holodeck evaluates them in the target's own frame. A vocabulary without left/right
   avoids the problem and matches ArchLang's "a glyph never gains handedness" law.
3. ArchLang already measures most of what the furniture checks need (`frontClearanceRect`, the back-edge table in
   `src/fixture-orientation.ts`). What it lacks is the **statement of intent**. ADR 0017 refuses to derive a turn for
   a sofa because the plan "never stated" it. `facing <id>` is that statement.
4. GB 55038-2025 **4.1.7** now carries the toilet-over-habitable-room rule [V], worded "other households" instead of
   "the household below". It is a cross-dwelling rule and ArchLang has **no dwelling** to apply it to. Treating each
   level as one dwelling (design-taste R19) is wrong in both directions.
5. Most multi-storey facts already exist in `describe()`: room polygons per level, shaft identity, per-level shaft
   footprints, voids, storey elevation. What is missing is small and nameable: dwelling membership, exit and
   common-area tags, an "openable" fact on windows, wall fire rating, and a riser identity.

---

## Part A. Furniture semantics as relations (question 7)

### A.1 Survey

| System | Exact vocabulary | Checked, solved, or both | Handedness | Target that moves |
|---|---|---|---|---|
| **Holodeck** (CVPR 2024) | Global `edge`, `middle`. Distance `near` (50 to 150 cm), `far` (150 cm and up). Position `in front of`, `side of`; the prompt also lists `around`, `left of`, `right of`. Alignment `center aligned`. Rotation `face to`. [V] arXiv https://arxiv.org/html/2312.09067v2 ("ten types of constraints, five categories"); prompt text in `ai2holodeck/generation/prompts.py` L66-92, https://github.com/allenai/Holodeck | **Solved.** DFS over a grid, each object tried at four rotations (0, 90, 180, 270). Collision, room bounds and `edge` are hard. Every other constraint only adds a score bonus (`constraint_bouns` 0.2). A MILP variant exists. `face to` is a ray from the candidate centre along its rotation that must intersect the target polygon (`place_face_to`). [V] `floor_objects.py` L1021-1050 | `left of`, `right of`, `in front of`, `behind` are evaluated **in the target's own frame**: a lambda table keyed by the target's rotation (`place_relative`, L903-972). [V] | Objects are ordered by footprint area (`order_objects_by_size`, L442) and each constraint reads `placed_objects[target]`, so the target must already be placed. Nothing is re-solved when a target changes. [V] code |
| **Infinigen Indoors** (CVPR 2024) | Relations (`constraint_language/relations.py`): `Touching`, `SupportedBy`, `CoPlanar(margin, rev_normal)`, `StableAgainst(margin, check_z, rev_normal)`, `RoomNeighbour(connector_types: door/open/wall)`, `CutFrom`, `SharedEdge`, `Traverse`. Scalar terms (`geometry.py`): `accessibility_cost(objs, others, normal, dist=1.0)`, `focus_score`, `angle_alignment_cost`, `distance`, `freespace_2d`, rotational and reflectional asymmetry. Idioms (`infinigen_examples/constraints/util.py`): `against_wall = StableAgainst(back, walltags, margin=0.07)`, `flush_wall` margin 0.02, `front_against = StableAgainst(front, side, margin=0.05, check_z=False)` used for chairs at a table. [V] https://github.com/princeton-vl/infinigen (files named) | **Both.** One constraint graph is evaluated (comparisons such as `accessibility_cost(...) > 0.4`, `in_range`) and solved by simulated annealing with Metropolis-Hastings; hard terms and weighted soft terms (`.minimize(weight=5)`) feed one loss. [V] https://arxiv.org/html/2406.11824v1 | Each asset declares a front; `front_dir = [0,1,0]`, `back_dir = [0,-1,0]`; `rev_normal` flips a normal. There is **no left/right primitive**; `leftright` is only a symmetric subpart set. [V] `constraints/util.py` | Costs are functions of poses, so they are re-scored on every move. Moves are restricted to the degrees of freedom the relations leave, and solving runs large, then medium, then small objects, so parents are fixed when children are solved. [V] paper. How a parent move drags children was not read. |
| **Sweet Home 3D** | Interaction only. With magnetism on, "a piece of furniture is automatically rotated so its back face lies along the wall"; a door or window "dropped upon a wall is automatically oriented and resized"; rotation snaps to 15 degrees, Alt toggles. A model has a mirrored flag and a front face chosen at import. [V] https://www.sweethome3d.com/userGuide.jsp | **Solved at drag time, nothing stored.** The saved home keeps position and angle [M]. No checking. | Back face to wall is the only orientation rule. Mirroring is a stored boolean. [V] | Not applicable: no relation survives the drag. Whether doors follow a moved wall [M, unverified]. |
| **IFC 4.3** | `IfcFurniture`: built-in furniture (`Pset_FurnitureTypeCommon.IsBuiltIn`) "should have their connection relationship with a building element occurrence defined through the `IfcRelConnectsElements` relationship", a logical connection whose geometry the receiver may recompute. Placement is `IfcLocalPlacement` relative to another product (`PlacementRelTo`); "rules to prevent cyclic relative placements have to be introduced on the application level". Orientation is an `IfcAxis2Placement3D` (Z axis, X reference direction): an angle, never a target. `IfcRelSpaceBoundary` is "defined as seen from the space". `IfcRelPositions` "shall not be used to calculate the geometry". [V] raw schema docs https://github.com/buildingSMART/IFC4.3.x-development/tree/master/docs/schemas (`IfcFurniture.md`, `IfcRelConnectsElements.md`, `IfcLocalPlacement.md`, `IfcAxis2Placement3D.md`, `IfcRelSpaceBoundary.md`, `IfcRelPositions.md`) | **Neither solved nor checked beyond schema rules.** Relations are data. No facing, aligned or adjacent relation exists among the `IfcRelConnects` subtypes in the schema tree. [V] absence is within the files read | Right-handed axis frame; "as seen from the space" gives a handedness-free side convention for boundaries. [V] | Relative placement follows its parent by construction; cycles are the application's problem. [V] |
| **Revit** | Host-based families (wall, ceiling, floor, roof) can only be placed where a host of that type exists; the face-based template yields families placed "on any surface, regardless of its orientation". Doors and windows get author-defined **Flip Hand** and **Flip Facing** controls on the instance. [V] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-E36987A9-A68F-4121-A391-907306BAA60A.htm ; https://help.autodesk.com/cloudhelp/2023/ENU/Revit-GetStarted/files/GUID-0B88E1B2-37D2-4008-A2B4-50C35F1DB147.htm | Hosting is maintained by the regeneration engine [M]. There is no furniture-to-furniture facing. | Hand and facing are **stored booleans** per instance, not derived. The API `FamilyInstance.flipHand()` can fail. [V] https://rvtdocs.com/2025/Autodesk.Revit.DB.FamilyInstance.flipHand | A hosted element follows its host [M, not in the pages read] |
| **LayoutGPT** (2023) | The LLM emits CSS: `object {width: ?px; height: ?px; left: ?px; top: ?px;}`, and in 3D adds `orientation: ?degrees`. No relation tokens. [V] https://arxiv.org/html/2305.15393 | Checked after the fact: out-of-bounds rate, category KL, FID. Relations are read back from box centres. | None: a number. | None |
| **I-Design** (2024) | Object to object: `on`, `left of`, `right of`, `in front`, `behind`, `under`. To room elements: `on`, `in the corner`. A separate `facing` field names a wall. The LLM supplies rotation. [V] https://arxiv.org/html/2404.02838 | **Both.** Layout Corrector checks bounds, impossible adjacency and size fit; Layout Refiner adds sibling ordering and removes cycles; placement is parent-first with sampling and backtracking. | Left and right are ambiguous between siblings, which is why the Refiner must impose an order. [V] | Parents are placed first and children follow. |
| **LayoutVLM** (2024) | Five relations: `distance`, `on_top_of`, `align_with`, `point_towards`, `against_wall`. The paper says `in_front_of` and `left_of` are not used. Front direction annotated per asset; assets canonicalised to face +x. [V] https://arxiv.org/html/2412.02193 | **Both.** Self-consistent decoding keeps a VLM-proposed relation only if the initial numeric poses satisfy it within a threshold, at most one orientation constraint per asset. The kept relations become differentiable costs minimised with Adam (400 steps). | No handed relations by design. `point_towards` has an optional angle offset. [V] | Joint optimisation of all poses; the paper does not discuss it explicitly. |

### A.2 Reading across the survey

- **Canonical front per piece.** Holodeck (0 degrees faces up), Infinigen (`front_dir`), LayoutVLM (+x), Sweet Home 3D
  (back face), ArchLang (`rotate 0` puts the back on top, header of `src/fixture-orientation.ts`, repo fact).
  A facing relation is therefore always "pick the rotation whose front axis meets the target".
- **Facing is soft everywhere in the LLM-era systems** (a bonus, a cost, a dropped relation). ArchLang can do better
  because the quarter-turn set is tiny: four candidates, closed form, no search.
- **A clearance is a relation with a direction and a depth.** Infinigen's `accessibility_cost(normal, dist)` defaults
  to the frontal plane. ArchLang already has the geometry: `frontClearanceRect` and per-category `clearanceMm`
  in `src/fixtures-catalog.ts`.
- **What the catalogue deliberately does not say.** `wardrobe` has no `clearanceMm`, measured rather than assumed:
  a 550 mm default warned on `examples/garden-loft.arch`, which "cannot be fixed" (comment at
  `src/fixtures-catalog.ts` around L238-250, repo fact, re-measure before relying). `sofa` is not `directional` because
  deriving a turn "would assert a fact the plan never stated" (ADR 0017). Both argue that the new forms are
  **declarations by the author**, never catalogue defaults.

### A.3 Where each sentence in the brief lands today

| Sentence | Today | Gap |
|---|---|---|
| A TV faces the sofa | `rotate` hand-computed; `tv_unit` is `directional` (back to wall) | no statement of intent, no check |
| A bed head is against a wall | `furniture bed … against wall <id>` derives the rotation (`bed` is `directional`) | works for walls, not for a room-edge datum (PS3.2) |
| Chairs face the table | `rotate` per chair | no statement; the sofa/chair class is deliberately not derived |
| A wardrobe needs 600 mm in front | none; the catalogue says no clearance on purpose | needs an opt-in declaration |
| Nothing tall in front of a window | none | needs a catalogue height class (`FixtureSpec` has `overhead` but no `tall`) and a band on the window's inner face. A lint rule, not a relation |

### A.4 Proposal: a minimal declared-and-derived vocabulary (15 lines)

Relations are **declared by the author, derived in closed form, reported as facts, verified by lint, never solved.**

1. `facing <id>` on a piece placed by `at` or `in <room> anchor …`: derive `rotate` so the piece's front points at the target.
2. Rule: take the quarter-turn whose front ray, from the middle of the front edge, first enters the target's rectangle. No hit, or two equally near hits, is `E_FACING_AMBIGUOUS`. Never guess.
3. Targets are things with a rectangle and an id: a furniture piece, a rectangular room, a wall segment, an opening's span. A polygon or circle target is refused, as `E_PLACE_POLY` already refuses.
4. Targets resolve before dependants. A cycle is `E_FACING_CYCLE`. Charge one step per target read, before allocating.
5. `facing` excludes `rotate` and `against wall` on the same piece (a conflict code), so there is one source of truth for the turn.
6. `against <wall id | room.edge>`: widen the existing `against wall` target to the PS3.2 room-edge datum. A bed head is the catalogued back of a `directional` piece, so no `head` keyword is needed.
7. `clear front <mm>` and `clear sides <mm>`: required free depth measured on the derived front rectangle (and the long sides, for bed access) against solid furniture, wall inner faces and door swings. Opt-in, never a catalogue default.
8. No `left of`, `right of` or `in front of`. They are handed and need the target's frame. `side left|right` stays on `against wall` unchanged.
9. Facts: `describe()` adds `facing: {target, derived: true}` and `clear: {declared_mm, measured_mm}` per piece, only when declared, so every undeclared plan stays byte-identical.
10. Checks enabled: front ray blocked by a wall or solid piece before it reaches the target; measured clearance below declared; viewing distance outside a profile band (taste score only); two pieces whose derived fronts face each other closer than a stated gap.
11. Edit stability: PS4 `keep facing <piece>` and `impact` can name an edit that flips a derived turn, which a numeric `rotate` cannot express.
12. Subsumes: `rotate` on arranged pieces (sofa, chair, desk, dining chair), the bed case of `against wall`, and hand-written front-clearance numbers. Leaves `anchor`, `inset`, `side` and `centered` untouched.
13. Iron laws: pure, O(1) per piece, no search, ties refused; derived from a rectangle, never a centroid or the bounding box of a polygon; output set is D4 rotations only, so no glyph gains handedness; add a mirror-equivariance test through `src/algebra/d4.ts`.
14. Honest limit: "the front ray reaches the TV" is already computable from today's `rotate`. The new forms buy stated intent that survives edits and remove the hand-computed turn. This research found no evidence on how often agents get that turn wrong.
15. Needs an amendment to ADR 0017 (a stated `facing` is the missing licence for deriving a turn on arranged pieces) and a byte-identity law over the examples.

---

## Part B. Multi-storey and multi-dwelling rules (question 6)

### B.1 What ArchLang can read today (checked with `describe --json examples/two-storey.arch`)

- `levels[i].rooms[]` with `uses`, `floor_polygon`, `adjacent`, `area_m2`, `net_area_m2` [V, run locally].
- `vertical.connections[]`: shaft id, kind, levels, and a room per stop. Identity is **by id only**; nothing compares
  footprints across storeys (`src/vertical.ts` header; `W_STAIR_UNMATCHED` fires only on one-storey ids).
- `levels[i].verticals[]` with `bbox` and `flight_width`; `levels[i].voids[]`.
- `levels[i].access`, `circulation` (walk distance per room from the entrance, grid-quantised, one reference point
  per room rather than the farthest point; ADR 0008), and `heights` (only when the source authored a height clause).
- `zone` blocks: declared membership, zero geometry, nesting, legal inside `level` (`spec.llm.md`).
- Not present: dwelling, common area, exit tag, window operability, wall fire rating, riser or wet stack, sprinkler status.

### B.2 Rules

Status key: *mandatory* = binding clause text; *guidance* = deemed-to-satisfy, not binding wording; *advisory* = this programme's label (ADR 0005).

**B1. Toilet above another household's habitable room.**
- GB 50096-2011 **5.4.4**: "卫生间不应直接布置在下层住户的卧室、起居室（厅）、厨房和餐厅的上层。" Mandatory (on the mandatory-clause list). [S] clause text https://gf.cabr-fire.com/article-7232.htm ; mandatory list [V] per `design-taste.md` §2.4 (https://www.gongbiaoku.com/mobile/book/7qt18074dbf).
- GB 55038-2025 **4.1.7**: "卫生间不应直接布置在其他住户的卧室、起居室、厨房或餐厅的上层。" [V] Beijing standards-centre extract of the code, https://ghzrzyw.beijing.gov.cn/biaozhunguanli/bzzl/202506/P020250609570099619169.pdf (published 2025-03-13, in force 2025-05-01). The extract is partial, so a missing counterpart of 5.4.5 is not proof it was dropped. That GB 55 codes are mandatory throughout [M].
- Wording change: "household below" became "other households". Both name the same rooms: bedroom, living, kitchen, dining. Hall, stair, corridor, storage and balcony are not in the list.
- Fact needed: overlap area of a bath or wc polygon on storey n+1 with each listed room polygon on storey n, **and** whether the two rooms belong to the same dwelling.
- Today: polygons and `uses` suffice (`floor_polygon` per level). Dwelling membership is missing.
- Negative case: `examples/two-storey.arch` puts the L2 bath (0,4600 2200x2400) over the L1 hall. Hall is not listed, so the rule is silent. Good defect-corpus control.

**B2. Same-dwelling case.** GB 50096 **5.4.5**: "当卫生间布置在本套内的卧室、起居室（厅）、厨房和餐厅的上层时，均应有防水和便于检修的措施。" [S] https://gf.cabr-fire.com/article-7232.htm. Not on the mandatory list. The measured fact is the same overlap, but the requirement is construction (waterproofing, access for repair), which no plan can show. So advisory only: report the overlap as a note, never a failure. This upgrades design-taste R19's 5.4.5 from [M] to [S].

**B3. Lift shaft or pump room next to a bedroom.** GB 55038-2025 **4.2.3**: "电梯井道及电梯机房、水泵机房等产生噪声或振动的房间不应紧邻卧室布置。" [V] same extract. "紧邻" (immediately adjacent) is not defined in the extract; read it as sharing a wall or face. Fact: an `elevator` footprint (`verticals[].bbox`) abutting a bedroom polygon on the same storey. Today: sufficient on one storey. The vertical case (a lift stopping above a bedroom) is not stated; do not invent it.

**B4. Drain stack against a bedroom wall.** GB 55038-2025 **6.1.4**: in a bathroom next to a bedroom, the soil stack shall not sit against the wall shared with the bedroom and gets sound wrapping; drainage noise from the upper bathroom measured in the bedroom shall not exceed 33 dB. [V] same extract. Fact needed: a riser or stack position. Today: missing. Not computable until a stack exists as a fact.

**B5. Wet-stack alignment (practice).** I found no authoritative numeric rule for how far bathrooms may be offset between storeys. Sources are guides and forums (https://www.studiomatrx.org/guides/soil-waste-vent-stack-india , https://www.diynot.com/diy/threads/non-vertical-soil-stacks.508722/latest) [S, anecdotal]. UK Approved Document H and CIBSE were not reached. What is computable is a proxy: the share of wet-room area that lies under or over another wet room. It is a score (design-taste R20), never a warning, and must be named a proxy.

**B6. Stair and lift shaft continuity.**
- No clause is needed to call it a defect: a same-id run whose footprints on adjacent storeys do not overlap is an inconsistent drawing. A code analogue is UK ADB 2.5a and 2.5a(i): a protected stair "at all storeys" that "extends to a final exit". [V] https://assets.publishing.service.gov.uk/media/6aa3bb335f6e942efe37f150/AD_B1_2026.pdf
- GB 50016 requiring an evacuation stair's plan position to stay unchanged on every storey: I could not locate the clause text. [M]; do not cite a clause number until verified.
- Fact: `levels[i].verticals[].bbox` for each stop of `vertical.connections[]`. Today: sufficient. Check: footprints of consecutive stops overlap by at least a threshold share of the smaller one; lift cars should match exactly. Add the arrival void, already in PS2.11.
- Nothing new is needed for "the flight on n lands within the shaft on n+1": `dir` is declared per storey, so it reduces to the footprint overlap plus a void or room under the arrival.

**B7. UK inner rooms (houses and flats).** ADB Vol 1, 2019 edition, current online version with amendments to 2026. [V] same PDF.
- Definition (Appendix A): "Room from which escape is possible only by passing through another room (the access room)."
- Houses: 2.1 ground storey, every habitable room except kitchens opens onto a hall leading to a final exit, or has an emergency escape window or door. 2.2 upper storeys up to 4.5 m: escape window or direct access to a protected stairway. 2.11 an inner room is permitted if it is a kitchen, laundry or utility room, dressing room, bathroom, WC or shower room, a room on a storey at most 4.5 m above ground with an escape window, or a compliant gallery. 2.12 an inner inner room needs a smoke alarm in each access room and no kitchen as an access room.
- Flats: 3.7 and 3.8 repeat 2.11 and 2.12 with the same lists.
- Escape window (2.10): openable area at least 0.33 m2, at least 450 mm high and 450 mm wide, bottom of the openable area at most 1100 mm above the floor.
- Status: guidance (approved document). The binding text is requirement B1.
- Fact: access graph with hall, landing, stair and corridor spaces contracted and the exterior door as the exit. A room is inner when every route to the exit crosses another non-circulation room. Plus storey height above ground and window openable area.
- Today: access graph and `uses` suffice for the graph test if rooms are classified; otherwise skip and say so in the coverage report. Storey height is available but "ground level" is an assumption (lowest `level`). Window sill, head and width exist (gated on authoring, defaults apply). **Missing: which windows open, and by how much.** A gross-opening test can only prove a failure (gross area below 0.33 m2), never a pass.
- Protected stairway (REI 30 enclosure) needs wall fire rating: missing.

**B8. UK flat escape inside the flat.** ADB **3.18b**: travel distance from the flat entrance door to any point in any habitable room at most 9 m, cooking remote from the entrance door and not on the escape route. [V] same PDF; it applies to flats with a storey over 4.5 m. Today: `circulation` gives a walk distance per room to a reference point, not the farthest point. The nav grid could give a maximum but `describe()` does not expose it. Advisory.

**B9. UK common corridors of flats.** ADB **Table 3.1**: from the flat entrance door to the storey exit or stair lobby, 7.5 m with escape in one direction, 30 m in more than one; 4.5 m for a small single-stair building (note 2). 3.27 allows a single route only with a protected lobby or corridor. 3.38 the wall between each flat and the corridor is a compartment wall, REI 30 where the top storey is up to 5 m, else REI 60. 3.40 a self-closing fire door separates the dead-end part of a common corridor. [V] same PDF (3.36: "Escape route travel distances should comply with Table 3.1"). Guidance. Facts needed: which door is a flat entrance (dwelling), which element is the storey exit, whether a second route exists (two exits, node-disjoint). Today: nav grid exists; dwelling and exit tags are missing.

**B10. US dwelling egress.**
- IRC 2021 **R310**: basements and every sleeping room need at least one operable emergency escape and rescue opening. **R310.2.1** net clear opening at least 5.7 sq ft (0.53 m2), 5.0 sq ft at grade floor. **R310.2.2** net clear height at least 24 in (610 mm) and width at least 20 in (508 mm). **R310.2.3** bottom of the opening at most 44 in (1118 mm) above the floor. **R310.4** window well at least 9 sq ft. [S] quoted from https://bouldercounty.gov/property-and-land/land-use/building/building-publications/b10-emergency-escape-and-rescue-openings/ ("Per 2021 IRC section R310"). Subsection numbers differ between jurisdictions' summaries, so confirm in the ICC text. The exception for a sleeping room with a door to the outside [M].
- IRC **R311.2**: one side-hinged egress door per dwelling unit, 32 in (813 mm) clear width, 78 in (1981 mm) clear height. [S] https://www.thebuildingcodeforum.com/forum/threads/irc-required-exit-door-question.9970/post-119010 ; 2021 training deck https://bsd.dli.mt.gov/_docs/Training/2021-IRC-Means-of-Egress-Thursday-AM.pdf . R311.1 requires a continuous path to a public way. Mandatory where adopted.
- Fact: per sleeping room, an exterior window with sill, head, width and an openable fraction. Missing: openable fraction and net clear. Same rule as B7: only the necessary condition can be checked (width under 508 mm, sill over 1118 mm, gross area under 0.53 m2 are failures). The IRC covers one- and two-family dwellings and townhouses, so for flats the IBC applies.

**B11. US corridors in multi-unit buildings.**
- IBC 2021 **1020.5** Dead ends (2018 edition: 1020.4): dead-end corridors at most 20 ft (6096 mm) where more than one exit or exit access doorway is required; Groups R-1 and R-2 in a building sprinklered throughout (903.3.1.1) 50 ft (15 240 mm); no limit where the dead end is shorter than 2.5 times its least width. [V] ICC interpretation 68-23, https://www3.iccsafe.org/cs/committeeArea/pdf_file/BU_21_68_23.pdf ; edition renumbering [S] https://evstudio.com/dead-end-corridors-what-are-they-and-why-are-they-important/
- IBC Table 1017.2 exit access travel distance, Group R: 200 ft unsprinklered, 250 ft sprinklered. [S] https://app.leg.wa.gov/WAC/default.aspx?cite=51-54A-1017&pdf=true (a state adoption); not read from the ICC text.
- Fact: corridor room polygon (`uses` corridor or circulation), door positions along it, exits (stair, exterior door), and a plan-level sprinkler flag (missing). Dead-end length is the distance from the far end of the corridor to the nearest point where a second route opens. Advisory under a `us` profile.

**B12. Dwelling boundary.**
- IBC **420.2**: walls separating dwelling units are fire partitions per Section 708; **708.3** at least 1 hour. [S] quoting the code, https://www.thebuildingcodeforum.com/forum/goto/post?id=222600 ; floors and ceilings 420.3 [M].
- GB 55038-2025 **4.1.15 (5)**: balconies adjoining between dwellings need a dividing screen (分户隔板). [V] same extract.
- UK ADB 3.38, above. [V]
- None of these is checkable as a rating, because walls carry no rating. Two things are checkable: **no connector between rooms of different dwellings** (a door joining two flats is always wrong), and **balconies of different dwellings that share an edge need a divider**. Both need dwelling membership.

### B.3 What a "dwelling" would need to be in a plan DSL

- **Declared, never inferred** (ADR 0005). `zone` already gives declared membership with zero geometry, nesting and legality inside `level`. The lightest design is a marker on a zone, for example `zone flat_2a "Flat 2A" dwelling { … }`. That is a grammar change and needs an ADR. It moves no byte of an undeclared plan.
- **Identity across storeys by id**, as stairs do: the same dwelling zone id on two levels is one dwelling (a duplex). To be settled in the ADR, because ids are documented as unique within a level only.
- **Derived, not authored:** common area = rooms in no dwelling; flat entrance = the exterior or common-area door of a dwelling; party wall = a wall segment whose two side rooms belong to different dwellings. The last uses the side-probe machinery behind `W_CONNECTOR_AMBIGUOUS` (PS2.3).
- **Without a declaration the cross-dwelling rules must skip and say so** in the PS2.13 coverage block. Treating "one level = one dwelling" (design-taste §5.2 note) is wrong for a house (a cross-dwelling rule would fire inside one household) and for a block of flats (many dwellings on one level).

### B.4 Fact sufficiency

| Fact | Exists | Note |
|---|---|---|
| Room polygons and `uses` per level | yes | `uses` optional; unclassified rooms skip |
| Access graph per level | yes | door side probes still have the PS0.1 ambiguity |
| Shaft identity across levels | yes | id only |
| Shaft footprint per level, voids | yes | not compared across levels |
| Storey elevation | yes, gated | ground level assumed to be the lowest level |
| Window sill, head, width | yes, gated | no openable fraction |
| Walk distance per room | yes | reference point, grid-quantised, not the farthest point |
| Dwelling membership, common area | **no** | zone marker plus ADR |
| Exit and storey-exit tags | **no** | derivable from stairs and exterior doors once dwellings exist |
| Operable window fraction | **no** | an `openable` attribute on windows |
| Wall fire rating | **no** | would be a new wall attribute; skip |
| Riser or stack | **no** | new element; do not add yet |
| Sprinkler status | **no** | plan or profile setting |

---

## Part C. What this changes in the plan (10 lines)

1. **Supports PS3 (relations first):** furniture `facing` and a datum-widened `against` extend the same philosophy to the last unrelated layer. Add as **PS3.7**, with an ADR 0017 amendment.
2. **Supports PS2.11 (clearance family):** `clear front` and `clear sides` become the opt-in declaration form. The tall-unit-over-window rule needs a catalogue height class that does not exist yet.
3. **Contradicts PS2.11 as written** where it lists "front of a wardrobe at least 600" as a default lint. The catalogue deliberately has no wardrobe clearance because a default warned on `garden-loft.arch`. Make it a declaration or a profile value only, and re-measure first.
4. **Supports PS4 (change model):** `keep facing` and `impact` naming a flipped derived turn is a concrete, closed-form instance of "what follows".
5. **Contradicts design-taste R19's default** ("treat each level as one dwelling, cap at advice"). Replace with: R19 runs only where dwellings are declared (warning across dwellings, note within one), otherwise skip and report coverage. Cite GB 55038-2025 4.1.7 as the successor clause.
6. **Supports PS2.13 (coverage report):** add "no dwelling declared" and "no operable-window data" as named skip reasons.
7. **New card PS2.14, Dwelling declaration:** zone marker, `describe().dwellings`, common area, party-wall derivation, ADR. Blocks B1 across dwellings, B9 and B12.
8. **New card PS2.15, Shaft continuity:** `W_SHAFT_FOOTPRINT_MISMATCH` for same-id runs whose footprints do not overlap across storeys. No new fact; small; ships with PS2.11's arrival-void check.
9. **New card PS2.16, UK and US egress as necessary-condition checks:** `W_INNER_ROOM` (uk-residential-advisory) and bedroom escape-window failures provable from gross sizes (508 mm width, 1118 mm sill, 0.33 m2). Never a pass claim without an `openable` fact.
10. **Not proposed:** wet-stack rules (no riser fact, no authoritative number), wall fire ratings, the ADB protected-stairway enclosure, sprinkler-dependent limits. List them under §8 question 6 as blocked on facts, not on rules.

---

## Verification log: what I could not verify

- GB 50096 5.4.4 and 5.4.5 wording is from a reprint site, not the standard PDF (its text layer did not extract). The mandatory status of 5.4.4 rests on the earlier research's mandatory-clause list.
- GB 55038-2025 clauses were read from a municipal extract (partial). Full-text mandatory status is [M]. The full code (https://www.hbdjgc.com/uploads/20250510/a77c806ef95f55dcd65944c57ef32078.pdf) was unreachable.
- GB 50016 plan-position clause for evacuation stairs: not found.
- IBC Table 1017.2 R-2 row, IRC R310.1 exceptions and R311.1: not read from ICC text (blocked, 403).
- Sweet Home 3D saved-file contents and wall-follow behaviour, Revit host-following, Infinigen parent-move semantics: [M].
- Wet-stack alignment: no authoritative numeric guidance found (Approved Document H and CIBSE not reached).
- The garden-loft calibration claim is a code comment in this repo; I did not re-run it.
