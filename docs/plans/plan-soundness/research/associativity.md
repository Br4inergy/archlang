> Research record, 2026-10-18, made against `main@98bd30b` (v1.43.1). Copied from the
> session's scratch: machine-local paths are replaced by `<scratch>/`, and closed-source
> and marketing material is removed. Read observations as evidence and diagnoses as
> hypotheses (the `docs/backlog.md` rule): re-measure before you build on a number.
> Programme entry: `../README.md`.

# Parametric intent for ArchLang: what must follow, what stays fixed, what gets re-checked

Research report, 2026-10-18. Scope: how BIM/CAD tools encode associativity, what the design-intent and
constraint-layout literature says, and a concrete design for ArchLang that keeps `compile()` pure,
deterministic, bounded and zero-dependency (ADR 0004/0005/0006/0020).

Clones (all `--depth 1`) live under `<scratch>/oss\`:

| clone | commit | why |
|---|---|---|
| `freecad` (sparse: `src/Mod/BIM`, `src/Mod/Sketcher/App`, `src/App`) | `799c91e` (2026-10-18) | Arch wall/window hosting, Arch Space boundaries, Sketcher solver, element map (TNP) |
| `solvespace` | `8ef723e` (2026-10-15) | constraint vocabulary, rank/DOF, redundancy finder |
| `ifcopenshell` (sparse: `api/`, `util/`, `bonsai/bim/module/model`) | `2be812f` (2026-10-17) | IfcRelVoids/Fills, path connections, layer-set regeneration, IfcObjective |
| `topologicpy` | `4be76a6` (2026-10-16) | cells-as-rooms, internal faces as walls, dual graph |
| `sh3d-new` (keich/SweetHome3D mirror, v7.5) | `825635f` | door/window magnetism, wall joins, room-from-walls |
| `sh3d` (Vanuan mirror, v4.1) | — | older baseline, same mechanisms |

Probe sources written for this report (the `.arch` ones are kept in `../repro/`): `<scratch>/probe\`
(`tee.arch`, `tee2.arch`, `w4000.arch`, `w4500.arch`, `diff.mjs`, `freedom.mjs`). All numbers below were
measured with the built CLI (`node dist/cli.js lint|describe --json`) and `dist/index.js` on the primary
checkout at `98bd30b`.

---

## 0. Summary, ranked by leverage

1. **Name resolved geometry, so a wall can stand on a room edge (closes backlog G.12).** Today a wall point
   is an `Expr` that can see only `let`s and the nine built-ins; `kitchen.x` is `E_UNKNOWN_REF`
   (`docs/backlog.md` G.12, lines ~290-330; `examples/relational.arch` header). Every BIM tool studied
   makes *one* class of element primary and derives the other from it. ArchLang derives neither. A
   closed-form `wall … between A and B` / `wall … around [A B C]` plus room-edge datums (`A.east`) is
   the single change that makes "room grows 500 → walls follow" true. It is core-legal: every target is
   named and explicit (ADR 0005), and it is arithmetic in DAG order (ADR 0004).
2. **Re-check what breaks, and fix three lint and fact gaps the probes found.** (a) A door centred on a
   T-junction is reported as an interior `a↔b` door with `exterior:false, ambiguous:false`, and the plan
   then raises `W_NO_ENTRANCE` (probe `tee.arch`). (b) Two openings on one wall that overlap draw no
   warning. (c) A room pushed 500 mm through the exterior wall draws no warning (probe `w4500.arch`; only
   `W_ROOM_DISCONNECTED` fires). These are the "door across a junction" and "rooms overlap" cases the
   owner named, and today they pass silently.
3. **A dependency fact plus `arch impact` (what-if).** Extend `describe().freedom` (which says *how* a
   position was authored) with *what it depends on* (element→element, element→`let`). Add a twin-compile
   command that overrides one `let`, or applies one edit, and reports moved / fixed / re-hosted elements
   plus the diagnostic delta, i.e. the invariants that broke. It is the `reroll`/`fix` shape, one layer up
   (ADR 0020 §4). `diffPlans` today labels a pure move as `resized` and never reports an opening that
   changes its `between`.
4. **Declared invariants (`keep …`), checked by `compile()` and never solved there.** A small vocabulary
   (`align`, `equal`, `offset`, `min clear`, `on axis`, `stacked`) that lint checks as facts with a
   signed residual in mm. IFC already has the grade ladder (`IfcConstraintEnum` HARD/SOFT/ADVISORY).
5. **`arch solve`, an explicit source-to-source transform (ADR 0006).** On a rectilinear plan the x and
   y systems decouple and almost every architectural constraint is a *difference constraint*. So solving
   is exact rational elimination for equalities (DOF = unknowns − rank, conflict and redundant sets the
   way FreeCAD's `planegcs` and SolveSpace report them) plus Bellman-Ford for inequalities (a negative
   cycle is the witness of conflicting `keep`s). Authored values act as the lowest-priority anchors
   (SolveSpace's `WHERE_DRAGGED`), so the solve is "least change", never a free layout search. The step
   budget is counts only: SolveSpace bounds its redundancy search with a *timeout*, and ArchLang must not.
6. **An architect's hold-fixed ladder** (site → structure → shafts → wet stacks → envelope and façade
   rhythm → entrance → partitions → room sizes → doors → furniture). `solve` uses it for priority and
   `impact` uses it for ordering and wording.
7. **Stable semantic references instead of positional ones.** `against wall shell segment 0` is the
   same fragility as FreeCAD Arch Space's `"Face3"` index references. Prefer named edges (`north`,
   `start`/`end`, `A.east`) on the CadQuery-selector or Revit-named-reference model.

---

## 1. Baseline: what ArchLang does today (measured)

### 1.1 What is relative and what is absolute

- **Rooms:** `room … right-of|left-of|below|above <ref> [align] [gap]`, resolved by `placeRelational`
  (`src/layout.ts:1-16`, `:87`) **after** every element of the group has resolved
  (`src/ir.ts:2488-2500`, step "3a"; instance path `src/ir.ts:2409`). `strip` is pure sugar to absolute
  rooms.
- **Openings:** `door|window|opening on <wall> at <expr>|<expr>%|center`. It walks the wall's polyline
  run length from the **start** vertex only, and is hosted by construction (`src/attach.ts:1-13`,
  `:108`). There is no "from end", "from corner" or "from room edge" form.
- **Furniture:** `in <room> centered|anchor <9-point> [flush] [inset]` and
  `against wall <id|category> [segment <n>] [offset] [side]`.
- **Walls:** always absolute. Registry order is walls → rooms → doors → windows → openings → furniture
  → … (`src/elements/defs.ts:29-45`), and walls resolve first so openings can host against them.
- **Degrees-of-freedom fact:** `describe().freedom` (`src/describe.ts:450-480`, built at
  `src/describe.ts:907-946`, classified by `markPlacement` at `src/ir.ts:3003-3027`) records *how* each
  position was authored (absolute / relational / strip / attached / anchored / against-wall). It does not
  record *on what* it depends.

Corpus share (sum of `describe().freedom` over the 34 examples that describe at top level; multi-level
plans undercount):

| family | total | derived | absolute |
|---|---|---|---|
| rooms | 203 | 13 (5 relational, 8 strip) | **190 (94 %)** |
| openings | 444 | 201 attached | **243 (55 %)** |
| furniture | 565 | 258 (93 anchored, 165 against-wall) | **307 (54 %)** |
| walls | all | 0 (no derived form exists) | **100 %** |

So in practice an ArchLang plan is a set of independent absolute statements joined only by `let`
arithmetic. That is exactly the fragility the owner describes.

### 1.2 Probe A: a 500 mm wider room (`w4000.arch` → `w4500.arch`)

The plan has a shell `8000×5000`, a partition at x=4000, `room a at (0,0) size AW x 5000` and
`room b right-of a`. A door on the partition and a bed against the shell sit in `b`.

- `lint` before: clean. After `AW = 4500`: **only** `W_ROOM_DISCONNECTED` (Bed).
- Facts after the edit: `b` runs x 4500→8500, so 500 mm of it lies outside the 8000 mm shell. The
  partition is now inside `a`. The partition door's `between` went from `[a, b]` to `[]`. None of this
  raises a warning about the room crossing the envelope or about the partition no longer sitting on a
  room boundary.
- `diffPlans(before, after)` (`probe/diff.mjs`) reports `a` as resized (+500 right) and `b` as
  **"resized"** with `+0.0 m²` and both left and right edges +500. That is a *move* mislabelled as a
  resize. It reports no change for `door_2` (its `between` changed), and nothing for walls (walls are
  not diffed at all: `PlanDiff` has rooms/openings/furniture only, `src/diff.ts:61-70`). Opening changes
  carry width only (`src/diff.ts:41-48`), with no position and no host.
- Side finding: `furniture … against wall shell … in b` with a relational `b` fails with
  `E_FURN_AGAINST: can't infer side from a relationally-placed room`. That is because relational
  placement runs after furniture resolves (`src/ir.ts:2488`). Proposal P1 fixes this ordering as a
  by-product.

