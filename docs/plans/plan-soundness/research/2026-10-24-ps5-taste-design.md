> Research record, 2026-10-24, against `main@7954f252` (built CLI, `dist/`). Design only: no code.
> Read observations as evidence and diagnoses as hypotheses: re-measure before you build on a
> number. Programme entry: `../README.md` (§3 D2, D3, D7; §6 PS5; §7 row 5). Rule catalogue and
> sources: `design-taste.md`.

# PS5 taste layer: design for §7 row 5

Row 5's acceptance: "The taste score separates the corpus's known-bad from known-good plans
monotonically". This file turns PS5.1–PS5.3 into four PR-sized cards, fixes the score's shape and
arithmetic, defines the eleven starting criteria over today's facts, and states what "separates
monotonically" means as a pinned law.

## 0. Measured today (what shapes the design)

Prototype scripts ran over `dist/index.js` from scratch; none is committed.

1. **`arch score` exists and is the intent meter only.** `cmdScore` (`src/cli/commands-analyze.ts:699`)
   requires `--brief`, prints `score` as `Math.round(x·10⁴)/10⁴` and exits 0 on a measurement.
   Manifest: `src/manifest.ts:651`; MCP `score` tool: `packages/mcp/src/tools.ts:560`. Nothing
   named `taste` exists in `src/`.
2. **Known-good twins are not lint-clean.** Of the 70 defect-corpus pairs (`test/defect-corpus/`),
   only 42 clean twins have an empty default `lint()`. 28 carry other warnings, mostly
   `W_ROOM_NO_FIXTURE`, `W_HABITABLE_NO_WINDOW` and `W_ROOM_MISSING_DEFINING`, because a twin is
   the smallest plan that shows one defect. 27 pairs are separated by lint alone (bad warns, good
   is clean); 15 bad cases are lint-clean (`todo` rows). So the 0.5 validity cap cannot carry the
   row-5 acceptance by itself, and the corpus alone is not a known-good/known-bad set for taste (§4).
3. **Examples:** 32 of 34 compile without a `world`; 27 lint clean (`furnished-flat`,
   `tiny-house`, `hillside-villa`, `garden-house`, `themed` warn).
4. **The starting criteria do separate the circulation pairs.** A prototype of R3, R11, R14 over
   `describe --facts syntax` (definitions as in §3):

   | Pair (`circulation-privacy/`) | R3 bad → good | R11 bad → good | R14 best common-room rank, bad → good |
   |---|---|---|---|
   | `two-bed-chain` | 1/2 → 2/2 | 1/1 → 1/1 | 3/5 → 1/5 |
   | `living-via-bedrooms` | 2/4 → 4/4 | 0/1 → 1/1 | 4/4 → 3/4 |
   | `entry-into-bedroom` | 0/1 → 1/1 | n/a | 2/2 → 1/2 |
   | `bedroom-via-bedroom`, `bath-via-bedroom` | equal | n/a | equal |

   The other circulation pairs (wet-room doors, a fire door) are equal or not assessable on every
   starting criterion, which is honest: their defect is validity, owned by lint.
5. **R15 as written in `design-taste.md` rewards the defect.** "Bedroom pairs whose path avoids
   kitchen/living" scores `bedroom-via-bedroom` 1/1 bad and 0/1 good, because a bedroom-to-bedroom
   door is such a path. Redefined in §3 (pairs joined through circulation rooms only): 0/1 both,
   and 1/1 on `two-bed`, `bungalow`, `furnished-flat`, 3/3 on `courtyard-house`. `terrace-row` reads
   0/6 because its bedrooms belong to four houses: the dwelling concept is missing (PS2.14), so §3
   counts only pairs joined without passing outside.
6. **Examples with a real R3 inversion:** `furnished-flat` 2/4 and `relational` 1/2 (a public room
   deeper than a bedroom). Both lint clean: taste, not validity.

## 1. Scope, non-goals and the ADR

**PS5.1 · `taste()` and `arch score --taste <profile> [--json]`.**
- `taste(source, { profile?, world? }): TasteReport` in a new `src/taste/` folder, exported from
  `src/index.ts`. Pure, sync, deterministic, no I/O, bounded by counts.
- CLI: `arch score <file> --taste <profile> [--json] [--quiet]`. `--taste` and `--brief` are
  mutually exclusive in PS5.1 (exit 3 if both). Like the intent meter it exits 0 on a measurement,
  whatever the score; a plan with compile errors exits 2 and prints the errors (the `lint` path).
- PS5.1 ships one profile, `generic`, and the eleven criteria R3, R6, R7, R9, R11, R12, R14, R15,
  R16, R17, R18.
- Non-goals: no `A_*` code in `lint()` or `describe()`; no machine fix; no MCP tool; no
  `arch explain` for `A_*` (§6 Q7); no facade (R26, R27) or multi-dwelling (R19, R20) criteria.

**PS5.2 · Profiles `cn-`, `uk-`, `us-residential-advisory`.**
- Each name is both a taste profile (`Partial<TasteRuleset>`) and a lint profile
  (`Partial<LintRuleset>` in `LINT_PROFILES`, `src/lint/ruleset.ts:294`), so `lint --profile` and
  `score --taste` take the same three names. Every number carries its source in a doc comment (D3).
- R4 (area and short side by use), R8 (corridor width by destination), R10 (WC clearances) and
  R37 (bedroom escape window, `us`) are **lint thresholds** (Sev W in `design-taste.md` §5.2), the
  "advisory code" layer of README §4, opt-in by profile. They never enter the taste total; the
  taste report lists the profile's extra warnings under `advisory` (§2).
