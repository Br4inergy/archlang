/**
 * The measured baseline for `test/while-byte-identity.test.ts` — M3 of the W7 red-team
 * verdict: no test pinned the byte-identity law for `compile().diagnostics` itself, only
 * for SVG/`describe()`/`lint()` (which a PARSE-stage diagnostic never reaches).
 *
 * Every row is `allStoreysDigestWithDiagnostics(API, src, { world })` from
 * `./byte-identity-digest.ts`, taken with the test's own digest body (never a lookalike;
 * see that module's header for why this split exists) over the whole corpus: every
 * shipped `examples/*.arch` plus every `test/fixtures/*.arch`. None of these plans uses
 * `while` or a bare reassignment, so the measurement is the same on the tree before W7
 * existed and after — proved directly, not merely argued, by an ad-hoc before/after sweep
 * against `feat/algebra` (0 files moved) as part of this change.
 *
 * `terrace-row` re-measured after W5b (merged in `566f2d3`; commit `54d8b18` re-measured
 * its own goldens): mirrored units' sliding doors now take the correct track — SVG only;
 * describe/lint/diagnostics unchanged.
 *
 * Fourteen example rows re-measured for W3b's circulation changes, with this test's own
 * digest body. In every one the SVG, `lint()` and `compile().diagnostics` are byte-identical
 * (swept per storey before and after on the same tree); only `describe().circulation` moved
 * (field by field in `./byte-identity-baseline.ts`, "Fourteen rows re-measured"). No fixture
 * row moved.
 *   - `bungalow`, `garden-house`, `hillside-villa`, `laneway-house`, `materials`, `museum`,
 *     `museum-wings`, `parametric`, `terrace-row`, `townhouse`, `transit-hall`: each has
 *     several entrances, and every room now walks from its NEAREST one (backlog G.5);
 *   - `library`: the same, plus r_reading 25500 → 25400 from the snapped relative frame;
 *   - `aquarium`: rotunda_r detour 1.01 → 1, the snapped relative frame (translation
 *     invariance);
 *   - `hexagon-pavilion`: rotunda walk 5800 → 5700, the snapped relative frame.
 *
 * Two more rows re-measured for W3b's door-route gate (a room `access` cannot reach is
 * `no_door_route` even where the raster walks into it): `examples/relational.arch` —
 * kitchen, bed and bath, doorless rooms of an open plan with no interior wall, lose their
 * walks and their two routes; `test/fixtures/zones-wings.arch` — gal_b and store, doorless
 * rooms of a plan with no partitions, likewise. Only `describe().circulation` moved.
 *
 * `examples/museum-wings.arch` re-measured for a SOURCE edit, not a compiler change: `d_east`
 * now hangs `hinge left` (the mirror of `d_west`). Only the SVG moves — that one door's leaf
 * and swing arc; `describe()`, `lint()` and `compile().diagnostics` are byte-identical (the
 * full field-by-field is in `./byte-identity-baseline.ts`, "`museum-wings`: whole-surface row").
 * Re-measured again for a second SOURCE edit (backlog 6.8): the single-leaf `d_main` became a
 * mirror pair of 1000 mm leaves on a shared jamb. The SVG and `describe()` move (field by field
 * in `./byte-identity-baseline.ts`, "the main door is a mirror pair"); `lint()` and
 * `compile().diagnostics` are `[]` before and after. The `W_SWING_OBSTRUCTED` change that lets
 * the pair lint clean moved no row on its own (the corpus swept with the examples untouched).
 *
 * Circulation v2 (backlog E.6–E.10): 24 example rows and three fixture rows re-measured, with
 * this test's own digest body. SVG, `lint()` and `compile().diagnostics` are byte-identical in
 * every one; only `describe().circulation` moved — the examples field by field in
 * `./byte-identity-baseline.ts` ("Circulation v2"), the fixtures here (A = the walk-first
 * nearest-cell tie, E = an entrance seeded on both sides of its lattice line):
 *     - `test/fixtures/diff-circ-a.arch`: living walk 2500→2300 [A]; living detour 1.04→1 [A]
 *     - `test/fixtures/diff-circ-b.arch`: living walk 2500→2300 [A]; living detour 1.04→1 [A];
 *       bed walk 5800→5700 [A]
 *     - `test/fixtures/zones-wings.arch`: lobby walk 1900→1800 [A]; lobby detour 1.05→1 [A];
 *       gal_a walk 7900→7700 [AE]; gal_a detour 1.28→1.26 [AE]; office walk 11900→11700 [AE];
 *       office detour 1.19→1.17 [AE]
 *
 * Circulation on storeys reached only by a shaft (owner-approved; ADR 0008's 2026-10
 * addendum): `hillside-villa`, `townhouse` and `two-storey` re-measured with this test's own
 * digest body. In each, every storey's SVG and `compile().diagnostics` are byte-identical; in
 * `describe()` only the upper storeys' `levels[i].circulation` moved, `null` → a model walked
 * from the head of the arriving stair (hillside-villa level 2; townhouse levels 2 and 3;
 * two-storey level 2); `lint()` gains only `W_PATH_TOO_NARROW`, inserted in rule order —
 * six on hillside-villa level 2 (640 mm: five 700 mm doors, and the Master Suite's a carve
 * artefact on the passage under the flight — since removed, below), none on the other two. hillside-villa's
 * corrected source comment shifts no default-profile span (every one lies above it). Every
 * value, field by field, is in `./byte-identity-baseline.ts` ("Circulation on storeys reached
 * only by a shaft"). No fixture row moved.
 *
 * `examples/hexagon-pavilion.arch` re-measured, with this test's own digest body, for the
 * threshold carve-order fix (every connector's seeds are read off the nav mask as it stood
 * before any connector carved, so neither the order a connector's threshold points are
 * visited in — which a turn or flip reverses — nor the connectors' source order moves a fact).
 * SVG, `lint()` and `compile().diagnostics` are byte-identical; only `describe().circulation`
 * moved: g_sw and g_se walk 9800 → 8800, detour 1.87 → 1.68 (field by field, and the 14 files
 * whose opt-in `--overlay circulation` SVG moved with no fact, in `./byte-identity-baseline.ts`,
 * "a threshold no longer carves in carve order"). No other example row and no fixture row moved.
 *
 * `examples/hillside-villa.arch` re-measured, with this test's own digest body, for the
 * connector carve fix (a connector's inward walk stops at the room's first eroded floor cell,
 * so `d_en2_corr` no longer stamps its 640 on the passage under the flight). Every storey's SVG
 * and `compile().diagnostics` are byte-identical; `describe()` moves only level 2's
 * r_master bottleneck, 640 → 700; `lint()` keeps nine warnings, the Master Suite's walk
 * warning replaced by its route to its ensuite through `d_enm` (640, at the same span). The
 * example's comment above `d_en2_corr` was rewritten in the same change and shifts no
 * default-profile span. Field by field in `./byte-identity-baseline.ts`, "a connector's inward
 * walk stops at the room's first eroded cell". No other example row and no fixture row moved.
 *
 * `examples/hillside-villa.arch` re-measured again, with this test's own digest body (the
 * script first reproduced the old row on the tree before), for "a room is reached on its
 * floor": a room's best cell no longer counts the doorway cells a carve opened inside its
 * rectangle. Every storey's SVG, `compile().diagnostics` and the default `lint()` are
 * byte-identical; `describe()` moves only level 1's `r_terrace` bottleneck, 1140 → 840.
 * Field by field in `./byte-identity-baseline.ts`, "a room is reached on its floor". No other
 * example row and no fixture row moved.
 *
 * Re-measured for the visual-polish symbol redraw: SVG only, describe/lint/diagnostics unchanged
 * (substitution check reproduces the old digests).
 *
 * `examples/hillside-villa.arch` re-measured, with this test's own digest body, for backlog
 * E.17 (`facade-probe-order`): level 2's `dims auto` chains end on the shell's outer face
 * (13950) instead of the ensuite wall's (13850) that `ir.walls` order picked. Only level 2's
 * SVG moves; the old SVG put back into the new payload reproduces the old row, so
 * `describe()`, `lint()` and `compile().diagnostics` are byte-identical. Field by field in
 * `./byte-identity-baseline.ts`, "`dims auto` ends on the outermost face". No other example
 * row and no fixture row moved.
 *
 * `examples/garden-house.arch` re-measured, with this test's own digest body, for backlog D.1:
 * the example's SOURCE changed (the four `chair`s and four `outdoor_chair`s that doubled the
 * chairs its two tables draw are removed); the compiler did not. Level 1's SVG, `describe()`,
 * `lint()` (one span, 523 bytes up) and `compile().diagnostics` (the `W_DRAWING_OVERFLOW`
 * message's measured numbers) move; level 2's SVG is byte-identical. Field by field in
 * `./byte-identity-baseline.ts`, "the example stopped seating its tables twice". No other
 * example row and no fixture row moved.
 *
 * `examples/hillside-villa.arch` re-measured, with this test's own digest body, for backlog D.2:
 * the example's SOURCE changed (its `piano` moved beside the bay, turned `rotate 270` and given
 * a 1600x1200 footprint that holds the bench); the compiler did not. Level 1's SVG (the piano
 * only), `describe()` (the piano's `rotate`, three bottlenecks 940 → 1100) and `lint()` (five
 * spans, +11 bytes) move; level 2's SVG and `compile().diagnostics` are byte-identical. Field by
 * field in `./byte-identity-baseline.ts`, "the piano turns its keyboard to the room". No other
 * example row and no fixture row moved.
 *
 * `examples/garden-house.arch` re-measured, with this test's own digest body, for backlog D.3:
 * the legend's `grass`, `gravel` and `tarmac` swatches draw their pattern at a smaller zoom.
 * Only level 1's SVG moves (three swatch fills); the old SVG put back into the new payload
 * reproduces the old row, so `describe()`, `lint()` and `compile().diagnostics` are
 * byte-identical. Field by field in `./byte-identity-baseline.ts`, "three legend swatches show
 * more marks". No other example row and no fixture row moved.
 *
 * `examples/clinic.arch` re-measured, with this test's own digest body, for room-name wrapping:
 * "Accessible WC" is too wide for its room on one line and is drawn as "Accessible" / "WC"
 * (`wrapLabels`, `src/label-placement.ts`). Only that name and its area figure move; the old
 * SVG put back into the new payload reproduces the old row, so `describe()`, `lint()` and
 * `compile().diagnostics` are byte-identical. Field by field in `./byte-identity-baseline.ts`,
 * "a room name too wide for its room wraps". No other example row and no fixture row moved.
 *
 * `examples/hillside-villa.arch` re-measured, with this test's own digest body:
 * `W_BATH_VIA_BEDROOM` no longer names an en-suite on a storey with another wet room off
 * circulation. `lint()` loses that one diagnostic (the master ensuite, span 2564); putting it
 * back at its old index in the new payload reproduces the old row, so every storey's SVG,
 * `describe()` and `compile().diagnostics` are byte-identical. Field by field in
 * `./byte-identity-baseline.ts`, "an en-suite beside a bathroom off circulation is not
 * flagged". No other example row and no fixture row moved.
 *
 * `examples/sheet-notes.arch` is a row ADDED with a new example (the issued-sheet statements),
 * measured with this test's own digest body when the example first existed, and measured again
 * when the next commit on the same branch extended it with `schedule openings`: only its SVG
 * moved (`compile().diagnostics` is `[]` both times; the summary row in
 * `./byte-identity-baseline.ts` did not move), and once more for the review fixes (NOTES wrap
 * to a fixed column; tags avoid neighbouring openings) — again the SVG alone, diagnostics `[]`.
 * No other example row and no fixture row moved.
 *
 * Three rows re-measured, with this test's own digest body, for a deliberate diagnostic-TEXT
 * change (case (3) in `./byte-identity-baseline.ts`'s header; `test/lint-fix-texts.test.ts`).
 * Each moves in `lint()` alone: hashing the NEW compile, `describe()` and diagnostics with the
 * OLD `lint()` reproduces its old row.
 *   - `examples/hillside-villa.arch` — `W_PATH_TOO_NARROW` names the en-suite doors and gives
 *     the clearing `width`; the Master Suite → Ensuite route through `d_enm` is withdrawn as
 *     the same bottleneck. Re-measured a second time when the named door became the one on the
 *     widest door path (doors in series), and a third time when the attribution became
 *     re-measured (hint wording only); each time the previous `lint()` put back reproduces the
 *     previous row. Field by field in `./byte-identity-baseline.ts`, "names the door, once".
 *   - `test/fixtures/diff-a.arch`, `test/fixtures/diff-b.arch` — `W_ROOM_NO_FIXTURE`'s hint
 *     stops pointing at an unshipped `lib/fixtures.arch` import and gives a pasteable
 *     statement (`furniture wc in bath anchor top flush size 400x700`). Its message, span and
 *     every other diagnostic are byte-identical.
 * No other example row and no other fixture row moved.
 *
 * Two fixtures ADDED, not re-measured: `test/fixtures/star30.arch` (thirty rooms off one
 * corridor) and `test/fixtures/chain30.arch` (thirty rooms in a row), the run-time and
 * re-measure-count pins for `W_PATH_TOO_NARROW`'s door attribution
 * (`test/lint-attribution-budget.test.ts`). Their rows are their first measurement, taken with
 * this test's own digest body on the tree that adds them. `test/fixtures/off-path-bypass.arch`
 * likewise: the repro of a walk that passes furniture through another room's doorway band.
 *
 * Eighteen rows re-measured, with this test's own digest body, for the thickness call-out
 * station (drawing only): every example that draws a `dims auto all`/`walls` call-out, plus
 * `test/fixtures/axes-grid.arch` and `test/fixtures/schedule-sheet.arch`. A call-out now keeps
 * off the openings on its wall and the furniture on its side. Hashing the NEW payload with
 * the OLD SVG put back reproduces each old row; `describe()`, `lint()` and
 * `compile().diagnostics` are byte-identical. Each moved call-out in
 * `./byte-identity-baseline.ts`, "thickness call-outs keep off doorways and fixtures".
 *
 * `examples/sheet-notes.arch` re-measured once more, for the same call-out change meeting the
 * example on merge: two call-outs move out of d_bed and d_front, nothing else in the drawing;
 * `compile().diagnostics` is still `[]`, and the old SVG put back into the new payload
 * reproduces its old row (`365c38ef…`). Field by field in `./byte-identity-baseline.ts`,
 * "`sheet-notes`'s whole-surface row re-measured when the call-out change met it".
 *
 * EVERY row re-measured once for net internal area (owner decision 2): `describe()` gains
 * `net_area_m2` / `totals.net_floor_area_m2`; SVG and lint unchanged except room schedules.
 * A hybrid run of this file, unedited, with `describe()` from the pre-change tree (`1eb1bf9`)
 * and `compile()`/`lint()` from the new one reproduces every old row except the plans that
 * set `schedule rooms`: the twelve examples (`aquarium`, `bungalow`, `clinic`,
 * `courtyard-house`, `furnished-flat`, `garden-house`, `hillside-villa`, `library`,
 * `materials`, `museum-wings`, `sheet-notes`, `transit-hall`) and
 * `test/fixtures/schedule-sheet.arch` and `zones-wings.arch`, whose SVG gains the
 * ROOM SCHEDULE's NET AREA column; their `compile().diagnostics` is byte-identical, and with
 * `compile()` too from the old tree they reproduce as well. The account is in
 * `./byte-identity-baseline.ts`, "EVERY row re-measured, once". The same schedule rows,
 * and only they, were re-measured once more when the AREA column took its owner-given label
 * `AREA (CENTRELINE, m²)`; no other row moved.
 *
 * Re-measured once more when net area became the room less every wall band on it (ADR 0027):
 * the rows of `aquarium`, `hexagon-pavilion`, `hillside-villa`, `materials`, `tiny-house` and
 * `townhouse`, whose `describe()` moves in its net figures only. Field by field in
 * `./byte-identity-baseline.ts`, "Six plans re-measured again".
 *
 * `classroom-block`, `corner-cafe` and `practice-office`, first measured without net area,
 * re-measured when it met them: `describe()` and the drawn NET AREA column only, diagnostics
 * byte-identical. Field by field in `./byte-identity-baseline.ts`, "Three example rows
 * re-measured when net area met them".
 *
 * Four rows re-measured when `W_PATH_TOO_NARROW` began naming a bottleneck door by the rooms it
 * joins instead of its id (the id stays in the hint): `examples/hillside-villa.arch` (field by
 * field in `./byte-identity-baseline.ts`, "names a door by its rooms") and the fixtures
 * `test/fixtures/chain30.arch`, `star30.arch` and `off-path-bypass.arch`, whose walks name
 * their doors (`off-path-bypass` also in its `W_FURNITURE_WALL_COLLISION`, which now names
 * "the exterior wall at y 2000" rather than `wall "w_s"`). `lint()` `message` text only: hashing the new SVG, `describe()` and
 * `compile().diagnostics` with the previous `lint()` reproduces each previous row.
 *
 * Two rows re-measured when a connector on a wall began to join the space off each face of
 * that wall, with an additive `straddles` (backlog C.4, plan-soundness PS0.1; field by field
 * in `./byte-identity-baseline.ts`, "read off the host wall's faces"). Hashing the new
 * `compile()` with the previous `describe()` and `lint()` reproduces each previous row: every
 * storey's SVG and `compile().diagnostics` are byte-identical.
 *   - `examples/hillside-villa.arch`: `describe()` gains `straddles` on `o_entry_dining` only.
 *   - `test/fixtures/schedule-sheet.arch`: `door on shell at 20%` is centred on the T where
 *     `part` meets the shell, (4000, 0). It used to join `living` and `bath` and the plan had no
 *     entrance. It is now `between ["exterior", "living"]` (each room covers 400 mm of the inner
 *     face's clear span, so room order breaks the tie), `exterior: true`, `straddles ["living",
 *     "bath"]`; `access` gains the entrance, both rooms' depths and bottlenecks, `circulation`
 *     is measured (it was `null`) and the caption names the entrance. `lint()` withdraws
 *     `W_NO_ENTRANCE`, its only diagnostic, and gains nothing.
 *     Two surfaces no digest here pins move with it, on this row and on
 *     `docs/plans/plan-soundness/repro/door-on-tee.arch` (no row): Plan JSON (`compile -f json`),
 *     whose edge for that door goes from `living`→`bath`, `interior` to `exterior`→`living`,
 *     `front`; and `lint()` under `accessibility-advisory`, which gains `W_PATH_TOO_NARROW` twice
 *     (one walk per room, 840 and 740 mm clear against the 900 mm minimum) now that a route exists.
 *
 * Three rows re-measured on 2026-10-18 (plan-soundness PS0.7) when the label classifier began
 * emitting `living`: `examples/relational.arch`, `themed.arch` and `two-bed.arch`. `describe()`
 * only — one room per plan gains `living` in `uses` and its `room_type` becomes `LivingRoom`
 * (field by field in `./byte-identity-baseline.ts`, "the label classifier emits living").
 * Hashing the new SVG, `lint()` and `compile().diagnostics` with the previous `describe()`
 * reproduces each previous row.
 *
 * Eight rows re-measured on 2026-10-18 for the opening rules (plan-soundness PS2.1–PS2.3): six
 * examples and two fixtures whose SOURCE was fixed with same-length edits, so `lint()` did not
 * move (field by field in `./byte-identity-baseline.ts`, "Six examples fixed for the opening
 * rules", and `import-module-lets.test.ts` for the fixtures). The new `lint()` with the previous
 * SVG, `describe()` and `compile().diagnostics` reproduces each previous row. `terrace-row` again
 * in the review round (`win_bath` moved, the drawing only, against `bc5c55f`, same proof).
 */
