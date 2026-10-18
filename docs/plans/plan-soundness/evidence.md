# Evidence: what was measured (2026-10-18, `main@98bd30b`, v1.43.1)

All measurements used the built CLI (`node dist/cli.js …`). Per-plan detail with coordinates is in
`audits/`, and the reproductions are in `repro/`. **Re-measure before you build on any number here.**
The compiler has moved on since; a number that no longer reproduces is a finding in itself.

## 1. The reconstructed published plan (`repro/family-apartment.arch`)

**Source.** An AI-generated "Classic Family Apartment" (8 rooms, 96 m²) was published as a product
showcase. Its source was not kept, so every wall, room, opening and fixture was read back from the
SVG's `data-arch-*` attributes. Hinge, swing and fixture rotation are approximate.

**What the CLI says:**
- `lint`: fixture-rotation warnings only, which are artefacts of the approximate reconstruction.
- `arch fix` clears 11 of 12; one hand edit then passes `validate --strict`.
- `suggest`: nothing.

**What is actually wrong.** Every defect below is visible in the render, and none is flagged:

| # | Defect | Fact that already exposes it |
|---|---|---|
| 1 | `d_living_bed3` (x=5500, y 6100–6900) spans the T-junction where the bath1/bath2 partition (y=6400) meets the x=5500 partition. The partition dead-ends into the door leaf | `describe`: its `between` is `[bedroom3, bathroom2]`, not living; `ambiguous:false` |
| 2 | No wall between Living Room (y 0–5000) and Bedrooms 3 and 4 (y 5000–8000) | `rooms[].adjacent` lists them as adjacent, but the access graph has no edge; the walking grid walks through |
| 3 | Bathroom 1 opens onto the living room through a leaf-less opening, and has a second door into Bedroom 3, so it is a passage | access edges |
| 4 | The living room is reached kitchen → bedroom 1 → bedroom 2 → living (depth 4); bedroom 4 only via bedroom 3; bedroom 3 via bathroom 2 | `access.rooms[].depthFromEntrance` |
| 5 | The front door opens into the kitchen | `doors[d_entry].between` |
| 6 | Window `win_bed3` (x 1000–2200) overlaps the entry door (x 1550–2450) on the south wall | none (no opening-vs-opening fact) |
| 7 | Window `win_living_top` (x 5100–6900) spans the x=5500 partition junction | none |
| 8 | Most window ids name a room they are not on (`win_bed1` lights Bedroom 2, `win_bed2` lights the living room, …) | `windows[].room` |
| 9 | Bedroom 3 has no bed; Bedroom 4's wardrobe backs onto the missing wall | furniture facts |
| 10 | Room labels collide with furniture (Bedroom 4, Bathroom 2) | none |

## 2. Corpus audits (`audits/`)