- Non-goals: no `gb50096`/`irc`/`ndss` names (ADR 0005); no pass claim for escape windows
  (necessary-condition only, PS2.16); no default-profile change.

**PS5.3 · `validate --json` gains `next`.**
- One diagnostic chosen by fixed precedence: errors → validity (default `lint()` W_*) → intent
  (gating, then advisory) → profile (only with `--profile`) → taste (only with `--taste`).
- Non-goals: no reordering of `diagnostics`; no change to exit codes; `lint()` and `describe()`
  untouched.

**PS5.4** (`preview --review`) is out of scope.

**ADR needed: yes.** D2 lives only in the programme README, which is deleted when the programme
ends (README "How to extend"). ADR 0005 allows "honestly named, caveated advisory checks" but says
nothing of a score, a cap or a second channel. No ADR mentions taste. Propose, in PS5.1a, as
**0032**: 0030 and 0031 are reserved by the owner's archlang-3d programme
(`docs/plans/archlang-3d/adr-draft-0030-*.md`, `adr-draft-0031-*.md`, to land under those numbers);
re-check `docs/adr/` and the open PRs before the PS5.1a PR lands.

> **ADR 0032 · Taste is a separate, sourced score that never gates**
> - Quality judgements that are profile- or culture-dependent go to `taste()` / `arch score
>   --taste`, never to `lint()` or `describe()`; neither ever reads the taste module.
> - Only plain defects become `W_*` lint rules (D2). A taste criterion graduates to lint only with
>   a defect-corpus case, a clean twin, and the corpus `lint()` movement explained.
> - The score is in [0, 1], computed in integer arithmetic, capped at 0.5 while default `lint()`
>   reports any validity-layer warning, and `null` when nothing is assessable. It never sets an
>   exit code.
> - Every lint rule declares its layer (`layer: "validity" | "drafting"`) on its definition.
>   Drafting-only codes (the annotation family: `W_DIM_INSIDE`, `W_DIM_TEXT_MISMATCH`, PS2.12's
>   codes, and any later rule declared drafting) never cap; they are listed under
>   `validity.drafting` so they stay visible. Compile-channel warnings never cap. The taste module
>   keeps no list of codes of its own.
> - Coverage first: a criterion that cannot judge says so (`assessable: false` and a reason); an
>   unassessable criterion is excluded, never counted as a pass.
> - Every threshold cites a source; a remembered value ([M]) is verified before it ships.
>   Profiles are advisory names (ADR 0005).
> - Calibration is deterministic over the repository's corpora; no paid eval, no live model run,
>   no claim of a model-loop gain (iron laws, Eval).
> - *Reverse if:* agents measurably ignore a separate score (D2's own trigger).

## 2. The score

### 2.1 What it reads

- **`describe()` facts** for everything `describe()` reports, so taste sees exactly what an agent
  sees: `rooms[].uses`, `adjacent`, `area_m2`, `net_area_m2`; `access.edges`,
  `access.rooms[].depthFromMainEntrance` when present (PS0.10), else `depthFromEntrance`;
  `access.mainEntrance`; `windows[].room`, `facing`; `syntax` (opt-in fact, requested internally);
  `levels[]`.
- **The resolved IR** (`resolvePlan`, `src/analyze.ts:99`) only where `describe()` rounds or omits:
  room rings at full precision (`roomRing`), window `sill`/`head` (always resolved: authored or the
  900/2100 defaults, `src/ir.ts:486-491`), door `at`/`width`/`host`, wall centreline segments.
- **`lintWithCoverage()`** (`src/lint.ts:77`) for two things only: the validity cap (codes, never
  message text) and the coverage's `unclassified` rooms. Default ruleset for the cap; the named
  profile's lint run for the `advisory` list.
- Never: ids or labels as meaning (ADR 0005; uses come from `roomUses`), diagnostic text, the
  SVG, the theme, `--view`, the clock or the environment beyond the `World` seam.

All three share the memoised parse/resolve stages, as `validate` does, so a `score --taste` call
resolves once. `taste()` must not mutate any memoised value (iron law: clone).

### 2.2 Shape

```json
{
  "profile": "generic",
  "ok": true,
  "score": 0.5,
  "uncapped": 0.7125,
  "capped": true,
  "validity": { "pass": false, "warnings": 2, "codes": ["W_ROOM_VIA_PRIVATE"],
                "drafting": { "warnings": 1, "codes": ["W_DIM_INSIDE"] } },
  "advisory": [],
  "coverage": {
    "rooms": 6, "classified": 5,
    "unclassified": [{ "name": "Snug", "id": "r_snug" }],
    "weight": { "assessable": 9, "total": 11 },
    "skipped": [{ "criterion": "R12", "reason": "non-dwelling" }]
  },
  "subscores": { "circulation": 0.5, "zoning": 0.6667, "light": 0.875,
                 "geometry": 1, "furnishing": 1, "facade": null },
  "criteria": [
    { "id": "R3", "name": "intimacy-gradient", "subscore": "zoning", "kind": "taste",
      "weight": 1, "assessable": true,
      "measured": { "num": 1, "den": 2 }, "score": 0.5,
      "source": "Alexander, A Pattern Language, 127", "verified": "V",
      "advice": "A_INTIMACY_INVERSION",
      "message": "\"Kitchen / Living\" is 4 doors from the front door; \"Master Bedroom\" is 3.",
      "evidence": [{ "ids": ["r_kitchen", "r_bed1"], "fact": "depth 4 > depth 3" }] }
  ]
}
```

- Key order is fixed as above; `criteria` in R-number order; `evidence` in source order, at most
  8 entries per criterion (`evidence_more: n` past that), so output size is bounded.
- `message` names rooms by label and never quotes an id (the lint iron law applied to taste);
  ids live in `evidence[].ids`, as data, the way lint puts them in `hint`.
- `skipped[].reason` reuses `LintSkipReason` words (`no-uses`, `no-entrance`, `non-dwelling`,
  `no-main-entrance`, `non-rectangular-room`) plus taste's own: `too-few-items`,
  `upper-storey` (until PS0.3), `taste-budget`, `curved-room`.
- `null` subscore: no assessable criterion in it (`facade` in PS5.1). `score: null` when no
  criterion is assessable; then `capped` is `false`.

### 2.3 Exact arithmetic

- **Lattice integers.** Every IR coordinate lies on the 0.001 mm lattice within ±2²⁵ mm
  (ADR 0022, `MODEL_RANGE_MM`), so `Math.round(x·1000)` is an exact integer below 2³⁶, safe as
  a double. A product of two (an area, a cross product) reaches about 2⁷², so products and their
  sums are `BigInt`. Counts are plain integers.
- **A criterion's measured value is a rational** `num/den` of integers (counts, or lattice
  lengths and areas), reported as `measured`. No transcendental call: R14 ranks by integer total
  depth instead of `rra` (§3), R9/R18 compare ratios by cross-multiplication.