### 1.3 Probe B: an opening on a T-junction (`tee.arch`, `tee2.arch`)

The shell has a partition teeing in at x=4000. `door on shell at 4000 width 900` and
`window on shell at 3800 width 1200` overlap by 850 mm.

- `describe`: `door_1.between = ["a","b"]`, `exterior:false`, `ambiguous:false`, `hostCategory:
  "exterior"`. An exterior-wall door is classified as an *interior* connection, and the probe landed
  exactly on the a|b boundary yet reports `ambiguous:false`. ADR 0020's W3b says `ambiguous` means "the
  wall-face probe could not decide", so this looks like a defect, not a design choice.
- `lint`: `W_NO_ENTRANCE` only (a consequence of the above). There is no warning that the door straddles
  a junction, and no warning that the window and door overlap. `W_DOOR_NEAR_CORNER` explicitly excludes
  "a partition teeing into a wall that carries straight past it" (`src/error-catalog.ts:1020-1026`).
  That exclusion is right for the nib rule, but it leaves the straddle case uncovered.
- Moving the door to `at 4600` (`tee2.arch`) gives `between ["exterior","b"]`. The window still
  overlaps it (4150–4400), and there is still no warning.

These probes motivate P2.

---

## 2. How BIM/CAD tools encode associativity

### 2.1 Revit (documentation; closed source)

