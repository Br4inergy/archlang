# 27. Net internal area beside the centreline area

- **Status:** Accepted
- **Date:** 2026-10
- **Relates to:** [ADR 0022](0022-exact-decisions-and-bounded-input.md) (decide geometry exactly
  where the inputs allow), [ADR 0008](0008-circulation-as-facts.md) (`describe()` reports facts)
- **Scope:** `describe()` gains `rooms[].net_area_m2`, `totals.net_floor_area_m2` and, on a
  `schedule rooms` plan, `schedule[].net_area_m2`; the drawn ROOM SCHEDULE gains a NET AREA
  column. No language syntax, no change to `lint()`, `area_m2` unchanged.

## Context

A room is drawn on wall centrelines, so `area_m2` runs to the middle of every wall round it.
That is the right figure for a plan's geometry, and two consumers depend on it byte for byte:
the dataset deduplicates rows by `describe()` (`dataset/dedup.ts`) and the fidelity eval scores
room areas (`eval/fidelity.ts`). It is not the figure a buyer, a brief or a building code means
by "room area". They mean the floor between the walls. On a typical flat that is about 8%
less: the agent-UX audit plan reports 65.00 m² on centrelines and about 60.0 m² net.

An agent reading `describe()` could only estimate the difference. The owner decided
(agent-reach decision 2, 2026-10-13) that `describe()` gains a new field `net_area_m2`,
`area_m2` stays as it is, and the byte-identity law tables are re-measured once, with this
reason written down. The same record adds a condition: if net area cannot be computed exactly
from the room's shape for wall-less edges or curved rooms, the field ships only for the cases
it can state exactly, and no copy calls an approximate figure a measurement.

## Decision

**1. Net area is the room's own shape, inset by its walls.** Each edge of the room is moved
inward by half the thickness of the wall whose centreline runs along it. The figure is read
from the room's shape and the wall centrelines alone, never from a bounding box, a centroid
or the drawn wall joinery.

**2. Which wall insets which edge.** A straight edge (a rectangle's side, a `room polygon`'s
edge) is inset, along each stretch of it, by half the thickness of the thickest straight wall
segment whose centreline lies on that stretch of the edge's line. "Lies on" allows 1 µm of float
noise and nothing more: rooms are authored on wall centrelines, and across the shipped corpus
every wall either lies exactly on a room edge or stands clear of it by more than its own
thickness.

- **Each wall uses its own thickness.** A 300 mm shell insets 150, a 100 mm partition 50.
- **A shared wall gives each room half of itself.** Two rooms either side of a 100 mm
  partition each lose 50 mm along it.
- **A wall-less edge is inset by zero.** An open side, a missing partition or a doorless
  opening between two rooms with no wall drawn is not inset.
- **A part-walled edge steps.** Where the depth changes along an edge (a wall ends half way,
  a shell gives way to a partition), the inset steps square at the change.
- **A door or window does not interrupt its wall.** The wall's centreline runs through the
  opening, so the edge is inset across it as along the rest of the wall.
- **Overlapping walls on one stretch take the thickest.** Their bands are concentric, so the
  thickest one is the face.
- **Corners.** At a convex corner the two inset edges meet. At an inside (reflex) corner the
  square both walls' bands share is wall, not floor.

**3. Curved walls and circular rooms.** Every rule here is exact. The rule for curves is
chosen so that it stays exact:

- **A circular room** (`room circle`) is inset, over each angular interval, by half the
  thickness of the thickest concentric arc wall there (centre and radius each within 1 µm).
  Walled all round by one thickness, that is `π(r − t/2)²` in closed form. Half walled, it is
  the walled half of that plus the open half of `πr²`. A straight wall never insets a circle:
  it meets the circle at a tangent point or crosses it, and backs no length of it (the same
  rule `W_ROOM_NOT_ENCLOSED` uses).
- **A curved wall never insets a straight edge.** An arc meets a straight edge only at its two
  chord ends or at one tangent point, so it is not that edge's wall. Where a curved wall's band
  crosses a straight room edge, the sliver inside the room is not subtracted. Example: a bay
  whose room stops at the chord, or a drum tangent to a corridor. The figure is still exact:
  it is the inset this rule defines. It is not the floor up to the arc's inner face, and the
  docs do not say it is. A room that wants the bay's floor counted is drawn to include it.

**4. Implementation.** `src/analyze/net-area.ts`, re-exported from `src/analyze.ts` beside
`roomAreaMm2`. One rule, two procedures, both exact:

- A **rectilinear** ring (every rectangle and every right-angled polygon) is swept in vertical
  slabs. In each slab the floor is the ring's own intervals less the walls' bands. Thin rooms,
  short stretches and inside corners need no special case.
- An **oblique** ring builds the inset ring: each stretch's line is moved inward by its depth,
  neighbours meet at their lines' intersection, and a step is drawn where the depth changes.
  Its shoelace area is the net area.

On every rectilinear room in the corpus the two procedures agree, which the tests check
(`test/net-area.test.ts`). The result is held to `[0, area]`. For an oblique room so thin that
its inset lines cross, that clamp is the stated limit of the rule; no shipped plan comes near
it. A circle walled by more than one thickness, or only partly, reads its interval ends through
`Math.atan2`, which is not exactly rounded across engines. A circle walled all round by one
thickness never uses an angle.

**5. What reports it.**

- `describe().rooms[].net_area_m2`: 2 dp, `<= area_m2`, equal to `area_m2` for a room with
  no wall on its edge.
- `describe().totals.net_floor_area_m2`: the sum of the rooms' rounded figures, the way
  `floor_area_m2` sums theirs.
- `describe().schedule[].net_area_m2` on a `schedule rooms` plan.
- The drawn ROOM SCHEDULE's NET AREA column, with its subtotals and TOTAL. The centreline
  column is labelled `AREA (CENTRELINE, m²)` and the new one `NET AREA (m²)`, the owner's
  "Area (centreline)" and "Net area" in the table's capitals with the unit kept. The AREA
  column widens to hold its label: the NO. and NAME cells keep their place, and the AREA cells
  and totals move right with the column's right edge.

`lint()` does not read net area. The minimum-area rules stay on `area_m2`, so no diagnostic
moves. Zones, the caption and Plan JSON are unchanged.

## Consequences

- Every `describe()` payload gains the fields, so every byte-identity row that digests
  `describe()` moved. They were re-measured in one commit, and the reason is written in each
  table's header (`test/byte-identity-baseline.ts`, "EVERY row re-measured, once"). A hybrid
  run of the law tests, with `describe()` from the tree before the change, reproduces every
  old summary row and every old drawing row except the plans that set `schedule rooms`. Those
  move only in the room schedule (and any table beside it).
- Every `schedule rooms` sheet's room schedule is wider: by the NET AREA column, and by what
  the AREA column grew to hold `AREA (CENTRELINE, m²)`. A legend, door & window schedule or
  notes table to its right moves right by that width. No page size in the corpus moved.
- `area_m2` remains the centreline figure, so `dataset/dedup.ts` and `eval/fidelity.ts` read
  the same numbers as before.
- The D4 equivariance oracle (`test/d4-oracle.ts`) holds net area invariant under every
  turn and mirror of a placed plan. A rectilinear room swept along x on one side is swept
  along y on the other, so the oracle checks the procedure; it does not restate it.