- **Ramps.** A criterion maps `v` to a score with two rational anchors, `zero` and `one`
  (piecewise linear, clamped; `zero > one` for a lower-is-better value). The score is an integer
  permyriad `p ∈ [0, 10000]`: `p = clamp(roundHalfUp(10000·(v − zero) / (one − zero)))`, with the
  sign of `one − zero` normalised first and the division done on `BigInt` cross-multiplied
  numerators and denominators, so the rounding is decided in integers.
- **Means.** Item → criterion, criterion → subscore, subscore → total: weighted means of permyriads
  with integer weights, each rounded half up in integers. The cap is `min(p, 5000)`.
- **Printing.** Permyriads print through one new helper beside `fmt4` in `src/num-format.ts`,
  `fmtPermyriad(p: number): string`, built from the integer's digits (no division), e.g.
  `6125 → "0.6125"`, `5000 → "0.5"`, `10000 → "1"`. The JSON number is the parse of that string,
  which ECMA-262 makes exact and which `JSON.stringify` prints back byte-for-byte. So no float
  operation sits upstream of any pinned byte.

### 2.4 Determinism, bounds, purity

- Pure, sync, no `Date`, no randomness, no `Map` iteration over insertion order that depends on
  anything but source order.
- **Bounds are counts.** The step meter (`MAX_EVAL_STEPS`, `src/expr.ts`) is resolve-time only;
  lint bounds its analyses with counted budgets and coverage skips (`EnclosureBudgetCap`,
  `MAX_HINT_VERIFICATIONS`). Taste follows lint: one `TASTE_BUDGET` count per call, charged before
  each criterion's work at its stated cost (§3 column "cost"); a criterion that would exceed it
  reports `assessable: false, reason: "taste-budget"`. Every cost is polynomial in element
  counts, and the 5,000-elements-per-storey cap (`MAX_ELEMENTS`, `src/ir.ts:992`) bounds them all. The budget is
  set by measurement in PS5.1a: at least 1,000 × the largest corpus plan's charge, as the step
  budget was.
- `syntaxFacts` (`src/analyze/syntax.ts:75`) is all-pairs on the access graph, O(V·(V+E)); R14 is
  charged that.
- Taste draws nothing and never changes `compile()`, `describe()` or `lint()` (law L1, §5).

### 2.5 The validity cap

