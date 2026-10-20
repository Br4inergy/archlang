> Research record, 2026-10-18, made against `main@98bd30b` (v1.43.1). Copied from the
> session's scratch: machine-local paths are replaced by `<scratch>/`, and closed-source
> and marketing material is removed. Read observations as evidence and diagnoses as
> hypotheses (the `docs/backlog.md` rule): re-measure before you build on a number.
> Programme entry: `../README.md`.

# ArchLang plan-soundness audit: checks inventory, authoring model, constraints, gaps

Repo state: `main` 98bd30b (v1.43.1 `dist/`). Read-only; probes
written only under `<scratch>/` (`probe-*.arch`).

## 0. What the CLI actually says about `repro/family-apartment.arch`

| Command | Result |
|---|---|
| `lint --json` (default ruleset; `residential-basic` adds only `assumeDwelling`, PS2.18) | 12 x `W_FIXTURE_BACK_TO_ROOM`, nothing else |
| `lint --profile accessibility-advisory` | + `W_ROOM_TOO_SMALL` (Bath 2), 6 x `W_DOOR_CLEARANCE`, 8 x `W_PATH_TOO_NARROW`. Still no topology finding |
| `validate --strict` | fails only on the 12 fixture warnings |
| `fix` (one run) then `validate --strict` | 11 of 12 auto-fixed, 1 wardrobe left. **One more hand edit and the plan passes the ship gate with every defect still in it** |
| `suggest --json` | `{"suggestions": []}` |

`describe --json` does know the truth. It just does not flag it:

- `doors[]`: `d_entry` between `exterior` and `r_kitchen` (the entry opens into the kitchen);
  `d_living_bed3` between `r_bedroom3` and `r_bathroom2` (not living); `door_8` between bed3 and bath1.
- `windows[].room`: `win_bed1` → bedroom2, `win_bed2` → living, `win_living_top` → bedroom3,
  `win_living_side` → bedroom4, `win_bed3` → kitchen, `win_bed4` → bathroom2, `window_8` → bedroom1.
- `rooms[].adjacent` (geometric edge contact) puts living next to bedroom3 and bedroom4, but
  `input_graph` and `access` (door graph) have no living–bed3/bed4 edge. Two models disagree and
  nothing reports it.
- `access.rooms[].depthFromEntrance`: living = 4 (kitchen → bed1 → bed2 → living), bed4 = 4
  (via bath2 → bed3). Every route runs through bedrooms or bathrooms. No rule reads depth or
  room type along the path, except for the bath-via-bedroom case.
- `circulation.rooms[r_living].walkDistanceMm = 12000`. A walk through the door chain
  (entry → d_bed1_kitchen → d_bed2_bed1 → d_living_bed2) is about 14 250 mm Manhattan. The
  route through the wall-less bed3/living boundary (pocket door → d_living_bed3 → straight
  north) is about 12 250 mm. So the nav grid (walls rasterised, ADR 0008) **walks through the
  missing wall** while the access graph treats the boundary as closed. That is a second silent
  disagreement.
- `furniture[].room` is `null` for every `at (x,y)` piece. A room is set only for `in <room>` placements.

## A. Inventory of current checks

### A.1 Lint rule list (order is contract): `src/lint/rules/index.ts:28-87`

Thresholds: `DEFAULT_RULESET` `src/lint/ruleset.ts:94-107`. Profiles: `LINT_PROFILES`
`src/lint/ruleset.ts:116-128`. `residential-basic` = defaults plus `assumeDwelling: true` (PS2.18: every plan judged as a dwelling). `accessibility-advisory` raises
door width to 850, room area to 5, swing clearance to 150, landing to 450 and path width to 900.
Every rule is advisory (`W_*`, never blocks render). `--strict` turns warnings into exit 2.

