# Defect corpus

The yardstick for the plan-soundness programme (`docs/plans/plan-soundness/README.md`, card PS1.1).
Each case is a minimal plan that compiles without errors and really contains one verified
architectural defect, pinned to the lint code that must report it. Each case has a clean twin that
differs only in the fix and must not raise that code, so a rule that fires everywhere fails too.
`test/defect-corpus.test.ts` reads this folder and prints the catch rate per class.

This is **not eval data**. Nothing here feeds `eval/` or `dataset/`, and the holdout rules in
`.claude/rules/eval-dataset.md` do not apply to it. Every plan was written for this folder from the
coordinates in `docs/plans/plan-soundness/audits/`, `evidence.md` and `repro/`, and from measurement
with the CLI. No source from outside this repository is copied in. The `repro/` files that were reduced
here stay where they are.

## Layout and header

`<class>/<case>.arch` is a defect case and `<class>/<case>.clean.arch` is its twin. Every file starts
with a block of `# key: value` lines, which the test parses. A line `#` followed by two or more spaces
continues the previous value. The block ends at the first line that does not start with `#`.

| Key | Defect case | Clean twin |
|---|---|---|
| `class` | the folder name | the folder name |
| `origin` | where the defect was found (paths relative to `docs/plans/plan-soundness/`) | where the fix comes from |
| `expect` | the one `W_*` code that must report the defect | `none` |
| `status` | `todo` while no rule emits the code, `done` once lint reports it | absent |
| `twin-of` | absent | the case's file name without `.arch` |
| `fact` | the measured fact that makes it a defect (from `describe --json`, Plan JSON, the SVG or arithmetic) | the measured fact after the fix |

What the test asserts:

- every file compiles with no error diagnostics, and every header is well formed;
- a `done` case's `lint()` codes contain its `expect` code;
- a `todo` case's codes do **not** contain it yet. When a PS2 rule lands and a case starts to fire,
  the test goes red until the header says `done`, so the status column never goes stale;
- a twin's codes never contain its case's `expect` code, whatever the case's status;
- every case has a twin and every twin has a case;
- an `expect` code that is not in `src/error-catalog.ts` is listed in one of the code tables below,
  and every code listed below is used by at least one case.

The catch rate (`caught/total`) per class and overall is printed when the test runs.

## Classes

The eight classes of README §1, most frequent first. The test reads the slugs from this table.

| Slug | Class |
|---|---|
| `openings-ignore-walls` | Openings across T-junctions and corners, overlapping each other, or with nibs under 100 mm |
| `space-not-enclosed` | A shared edge with no wall, walled floor with no room, a room outside the shell |
| `circulation-privacy` | Through-bedroom and through-bath routes, wet-room doors, the entrance into a private room |
| `missing-defining-contents` | A bedroom without a bed, a bath without a shower, a kitchen without a worktop |
| `clearances` | WC side clearance, wardrobe fronts, tall units over windows, blocked openings, pinches |
| `daylight` | Windowless living rooms (labelled or typed) and bedrooms |
| `stair-safety` | A door swing over the stair head, a void at the arrival, a flight too steep |
| `annotation-collisions` | Auto dimensions inside rooms, title-block overflow, labels over furniture, lying dimension text |

Two classes from `evidence.md` §3 have no cases, because no core lint rule can see them:

- **Names contradicting geometry.** A window id names a room it is not on. Ids carry intent and a core
  lint must not read meaning from them (ADR 0005), so the comparison belongs to the consumer.
- **Change blindness.** It is a property of an edit, not of one plan; PS4's `impact` and `keep` cover it.
  `space-not-enclosed/widen-after-outside-shell.arch` holds the one consequence a single plan can show.

## Codes named by the plan (PS2 table)

| Code | Card |
|---|---|
| `W_OPENING_AT_JUNCTION` | PS2.1 |
| `W_OPENING_OVERLAP` | PS2.2 |
| `W_CONNECTOR_AMBIGUOUS` | PS2.3 |
| `W_BOUNDARY_NO_WALL` | PS2.4 |
| `W_ROOM_OUTSIDE_SHELL` | PS2.4 |
| `W_ROOM_VIA_PRIVATE` | PS2.5 |
| `W_WET_ROOM_DOOR` | PS2.6 |
| `W_ENTRANCE_INTO_PRIVATE` | PS2.7 |
| `W_HABITABLE_NO_WINDOW` | PS2.8 |
| `W_ROOM_MISSING_DEFINING` | PS2.9 |
| `W_DIM_TEXT_MISMATCH` | PS2.10 |

## Proposed codes

The plan names no code for these checks. One code per distinct check, in the catalogue's naming style.
The card that implements a check may rename its code; rename it here and in the cases' headers.