| Corpus | Plans | Verified defects | Caught by lint |
|---|---|---|---|
| ArchCanvas public examples (github.com/archcanvas/archcanvas `examples/`) | 10 | ~45, 6 blockers | 2 (both in one plan, which shipped with the warnings) |
| ArchLang showcase (github.com/ChanMeng666/archlang-showcase) + repo `examples/` | 12 + all | ~70 | a handful (Bag End's windowless spare room, furnished-flat and tiny-house blocked routes, garden-house sheet overflow) |

Highlights an architect would call out at a glance:
- **`examples/two-bed.arch`:** hall → bath → master bedroom → kitchen/living → bedroom 2; lint `[]`.
- **`examples/hillside-villa.arch`:** a 28.8 m² living room with no window; an ensuite door swings
  over the top stair tread.
- **`examples/two-storey.arch`:** the floor void at the head of the stair.
- **Showcase tweet-house:** the 16 m² living room has no window ("Living" is not classified as
  living, so no rule looks).
- **ArchCanvas public examples:**
  - corner-cafe: door and window overlap by 400 mm on the angled wall;
  - family-house: a bifold and a window overlap by 800 mm, and a wall nub is left inside an opening;
  - bay-bungalow: the "round snug" has no round wall, leaving 4.6 m² of floor in no room;
  - gallery-wing: a partition stops at the chord of a curved façade, joining two shops and leaving
    about 20 m² unassigned;
  - courtyard-apartment: an indoor "courtyard" joined to living by a leaf-less opening and counted
    as floor area;
  - accessible-clinic: an accessible WC door swings in, with the pan 200 mm from the wall.
- **Fixtures:** 20 WCs in 12 plans sit with their centreline 200 mm from a side wall (should be ≥ 380–450).
- **Drafting:** 28 sheets with `dims auto all` print wall-thickness dimensions inside rooms, on doors
  or on stairs.

## 3. Defect taxonomy (classes ordered by frequency × severity)

1. **Openings ignore the walls around them.** Spans across T-junctions and corners, overlapping
   openings, nibs under 100 mm. Today: `W_DOOR_NEAR_CORNER`, which covers doors only, L-corners only,
   and excludes tees by design.
2. **Space not enclosed or not assigned.** A shared edge with no wall, a walled face with no room, a
   partition short of a curved wall, wall fragments, a room outside the shell. Today:
   `W_ROOM_NOT_ENCLOSED`, wet rooms only.
3. **Circulation and privacy.** Through-bedroom, through-bath, bath onto living or kitchen, kitchen as
   a cut vertex, WC in a passage room, garage into a study. Today: `W_BATH_VIA_BEDROOM` only.
4. **Rooms missing their defining contents or holding the wrong ones.** Today: `W_ROOM_NO_FIXTURE`,
   bath and kitchen only.
5. **Fixture and furniture clearances.** WC side clearance, wardrobe front, hob beside fridge, tall
   units over windows, furniture in a leaf-less opening.
6. **Daylight.** Windowless living rooms and kitchens. Today: bedrooms only, and living is blind on
   label-only plans.
7. **Stair safety.** A swing over a tread, a void at the arrival, a flight too steep for the storey.
8. **Annotation collisions.** Auto-dimension text, title-block overflow, labels over symbols.

Plus two classes no rule can see yet:
- **Names contradicting geometry.** Ids describe intent; `describe` describes truth, and the consumer
  should compare them, since a core lint must not read meaning from ids (ADR 0005).
- **Change blindness** (§4 below).

## 4. Change drills

- **Studio, living +500 mm.** In `examples/studio.arch`, change `size 4000x6000` on `r_living` to
  `4500x6000`. The room grows through the fixed x=4000 partition. Lint gives three
  `W_ROOM_OVERLAP` ("allowed") and three `W_ROOM_UNREACHABLE`; nothing says the partition should
  have moved. Doing the edit correctly touches about 24 literals: walls, rooms, openings, windows,
  furniture and dims.
- **A lying dimension.** In the same example, change `text "4000"` to `text "4500"` on the top
  dimension. Lint: `[]`.
- **`repro/widen-before.arch` → `repro/widen-after.arch`** (`let AW` 4000 → 4500, room `b` is
  `right-of a`):
  - `b` is pushed 500 mm through the 8000 mm shell, and the partition ends up inside `a`;
  - the partition door's `between` goes from `[a, b]` to `[]`;
  - lint reports only `W_ROOM_DISCONNECTED`;
  - `diffPlans` calls `b` "resized +0.0 m²" and reports no door or wall change.
- **Corpus share of absolute authoring** (`describe().freedom`, 34 top-level examples): rooms 94 %
  absolute, openings 55 %, furniture 54 %, walls 100 % (no derived form exists).

## 5. The consumer loop (summary only)

A generator that repairs against lint inherits lint's blind spots. In the one consumer studied, every
missed class above reached published output, and so did one class lint did catch: a generator's
budget ran out and the best remaining plan shipped with the warning. Consumer-side changes are
tracked privately by the owner. The lesson for ArchLang is to make blind spots visible
(`coverage`), make the first fix obvious (`next`), and keep `suggest` from proposing a bedroom as
the route to a room.

## 6. Dataset priors used for thresholds

ResPlan (github.com/m-agour/ResPlan, CC BY 4.0), 16,317 plans; the method and caveats are in
`research/design-taste.md` §4.
- Bedroom-to-bedroom doors: 0.06 %. A non-bath room reachable only through a bedroom: about 0.03 %.
- Bath doors off a kitchen: 0.3 %. Front doors into a bedroom or bath: 0.
- Kitchen touching living: 99 %.
- Windows on two sides: bedroom 18 %, living 41 % (so this is a score, never a warning).
- Aspect ratio p50/p95: bedroom 1.19/1.57, bath 1.58/2.24.
- About half of bedroom doors and three quarters of bath doors sit at a room corner.