| Rule (file:line) | Codes | What it checks | Category |
|---|---|---|---|
| `perRoomRules` per-room.ts:81 | `W_ROOM_TOO_SMALL` (area < 4 m²), `W_ROOM_DISCONNECTED` (no connector point on the perimeter), `W_BEDROOM_NO_WINDOW` (no window point on a bedroom edge), `W_ROOM_NOT_ENCLOSED` (**wet rooms only**: largest unwalled perimeter run > 300 mm, via `largestPerimeterGap` analyze.ts:753), `W_ROOM_NO_FIXTURE` (bath/kitchen without a zone fixture), `W_GARAGE_TOO_NARROW` | room program / enclosure |
| `furnitureOverlap` furniture.ts:54 | `W_FURNITURE_OVERLAP` | AABB overlap | furnishing |
| `furnClearance` furniture.ts:92 | `W_FURN_CLEARANCE` | fixture use-space blocked | fixtures |
| `fixtureFloating` furniture.ts:138 | `W_FIXTURE_FLOATING` | plumbing/kitchen fixture not against a wall | fixtures |
| `fixtureWrongRoom` furniture.ts:261 | `W_FIXTURE_WRONG_ROOM` | `in <room>` piece outside that room | fixtures |
| `furnitureWallCollision` furniture.ts:288 | `W_FURNITURE_WALL_COLLISION` | piece penetrates a wall band | furnishing |
| `reachability` reachability.ts:28 | `W_BATH_VIA_BEDROOM`, `W_ROOM_UNREACHABLE` | door access graph from `exterior`. Bath-via-bedroom fires only when **no** wet room on the storey avoids a bedroom (`wetRoomsOnlyViaBedroom` analyze.ts:545) | circulation |
| `swingObstructed` doors.ts:43 | `W_SWING_OBSTRUCTED` | furniture in the leaf's swing | openings |
| `doorwayBlocked` doors.ts:189 | `W_DOORWAY_BLOCKED` | furniture in the 300 mm landing | openings |
| `doorClearance` doors.ts:328 | `W_DOOR_CLEARANCE` | nominal width < 700 (850 in the a11y profile) | openings |
| `roomNoClearPath` circulation.ts:13 | `W_ROOM_NO_CLEAR_PATH` | occupancy flood-fill clear area < 1 m² | circulation |
| `noEntrance` entrance.ts:24 | `W_NO_ENTRANCE` | no exterior connector | circulation |
| `pathTooNarrow` circulation-facts.ts:484 | `W_PATH_TOO_NARROW` | nav-grid bottleneck < 700 (900 a11y) | circulation |
| `circuitousPath` circulation-facts.ts:573 | `W_CIRCUITOUS_PATH` | detour ratio > 3.0 | circulation |
| `aliasMatch` alias-match.ts:39 | `W_ALIAS_MATCH` | use inferred from an indirect label alias | room program |
| `fixtureBackToRoom` furniture.ts:206 | `W_FIXTURE_BACK_TO_ROOM` | fixture against a wall but facing away (machine-applicable `rotate` fix) | fixtures |
| `dimInside` dims.ts:55 | `W_DIM_INSIDE` | hand `dim` inside the building | drafting |
| `stairUnmatched` vertical.ts:22 | `W_STAIR_UNMATCHED` | vertical run on one storey only | circulation |
| `dimOverlap` dims.ts:142 | `W_DIM_OVERLAP` | two dims drawn on top of each other | drafting |
| `roomNotEquatorFacing` site.ts:56 | `W_ROOM_NOT_EQUATOR_FACING` | needs a `site`; habitable room windows miss the equator side | openings/program |
| `pocketRun` doors.ts:249 | `W_POCKET_RUN` | pocket door has no wall run to slide into | openings |
| `outdoorOverlapsRoom` outdoor.ts:46 | `W_OUTDOOR_OVERLAPS_ROOM` | terrace over a floor | geometry |
| `balconyNoDoor` outdoor.ts:92 | `W_BALCONY_NO_DOOR` | balcony with no way on | circulation |
| `doorNearCorner` doors.ts:405 | `W_DOOR_NEAR_CORNER` | jamb-to-**corner** nib < wall thickness. `isCorner` doors.ts:511 counts only the host segment's own ends, and **a partition teeing into a continuing wall is explicitly not a corner** (doors.ts:501-504) | openings/drafting |
| `openingNotDimensioned` dims.ts:217 | `W_OPENING_NOT_DIMENSIONED` | only with `dims auto all` | drafting |