`validity.pass` is false when default-ruleset `lint()` returns any warning from a rule whose
layer is `validity`. (Lead ruling, PR #242 review.)
- **The layer lives on the rule.** `LintRule` (`src/lint/context.ts`) gains two required fields:
  `layer: "validity" | "drafting"` and `codes: readonly string[]`, the codes the rule may emit
  (a diagnostic does not name its rule today). `lintWithCoverage()` returns the code → layer map
  beside the diagnostics, never inside them, as it does the coverage report; taste reads that map.
  Required fields make the compiler refuse a rule with no layer.
- **Drafting-only codes do not cap:** the `annotation` family (`W_DIM_INSIDE`,
  `W_DIM_TEXT_MISMATCH`, PS2.12's `W_TITLE_OVERFLOW`, `W_LABEL_COLLISION` and the `dims auto`
  widening) and any later rule declared `drafting`. They are listed under `validity.drafting`
  (`{ codes, warnings }`) so they stay visible.
- Compile-channel warnings (`W_ROOM_OVERLAP`, the `while` deprecations) do not cap: they are not
  soundness findings. Profile-only warnings (PS5.2) go to `advisory` and do not cap: README §4
  puts advisory code below validity. A plan with a compile error has no score.

## 3. The eleven criteria

Common rules: a room's use is `roomUses` (`src/analyze.ts:222`). *Public* = living, dining,
kitchen. *Bedroom* = bedroom use with no public use (the `privacy.ts` "private" test,
`src/lint/rules/privacy.ts:59-75`). *Circulation* = hall, circulation, entry. *Habitable* =
living, dining, kitchen, bedroom, office. An item whose room has no use is not assessable
(`no-uses`). Multi-storey: items are pooled over storeys; until PS0.3 an upper storey's depths
are unreliable, so R3, R14 and R15 skip it (`upper-storey`). Ramps are `zero → one`.

| Id · subscore | Definition over today's facts | Already in `src` | Missing | Source | Cost |
|---|---|---|---|---|---|
| **R3** intimacy gradient · zoning | Pairs (public p, bedroom b), both reached. Inversion iff `depth(p) > depth(b)`; equal depth is no inversion (two rooms off one hall is the ideal). v = 1 − inversions/pairs; ramp 0 → 1. Assessable with ≥ 1 pair and an entrance | depths `src/analyze.ts:954` (`buildDoorAccessGraph`), main-entrance depth `src/analyze/entrance.ts:269`; use sets `privacy.ts:59-75` | the pair count; exporting the use sets | Alexander 127 [V] | P·B |
| **R6** furniture–use match · furnishing | Per piece in a classified room: a `wet`-zoned piece in a room with no bath/wc/utility use, a `kitchen`-zoned piece in a room with no kitchen use, or a bedroom's defining piece (bed) in a room with no bedroom use and a public or wet use, is a mismatch. v = 1 − mismatches/pieces | zones `src/fixtures-catalog.ts:156-189` (only `wet`, `kitchen`); defining items `src/lint/defining.ts:44` | a sofa/dining zone (none; out of PS5.1) | none (catalogue semantics) | F |
| **R7** daylight ratio · light | Per habitable room: G = Σ width × (head − sill) over windows whose `describe().windows[].room` is the room, A = `net_area_m2` (centreline `area_m2` if net is omitted, flagged in evidence). v = G/A; ramp 0 → target (generic 8 %). Zero windows is validity (`W_HABITABLE_NO_WINDOW`) and scores 0 here too | window→room `src/describe.ts:1318`, `src/analyze.ts:653`; sill/head `src/ir.ts:486-491`; net area ADR 0027 | the ratio; evidence says `heights: default` when no height was authored | IRC R303.1 8 % [S, `prior-art.md` §3]; GB 50096 7.1.5 1/7 for `cn` [V, `prior-art.md` §3.1] | W + R |
| **R9** proportion · geometry | Per room (habitable, bath, wc; circulation and storage exempt): aspect = long/short side of the **minimum-area enclosing rectangle of the room's ring** (from the shape, never the bbox). Circle: 1. Ramp habitable 3 → 2, bath/wc 3.5 → 2.5 | ring `roomRing`; exact areas `src/geometry/polygon.ts:40` (doubles) | an exact hull + rotating-calipers helper on lattice integers (`src/geometry/min-rect.ts`): for each hull edge e, extents are Δ(p·e) and Δ(p×e) and the length of e cancels in the ratio, so aspect and rectangularity are rationals | Palladio 2:1 [M, Quattro Libri I.xxi]; ResPlan p95 bedroom 1.57, bath 2.24 [prior, §4 of `design-taste.md`] | Σ V log V |
| **R11** kitchen–dining link · zoning | Per kitchen room: linked iff it also has a living or dining use, or an access edge (door or opening, including a derived `open between`) joins it to a living or dining room. v = linked/kitchens | edges `describe().access.edges` | nothing | Alexander 139 [V]; ResPlan 99 % touch [prior] | K·E |
| **R12** dwelling aspect · light | Over windows of habitable rooms: number of distinct `facing`. 0 → 0; 1 → 0.5, or 0 when the plan declares `site` and that facing is the pole side; ≥ 2 → 1. Skips a non-dwelling plan (`dwellingReading`, `src/analyze/dwelling.ts:35`) | `windows[].facing` `src/describe.ts:270`; `windowFacingPage` `src/site.ts:170` | pole side from `site` (exists for `W_ROOM_NOT_EQUATOR_FACING`, `src/lint/rules/site.ts`) | London Plan D6, LPG C4.1 [S] | W |
| **R14** common area at the heart · circulation | Rooms in the system ranked by integer total depth T = Σ step distances (rank 1 = smallest T; ties share the better rank). r = best rank among living/dining rooms, n = system rooms. 1 if r ≤ ⌈n/3⌉, else linear to 0 at r = n. Needs n ≥ 3 | `syntaxFacts` computes T before dividing (`src/analyze/syntax.ts:107-110`); RRA = RA/D_k with one D_k per storey, so ranking by T is ranking by RRA without `log2` | return T (integer) from the shared walk, or recompute with `bestPaths` | Alexander 129 [V]; Hanson 1998 [S] | V·(V+E) |
| **R15** night-zone contiguity · zoning | Bedroom pairs joined in the access graph **without the exterior node** (a proxy for "same dwelling" until PS2.14). Pair zoned iff a path joins them whose every intermediate node is a circulation room and which has at least one (a bedroom-to-bedroom door is not zoning). Computed by components of the circulation-only subgraph: zoned iff the two bedrooms touch a common component. v = zoned/pairs. Needs ≥ 2 bedrooms | edges; `CIRCULATION_USES` `privacy.ts:72` | the component pass | 动静分区 (practice); Alexander 136 [V] | V+E+B² |
| **R16** corner doors · circulation | Per door joining two rooms, per side room with centreline area < 15 m²: the door's room-ring edge (rectilinear only, else `non-rectangular-room`), jamb-to-corner distance along it to the nearer ring corner. Pass iff ≤ max(host thickness, 600 mm). v = passes/items | jamb projection `jambRuns` `src/lint/rules/doors.ts:497`, corner test `tightestCorner` (`:462`) (to a wall corner, not a room corner) | the room-ring edge lookup; measure to the ring corner, the datum PS2.25 debates | Alexander 196 [V]; ResPlan jamb-to-corner p50 bedroom 0.09 m [prior] | D·V |
| **R17** axis economy · geometry | Per storey: x-values of vertical and y-values of horizontal edges of room rings and straight wall centrelines, lattice integers, sorted; single-linkage clusters with gap ≤ 100 mm (order-independent on sorted values). v = (clusters_x + clusters_y) / rooms (non-circulation rooms; all rooms if none). Ramp 2.5 → 1.5. Oblique edges excluded, counted in evidence | rings; `segmentsOfWall` `src/geometry.ts:514` | the clustering | Ching (datum) [M]; Brandão 2008 [S] | L log L |
| **R18** shape regularity · geometry | Per bedroom, bath, kitchen: rectangularity = ring area / minimum enclosing rectangle area (same helper as R9). Ramp 0.75 → 0.9. Circle rooms skip (`curved-room`) | `polygonSignedArea2` | the helper above | Alexander 191 [V]; ResPlan p10 bedroom 0.83, bath 0.98, kitchen 0.93 [prior] | shared with R9 |

Subscores in PS5.1: circulation {R14, R16}, zoning {R3, R11, R15}, light {R7, R12}, geometry
{R9, R17, R18}, furnishing {R6}, facade {} (null). All weights 1 in PS5.1; a weight change is a
law-row move (§4).

**Acceptance test per criterion** (one line each, every one a fixture in `test/taste-corpus/`):
- R3: `two-bed-chain` scores 1/2, its twin 2/2; a corridor plan with living and bedrooms both at depth 2 scores 1.
- R6: a bed in a room typed `uses kitchen` gives 1 mismatch of n pieces; the same bed in a bedroom gives 0.
- R7: a 12 m² net living room with one 1200 mm window at default heights reads G/A = 1.44/12 = 0.12 → 1 under `generic`, below 1 under `cn` (1/7).
- R9: a 2000 × 5000 bedroom (2.5) scores 0.5; a 45°-rotated 3000 × 3000 polygon bedroom scores 1 (the bbox would say 1, the shape must too); an L-shaped room uses its hull.
- R11: `living-via-bedrooms` 0/1, twin 1/1.
- R12: a flat with every habitable window on one side scores 0.5; with `site` and that side the pole side, 0.
- R14: `two-bed-chain` rank 3/5 → 0.6667 (one at rank ⌈5/3⌉ = 2, zero at 5), twin 1/5 → 1.
- R15: `bedroom-via-bedroom` scores 0 on both twins; two bedrooms off one hall score 1; `terrace-row` counts no cross-house pair.
- R16: a 3 × 3 m bedroom door with a 100 mm nib passes; centred on a 3000 mm edge (1050 mm nib) fails.
- R17: a 3-room strip (4 x-lines, 2 y-lines) reads 6/3; a 40 mm offset partition clusters with its neighbour.
- R18: a 3000 × 3000 room scores 1; an L at 0.75 of its hull rectangle scores 0.

## 4. Calibration and the row-5 law

**What "known-bad" and "known-good" mean.** §0.2 shows the defect corpus is a validity yardstick:
its twins differ by a validity fix, and 28 of 70 good twins still warn. So row 5 uses three sets.

- **Set A, the defect-corpus pairs a starting criterion reads** (owning subscore in brackets):
  `circulation-privacy/two-bed-chain`, `living-via-bedrooms`, `entry-into-bedroom` [zoning,
  circulation]; `bedroom-via-bedroom`, `bath-via-bedroom` [zoning]; `daylight/*` (4 pairs) [light].
- **Set B, the 27 pairs lint separates** (bad warns, good is lint-clean; listed by the test, not by
  hand, so it follows the corpus).
- **Set C, a new `test/taste-corpus/`** of lint-clean pairs, one or more per criterion, each pair
  differing in one taste fact (the acceptance fixtures above, plus `furnished-flat` and
  `relational` reductions for R3). Header format as `test/defect-corpus/README.md`, with
  `criterion:` in place of `expect:`. Not eval data; nothing feeds `eval/` or `dataset/`.

**The pinned law (`test/taste-separation.test.ts`):**
1. Set A: for every pair, the bad twin's owning subscore ≤ the good twin's; strictly less for the
   pairs §0.4 measured as separated (`two-bed-chain`, `living-via-bedrooms`, `entry-into-bedroom`,
   the four `daylight` pairs).
2. Set B: total(bad) < total(good) for every pair (the cap puts bad ≤ 0.5; the law demands the
   good twin's total > 0.5 or, where good's total is ≤ 0.5, the pair is listed as a calibration
   finding in the test's ledger with a reason; an empty ledger is the goal, not a precondition).
3. Set C: strict on the owning criterion and on the total, both twins lint-clean (asserted).
4. Concordance, printed like the corpus catch rate: over A ∪ B ∪ C, pairs ordered correctly /
   tied / reversed. **Reversed = 0** is the row-5 acceptance; ties are allowed only in set A's
   non-strict rows. This is Kendall's concordance restricted to the comparisons the corpus knows;
   no total ranking of unrelated plans is claimed.

**The digest law (`test/taste-digests.test.ts`):** SHA-256 of `JSON.stringify(taste(src,
{ profile }))` for every example and every corpus file, per profile, in a pinned table built with
the test's own body (the byte-identity convention). A moved row is a finding: the PR explains it
per criterion and never re-pins to green (AGENTS.md).

**ResPlan priors without paid eval.** The priors in `design-taste.md` §4 are used only as ramp
anchors (p50 near `one`, p95 near `zero`, after the 0.88 length / 0.77 area correction), each doc
comment marked `[ResPlan prior, design-taste.md §4]`. They are not re-mined in this row (the raw data
never entered the repository; the corpus law checks the anchors). A re-mine, if wanted, is local,
unpaid and CC BY 4.0. No LLM judges a plan, `eval:live` is never run, and no model-loop gain is claimed.

**Equivariance law:** `taste()` is invariant under a pure translation and under a D4 frame applied
with `north` carried along (R12's pole side is the only compass reader); under a D4 frame with
`north` fixed, every criterion but R12 is invariant. Reuse `test/equivariance-corpus.test.ts`'s
frames.

## 5. Cards

Every card: the backlog floor gate (`npm run check`, `check:drift`), `typecheck:all` (tests live in
`test/`), the touched tests locally, CI for the rest (owner rule, 2026-10-21). Every card carries
the two standing invariants as tests:
- **L1 · taste is invisible.** `digestPayload` (SVG + `describe()` + `lint()`) of every example and
  corpus file is equal to the pinned byte-identity baseline, computed after `taste()` has run in
  the same process for every profile (catches memo mutation). `describe()` and `lint()` import
  nothing from `src/taste/` (an import-graph assertion, like `test/algebra-leaf.test.ts`).
- **L2 · taste draws nothing.** `compile()` output for the corpus is unchanged (part of L1's payload).

**PS5.1a · Skeleton, three criteria, the laws.** About 12–16 executor-hours.
- Files: `docs/adr/0032-taste-separate-score.md` (new); `src/taste/{index,report,arith,criteria}.ts`
  (new); `src/num-format.ts` (`fmtPermyriad`); `src/index.ts` (export); `src/cli/commands-analyze.ts`
  (`cmdScore` branch), `src/cli/io.ts` (`--taste` flag), `src/manifest.ts` (flag, output, example);
  the lint rule registry: `src/lint/context.ts` (`LintRule.layer`, `LintRule.codes`, both
  required), every rule in `src/lint/rules/*.ts` (`annotation` family `drafting`, the rest
  `validity`), `src/lint.ts` (the code → layer map beside the diagnostics; `lint()` output
  unchanged); regenerated `gen:*` outputs (CLI reference, agent manifests, llms files);
  `test/taste-*.test.ts`, `test/lint-layers.test.ts` (every `W_*` code `lint()` can raise is in
  exactly one rule's `codes`, so it has one explicit layer; every diagnostic raised over the
  examples and both corpora is in its rule's `codes`), `test/taste-corpus/` (first fixtures).
- Criteria: R3, R7, R14 (the three that §0.4 shows separating set A), with the full report shape,
  coverage, cap, budget, `generic` profile.
- Acceptance: laws L1, L2, digest, equivariance, separation (set A rows for these three, set B,
  set C fixtures for these three) green; `arch score examples/two-bed.arch --taste generic --json`
  and the `two-bed-chain` pair proven through the CLI in the PR body; `--taste` with `--brief`
  exits 3; an unknown profile exits 3 with did-you-mean (the `lint --profile` path).
- Check `spec.llm.md`'s 30,000-character cap if the manifest example reaches it (it is generated
  from the manifest); trim provable duplication first (iron law).

**PS5.1b · The remaining eight criteria.** About 14–18 executor-hours (the exact min-rectangle
helper and R16's ring-edge lookup are the bulk).
- Files: `src/geometry/min-rect.ts` (new, with a law test against a brute-force rotation oracle in
  `test/` only); `src/taste/criteria.ts`; `test/taste-corpus/` (the remaining fixtures); digest
  table re-pinned **only by adding rows and criteria**, each existing row's move explained (a new
  criterion moves every row; the PR lists the per-criterion values, not just hashes).
- Then one teaching line in `skills/archlang/SKILL.md` and the loop `compile → lint → score
  --taste → repair` (`design-taste.md` §5.3), only after the concordance has 0 reversed. This line
  is what makes the first-contact re-measure necessary (§7).
- Acceptance: all eleven acceptance tests of §3; separation law over A ∪ B ∪ C with 0 reversed;
  L1, L2; taste-budget probe (a generated 5,000-room storey returns with `taste-budget` skips,
  counted, not timed).

**PS5.2 · Profiles.** About 10–14 executor-hours. After PS5.1a; R10 after PS2.11's
`W_WC_SIDE_CLEARANCE` lands; R37 coordinated with PS2.16.
- Files: `src/lint/ruleset.ts` (three `LINT_PROFILES` entries; new fields `minRoomShortSideByUseMm`,
  `minPathClearWidthByUseMm`, `wcSideClearanceMm` if PS2.11 has not named it,
  `escapeWindow` minima); the rules that read them (`per-room.ts`, `circulation.ts`, PS2.11's WC
  rule, PS2.16's escape-window rule); `src/taste/profiles.ts` (R7 target per profile);
  `src/manifest.ts` (profile names flow from `LINT_PROFILE_NAMES`); tests.
- Numbers (each with its doc-comment source; verify [M]/[S] before shipping a message, D3):

  | Rule | cn | uk | us |
  |---|---|---|---|
  | R4 area | double bedroom 9, single 5, living 10, kitchen 4.0 m² (GB 50096 5.2.1, 5.2.2, 5.3.1 [V `prior-art.md` §3.1]) | single 7.5 m² / 2.15 m, double 11.5 m², main double 2.75 m, other doubles 2.55 m (NDSS 10(c-e) [V]) | habitable 6.5 m², 2134 mm any dimension, kitchen exempt (IRC R304 [S]) |
  | R8 corridor | entry 1200 (宜), to bedroom/living 1000, to kitchen/bath/store 900 (GB 5.7.1 [V]) | hall 900 (AD M4(2) [S]) | hallway 914 (IRC R311.6 [S]) |
  | R10 WC | — (no sourced number; keep default) | — | centreline 381 to side, 533 clear in front (IRC P2705.1, R307.1 [S]) |
  | R37 escape | — | (ADB 2.10: 0.33 m², 450 × 450, ≤ 1100 [S]; PS2.16's `uk` arm) | width ≥ 508, sill ≤ 1118, gross area ≥ 0.46 m² (IRC R310: 5.0 ft² at grade, 5.7 ft² above [S]); failure only, never a pass |
  | R7 target (taste) | 1/7 (GB 7.1.5 [V]) | — (generic 8 %) | 8 % (IRC R303.1 [S]) |

- "Single" vs "double" bedroom: no fact says which; R4 reads the bedroom's bed (a `bed` wider than
  1200 mm is a double) and declares `no-bed` coverage otherwise. Never inferred from the label.
- Acceptance: default-profile `lint()` and `describe()` byte-identical over the corpus (L1's
  payload with no profile); each profile's new warnings listed per example in the PR and each one
  judged true or false positive; `score --taste cn-residential-advisory` reports the profile's
  extra warnings under `advisory` and does not cap on them.

**PS5.3 · `validate --json` gains `next`.** About 5–7 executor-hours. After PS5.1a.
- `nextDiagnostic(result): NextItem | null`, pure, in `src/next.ts`, exported. Tiers in order:
  (1) `compile()` errors; (2) default `lint()` warnings; (3) intent gating violations, then
  advisory ones; (4) profile-only lint warnings (needs `validate --profile`, added here, the same
  flag and names as `lint`); (5) the lowest-scoring assessable taste criterion (only with
  `--taste`). Within a tier: emission order, which is already deterministic. Output
  `{ tier, code, message, span?, hint? }`, appended as the last key of the JSON object, `null`
  when there is nothing. Human output: one `next:` line on stderr when not `--quiet`.
- Files: `src/next.ts`, `src/cli/commands-analyze.ts` (`report`, `reportWithChecks`),
  `src/manifest.ts`, MCP `validate` tool only with a version bump (iron law) or deferred.
- Acceptance: a table test over the corpus (the tier of each bad twin's `next` is the tier of its
  `expect` code); `validate --json` output differs from today's only by the appended key (a
  byte test that strips `next` and compares); `describe()`/`lint()` unchanged (L1).

**Order:** PS5.1a → (PS5.1b ∥ PS5.3) → PS5.2. PS2.10–PS2.12 run in parallel with all of them; they
move `lint()` and so move set B and the cap, which the separation law re-reads by itself.

## 6. Risks and open questions, with recommended answers

1. **Q: Is the corpus a fair known-good/known-bad set for taste?** No (§0.2). *Recommend:* sets A,
   B, C and the concordance law of §4; do not claim separation over plans the corpus does not pair.
2. **Q: Does the cap use the profile's lint?** *Recommend:* no. Default `lint()` only; profile-only
   warnings go to `advisory` (README §4 layers). Otherwise a `cn` profile would cap every plan
   whose bedroom is 8.9 m², turning advisory code into gating by the back door.
3. **Q: Which warnings cap?** *Ruled (lead, PR #242):* validity-layer `lint()` warnings only.
   Drafting-only codes (the annotation family and any rule declared `drafting`) do not cap and
   are listed under `validity.drafting`; compile-channel warnings do not cap. The layer is a
   required flag on each rule definition, never a list in the taste module (§2.5, ADR 0032).
4. **Q: Floats in output?** *Recommend:* integer permyriads printed by `fmtPermyriad` (§2.3). Do not
   reuse `cmdScore`'s `Math.round(x·10⁴)/10⁴` for taste.
5. **Q: R7 with no authored heights.** ADR 0022 deferred a daylight-ratio *fact* because the
   default for an unauthored height was undecided. *Recommend:* taste uses the resolved defaults
   (900/2100, already applied in the IR) and says `heights: default` in the evidence; no
   `describe()` fact is added, so ADR 0022's deferral stands.
6. **Q: Multi-dwelling plans (`terrace-row`).** *Recommend:* R15 counts only pairs joined without the
   exterior; R12 treats the plan as one dwelling and is known-coarse until PS2.14. Note both in the
   ADR's consequences.
7. **Q: Do `A_*` codes go in `src/error-catalog.ts` and `arch explain`?** *Recommend:* not in PS5.1.
   Keep them in `src/taste/advice.ts` with a guard test that every criterion has a code, a message
   template and a source. Add `explain` support later only if agents ask for it; the catalogue has
   generators and drift gates that a second severity would touch.
8. **Q: Weights.** *Recommend:* all 1 in PS5.1; a weight changes only with a separation-law reason
   and the digest rows explained.
9. **Q: Optimising the score by shrinking or relabelling (reward hacking).** *Recommend:* every
   criterion skips unclassified rooms (relabelling to nothing removes items, so the coverage
   weight drops and is printed); R9/R18 cannot be met by slivers because R4 (PS5.2) and
   `W_ROOM_TOO_SMALL` hold areas; R16 pairs with `W_DOOR_NEAR_CORNER`'s lower bound. Print
   `coverage.weight` beside the score in human output so a hollowed plan is visible.
10. **Q: MCP exposure.** *Recommend:* a separate card after PS5.1b with the `packages/mcp` version bump
    and both `server.json` fields (iron law); the hosted worker inherits it.
11. **Q: Which first-contact defects does taste reach?** Few: of the 48 surviving defects
    (`audits/2026-10-24-first-contact-rerun.md`) the starting criteria touch none directly
    (NA5 is not an R3 inversion; NH8, NA3, NT6 belong to R31, R25, not started). *Recommend:* say so
    in the PS5.1b PR; the row-5 yield on surviving defects comes from PS2.10–PS2.12.
12. **Q: `relational.arch` and `furnished-flat.arch` show R3 inversions.** *Recommend:* leave both
    as they are; they lint clean and taste is advice.

## 7. What the first-contact re-measure after row 5 must cover

D7's standing rule (README §3) re-measures first contact after a met row; D10 (PR #241) waives the
row-4 re-measure and makes the one after row 5 mandatory. Row 5 changes what an author sees in
these ways:

- **New commands and fields:** `arch score --taste <profile> [--json]`; `validate --json` `next`
  (and `validate --profile`); three new profile names on `lint --profile` and `score --taste`.
- **New warnings in default `lint()`** (PS2.10–PS2.12): `W_DIM_TEXT_MISMATCH`; the PS2.11 family
  (`W_WC_SIDE_CLEARANCE`, `W_WARDROBE_FRONT_CLEARANCE`, `W_FURNITURE_OVER_WINDOW`,
  `W_HOB_FRIDGE_GAP`, `W_LEAF_TOO_WIDE`, `W_SWING_OVER_STAIR`, `W_STAIR_HEAD_VOID`,
  `W_STAIR_TOO_STEEP`, `W_LEAF_ACROSS_DOORWAY`, `W_FOOTPRINT_TRANSPOSED`, `W_DOORWAY_BLOCKED`
  widened to leaf-less openings); PS2.12's `W_DIM_INSIDE` for `dims auto`, `W_TITLE_OVERFLOW`,
  `W_LABEL_COLLISION`.
- **Teaching:** the SKILL loop line (PS5.1b) and any `spec.llm.md` line the manifest generates.

Scope of the re-measure, in a dated `audits/` file:
1. Re-lint the twelve plans in `audits/first-contact-plans/` (the six 2026-10-18 plans and the six
   in `2026-10-24-rerun/`). Expected new catches, from the rerun's mapping: `W_FURNITURE_OVER_WINDOW`
   NA2, NS2, NH6, NC8, T5; `W_HOB_FRIDGE_GAP` NS2, NT7; `W_WC_SIDE_CLEARANCE` NT4, NT5, A8;
   `W_SWING_OVER_STAIR` NT1, T1; `W_STAIR_HEAD_VOID` NT2; `W_FOOTPRINT_TRANSPOSED` NT3, H2, T3, C4;
   `W_LEAF_ACROSS_DOORWAY` NH5, A1, K4; `W_DIM_INSIDE` NA6, NH9, NS5, NC9, NT9, NK7 (and the six
   2026-10-18 instances). Count hits, partials and false positives as the rerun did.
2. Record `score --taste generic` for all twelve as data (not a pass mark), with the criteria that
   moved between the old and rerun plan of each brief.
3. Cold authoring of the six briefs only if the SKILL or spec text changed in row 5 (it will, if
   PS5.1b's teaching line lands): same protocol as the rerun (unpaid local subagents, `spec.llm.md`
   only), and record whether authors call `score --taste` and `next` unprompted.
4. Re-run the defect-corpus catch rate and the taste concordance (§4) on the same commit.

## 8. Where `design-taste.md` disagrees with today's code

Never rewrite that record (README "How to extend"); these are the corrections for PS5 cards.

| `design-taste.md` says | Today |
|---|---|
| §0.2: the label classifier never emits `living`/`dining` (`src/vocabulary.ts:212-216`) | It does: `USE_VOCABULARY` has `living` and `dining` rows, and the fallback adds "great room", "reception room", "snug", "den" (`src/vocabulary.ts:166-235`; PS2.18, PS2.19) |
| §0.1, §1: `two-bed.arch` is a chain; only `W_BATH_VIA_BEDROOM` reads route kinds | Re-laid in PS3.6 (PR #227); R1, R2, R13 shipped as `W_ROOM_VIA_PRIVATE`, `W_WET_ROOM_DOOR`, `W_ENTRANCE_INTO_PRIVATE`; R7's zero-window case as `W_HABITABLE_NO_WINDOW`; R21 in part as `W_ROOM_MISSING_DEFINING` |
| Line references (`ruleset.ts:113-133`, `commands-analyze.ts:660-690`) | Stale: `src/lint/ruleset.ts:294`, `src/cli/commands-analyze.ts:699` |
| §5.1: charge steps on the existing meter | The step meter is resolve-time only; post-resolve analyses use counted budgets with coverage skips (§2.4) |
| §5.1: ratios print through `fmt4` | `fmt4` rounds a double; taste computes in integers and prints permyriads (§2.3). R14's `rra` uses `Math.log2`; ranking by integer total depth is equivalent within a storey |
| R3: ties broken by `walkDistanceMm` | Dropped: equal depth is the corridor ideal, and walk distances come from the nav grid (cell-quantised) |
| R15: share of bedroom pairs whose path avoids kitchen/living | Rewards a bedroom-to-bedroom door (§0.5); redefined through circulation rooms only |
| R7: GB 7.1.5 1/7 [M]; generic 1/10 | `prior-art.md` §3.1 read 7.1.5 (and 5.3.1's kitchen 4.0 m²) from the full text: [V]. 1/10 has no source; generic uses IRC 8 % [S] |
| R37: width ≥ 508 mm [M] | `prior-art.md` and `2026-10-18-furniture-and-multistorey.md` give R310 [S]: 0.53 m² (0.46 at grade), 610 high, 508 wide, sill ≤ 1118. README PS2.16's "area < 0.33 m²" is ADB 2.10's UK figure, not IRC |
| R6: derive from catalog `zones` | Zones are only `wet` and `kitchen`; beds, sofas and tables carry none; a bedroom's defining piece comes from `DEFINING` (`src/lint/defining.ts:44`) |
| R9, R18: minimum rotated rectangle | No such helper exists; PS5.1b adds an exact one (§3) |
| R12 `uk`: W for single-aspect north | Taste never warns (D2) |
| ADR 0022 (not this file) defers a daylight-ratio fact, "default for an unauthored height undecided" | The IR already resolves 900/2100 defaults; taste uses them without adding a fact (§6 Q5) |