| Code | Check | Card |
|---|---|---|
| `W_FLOOR_UNASSIGNED` | A walled face less than 95 % covered by rooms (PS2.4's dual) | PS2.4 |
| `W_WC_SIDE_CLEARANCE` | WC centreline to the nearest side wall or fixture under 400 mm | PS2.11 |
| `W_WARDROBE_FRONT_CLEARANCE` | Clear depth in front of a wardrobe under 600 mm | PS2.11 |
| `W_FURNITURE_OVER_WINDOW` | A tall unit (fridge, wardrobe, bookcase) standing over a window's span | PS2.11 |
| `W_HOB_FRIDGE_GAP` | A hob closer than 300 mm to a fridge or tall unit along the run | PS2.11 |
| `W_LEAF_TOO_WIDE` | A single hinged leaf over 1200 mm | PS2.11 |
| `W_SWING_OVER_STAIR` | A door swing over a stair footprint or its landing | PS2.11 |
| `W_STAIR_HEAD_VOID` | A void on a stair's arrival landing | PS2.11 |
| `W_STAIR_TOO_STEEP` | A flight too short for its storey height (riser over the profile's limit) | PS2.11 |
| `W_TITLE_OVERFLOW` | Title-block text wider than its row | PS2.12 |
| `W_LABEL_COLLISION` | A room label over a furniture or fixture symbol | PS2.12 |
| `W_LEAF_ACROSS_DOORWAY` | An open door leaf parked across another doorway's approach (door–door interference) | PS2.11 |
| `W_FOOTPRINT_TRANSPOSED` | A directional piece written `at … size WxH` with its depth on the long axis and no `rotate`, so it draws turned and stretched | PS2.11 |

Two checks extend existing codes instead of adding one: a desk in front of a leaf-less opening expects
`W_DOORWAY_BLOCKED` (PS2.11), and wall-thickness labels from `dims auto` inside a room expect
`W_DIM_INSIDE` (PS2.12). Both are `todo` until those rules widen.

## Notes from building it

- `clearances/bench-diagonal-pinch.arch` reproduces PS0.8 (the 500 mm diagonal past a bench that
  `W_PATH_TOO_NARROW` misses). The reduced repro, `bench-across-opening.arch`, does warn and is `done`.
- A window on an `arc` edge reports `room: null` in `describe` (`audits/archcanvas-public-examples.md`
  BB3), so the daylight twin of the solid bay is glazed on a straight wall. A rule that reads
  `windows[].room` would call a glazed bay windowless.
- The family-apartment label collision only reproduces at a fixed text size, so
  `annotation-collisions/label-over-bed.arch` is drawn on paper at 1:100. Without `paper` the label
  shrinks with the plan and the placer finds free floor.
- Defects with no PS2 check are left out rather than given a code: a kitchen as the only route
  (BB4), a garage opening into a study (X4), a WC on a pocket-door cavity (M3), an exterior wall used
  as a partition (T2), an indoor courtyard (CY1), and the `describe` bugs of PS0.
- The first-contact audit (`audits/2026-10-18-first-contact.md`, card PS1.2) adds one case per new
  shape. Instances whose shape an earlier case already holds get no second copy: the kitchens with
  no worktop (A7, H4, S3, T5, C8) are `kitchen-no-worktop`, the wall-thickness labels inside rooms
  (A10, H6, S5, C11, T8, K11) are `auto-dims-in-room`, K2 is `door-jamb-50-from-tee`, K3 is
  `door-fills-gap` and C5's staff WC onto a `uses kitchen` servery is `bath-door-off-kitchen`.
  `circulation-privacy/bath-off-open-plan` is S1's stronger variant: its kitchen sink stands 400 mm
  from the bath door. The audit's own instance (`first-contact-plans/3-studio.arch`) has its nearest
  kitchen fixture 2025 mm from the door, beyond the 1500 mm `wetDoorKitchenProximityMm` default, so
  it is silent: there a bath door onto a combined kitchen/living room is a taste question
  (`research/design-taste.md` R2), and no case is added that could never fire.
  Instances outside the eight classes, and those in a class with no check a card
  names (A6, S2 bed sides; A7 hob against a side wall; C6, C7, K8 accessible WC layout), are left
  out for the planner.
- The two masked-route cases (PS0.10) are reported since the walk is judged from the main entrance
  (`describe().access.mainEntrance`): the balcony door is no candidate, and the patio door is a way
  into its own room only. Each `fact` still gives the warning lint raised before only when that door
  was made a window.

## Adding a case

Reduce the defect to the fewest walls and rooms that still show it. Measure the fact with
`node dist/cli.js describe <file> --json` (or Plan JSON, `-f json`) and write it in `fact`. Write the
twin by changing only the fix, then run `npx vitest run test/defect-corpus.test.ts`.