### A.2 Error catalog (`src/error-catalog.ts`; table in generated `docs/error-codes.md:9-167`): 103 E, 52 W

**Warnings raised outside lint** (compile/resolve; still fail `validate --strict`):
`W_DOOR_OFF_WALL` (elements/door.ts:350), `W_WINDOW_OFF_WALL` (elements/window.ts), `W_OPENING_OFF_WALL`
(elements/opening.ts): the point is not on any wall, with an `offWallFix` (fix-producers.ts:213).
`W_SWING_ROOM_NOT_ADJACENT` (door.ts:89): `swing into <room>` names a room not on the host.
`W_ROOM_OVERLAP` (ir.ts:3385). `W_ROOM_LABEL_OUTSIDE`. `W_DIM_NO_WALL`. `W_EMPTY_PLAN`.
`W_SCALE_OVERFLOW`/`W_DRAWING_OVERFLOW` (sheet). `W_UNKNOWN_MATERIAL`/`_STYLE_KEY`/`_THEME_KEY`.
`W_HATCH_SCALE`. `W_SANITIZED_CONFIG`. `W_DUP_ACC_METADATA`. `W_IMPORT_EMPTY_FILE`.
`W_WHILE_DEPRECATED`/`W_REASSIGN_DEPRECATED`. `W_CJK_FONT_MISSING`/`W_GLYPH_UNSUPPORTED` (PDF/PNG).

**Errors relevant to plan soundness** (everything else is parse, evaluation, budget, import, roof,
site or level shape):
`E_ATTACH_WALL_REF` (unknown/ambiguous `on <wall>`), `E_ATTACH_POS_RANGE`, `E_DOOR_WIDTH`/`E_WINDOW_WIDTH`/`E_OPENING_WIDTH`
(> 0 only), `E_OPENING_ABOVE_WALL`, `E_SILL_ABOVE_HEAD`, `E_DOOR_KIND_*`, `E_FURN_AGAINST`/`E_FURN_FLUSH`/
`E_FURN_ROOM`/`E_PLACE_REF`/`E_PLACE_POLY`, `E_LAYOUT_CYCLE`/`_REF`/`_UNPLACED`, `E_ROOM_ALIGN(_AXIS)`,
`E_STRIP_*`, `E_ROOM_POLY_*`. Intent errors (section A.6). No error code for opening overlap,
an opening wider than its host (backlog V.3, "won't fix", diagnostic-free), an opening across a
junction, or a missing wall.

### A.3 Analyze facts (`src/analyze.ts`, `src/analyze/*`)

- **Access graph** `buildDoorAccessGraph` / `connectorEdges` analyze.ts:459. The edges are doors
  and openings only. `between` comes from `connectorConnection` analyze.ts:376 (see B.4). Depth,
  reachability and widest-path bottleneck are computed per room.
- **Room adjacency** `roomsAdjacent` analyze.ts:246: rectangle edge-touch with overlap > 0.
  Feeds `describe().rooms[].adjacent`. **Does not consult walls.**
- `largestPerimeterGap` analyze.ts:753 (+Ring/Circle): unwalled perimeter length. Today used only
  for wet rooms.
- `circulation.ts`: whole-plan nav grid, walls rasterised, doors carve thresholds, walk / bottleneck
  / detour per room plus key routes (kitchen→living, bedroom→bath) (ADR 0008).
- `occupancy.ts`: per-room flood-fill from doorways (clear area).
- `net-area.ts` / `net-area-memo.ts`: net internal area (ADR 0027).
- `symmetry.ts` (opt-in `--facts symmetry`): D4 group and repeats.
- `syntax.ts` (opt-in `--facts syntax`): space syntax (depth, integration) on the access graph.
- `isBedroom`/`isWetRoom`/`isKitchen`/`isGarage` analyze.ts:220ff, `roomUses()`. Authored `uses`
  wins over the label regex.

### A.4 `describe()` fields (`src/describe.ts` `SceneSummary` :592-801)