export const BASELINE: ReadonlyArray<readonly [string, string]> = [
  ["examples/accessible.arch", "dd7d71ebb95715ca666f7a087af5456436cba420936c111d20cb497159715529"],
  ["examples/aquarium.arch", "9b8e70c3cd7838abbb883062d3abd06dfb54ec7336f523bb4369ad917301cbb4"],
  ["examples/attached.arch", "591f4199087b7f7fcab65af3cab3f12dbe062456954e7ef0f02969a974d34b93"],
  ["examples/bungalow.arch", "1fc9881f7b2e3bf0015b0a978fd3858f22a7ea72d60de472bf083a716ca71ef2"],
  ["examples/classroom-block.arch", "4c5bb36d1d66957fd2f608184efca9fa7ded3854cebfcb5afdab8c88e1e482e7"], // added with the example, re-measured for net area, see header
  ["examples/clinic.arch", "fac5d9fab49df93fe8cbff6cc0bf26b9e84b1a32c26128e155d0eeb5da99feb1"],
  ["examples/corner-cafe.arch", "3434595cfa60533d5bac28bbd694fb69184b366522a2ee326d08549d7b5216af"], // added with the example, re-measured for net area, see header
  ["examples/courtyard-house.arch", "4a6c2594c8297071e217968266791a9ce35d8c639cd32605fbf3f5afdd3db59b"],
  ["examples/furnished-flat.arch", "4eb26e5f4ea04859bd96da44cd7db791a9da347d462143478e00b184de54a70b"],
  ["examples/gallery-l.arch", "cc37c7d8d73b535358978674f3c5da26af87af4d066e6cd67a8bd1f8506e7f5f"],
  ["examples/garden-house.arch", "ffe33b785e9b5d6a2d2b83b0c5fe416bb1df75e9cfe2755cd9721df2e424f85d"], // re-measured, see header
  ["examples/garden-loft.arch", "eb6ba7bdcd33231cd0cfd2072a1a99e2b416be039e6efc2cc0a5ea76129738f2"],
  ["examples/hexagon-pavilion.arch", "edef621837ae7adb96218de65b346e231ffe0c006dcd72f70a7e8d3b14777858"],
  ["examples/hillside-villa.arch", "c60aa30b07db55523b3b9fd412d04f4b5047374a8633a3f4e5124916c5fbdcf6"], // re-measured, see header
  ["examples/imports.arch", "f1b5ff9ee7189d217cd8df57d04a1af5d2876bbc69ec588be202f28c68f47a5b"],
  ["examples/laneway-house.arch", "d87dea46b06ea13b539e0a7c03674038e15762d15948a7bc27632e1b8afd11e2"],
  ["examples/library.arch", "3e8f00d70f63d840a1e2ead5c926cea204751fada57e5de028709bec4d091334"],
  ["examples/materials.arch", "29bb896c24060364f51b4cbad9d4065a21dc40444e6e95024bc85cf276b54e9c"],
  ["examples/museum-wing.arch", "6e01f37f15c674c544fac6651e9f3bd32d4d6e4865fdafba36ed97feca9ff33a"],
  ["examples/museum-wings.arch", "da7749539514ba637c3f58f8f74aa4b86d3f8e939fcedd20f2961e76d9f5fbc8"], // re-measured, see header
  ["examples/museum.arch", "e84e5b6d863c6fd71c0e7e39810277879c6d3a3774fe6808b2c7927546acbdf3"],
  ["examples/one-room.arch", "e12596f5401f097b5cf431fda952e96fc6523d7ca6a97c1518ffe6dd64e72cbe"],
  ["examples/parametric.arch", "982d09bc2018a495ca4c50d1cf5a99dcbb92f235b86f9cb722c4e931c839e921"],
  ["examples/practice-office.arch", "1692d70a7c06b0ebd17a64b47004afd37fd98b0a65e79df3de8d2f110162073e"], // added with the example, re-measured for net area, see header
  ["examples/relational.arch", "d27362e8dec9b595eaff227c2ea7978f311634fd22dfd7ac54c2bd12f002a918"],
  ["examples/sheet-notes.arch", "0104550fc3b3a39a71c1a005da79c3db5ea10ae21d9739e11a6d1f18ee7b7420"], // re-measured, see header
  ["examples/studio.arch", "ed8513998b1bc62fa08d73a67c0897777ab68f186609896ae491b868adf463d8"],
  ["examples/terrace-row.arch", "3863de52cc4fa5d87ae2f9f90b3edbb5d9db8ecc31b2343d2280b00b9c62a02c"],
  ["examples/themed.arch", "083872e0955d587897a87084c2f0bfe395856b02c643d7a8920e02f4bde870c1"],
  ["examples/tiny-house.arch", "cbd44f2c14aa28ea42f1fac0c7029f6257e6d7bcaab42c21ec290cecc3bd1933"],
  ["examples/townhouse.arch", "a3252455577b780dfed37d5eebeea1f8725c2df9d5c538b0e61c091418022f94"],
  ["examples/transit-hall.arch", "b8ec53697030c76a35fdd875115c89cedca4e5ff591837eab5b1fb1209024ad9"],
  ["examples/two-bed.arch", "a805e3baa9df0117a2216af7fda83174706ca4d47f38a13c5eb1e77bea89285c"],
  ["examples/two-storey.arch", "9a3c251061973ef6fd1cb77c0a2351e2d224b53cb7cd5f51b97dcf824285606d"],
  ["test/fixtures/axes-grid.arch", "ce679d02505196bc708ad17fd1774c3af515f4698b3ab4c7e950dff3b695576a"],
  ["test/fixtures/chain30.arch", "13411e1dbffca14e73601338837daf6517ddf9fc2447695021101fc051073cb6"], // new fixture, see header
  ["test/fixtures/dense-bays.arch", "c01f946b1cd01d07fb673f33c210388d647aeab75049be76a9e5a6c30c00ac46"],
  ["test/fixtures/diff-a.arch", "1cff5f9be081933217e1ee78804a2cf68cf17dba8d9997a51efc89ea3cbc7632"], // re-measured, see header
  ["test/fixtures/diff-b.arch", "baab46a8480793499c0992812fc3867988f1d874df02fe5ce5fc187373bfcdda"], // re-measured, see header
  ["test/fixtures/diff-circ-a.arch", "272184ab44393f0f5cf74f5ad7a41c65ee2e16fbaf837dd9d0a1fb40ab71a335"],
  ["test/fixtures/diff-circ-b.arch", "68ba4e31f6e1bcb57fda4bc7eefc2afba407b1e0038497fb4a65079be210864d"],
  ["test/fixtures/off-path-bypass.arch", "b8123c5f00d6ce700209f6c5f6a479847f0e5218cf99c8bb2d4af66006289415"], // new fixture, see header
  ["test/fixtures/schedule-sheet.arch", "e2bd4bee94bd148cbfc765d808cb3d93f3e5e5990e3cce4c4c3ec94df5007544"], // re-measured, see header
  ["test/fixtures/star30.arch", "eb21a2460d3cd302bc0b470184924cb46c947fa9ca95a7d8d7cbda839f791761"], // new fixture, see header
  ["test/fixtures/zones-levels.arch", "3bcbe8f909a76528732dc309234e17526c80030e7baff7605e1879dd328ab10b"],
  ["test/fixtures/zones-wings.arch", "a709a63178d723d6ceff5b39103b35dd16823449fd87200523c43a848a77cda2"],
];