- **Hosting:** doors and windows are hosted by a wall and move with it; joined walls resize to keep their
  joins ([Autodesk Learn: Add doors and windows](https://www.autodesk.com/learn/ondemand/module/layout-basic-architectural-elements-in-revit/unit/62eg5yXtt2MEBBs2g3hTBo)).
  Temporary dimensions measure to the door centre by default and can be switched to the opening edge,
  which is the "offset from what?" choice made explicit.
- **Rooms are derived and live:** a room is bounded by elements whose *Room Bounding* parameter is on,
  plus room separation lines, and "room dimensions update automatically when room-bounding elements are
  added, moved, or deleted" ([About Rooms](https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-DD74A51D-A0B0-4461-A4BA-0F9CCC191CDB.htm)).
  Walls are primary and rooms are computed from them.
- **Constraints:** locked dimensions and alignment locks make an element follow a reference while keeping
  the gap ("lock the dimension and move the grid line, the door moves with it maintaining the 900 mm gap",
  [Arkance](https://emea.support.arkance.world/hc/cs/articles/36470490097298-Working-with-Dimensional-Constraints-in-Revit)).
  An **EQ** string keeps a door centred between two walls when either wall moves
  ([Autodesk: center doors in wall segments](https://www.autodesk.com/learn/ondemand/tutorial/center-doors-in-wall-segments)).
  The failure mode is the over-constrained "Constraints are not satisfied" dialog, and constraints hide:
  users need *Reveal Constraints* to find a lock that outlived its dimension
  ([AUGI](https://forums.augi.com/archive/index.php/t-85945.html),
  [Arkance](https://emea.support.arkance.world/hc/lt/articles/36470451725586-Revit-Tip-Reveal-Constraints-Function)).
  Lesson for ArchLang: constraints must be visible in the source and reported as facts.
- **Families:** reference planes are flagged strong, weak or named (Left/Center/Right…). Named references
  keep a dimension stable when a 24″ door is swapped for a 30″ one; "Defines Origin" fixes the insertion
  point ([Reference plane properties](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-A9B4F5C7-E5E4-4369-AA68-F798DB5D50A3.htm)).
  This is the semantic-reference model (P7).
- **Location line:** a wall's thickness is placed relative to its location line (wall centreline, core
  centreline, finish face…). Changing the wall type therefore grows the wall about whichever line is
  held, and the wrong choice "may shift geometry and critical dimensions"
  ([Location line video](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-8608922A-15DF-457F-A26A-55DAC2B357E0.htm),
  [Novedge](https://novedge.com/blogs/design-news/revit-tip-master-revit-wall-placement-with-the-correct-location-line)).
  ArchLang fixes the centreline. That is a legitimate choice, but it means a thickness change silently
  changes the clear width of both rooms. `impact` should report it (P3).
- **Type vs instance:** a type parameter (wall assembly, door family size) changes every instance at
  once. ArchLang's analogue is `let` plus `component`/`place`; `set <element>(…)` is a scoped default,
  not a type.

### 2.2 ArchiCAD (documentation)

- Zones (rooms) are created from walls by *Inner Edge* or *Reference Line*, and each wall has a
  *Relation to Zones* setting ([Creating Zones](https://help.graphisoft.com/AC/22/INT/_AC22_Help/040_ElementsVB/040_ElementsVB-127.htm)).
  Unlike Revit, **automatic zones do not follow design changes**: the user runs *Design > Update Zones*,
  and manually drawn zones "cannot be automatically updated"
  ([Updating Zones](https://help.graphisoft.com/AC/21/INT/AC21Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-121.htm)).
  This is the *explicit transform* model (ADR 0006) inside a commercial BIM tool, and its status
  column ("self-intersecting", "locked layer") is a refusal-with-reason, the shape `arch repair` already
  uses.

### 2.3 FreeCAD BIM (source)

- **Window hosting is a link list plus a recompute touch, not relative coordinates.**
  `ArchWindow.py:141-148` declares `Hosts` (`App::PropertyLinkList`). `onChanged` (`:349-385`)
  `touch()`es every host when the window's size or placement changes, so the wall recomputes its hole
  from `getSubVolume` (`:763-793`). The window's own `Placement` is absolute.
- **"Move with host" is delta propagation:** `ArchComponent.py:309-320` adds `MoveWithHost`.
  `onChanged` (`:452-488`) computes `deltap`/`deltar` between the old and new host placement and
  applies them to `getMovableChildren` (`:490-535`). It is history-dependent: it fires on a rigid move of
  the host, not when the host's *length* changes. Placing a window relative to a wall *edge* exists only
  in the external **SketchArch** add-on ("Intuitive Automatic Placement"), which attaches windows to a
  layout-sketch edge and keeps the reference by `Sketch.Geometry[index].Tag`
  ([paullee0/FreeCAD_SketchArch](https://github.com/paullee0/FreeCAD_SketchArch)).
- **Space boundaries by face index:** `ArchSpace.py:199-208` declares `Boundaries`
  (`PropertyLinkSubList`). `getShape` (`:464-470`) parses `"FaceN"` with `int(sub[4:]) - 1` and cuts the
  space from those faces. This is the topological-naming problem in its purest form: renumber the wall's
  faces and the room binds to the wrong face. `ArchWall.py:204, 215, 226` warn that per-segment widths,
  aligns and offsets are "Not 'Toponaming-Tolerant' if just Sketch is used".
- **Element map (TNP mitigation):** `src/App/ElementNamingUtils.h:52-88` defines the mapped-name
  postfixes (`;:M` modified, `;:G` generated, `;:MG`, `;:U/;:L`, `;:H` tag). A face's persistent name is
  derived from the names of the inputs it came from. That is history-based naming in the line of
  [Kripac 1997](https://patents.google.com/patent/US6445388), "A mechanism for persistently naming
  topological entities in history-based parametric solid models" (CAD 29(2):113-122).
- **Sketcher solver vocabulary and diagnostics:** `Sketcher/App/Constraint.h:52-77`: Coincident,
  Horizontal, Vertical, Parallel, Tangent, Distance, DistanceX, DistanceY, Angle, Perpendicular, Radius,
  Equal, PointOnObject, Symmetric, InternalAlignment, SnellsLaw, Block, Diameter, Weight. `isDriving`
  (`:240`) separates driving constraints from reference (measured-only) ones.
  `planegcs/GCS.cpp:4773-4850` `System::diagnose`: a QR of the reduced Jacobian's transpose gives the
  rank, `dofs = |params| − rank`, and fills `conflictingTags`, `redundantTags` and
  `partiallyRedundantTags`. Dense QR is used for small systems because sparse QR "is known to fail rank
  detection", a floating-point rank decision that ArchLang can avoid entirely (P5).

### 2.4 Bonsai / IfcOpenShell (source + IFC 4.3 spec)

- **Openings are relationships, not coordinates:** `api/feature/add_feature.py:61` creates
  `IfcRelVoidsElement` (wall ← opening). `api/feature/add_filling.py:24-37, 112-113` creates
  `IfcRelFillsElement` (opening ← door), with the docstring "when the door moves, the opening will move
  with it". The ownership chain is wall ⊃ opening ⊃ door, and each placement is local to its parent.
- **Wall joins are first-class:** `IfcRelConnectsPathElements` with `ATSTART`/`ATEND`/`ATPATH`
  (`bonsai/bim/module/model/wall.py:1520` `DumbWallJoiner`). `split` (`:1556-1600`) re-attaches the far
  end's connection to the new wall and keeps an opening on whichever half its axis extent overlaps. That
  is the "door across a junction" decision made explicitly.
- **Type-level regeneration:** `DumbWallPlaner.regenerate_from_layer_set` (`wall.py:1439-1460`) finds
  every wall whose `IfcMaterialLayerSetUsage` uses the edited layer set and recalculates them. A
  type-parameter edit propagates to all instances. `OffsetFromReferenceLine`/`DirectionSense` decide
  which face is held (IFC 4.3 `IfcMaterialLayerSetUsage`, fetched to `papers/`).
- **Space boundaries:** IFC 4.3 `IfcRelSpaceBoundary` (`papers/IfcRelSpaceBoundary.md`) objectifies
  space↔element, physical or virtual, at 1st level (seen from the space) or 2nd level type A (space on
  the other side) and type B (element on the other side). ArchLang's `describe().access`
  (`between`, `hostWallId`) is a 2nd-level-A fact already; it lacks the boundary *segments*.
- **Declared constraints in the data model:** `api/constraint/add_objective.py:39-45` creates
  `IfcObjective` with `ConstraintGrade` and `ObjectiveQualifier` (e.g. `CODECOMPLIANCE`).
  `add_metric.py:46` adds `IfcMetric` with `Benchmark` (`EQUALTO`, …). `IfcConstraintEnum`
  (`papers/IfcConstraintEnum.md`) is **HARD** ("must be followed rigidly"), **SOFT** ("should be
  followed") or **ADVISORY**. This is a ready-made grade vocabulary for `keep` (P4).

### 2.5 Sweet Home 3D (source, v7.5 mirror)

- **Magnetism is edit-time snapping into absolute storage.**
  `PlanController.java:2643-2665` `adjustMagnetizedPieceOfFurniture`: a door dropped on a wall is
  resized to the wall thickness, rotated to the wall direction and flagged `setBoundToWall(true)` (`:2930`).
  `HomeDoorOrWindow` keeps `wallThickness`/`wallDistance`/`wallLeft` as *percentages of its own
  depth/width* plus the `boundToWall` flag (`model/HomeDoorOrWindow.java:41-51, 193-206`). No host id
  and no along-wall offset are stored.
- **Joins are the only live topology:** `moveItems` (`:6057-6084`) moves a wall's endpoint and, unless
  the neighbour is also selected, the joined wall's endpoint (`moveWallStartPoint`, `:6090-6115`). A
  moved door merely re-tests whether it still intersects a wall (`:6077-6080`).
- **Rooms from walls are a one-shot snapshot:** `getRoomPathsFromWalls` (`:8551-8565`) takes the
  complement paths of the walls' union area. `createRoom` (`:4356`) stores the points; the room never
  follows a later wall edit.
- **Feedback dimensions:** `getDimensionLinesAlongWall` (`:2992`, `:3751`) shows a door's distance to
  each wall end while dragging, i.e. the two offsets an architect checks.

### 2.6 Constraint solvers (source)

- **SolveSpace vocabulary** (`src/sketch.h:659-699`): `POINTS_COINCIDENT`, `PT_PT_DISTANCE`,
  `PT_LINE_DISTANCE`, `PT_ON_LINE`, `EQUAL_LENGTH_LINES`, `LENGTH_RATIO`, `LENGTH_DIFFERENCE`,
  `EQ_PT_LN_DISTANCES`, `SYMMETRIC(_HORIZ/_VERT/_LINE)`, `AT_MIDPOINT`, `HORIZONTAL`, `VERTICAL`,
  `PARALLEL`, `PERPENDICULAR`, `EQUAL_RADIUS`, `WHERE_DRAGGED`, `COMMENT`. `reference` (`:718`) is a
  dimension that "generates no eqs" (measured, not driving).
- **Results and DOF:** `SolveResult` (`src/solvespace.h:46-52`) is `OKAY`, `DIDNT_CONVERGE`,
  `REDUNDANT_OKAY`, `REDUNDANT_DIDNT_CONVERGE` or `TOO_MANY_UNKNOWNS`. `System::TestRank`
  (`src/system.cpp:249-255`) computes `dof = n − rank`.
- **Finding the bad constraint:** `FindWhichToRemoveToFixJacobian` (`system.cpp:469-512`) drops each
  constraint in turn, re-ranks, and reports those whose removal restores full rank, with
  point-coincident constraints tried last. It is **time-bounded** (`GetMilliseconds() - time >
  findToFixTimeout`, `:476-478`). ArchLang's equivalent must be **count-bounded** (AGENTS.md: "budgets
  are counts, never time").
- **`WHERE_DRAGGED`** is the "hold this where the user left it" soft anchor that makes an
  under-constrained drag well-defined. It is the right model for "least change" in `arch solve`.

### 2.7 Stable references (topological naming)

- **Onshape:** transient ids change after any operation; *robust* queries select by identity and
  *tracking* queries follow entities created from earlier ones (`startTracking`, `makeRobustQuery`),
  per staff answers on [forum.onshape.com](https://forum.onshape.com/discussion/comment/75861).
- **CadQuery:** string selectors (`>Z`, `|X`, `>Y[-2]`, combinable with and/or/not/exc) name faces and
  edges by *direction and extremity*, not by index
  ([Selectors reference](https://cadquery.readthedocs.io/en/latest/selectors.html)).
- **Dynamo:** *element binding* (trace data) makes a re-run update the same Revit elements instead of
  creating new ones; stale bindings cause duplicates ([Dynamo 2.2 notes](https://dynamobim.org/dynamo-core-2-2-release/),
  [Novedge](https://novedge.com/blogs/design-news/revit-tip-efficient-lookup-and-reliable-element-binding-in-dynamo-for-revit)).
- **ArchLang already has the identity half.** `diffPlans` pairs by authored id, then by a label unique on
  both sides, then by auto-id (`src/diff.ts:79-140`; antisymmetry law in ADR 0020 §5). What it lacks is
  semantic *sub-element* names: `segment <n>` on `against wall` and `dim radius` is an index, the same
  shape as FreeCAD's `"Face3"`.

### 2.8 Topologic (source + paper)

Rooms are **cells** of a non-manifold `CellComplex`, walls are the **shared internal faces**, and
openings are **apertures**:
`topologicpy/CellComplex.py:96` (`ByCells`), `:2040-2062` (`InternalFaces`),
`Topology.py:22523` (`SharedFaces`), `Graph.py:10513-10520` (`ByTopology(direct, viaSharedTopologies,
viaSharedApertures, toExteriorTopologies, …)`, the dual graph that ArchLang's `access` graph mirrors).
Paper: Jabi et al., "Topologic: A toolkit for spatial and topological modelling", eCAADe 2018
([ORCA](https://orca.cardiff.ac.uk/id/eprint/111728/)). Licence AGPL-3.0/LGPL, so it can serve only as
a reference; the zero-dependency rule forbids importing it anyway. The key idea for ArchLang: once
rooms are primary, a wall *is* the shared boundary of two cells. Two rectangles' shared edge is a
closed-form interval intersection.

---

## 3. Literature

- **Design intent and model robustness.** Camba, Contero and Company, "Parametric CAD modeling: An
  analysis of strategies for design reusability", *CAD* 74 (2016) 18-31, doi:10.1016/j.cad.2016.01.003
  ([RiuNet](https://riunet.upv.es/handle/10251/82267)). Model *quality* (how references are chosen)
  determines whether a model survives change. The same group's explicit-reference methodology (Aranburu
  et al., *CAD* 161, 2023) and constraint-redundancy work (*Computers in Industry*, 2021,
  [UJI](https://repositori.uji.es/items/a5b1f9ab-757c-4ae7-b759-a60bcc8e389a)) argue for referencing
  stable datums (planes, axes) rather than generated topology, and for removing redundant constraints.
  ArchLang should prefer axes and room edges over wall segment indices.
- **Parametric models break under change.** Daniel Davis, *Modelled on Software Engineering: Flexible
  Parametric Models in the Practice of Architecture*, PhD, RMIT 2013
  ([thesis](https://www.danieldavis.com/thesis/)). Its core finding is that parametric models routinely
  break when designers change them (Sagrada Família case). Structured and modular models plus
  *tests on the model* are the remedy, which is ArchLang's lint-as-invariant posture.
- **Separating topology from geometry.** Medjdoub and Yannou, "Separating topology and geometry in
  space planning", *CAD* 32(1) (2000) 39-61 ([arXiv:1303.4017](https://arxiv.org/pdf/1303.4017)),
  ARCHiPLAN: enumerate topological solutions, then dimension each. Flemming, "Wall representations of
  rectangular dissections…", *Env. & Planning B* 5(2) (1978) 215-232
  ([IDEAS](https://ideas.repec.org/a/sae/envirb/v5y1978i2p215-232.html)): fix the arrangement first,
  then compute room dimensions **by linear programming**. That is exactly P5's split, with
  `right-of`/`between` as topology and `keep` as the LP. Also in this line (from the record, not
  re-fetched): LOOS and SEED (Flemming and Woodbury, *J. Arch. Eng.* 1995), WRIGHT (Baykan and Fox,
  disjunctive constraint satisfaction, *AI EDAM* 1997), Charman (constraint technology for space
  planning, 1993), and Michalek, Choudhary and Papalambros, "Architectural layout design optimization",
  *Eng. Optimization* 34(5) 2002. They share one lesson: constraint-based *generation* needs search.
  ArchLang should take only the *dimensioning* half (convex, exact) into `solve`, and leave the
  topology search to the agent (ADR 0005).
- **LLM emits structure, solver emits geometry (2023-2026).** Holodeck
  ([arXiv:2312.09067](https://arxiv.org/pdf/2312.09067)): the LLM writes relational constraints, and
  DFS/MILP places objects. Co-Layout (AAAI 2026, [arXiv:2511.12474](https://arxiv.org/abs/2511.12474)):
  the LLM extracts constraints, then a grid integer program solves them coarse-to-fine. RoomPlanner
  ([arXiv:2511.17048](https://arxiv.org/pdf/2511.17048)): LLM layout criteria, then DFS. HouseLLM
  ([arXiv:2411.12279](https://arxiv.org/html/2411.12279v2)): LLM-only plans overlap rooms, so a
  refinement phase enforces constraints. SpatialGrammar (2026,
  [arXiv:2604.27555](https://arxiv.org/abs/2604.27555)): a DSL with *deterministic compilation* and an
  agent loop on compiler feedback, ArchLang's own thesis. HypergraphFormer (2026,
  [arXiv:2605.18932](https://arxiv.org/abs/2605.18932)) claims editability from a relational
  representation. Factor-graph constrained layout (CVPR 2024,
  [arXiv:2404.00385](https://arxiv.org/pdf/2404.00385)). FloorplanQA
  ([arXiv:2507.07644](https://arxiv.org/html/2507.07644v2)): LLMs are weak at numeric spatial reasoning,
  which is the argument for letting the *language* carry the relations so the agent does not
  hand-propagate numbers. The common pattern: LLMs are reliable at relations and unreliable at
  propagating coordinates.

---

## 4. Design for ArchLang

### P1. Room-edge datums and walls derived from rooms (highest leverage)

**Decision to make:** which side is primary? Revit, ArchiCAD, Sweet Home 3D and FreeCAD all treat
*walls* as primary and derive rooms (live in Revit; by an explicit command in ArchiCAD; as a snapshot in
SH3D; through brittle face indices in FreeCAD). Topologic treats *cells* as primary and walls as shared
faces. For an LLM-authored DSL, **rooms primary with walls derivable** fits better. Agents think in
room graphs (RPLAN `input_graph`, which ArchLang already reports), rooms already have relational
placement, and the shared boundary of two rectangles is closed-form. Walls stay authorable absolutely;
nothing existing changes.

Proposed forms (all new syntax):

```arch static
room id=living  at (0,0) size LW x 4000
room id=kitchen right-of living align top gap 0 size 3000x4000
room id=bed     below living align left gap 0 size LW x 3500

wall id=shell exterior thickness 200 around [living kitchen bed]   # outline of the union, closed
wall id=p1 partition thickness 100 between living and kitchen      # their shared edge, exactly
wall partition thickness 100 { (living.east, 0) (living.east, living.south) }  # datum refs in points
door on p1 at 50% width 800
```

- **Datums:** `<room>.north|south|east|west` (scalar edge coordinates of the resolved rectangle;
  `left/right/top/bottom` as aliases), `<room>.cx|cy`, `axis 1`/`axis A` for declared `axes`. They are
  legal in any numeric slot evaluated at resolve time. They are *scalars on one axis*, which keeps the x
  and y systems separate (this matters for P5).
- **`between A and B`:** the interval intersection of the two rectangles' facing edges (within `tol`).
  An empty intersection is `E_WALL_BETWEEN_NOT_ADJACENT`; two disjoint shared runs (an L contact) is
  `E_WALL_BETWEEN_AMBIGUOUS`. It refuses rather than choosing (ADR 0005). A polygon or circle room is
  refused (`E_PLACE_POLY`, as relational placement already does).
- **`around [ids]`:** the boundary of the union of axis-aligned rectangles, i.e. the rectilinear union
  outline. It is closed-form (sweep over sorted x-breaks), deterministic, and refuses a union with holes
  or more than one component.
- **Resolution order (the real work):** a new datum phase after rooms are resolved and relationally
  placed, but before walls. Concretely: resolve rooms, then `placeRelational`, then freeze a
  `RoomDatum` table, then resolve walls (which may read the table), then openings, furniture, and the
  rest. Rooms never depend on walls today, so the DAG is unchanged. A wall reading a room that reads
  nothing is acyclic by construction. A datum read inside a `place` instance resolves in the local frame
  (same rule as `right-of`, `src/ir.ts:2404-2409`). Moving `placeRelational` earlier also fixes the
  `against wall … in <relational room>` side-inference refusal from probe A.
- **Budgets and purity:** each datum read charges one step and each `around` charges O(n log n) steps
  before allocating (`src/expr.ts` meter). Outputs pass `MODEL_RANGE_MM`. Grid snapping is unchanged:
  room coordinates are already snapped, so datums are snapped values.
- **Byte identity:** plans that use no datum/`between`/`around` must be identical in SVG, `describe()` and
  `lint()`. The reordering is the risk: id assignment order must stay registry order even if resolve
  order changes (ids are assigned in step 2, before resolve, `src/ir.ts:2238-2243`, so this is
  achievable). Pin it with the standard SHA-256 corpus law and add `compile().diagnostics` to the sweep,
  since this reaches the resolver.
- **Effect on probe A:** with `wall … between a and b`, widening `a` moves the partition, the door on it
  (`on p1 at 50%`) and `b`'s left edge together. `around` grows the shell, so `b` never escapes it.

### P2. Re-check: lint the failure modes that change produces

Each is an advisory `W_*` (ADR 0005), traceable and catalogued, with no auto-fix that rewrites an
authored number (the `W_DOOR_NEAR_CORNER` precedent, `src/error-catalog.ts:1024`).

| proposed code | condition (measured on the resolved plan) | today |
|---|---|---|
| `W_OPENING_AT_JUNCTION` | an opening's clear span contains a point where another wall meets the host (tee or cross), within the joining wall's half-thickness | silent (probe B) |
| `W_OPENING_OVERLAP` | two openings on the same host wall whose spans intersect (door/door, door/window, window/window) | silent (probe B) |
| `W_ROOM_OUTSIDE_SHELL` | a room's area lies outside the plan's closed exterior ring (when exactly one exists, the same rule `roof overhang` uses) | silent (probe A) |
| `W_WALL_OFF_BOUNDARY` (optional) | an interior partition no longer lies on any room boundary (it now bisects a room) | silent (probe A) |
| fix: access probe | a door whose face probe lands on a room boundary must report `ambiguous: true`, not `between [a,b]` on an exterior host | wrong fact (probe B) |

The fourth row is the "walls didn't follow" detector for plans that do not adopt P1. The fifth is a
facts bug and should be filed independently of this programme.

### P3. Dependency facts plus `arch impact` (the what-if / change-impact report)

**3a. `describe().depends`.** This is an append-only fact block. It is gated so that plans not asking for
it describe byte-identically: emit it only under `describe --facts depends`, following the existing
`DESCRIBE_FACTS` opt-in list (`src/describe.ts:136`). For each element it lists:
- `on`: the element ids it was derived from: relational ref room, host wall (`attach` or `against`),
  anchor room, instance frame, and the rooms named by P1's `between`/`around` and datums.
- `params`: the `let` names its coordinates read. This is computable from the AST with
  `cursor.ts`'s `statementExprs`/`eachExpr` (`src/cursor.ts:204, 324`), the same walk LSP
  references/rename uses. It is the "type parameter → instances" map.
This is the input graph Revit hides and users dig out with *Reveal Constraints*.

**3b. `arch impact plan.arch --set AW=4500 [--json]`** (or `--edit '<old>' '<new>'`, or
`--against old.arch`). It runs one layer up, like `reroll` and `fix`. It twin-compiles through the one
pipeline (`src/pipeline.ts` `compileUncached`, ADR 0020 §4) and reports:
- **moved** (translation only, area equal: fixes the `diffPlans` "resized +0.0 m²" mislabel),
  **resized**, **re-hosted** (opening `hostWallId` or `between` changed), **unchanged**. Each moved item
  carries its `depends.on` chain, *why* it moved: "door_2 moved +500 because it is `on p1 at 50%` and
  p1 is `between a and b`".
- **held**: elements whose position did not change *although* a dependency did. This is the "should
  have followed but didn't" signal. In probe A, without P1, the partition `p` and the shell are held
  while their neighbouring rooms moved. That is the invariant breach to surface first.
- **broke / healed**: the multiset difference of lint diagnostics (keyed by code + element id, never
  message text), plus violated or newly satisfied `keep`s (P4). In probe A: `+W_ROOM_DISCONNECTED(b)`,
  and, with P2, `+W_ROOM_OUTSIDE_SHELL(b)` and `+W_WALL_OFF_BOUNDARY(p)`.
- **walls** are diffed too (`PlanDiff` has no wall section today, `src/diff.ts:61-70`). Extending the
  frozen `PlanDiff` shape (ArchCanvas consumes it verbatim, `src/diff.ts:14-17`) must be additive.

`--set` substitutes a literal into one top-level `let` in a *clone* of the parsed AST (never the
memoised `PlanNode`), so `compile()` stays a pure function of source text. The override is a CLI
convenience that produces a twin source.

### P4. Declared invariants: `keep` (checked by `compile()`, never solved there)

The vocabulary is a deliberately small subset of the Sketcher/SolveSpace sets. Every term is one linear
relation on one axis, or a fact the analyzer already computes:

```arch static
keep align living.north kitchen.north            # equal datum (SolveSpace PT_PT_DISTANCE 0 on one axis)
keep equal bed1.width bed2.width                 # EQUAL_LENGTH_LINES
keep offset door_1 from shell.start 150          # hosted offset (Revit locked dimension)
keep min clear hall 1100                         # reuses the clear-width fact behind W_PATH_TOO_NARROW
keep on axis 2 p1                                # a partition centreline sits on a declared axis
keep stacked bath on levels 1 2                  # wet stack: same footprint edge across storeys
keep fixed axis 1 axis 4 shell                   # hold-fixed declaration consumed by `arch solve`
```

- **Semantics:** a `keep` draws nothing and moves nothing (the "heights draw nothing" posture). Lint
  evaluates it on the resolved plan and reports `W_KEEP_VIOLATED` with a signed residual in mm and the
  datum values ("living.north = 0, kitchen.north = 50, residual 50 mm"). `validate --strict` fails on
  it. A grade suffix `keep … hard|soft|advisory` maps to IFC's `IfcConstraintEnum`, so ArchLang's
  constraints can later round-trip to `IfcObjective`/`IfcMetric`.
- **No solving in `compile()`:** ADR 0004/0006 hold unchanged. `keep` is the Davis "test on the
  model", written in the model.
- **Static DOF facts (cheap, exact):** `describe --facts depends` adds, per axis, the number of free
  scalars (absolute literals not pinned by any `keep`) and the `keep` rank (P5's elimination, without
  solving). It flags *redundant* keeps (implied by others) and *conflicting* keeps (inconsistent with
  others), the `planegcs` `redundantTags`/`conflictingTags` split, as facts.
- **Byte identity:** a plan with no `keep` is unchanged. A `keep` adds diagnostics only.

### P5. `arch solve`: an explicit transform (ADR 0006), exact and count-bounded

Input: a `.arch` file with `keep`s and optional `keep fixed …`. Output: new `.arch` source plus a
per-number change log, or a refusal with a reason (the ArchiCAD *Update Zones* status-column model).

1. **Unknowns:** every *literal* number in a position or size slot of a rectangle room, an axis or a
   wall vertex, split by axis (x and y). An expression slot (`AW`, `i * W`) is solved through its
   `let` when the `let` is a top-level literal; otherwise it is frozen and reported. This is the same
   "what can be rewritten" discipline `repair` uses (`src/repair.ts` header: literal `at` is rewritable,
   expressions and multi-instance statements are reported).
2. **Equalities** (`align`, `equal`, `offset`, `on axis`, `stacked`) form a sparse integer linear system
   per axis. Solve it by **fraction-free (Bareiss) Gaussian elimination over `BigInt`** (exact, so the
   rank is a decision, not a floating-point threshold, unlike `GCS.cpp`'s QR). The output is
   **DOF = unknowns − rank**, plus the redundant and conflicting sets. Conflicts are found by the
   SolveSpace drop-one-and-re-rank method (`system.cpp:469-512`), but bounded by a step count
   (`MAX_EVAL_STEPS`-style), never `findToFixTimeout`.
3. **Inequalities** (`min clear`, room minimum sizes, "door ≥ wall-thickness nib") are almost all
   *difference constraints* `x_j − x_i ≥ c`. Feasibility is a shortest-path problem: Bellman-Ford over
   the constraint graph, O(V·E), counted. A negative cycle is the exact certificate of infeasibility,
   printed as the cycle of `keep`s that cannot hold together. (Note: the existing `src/algebra/paths.ts`
   `bestPaths` is label-setting and requires monotone non-negative weights, so it is *not* valid here.
   Bellman-Ford is a separate, textbook routine and needs its own law test.)
4. **Least change, no search:** every unknown not pinned by `keep fixed` gets a soft anchor at its
   authored value (SolveSpace `WHERE_DRAGGED`). The solved values are the unique point that satisfies
   the hard constraints and moves soft anchors minimally *in ladder order* (P6): first satisfy holding
   priority 1 at the authored values, then priority 2, and so on. Each tier is an exact linear solve
   (no optimizer), and within a tier the solve stays exact only when it is fully determined. If a tier
   is still under-determined after its anchors, `solve` **refuses** and names the free scalars rather
   than picking (ADR 0005: never choose among valid alternatives without saying so). A
   `--prefer left|right` style tie-break may be added later as an explicit flag recorded in the log.
5. **Emit:** rewrite only literals, through the one statement printer (`src/statement-print.ts`, ADR
   0020 §5 printer round-trip law). Prove the output by recompiling it: every `keep` satisfied, no hard
   lint conflict added (the `repair` "never worse than the input" contract), and
   `solve(solve(s)) = solve(s)`.

The scope deliberately excludes topology search, which stays with the agent: which room goes `right-of`
which (ARCHiPLAN's enumeration, Holodeck/Co-Layout's DFS/MILP). `solve` is Flemming's second step
(dimensioning by linear constraints) and nothing more.

### P6. What architects hold fixed, and what may flex

This is the ordering `solve` uses as anchor priority and `impact` uses to rank findings. Items 1-6
change rarely and drive everything below them.

| tier | hold fixed | why | ArchLang hook |
|---|---|---|---|
| 1 | lot line, setbacks, street side | legal and site-given | `site { boundary … street … }` (exists) |
| 2 | structural axes and columns | the most expensive thing to move; dimensions chain from axes (GB/T 50001) | `axes` (exists, `src/axes.ts`), `column`, `keep on axis` |
| 3 | vertical shafts: stairs, lifts | must align across storeys | same-id-across-levels shaft identity (exists, `stair`/`elevator`) |
| 4 | wet stacks: WC/bath/kitchen walls stacked and back-to-back | one stack, short runs, no wet-over-dry ([HouseYog](https://www.houseyog.com/blog/wet-walls-house-design/), [Brick Underground](https://brickunderground.com///node/47564)) | `keep stacked`; a `describe` fact pairing wet rooms across levels |
| 5 | envelope and façade opening rhythm | windows on bays and axes; heads aligned (2100 door = 2100 window head, `src/datum.ts` header) | `keep offset`, axis-relative `on <wall> at axis 2` |
| 6 | entrance position | street relation, approach | `site.street`, exterior-door facts |
| 7 | partitions | flex, but should follow room edges | P1 `between` |
| 8 | room sizes, above minimums | the usual edit target | `W_ROOM_TOO_SMALL`, `keep min` |
| 9 | doors: keep the hinge-side nib, preserve the latch-side clearance | nib ≥ wall thickness (exists: `W_DOOR_NEAR_CORNER`); the trade practice of 100-150 mm leaves room for frame and architrave ([BuildHub](https://forum.buildhub.org.uk/topic/9496-architrave-offset/)); accessible pull side 18 in (455 mm) past the latch ([ADA 404.2.4 summaries](https://idighardware.com/2012/09/recessed-doors/)) | `keep offset door from <corner>`; a latch-side advisory rule under `accessibility-advisory` |
| 10 | furniture | follows its room/wall anchor | `in <room> anchor`, `against wall` (exist) |

Re-check after any edit: corridor clear width (IBC Table 1020.2: 44 in, 36 in under 50 occupants or
within a dwelling, [summary](https://learnarchitecture.net/articles/35632-minimum-corridor-width.html);
ArchLang already has `W_PATH_TOO_NARROW`), door landings and swings (`W_DOOR_CLEARANCE`,
`W_SWING_OBSTRUCTED`), openings vs junctions and each other (P2), rooms inside the shell (P2),
reachability (`W_ROOM_UNREACHABLE`), bedroom windows (`W_BEDROOM_NO_WINDOW`). Every threshold stays
advisory and profile-scoped. No "compliance" claim (ADR 0005).

For a *hosted opening*, the conventional default is **offset from the nearer corner or the nearer room
edge, not from the wall start**. When a wall lengthens at its far end, a door near the start should
stay put, and a door near the far end should travel with that end. Today's `at <mm>` measures from the
start only, and `at %` scales with the length (wrong for doors, often right for a centred window). The
proposed forms:

```arch static
door   on shell at 150 from end width 900          # held to the far corner
door   on p1 at 150 from kitchen.north width 800   # held to a room edge (a datum projected on the run)
window on shell at axis 3 width 1500               # held to the structural rhythm
window on shell at center width 1600               # exists: centred, follows both ends
```

All are closed-form projections onto the host run, using the existing `resolveAttachment` walk
(`src/attach.ts:108`) plus one subtraction. They are core-legal under ADR 0005.

### P7. Stable semantic references

- Replace or alias the index forms (`against wall X segment <n>`, `dim radius <wall> segment <n>`) with
  semantic selectors: `segment north|south|east|west` (the facing of the segment's floor side) or
  `segment containing <room>.north`. Refuse with a diagnostic when the selector matches zero or more
  than one segment (CadQuery's selectors return 0..many; ArchLang must refuse on anything but 1).
- Rule of thumb for agents (`skills/archlang/SKILL.md`): author an `id=` on everything another statement
  references. `diffPlans` and `impact` then pair it by the identity key (Dynamo element binding, Onshape
  robust query), and auto-ids, which are positional, are never used as references (`arch suggest`
  already refuses to emit them).

---

## 5. How each proposal respects the hard rules

| | `compile()` purity | determinism | bound | zero-dep | byte identity |
|---|---|---|---|---|---|
| P1 datums / `between` / `around` | closed-form arithmetic | sorted sweeps, grid-snapped inputs | steps charged per read and per sweep | yes | unused ⇒ identical (needs reorder proof) |
| P2 lints | facts only | integer and tol comparisons | linear in openings × junctions | yes | new warnings only where they fire; corpus `lint()` may move (they are new rules), so state that per rule |
| P3 `depends` / `impact` | `depends` is opt-in describe; `impact` is one layer up | twin compile through one pipeline | 2 × compile | yes | opt-in key ⇒ unchanged |
| P4 `keep` | checks only, never moves | exact | linear | yes | no `keep` ⇒ unchanged |
| P5 `arch solve` | outside `compile()` (ADR 0006) | exact `BigInt` elimination, Bellman-Ford, fixed tier order | step-counted, no time | yes | n/a (emits source) |
| P6 ladder | policy lives in `solve`/`impact` only | fixed table | — | — | — |
| P7 selectors | closed-form, refuse on ambiguity | yes | yes | yes | aliases only ⇒ unchanged |

## 6. Suggested order of work

1. P2's access-probe bug (file now) and the three new lints. Small, and they make today's failure modes
   visible.
2. P3a `depends` (opt-in) plus P3b `impact`, including the `diffPlans` move-vs-resize fix and the
   additive wall section. This gives agents a verification loop for edits immediately.
3. P1 datums plus `between`/`around` (closes G.12). This is the language change that makes things
   follow. It needs an ADR, the resolve-order byte-identity proof, and `place`-frame semantics.
4. P6's hosted-offset forms (`from end`, `from <room>.<edge>`, `at axis n`).
5. P4 `keep` (facts, DOF and rank).
6. P5 `arch solve`, only after `keep` has corpus use. It needs an ADR addendum to 0006 naming the
   tier ladder and the refusal rule.
7. P7 selectors and SKILL guidance.