`plan`, `caption`, `units`, `scale`, `sheet`, `bbox`/`bbox_outer`, `axes`, `site`, `instances`.
`rooms[]` {id, label, uses, room_type, area_m2, net_area_m2, bbox, floor_polygon/circle,
**adjacent**, instance, component}. `doors[]` {id, **between**, width, kind, swing/hinge facts,
heights}. `windows[]` {id, **room** (one), width, **facing**, sill/head}. `openings[]` {id, between,
width}. `furniture[]` {id, category, label, **room (only for `in` placements)**, rotate}.
`verticals`, `voids`, `outdoor`, `fences`, `heights`, **`access`**, **`circulation`**, `totals`,
**`input_graph`** (RPLAN-style door adjacency), `freedom` (absolute/relational/attached counts per
element), `schedule`, `zones`, `levels`, `vertical`, `symmetry`?, `syntax`?, `diagnostics`.

### A.5 Transforms and helpers

- **`suggest`** (`src/suggest.ts:275`, advisory data, never applied). It covers exactly four
  faults: `W_ROOM_UNREACHABLE`, `W_NO_ENTRANCE`, `W_BATH_VIA_BEDROOM` and `W_BEDROOM_NO_WINDOW`.
  Each comes with ready-to-paste `door|window on <stable wall ref> at <pos>`. On this plan it
  returns nothing.
- **`fix`** (`src/fix-apply.ts`, `src/fix-producers.ts`, ADR 0011). A bounded fixpoint of at most
  4 passes, applying `machine-applicable` edits only. Producers: off-wall opening → attachment
  form (:213), fixture rotate (:248), door hinge flip (:284), door kind clause (:312), door open
  range (:335), pocket run (:365), dim swap/bump (:409/:440), opening width (:460), room align
  (:491/:526), attach clamp (attach.ts:28), while→for.
- **`repair`** (`src/repair.ts:1050`, ADR 0006). Furniture only: out of walls, back into its room,
  overlap separation, out of the door landing and swing, floating fixture to the nearest wall,
  then orientation. Never worse, and reaches a fixpoint. **It touches no wall, door or room.**
- **`finish`** (`src/finish.ts`, ADR 0024) runs `furnish` (`src/furnish.ts`, ADR 0025,
  `FURNISH_TABLE` :102; bedroom → required `bed`) and then `sheet`. **Fill-only: a room holding any
  piece is never topped up** (backlog M.22). Bedroom 3 holds a wardrobe, so it never gets a bed.
- **`score --brief`** (commands-analyze.ts:660): satisfied/total of the intent assertions, always
  exit 0. It measures and never gates.
- **`validate --graph g.json`** (`checkGraph` plan-json.ts:1294): compares interior-door adjacency
  with an intended dict. It reports missing rooms, missing connections and **extra connections**.
  A mismatch exits 2. This is the only *gating* topology check in the product.

### A.6 Intent channel (`src/intent.ts`, `docs/intent.md`)

Assertable fields (intent.ts:~100-110, docs/intent.md:65-75): `rooms` (exact count),
`roomsInclude[]{concept, count, areaM2, windows{min, facing}}`, `totalAreaM2`,
`adjacency.requiredEdges` (concept → concepts **required**; there is no forbidden or must-not
edge), `reachable`.

- **Gate** (`validate --intent`, exit 2): `E_INTENT_ROOM_COUNT`, `_ROOM_MISSING`, `_ROOM_AREA`,
  `_TOTAL_AREA`, `_NO_WINDOW`, `_NO_SITE`.
- **Advisory** (`gate:false`): `E_INTENT_NOT_ADJACENT`, `_NO_DOOR`, `_UNREACHABLE`.
  docs/intent.md:181-187 and iron-laws.md ("adjacency/reachability assertions stay advisory
  (`gate: false`)") make this permanent.
- The channel has no way to assert furniture, "no through-bedroom access", "bath not off living",
  or "a wall between X and Y".

### A.7 By category

| Category | Existing checks |
|---|---|
| Geometry / topology | `W_ROOM_OVERLAP`, `W_ROOM_NOT_ENCLOSED` (wet only), `W_OUTDOOR_OVERLAPS_ROOM`, `W_EMPTY_PLAN`, E_ room/polygon shape |
| Openings | `W_*_OFF_WALL` (point test only), `W_DOOR_CLEARANCE`, `W_SWING_OBSTRUCTED`, `W_DOORWAY_BLOCKED`, `W_POCKET_RUN`, `W_DOOR_NEAR_CORNER` (L-corners only), `W_SWING_ROOM_NOT_ADJACENT`, `W_BEDROOM_NO_WINDOW`, `W_ROOM_NOT_EQUATOR_FACING` (site only), `E_ATTACH_*`, `E_OPENING_ABOVE_WALL` |
| Circulation / access | `W_NO_ENTRANCE`, `W_ROOM_DISCONNECTED`, `W_ROOM_UNREACHABLE`, `W_BATH_VIA_BEDROOM`, `W_ROOM_NO_CLEAR_PATH`, `W_PATH_TOO_NARROW`, `W_CIRCUITOUS_PATH`, `W_BALCONY_NO_DOOR`, `W_STAIR_UNMATCHED`; intent `E_INTENT_NOT_ADJACENT`/`_UNREACHABLE` (advisory); `validate --graph` (gating) |
| Room program / furnishing | `W_ROOM_TOO_SMALL`, `W_ROOM_NO_FIXTURE` (bath/kitchen only), `W_GARAGE_TOO_NARROW`, `W_ALIAS_MATCH`, `W_FURNITURE_OVERLAP`, `W_FURNITURE_WALL_COLLISION`; intent count/area/window (gating) |
| Fixtures | `W_FIXTURE_FLOATING`, `W_FIXTURE_BACK_TO_ROOM`, `W_FIXTURE_WRONG_ROOM`, `W_FURN_CLEARANCE` |
| Drafting | `W_DIM_INSIDE`, `W_DIM_OVERLAP`, `W_DIM_NO_WALL`, `W_OPENING_NOT_DIMENSIONED` (only with `dims auto all`), `W_SCALE_OVERFLOW`, `W_DRAWING_OVERFLOW` |

Off by default or scoped: the accessibility thresholds (profile only); `W_ROOM_NOT_EQUATOR_FACING`
(only with `site`); `W_OPENING_NOT_DIMENSIONED` (only with `dims auto all`); `W_POCKET_RUN`
(only with pocket doors); outdoor rules (only with `outdoor`); symmetry/syntax facts (opt-in);
intent adjacency/reachability (advisory forever).

## B. Authoring-model facts that make these errors easy

1. **Rooms do not generate walls, and nothing relates a wall to the rooms it separates.**
   docs/language-reference.md:858 says "Rooms describe space; walls are drawn separately." A
   wall is a free polyline with a category label (`<kind>` is "a free label", :825). The only
   wall↔room relation computed anywhere is per-check geometry: `largestPerimeterGap` (wet rooms
   only), the nav grid's rasterisation, and the wall-face probe. `describe().rooms[].adjacent` is
   pure rectangle contact (analyze.ts:246). A room pair can therefore share an edge with no wall,
   and the only symptom is the room-vs-door-graph mismatch above.
2. **There is no higher-level form.** No `wall between A and B`, no rooms→walls derivation, no
   `door between A B`. Backlog **G.12** (docs/backlog.md:290-332) records that a wall cannot name a
   resolved room boundary (`kitchen.x` → `E_UNKNOWN_REF`). Relational rooms therefore get "rooms
   that reflow **or** partitions, never both". The fix it names, "something in the shape of
   `wall partition between living and kitchen`", is an open language-design question.
3. **Two opening placement forms** (language-reference.md:1160-1210, 1327-1368;
   `src/attach.ts:69-79`).
   - `at (x,y) width W [wall <ref>]`: an absolute centre point. `wall <ref>` may be an id **or a
     category** (`wall partition` picks the nearest partition). This is the form the generated
     plan uses throughout.
   - `on <wall> at <pos>` walks the named wall's run (`resolveAttachment` attach.ts:115), so
     the opening is on that wall by construction. It still knows nothing of rooms. Both forms take
     a **centre point plus width**: nothing names which rooms the door should join.
4. **How `between` is computed** (analyze.ts:272-295, 341-388).
   - `roomsAtPoint(d.at)` lists every room whose perimeter is within `tolMm` (200) of the
     **centre point only**. Two or fewer rooms gives `doorConnections`, which takes the first
     two, or `exterior` + room on an exterior host.
   - Three or more rooms gives `probeConnection`: one wall thickness off each face at the centre.
     If it cannot decide, `ambiguous: true` and the edge joins nothing, but **no diagnostic says
     so** (it is only a field on `describe().access.edges[]`).
   - **The leaf span is never examined.** `d_living_bed3` at (5500,6500) w800 covers y
     6100–6900 across the T at (5500,6400). The centre touches only bed3 and bath2, so it reports
     `[bed3, bath2]`, `ambiguous: false`, silently. A door whose leaf spans two rooms on one side
     is never reported as ambiguous.
   - The 200 mm tolerance makes a centre near a junction pick up extra rooms. Backlog **C.4**
     (:612): an exterior door near a partition end joins the two rooms and the plan reports
     `W_NO_ENTRANCE`.
5. **Ids are opaque.** Nothing compares an id like `win_bed1` or `d_living_bed3` with
   `describe().windows[].room` or `doors[].between`. The iron law forbids quoting ids in lint
   messages (iron-laws.md, "names things the way a person would"). Ids are hint-only.
6. **Relational placement and `strip`** (ADR 0004; language-reference.md:897-922, 1130-1158) are
   closed-form arithmetic for **rooms only**. Strip "expands to ordinary absolute-placed rooms
   during resolve, so everything downstream — walls, doors … — is unchanged". Neither emits a wall
   or a door.
7. **Window → room** is a single room (`describe().windows[].room`), found by the same
   point-on-edge test. A window whose span crosses a partition junction is attributed to one room
   and not flagged.

## C. Governing ADRs and constraints (decisive lines)

- **ADR 0004** (relational placement): "Relational placement is resolved by **pure arithmetic in
  dependency order**, not by a solver." It "cannot satisfy *mutual* or *global* constraints …
  those need a solver, which is out of scope."
- **ADR 0005** (no invisible architect): "**The core computes facts and emits advisory warnings;
  it never designs. Arranging — choosing among alternatives — is the job of the agent/SKILL layer
  on top of the CLI.**" The core may "warn when a plan looks unsound (advisory `W_*`, traceable to
  a documented rule)" and "perform closed-form placement only when every target is explicit and
  unambiguous — and fail with a diagnostic … when it is not". It may not "pick among valid
  wall/side/furniture placements; run a layout or constraint optimizer; … or assert standards
  *compliance*". Honesty: "Inferring room purpose from label regexes … manufactures confidence".
- **ADR 0006**: "A constraint-solver / arranger may exist in ArchLang only as an explicit, opt-in
  command whose output is new `.arch` source plus a change log." Its context paragraph is
  load-bearing for this audit: "the failing plans were mostly an **integration failure** … lint
  *already* flagged … — the upstream generator ignored every warning and shipped anyway." This
  time lint did **not** flag the defects, so this case is a coverage gap and not only an
  integration failure.
- **ADR 0008**: "Circulation is … **a measurement, not a generator** … Rooms connect **only**
  where a door/opening actually is." The numbers are "deliberately **coarse and advisory**". That
  claim holds only where walls exist. The missing wall here breaks it.
- **ADR 0011**: "a producer emits `machine-applicable` **only when it can prove uniqueness** …
  the *moment* there is a choice, it emits `maybe-incorrect`." "`fix` never guesses at space."
- **ADR 0024 / 0025**: finish/furnish are explicit transforms. Furnish "fills only empty rooms. A
  room that holds any furniture or fixture is not touched." Law "Never worse": no new diagnostic
  code under any profile.
- **Iron laws** (docs/agents/iron-laws.md):
  - Intent "adjacency/reachability assertions stay advisory (`gate: false`)".
  - T3 loop experiment permanently declined.
  - A lint `message` never quotes an element id.
  - "A derived position comes from the shape, never its bounding box or centroid" ("a defect
    class that `arch lint` cannot see"; probe one wall thickness off each face).
  - Every new language form ships a byte-identity law.
- **AGENTS.md hard rules**:
  - New lint work must stay inside the step and drawing budgets.
  - A drawing change never moves `describe()`/`lint()` over the corpus.
  - A *new lint rule* does move `lint()` over the corpus wherever it fires. Rules are appended
    last (index.ts:28-31, "ORDER IS CONTRACT"), and the byte-identity ledger must explain each
    move.
- **Backlog items bearing on soundness**:
  - G.12: no wall from a room boundary.
  - C.4: exterior door at a partition end gives no entrance.
  - V.3: an opening wider than, or consuming, its host is diagnostic-free; "won't fix", filed
    under the view.
  - 6.10: door `at` grid-snaps silently.
  - 6.11: a double door reads as two doors.
  - M.16: egress facts deferred.
  - M.22: furnish never tops up.
  - U.3: a misspelt furniture category passes `--strict`.
  - U.7: two bedrooms are both `MasterRoom`.

## E. Gap list

| # | Defect class (example) | Closest existing check | Why it misses | Where a new check would live |
|---|---|---|---|---|
| 1 | Door across a wall T-junction; one leaf side spans two rooms (`d_living_bed3` over (5500,6400)) | `W_DOOR_NEAR_CORNER` (doors.ts:405); `ambiguous` in `connectorConnection` | `isCorner` only tests the host segment's own ends and excludes tees (doors.ts:501-504). `between` reads the centre point only | A lint rule in `doors.ts` that, for each connector, collects every other wall segment whose end or centreline meets the host within the void span `[u−w/2, u+w/2]` (reuse `jambRuns`). Or probe each face at both jambs (not only the centre) and flag when either face holds more than one room. Generalises to windows. Append-last |
| 2 | Two rooms share an edge with no wall (living / bed3 / bed4) | `W_ROOM_NOT_ENCLOSED` (wet rooms only, per-room.ts); `rooms[].adjacent` vs `input_graph` | The enclosure rule is limited to `isWetRoom` | Generalise `largestPerimeterGap` to *shared* boundaries. For each `roomsAdjacent` pair, measure the shared run not covered by any wall segment. Warn (new `W_ROOM_BOUNDARY_UNWALLED`, or `W_ROOM_NOT_ENCLOSED` widened) unless an `opening` covers it, or the pair is an open-plan pair (both rooms' uses in {living, dining, kitchen, hall, circulation, entry}). The fact itself could also go on `describe()` as `rooms[].unwalled_edges`. A layer-up fix is G.12's `wall … between A and B` |
| 3 | Bathroom opening straight onto living via a cased opening, plus a second door into a bedroom (bath1 as a passage) | `W_BATH_VIA_BEDROOM` only | Nothing reads the *kind* of room on each side of a wet-room connector, or a wet room with two or more connectors | `reachability.ts` (access graph): e.g. `W_WET_ROOM_THROUGH` (a bath with more than one connector that joins two different non-en-suite rooms, i.e. a bath used as a passage) and `W_WET_ROOM_OPENING` (a leaf-less `opening` on a wet room). The access edges already carry `kind` |
| 4 | Bedroom reached only through another bedroom (bed4 via bed3; bed1/bed2 chain) | `W_BATH_VIA_BEDROOM` (same graph, wet rooms only) | Not generalised | `reachability.ts`: `reachFrom(g, {avoid: isBedroom})`, already computed as `reachNoBed`. A bedroom not in it means every path crosses another bedroom (`W_BEDROOM_VIA_BEDROOM`). Near-zero cost |
| 5 | Kitchen/living reached only via a bedroom (living at depth 4 via bed1 and bed2) | none | — | Same `reachNoBed` set: any non-bedroom habitable room (living, kitchen, dining) missing from it gives `W_ROOM_VIA_BEDROOM`. Optionally a dominator fact (backlog M.16 egress facts) |
| 6 | Entry door opens into the kitchen (front door straight into the kitchen) | none | — | Advisory: the entrance room's uses not in {hall, entry, living, circulation}. Weak and culture-dependent, so a profile-scoped rule |
| 7 | Window overlapping the entry door on the same wall (`win_bed3` 1000–2200 vs `d_entry` 1550–2450) | none (V.3 records overlapping openings as diagnostic-free) | No opening-vs-opening test | New lint rule (an `openings.ts` module or doors.ts) over host segments: two openings on the same segment (or collinear segments of one wall) whose along-run intervals overlap or leave a pier < wall thickness → `W_OPENING_OVERLAP`. Interval math only, cheap |
| 8 | Window spanning a partition junction (`win_living_top` 5100–6900 over x=5500; `win_bed1` ending at the 5500 tee) | none | Same as #1 | Same span-vs-junction test as #1, applied to windows. A window over a tee lights two rooms and has a partition dying into glass |
| 9 | Ids that describe rooms they are not on (`win_bed1` in bedroom 2; `d_living_bed3` joins bed3↔bath2) | none; `describe` gives the truth | Ids are opaque; lint messages may not quote ids | Not a core lint: token-matching ids against labels is the label-regex inference ADR 0005 calls dishonest. Belongs on the generator (consumer) side: compare its own intended ids or `between` with `describe().doors[].between` / `windows[].room`. Or the model should state intent through `validate --graph` (gating, already reports `extra_connections`) |
| 10 | Bedroom with no bed (bed3) | `W_ROOM_NO_FIXTURE` (bath/kitchen only); furnish (empty rooms only) | Bedrooms are not in the fixture rule; furnish never tops up | Extend `perRoomRules` with a bedroom→`bed` presence test (`FURNISH_TABLE` already says bed is required). Footprint centre in room, as `W_ROOM_NO_FIXTURE` does. Or allow `finish` to add a *required* piece to a partly furnished room (M.22 policy change) |
| 11 | Bathroom as through-route to a bedroom (bed3 reached via bath2: kitchen → bath2 → bed3) | none | — | Same `reachability.ts` family as #3/#4: `reachFrom(g, {avoid: isWetRoom})` |
| 12 | Nav grid walks through a missing wall while the access graph says closed | none | Two models | Falls out of #2. Alternatively assert in a test that circulation-reachable implies access-reachable |
| 13 | Door point near a junction picks up an extra room (tolerance 200) | C.4 backlog | `roomsAtPoint` tol | Probe two-room connectors too (C.4's proposed fix) |
| 14 | Ambiguous connector is silent | `ambiguous` field only | No diagnostic | Lint: `W_CONNECTOR_AMBIGUOUS` for any edge with `ambiguous: true` |
| 15 | Two bedrooms both `MasterRoom` (U.7); `furniture[].room` null for `at` pieces | — | Fact gaps | `describe` fact work. Room-of-furniture by footprint would help every downstream check (#10) |
| 16 | `suggest` itself proposes a bedroom-via-bedroom or bath-off-living door | `suggestTopology` W_ROOM_UNREACHABLE builder (suggest.ts:364-395) | `neighbours.find(reachable)` takes any reachable neighbour; `SKILL.md:187-191` says otherwise | Rank interior candidates by the neighbour's use (hall/circulation/living first, bedroom/wet last) in `suggest.ts`. Or have `suggest` drop candidates that would raise #3/#4/#5 once those rules exist ("fires iff the lint fires" discipline) |

**Cheapest high-yield set.** #4, #5 and #11 are a few lines in `reachability.ts`, because
`reachNoBed` is already computed. #7 and #1/#8 are interval tests on the host segment in a new
`openings` rule. #10 is a bedroom row in the per-room fixture check. #2 generalises the existing
`largestPerimeterGap`. All are advisory `W_*`.

Constraint check for the proposed rules (C): each is a **fact + advisory warning** with a
documented threshold (ADR 0005 allows this). None chooses a placement. Each must be appended to
`LINT_RULES`, must derive positions from the shape (probe off the faces, not bboxes), must be
budget-bounded, and moves `lint()` on any corpus example where it fires (explain in the
byte-identity ledger). #2's open-plan exemption must come from authored `uses`, not labels, to
stay honest. A *language* answer to #1/#2/#9 is the G.12 `wall … between A and B` /
`door between A and B` form. It needs a byte-identity law, and resolves to the same absolute IR.
