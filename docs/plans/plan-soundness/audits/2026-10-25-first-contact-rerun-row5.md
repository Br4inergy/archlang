> Research record, 2026-10-25, against `main@9cc29c7e` (after §7 row 5: PRs #243–#247), built CLI
> `archlang v1.43.1` (`dist/cli.js`). Read observations as evidence and diagnoses as hypotheses:
> re-measure before you build on a number. Programme entry: `../README.md`. Baselines:
> `2026-10-18-first-contact.md` (57 defects, A1–K11) and `2026-10-24-first-contact-rerun.md`
> (48 defects, NA1–NK7). This is the D7 re-measure that D10 made mandatory after row 5.

# First-contact re-measure after row 5

## Headline

| Measure | 2026-10-18 | 2026-10-24 | 2026-10-25 |
|---|---|---|---|
| Cold-authored plans: verified defects (B / N / m), area basis judged as in the baseline | 57 (4 / 26 / 27) | 48 (2 / 24 / 22) | **49 (0 / 23 / 26)** |
| …without the area-basis rows on every side | 54 | 45 | **46** |
| …of which final default `lint` reports | 0 | 1 | **0** |
| Blockers (B) | 4 | 2 | **0** |
| Rooms-first (`walls from rooms`, no `wall` statement) | 0 / 6 | 6 / 6 | **6 / 6** (31 `door between`, 0 `wall`) |
| Class 1, openings ignore walls | 4 | 0 | **0** |
| Chairs at a table facing away: before the loop / final | — / 27 of 51 | 24 / 24 → 0 / 24 | **18 / 24 → 0 / 24**; `facing` used 0 times |
| Sofas facing their TV | 0 / 3 | 1 / 3 | **0 / 3** (one more sofa faces a bed) |
| Hinged exterior doors opening the intended way (K1) | 1 wrong (K1) | 8 / 8 | **8 / 8** |
| Authors who ran `score --taste` / `validate` (`next`) / `describe` unprompted | — | — | **0 / 6 each** |
| The 57 caught by default `lint` on the 2026-10-18 plans | 0 | 17 (6 partial) | **19 (7 partial)**; 15.5 counting halves |
| The 48 caught by default `lint` on the 2026-10-24 plans | — | 1 | **1** |
| Row-5 drafting codes on the twelve old plans | — | — | `W_ANNOTATION_OVERLAP` 12 (all true; 1 hit, 1 partial, 10 outside the audits); `W_DIM_TEXT_MISMATCH` 0; `W_TITLE_OVERFLOW` 0 |
| `score --taste generic`, cold plans | — | 0.5 (capped) – 0.90 | **0.72 – 0.93**, none capped |
| Taste concordance (A ∪ B ∪ C) | — | — | 41 pairs: 37 ordered, 0 tied, 0 reversed (0 ledgered), 4 unjudged |
| Defect-corpus catch rate | 46 / 68 | 47 / 70 | **53 / 72** (unchanged on this commit) |

What row 5 changed that a cold author sees, checked in `git log 7954f252..9cc29c7e`:
`W_DIM_TEXT_MISMATCH` (PR #243), `W_ANNOTATION_OVERLAP` and `W_TITLE_OVERFLOW` (PR #245),
`arch score --taste generic` (PRs #244, #247; `spec.llm.md` names it in the CLI list with the loop
`compile → lint → score --taste → repair`; the SKILL's step 7 says the same), `validate --json`
`next` (PR #246). The PS2.11 clearance family and PS2.16 did not land, and PS2.12 deliberately did
not widen `W_DIM_INSIDE` (PS2.39). So the design's §7 expectations for `W_FURNITURE_OVER_WINDOW`,
`W_HOB_FRIDGE_GAP`, `W_WC_SIDE_CLEARANCE`, `W_SWING_OVER_STAIR`, `W_STAIR_HEAD_VOID`,
`W_FOOTPRINT_TRANSPOSED`, `W_LEAF_ACROSS_DOORWAY` and `W_DIM_INSIDE` (NA2 … NK7) do not apply: none of
those codes exists in default lint today, and none of those defects is caught.

## Method and commands

Every number above comes from one of these, run on `main@9cc29c7e` after `npm ci && npm run build`:

```sh
node dist/cli.js lint <plan> --json                                    # default ruleset
node dist/cli.js lint <plan> --json --profile accessibility-advisory   # a11y profile
node dist/cli.js score <plan> --taste generic --json                   # taste report
node dist/cli.js validate <plan> --json                                # `next`
node dist/cli.js describe <plan> --json                                # access.entrances, totals
node dist/cli.js compile <plan> -f json -o plan.json                   # geometry for the defect audit
npx vitest run test/defect-corpus.test.ts test/taste-separation.test.ts   # catch rate, concordance
npx vitest run test/rooms-tiling-probe.test.ts
```

**Part 1** ran lint (both rulesets) and taste on the twelve plans in `first-contact-plans/` and
`first-contact-plans/2026-10-24-rerun/`, and compared each warning list with the 2026-10-24 run's
saved JSON. Each new warning was checked on today's render and mapped to an audit id, or marked new
and true, or false.

**Part 2** repeated the 2026-10-24 protocol exactly:
- six fresh `arch-author` subagents (model sonnet), one per brief;
- each got the brief verbatim (the same text and preamble, recovered from the 2026-10-24 dispatch);
- each was pointed at `spec.llm.md` as its only documentation and told not to read other files;
- the instruction was the same: "write the plan; you may run `node dist/cli.js compile|lint` to check; stop when it compiles".

All six ran the lint loop to clean without a nudge, the café included this time. CLI calls were
counted from the subagent transcripts. The defect audit used the same severities, classes and area
basis as 2026-10-24:
- Plan JSON geometry;
- `describe` access;
- the render at 1800 px, cropped to check symbols;
- front rays with `rotate 0` = back to the north.

Area basis counts only where the baseline counted it: the apartment, house and studio briefs.

**Confounders.** These are the same as on 2026-10-24, plus one:
- The prompt names only `compile|lint`.
- The `arch-author` role text's loop is compile → describe → lint and never names `score`.
- The SKILL, which carries step 7, is not shown to the authors.

So "0 / 6 ran `score --taste`" measures this protocol. It does not measure an agent taught by the SKILL.

---

## Part 1 · The twelve old plans, re-linted and scored

### New warnings since 2026-10-24 (default lint; the a11y profile adds exactly the same ones)

| Plan | New warnings | Maps to | Verdict |
|---|---|---|---|
| 10-18 · 1 Apartment | `W_ANNOTATION_OVERLAP` ×4: "Bathroom" over the WC; the thickness figure 250 over the Laundry's "4.0 m²"; "Bedroom 1" and "Bedroom 2" over their wardrobes | A11 **hit**; A10 **partial** (the "100" in the hall prints over nothing and stays missed); 2 new | all true |
| 10-18 · 6 Clinic | `W_ANNOTATION_OVERLAP` ×1: "Staff room" over a chair | new | true |
| 10-24 · 2 House | `W_ANNOTATION_OVERLAP` ×4: "Master Bedroom" over the bed, "Ensuite" over the shower and WC, "Dressing" over the wardrobe, "Bathroom" over the bathtub | none of the 48 (NH9 is thickness text) | all true |
| 10-24 · 4 Café | `W_ANNOTATION_OVERLAP` ×1: "Staff WC" over the basin | new | true |
| 10-24 · 5 Townhouse | `W_ANNOTATION_OVERLAP` ×2: "Stair" over the stair, both levels | new | true |
| the other five | none | — | — |

Results:
- **The 57:** 17 → **19 caught, 7 of them partial** (15.5 counting halves). By severity: B 1/4 · N 12/26 · m 4/27 → 6/27.
- **The 48:** still 1 (NC6). The row-5 codes catch none of the 48, because their class-8 rows (NA6, NH9, NS5, NC9, NT9, NK7) are thickness call-outs on room floors. That is `W_DIM_INSIDE` territory, which PS2.12 declined (PS2.39).
- **New true findings outside both audits:** 10. All are minor class 8, and the audits missed them.
- **False positives:** 0.

`W_DIM_TEXT_MISMATCH` and `W_TITLE_OVERFLOW` give 0 on all twelve plans: every dimension there is
`dims auto`, and every title row fits.

### Taste, as data (`score --taste generic --json`)

10-18, 10-24 and 10-25 are the plans of each brief. Criteria are 0–1; `n/a` means not assessable;
weight is the assessable criteria weight out of the total. Warnings are validity warnings and
drafting warnings; a validity warning caps the score at 0.5.

| Plan | Run | score | uncapped | capped | weight | warnings | R3 | R6 | R7 | R9 | R11 | R12 | R14 | R15 | R16 | R17 | R18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Apartment | 10-18 | 0.5 | 0.93 | yes | 11/11 | 4 / 4 | 0.5 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.75 | 0.83 | 1 |
| Apartment | 10-24 | 0.67 | 0.67 | no | 10/11 | 0 / 0 | 1 | 0.5 | 1 | 1 | n/a | 1 | 1 | 0 | 0 | 0.5 | 1 |
| Apartment | 10-25 | 0.8 | 0.8 | no | 10/11 | 0 / 0 | 1 | 0.71 | 1 | 1 | n/a | 1 | 1 | 1 | 0 | 0.3 | 1 |
| House | 10-18 | 0.5 | 0.96 | yes | 11/11 | 3 / 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0.62 | 1 | 1 |
| House | 10-24 | 0.9 | 0.9 | no | 11/11 | 0 / 4 | 1 | 1 | 1 | 0.92 | 1 | 1 | 0.88 | 1 | 0.17 | 1 | 1 |
| House | 10-25 | 0.87 | 0.87 | no | 11/11 | 0 / 0 | 1 | 1 | 1 | 1 | 0 | 1 | 1 | 1 | 0.33 | 1 | 1 |
| Studio | 10-18 | 0.5 | 0.95 | yes | 9/11 | 2 / 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | n/a | 0.5 | n/a | 1 |
| Studio | 10-24 | 0.79 | 0.79 | no | 7/11 | 0 / 0 | n/a | 0.43 | 1 | 1 | n/a | 1 | 0.5 | n/a | 1 | n/a | 1 |
| Studio | 10-25 | 0.81 | 0.81 | no | 7/11 | 0 / 0 | n/a | 0.5 | 1 | 1 | n/a | 1 | 0.5 | n/a | 1 | n/a | 1 |
| Café | 10-18 | 0.5 | 0.86 | yes | 6/11 | 16 / 0 | n/a | n/a | 1 | 1 | n/a | n/a | 1 | n/a | 0.25 | 0.83 | 1 |
| Café | 10-24 | 0.5 | 0.78 | yes | 9/11 | 1 / 1 | n/a | 1 | 1 | 1 | 0 | 1 | 1 | n/a | 1 | 0.7 | 1 |
| Café | 10-25 | 0.93 | 0.93 | no | 6/11 | 0 / 0 | n/a | n/a | 1 | 1 | n/a | n/a | 1 | n/a | 0.75 | 0.7 | 1 |
| Townhouse | 10-18 | 0.5 | 0.99 | yes | 8/11 | 4 / 0 | n/a | 1 | 0.92 | 0.99 | 1 | 1 | 1 | n/a | 1 | n/a | 0.95 |
| Townhouse | 10-24 | 0.9 | 0.9 | no | 9/11 | 0 / 2 | n/a | 1 | 1 | 1 | 1 | 1 | 1 | n/a | 0.5 | 0.25 | 1 |
| Townhouse | 10-25 | 0.93 | 0.93 | no | 8/11 | 0 / 0 | n/a | 1 | 1 | 0.83 | 1 | 1 | 1 | n/a | 0.5 | n/a | 1 |
| Clinic | 10-18 | 0.5 | 0.72 | yes | 4/11 | 10 / 1 | n/a | n/a | 1 | 1 | n/a | n/a | n/a | n/a | 0.33 | 0.67 | n/a |
| Clinic | 10-24 | 0.67 | 0.67 | no | 4/11 | 0 / 0 | n/a | n/a | 1 | 1 | n/a | n/a | n/a | n/a | 0 | 1 | n/a |
| Clinic | 10-25 | 0.72 | 0.72 | no | 4/11 | 0 / 0 | n/a | n/a | 1 | 1 | n/a | n/a | n/a | n/a | 0.33 | 0.67 | n/a |

**What moved from each brief's 10-18 plan to its 10-24 plan:**
- All six 10-18 plans are capped at 0.5 by the validity warnings Part 1 counts.
- Apartment: R3 0.5 → 1; R6 1 → 0.5 (a sink in a room typed `living`, NA1); R11 1 → n/a; R15 1 → 0 (NA5); R16 0.75 → 0; R17 0.83 → 0.5.
- House: R9 1 → 0.92; R14 1 → 0.88; R16 0.62 → 0.17.
- Studio: R6 1 → 0.43 (NS1); R14 1 → 0.5; R16 0.5 → 1; R3 and R11 → n/a (weight 9 → 7).
- Café:
  - R6, R11 and R12 become assessable (weight 6 → 9). R11 is 0: the kitchen reaches the seating through the servery.
  - R16 0.25 → 1; R17 0.83 → 0.7.
  - Still capped, by NC6.
- Townhouse: R7, R9 and R18 → 1; R16 1 → 0.5; R17 n/a → 0.25.
- Clinic: R16 0.33 → 0; R17 0.67 → 1.

**Taste's reach on the audited defects.**
- **On the 57: 0.** No criterion below 1 on a 10-18 plan names an audited defect (R3's apartment message is about door depth from the entrance, R7's townhouse message about kitchen glazing).
- **On the 48: 3**, plus one partial:
  - R6 sees NA1 and NS1, the kitchens hidden by `uses living`. Lint misses these.
  - R15 sees NA5.
  - The café's coverage lists the untyped servery as `unclassified`, which is NC1 surfaced as a coverage gap: partial.
- **Most frequent below-1 criteria:** R16 (corner doors) and R17 (axis economy). No audit judged either, so they are neither caught nor false.
- **R11 = 0 on the 10-24 café** applies a dwelling criterion to a café (kitchen → servery → seating is the right order there). It is a building-type false positive, as PS2.37 is for `W_WET_ROOM_DOOR`.

---

## Part 2 · The six briefs, cold-authored on today's spec

### The loop each author ran

CLI calls are counted from the transcripts as compile / lint / describe / validate / score. "First
lint" is the first lint after the plan first compiled.

| Plan | Form | CLI calls (c / l / d / v / s) | First lint | Final lint | Taste (final) | Defects B / N / m |
|---|---|---|---|---|---|---|
| 1 Apartment | rooms-first, relational rooms | 4 / 5 / 0 / 0 / 0 | 4: `W_FURNITURE_OVERLAP`, `W_SWING_OBSTRUCTED`, `W_DOORWAY_BLOCKED`, `W_PATH_TOO_NARROW` (then `W_DRAWING_OVERFLOW` from compile) | 0 | 0.80 | 8 (0 / 4 / 4) |
| 2 House | rooms-first, three `strip`s | 7 / 8 / 0 / 0 / 0 | 5: `W_SWING_OBSTRUCTED`, `W_DOORWAY_BLOCKED`, `W_PATH_TOO_NARROW`, `W_ROOM_MISSING_DEFINING`, `W_ANNOTATION_OVERLAP` | 0 | 0.87 | 11 (0 / 5 / 6) |
| 3 Studio | rooms-first | 5 / 5 / 0 / 0 / 0 | 7: `W_FURNITURE_OVERLAP` ×2, `W_FURN_CLEARANCE`, `W_SWING_OBSTRUCTED` ×2, `W_DOORWAY_BLOCKED` ×2 | 0 | 0.81 | 7 (0 / 3 / 4) |
| 4 Café | rooms-first | 2 / 3 / 0 / 0 / 0 | 19: `W_SEAT_FACING_AWAY` ×18, `W_FURNITURE_OVERLAP` | 0 | 0.93 | 8 (0 / 2 / 6) |
| 5 Townhouse | rooms-first, one `walls from rooms` per level | 6 / 5 / 0 / 0 / 0 | 9: `W_SWING_OBSTRUCTED` ×4, `W_ANNOTATION_OVERLAP` ×3, `W_FURNITURE_OVERLAP`, `W_DOORWAY_BLOCKED` | 0 | 0.93 | 8 (0 / 5 / 3) |
| 6 Clinic | rooms-first | 3 / 5 / 0 / 0 / 0 | 3: `W_SWING_OBSTRUCTED`, `W_DOORWAY_BLOCKED`, `W_ANNOTATION_OVERLAP` | 0 | 0.72 | 7 (0 / 4 / 3) |
| **Total** | 6 / 6 rooms-first | 27 / 31 / **0 / 0 / 0** | 47 | 0 | 0.72 – 0.93 | **49 (0 / 23 / 26)** |

`validate --json` on the six final plans returns `next: null`: they are clean, so there is nothing
to point at.

**Authoring friction** (compile errors the authors hit, from their reports):
- `E_OPENING_DATUM`: a bare `at <mm>` on a hosted opening needs `from start` (house, studio, townhouse).
- `E_FURN_SIZE`: `in <room> anchor` needs a `size` even where `against` would not (studio, townhouse, clinic).
- `E_PARSE` on `label "…" at` inside a `strip` (house).
- `E_OPENING_NIB` and `E_OPENING_NO_SHARED_WALL` (house).
- The café could not say which of two exterior doors is the main entrance. `describe` reports a tie, and lint's circulation and privacy checks skip it as `no-main-entrance`.

### Verified defects

Severity and class follow the baseline audits. Every Lint cell is the final plan's default lint:
none of the 49 is reported.

**1 · Apartment** (`size` 9800 × 7200 plus a 9800 × 1400 corridor; flat 70.6 m² centreline)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| RA1 | The common corridor is modelled as a room of the flat, walled on three sides, with no exterior door. The balcony door becomes the flat's only entrance, so every entrance-measured rule and taste's R3 read from the balcony (A9's pattern) | `corr` `uses circulation`, x 5200–15000, y 7200–8600; `describe` `access.entrances` = `["door_6"]` (balcony slider) | N | **new** (context) | MISSED |
| RA2 | The kitchen has no fridge and one 600 mm worktop, and is typed `uses living` only | sink, stove, 600 counter on `living.bottom` | N | 4 | MISSED (typing; taste R6 0.71 sees it) |
| RA3 | The sofa is a transposed footprint: drawn one seat wide and 2 m deep, facing south along the TV unit, not at it | `sofa … size 900x2000`, no rotate, x 600–1500; TV x 100–500 | N | **new** (transposed) | MISSED |
| RA4 | Both double beds are flush in a corner with one long side across a window | bed 1 x 8100–9700, face 9700, `window_3` y 1050–2550; bed 2 the same against `window_4` | N | 5 | MISSED |
| RA5 | The sofa is about 250 mm from the dining table's end chair | sofa east face 1500; `dining_table` 1700–3500 with its drawn end chair | m | 5 | MISSED |
| RA6 | The front door's open leaf parks about 150 mm in front of the bathroom doorway, over about 200 mm of it | `door_1` hinged at the west jamb, leaf y 6200–7200; bath door y 5600–6400 on x 5200 | m | **new** (door–door) | MISSED |
| RA7 | Wall-thickness text inside rooms | "100" in the hall, "200" in bedroom 1 | m | 8 | MISSED |
| RA8 | "~70 m²" is met only on centrelines | flat 70.6 centreline; GIA 9600 × 7000 = 67.2 | m | **new** (area basis) | n/a |

**2 · House** (13000 × 9000, 117 m² centreline with a 14.4 m² garage)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| RH1 | The sofa faces the hall with its back to the TV (NH2 again) | `sofa` y 2400–3300, no rotate; `tv_unit` y 150–650 | N | **new** (relation) | MISSED |
| RH2 | There is no continuous worktop. The hob is flush in the north-west corner, a single 600 counter stands mid-wall, and the sink is in the far corner | stove x 8850–9450 (wall face 8850); counter 10600–11200; sink 12050–12850 | N | 4 / 5 | MISSED (presence only) |
| RH3 | The fridge stands wholly in front of the east kitchen window | fridge y 1700–2400 on x 12850; `window_3` y 1400–2600 | N | 5 | MISSED |
| RH4 | The master wardrobe front is 250 mm from the bed side | wardrobe x 4750–5350 facing west; bed x 2700–4500 | N | 5 | MISSED |
| RH5 | The garage is too short for a car | internal about 3425 × 3825 | N | **new** (advisory size) | n/a |
| RH6 | The kitchen/dining table has no chairs | `table` 1800 × 1000 | m | 4 | MISSED |
| RH7 | All three bed heads stand across the bedroom windows | e.g. bed 2 x 6150–7650 against `window_7` x 6150–7650 | m | 5 | MISSED |
| RH8 | The bathroom basin front is 400 mm from the bathtub | basin x 11250–11750; tub from x 12150 | m | 5 | MISSED |
| RH9 | Three rooms print no name: the garage, living room and utility have no `label`, so only their areas print | `room id=garage size 3600 uses garage` (also `living`, `utility`) | m | 8 | MISSED |
| RH10 | Wall-thickness text inside rooms | "300" and "100" in the living room | m | 8 | MISSED |
| RH11 | "~110 m²" is missed on the habitable floor (as H8 and NH10) | 117.0 − 14.4 = 102.6 m² centreline | m | **new** (area basis) | n/a |

**3 · Studio** (6000 × 5000, 30 m² centreline)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| RS1 | There is no sleeping alcove. The double bed is flush in a corner, its long side across a window (NS3 again) | bed x 4300–5900, face 5900; `window_2` y 3050–4550 | N | 5 / brief | MISSED |
| RS2 | The kitchenette has no worktop and is typed `uses living` only. The author deleted the `counter` to clear `W_FURNITURE_OVERLAP` (sink on counter) | fridge, sink, stove on `main.top`; `sed '/counter in main/d'` in the transcript | N | 4 | MISSED (typing; taste R6 0.5 sees it) |
| RS3 | The hob is flush against the side wall and runs 150 mm into the side window's span | stove x 5300–5900, y 100–700; `window_1` y 550–2050 | m | 5 | MISSED |
| RS4 | The L-sofa is a transposed, undersized footprint (catalogue 2600 × 1600). It faces the bed 300 mm away, with its back to the kitchen | `sofa_l … size 900x1300`, no rotate, y 1300–2600; bed from y 2900 | N | **new** (transposed) | MISSED |
| RS5 | The entrance takes 16.7 % of the flat (S6 counted 15 %) | entry 2000 × 2500 = 5.0 m² | m | **new** (space efficiency) | n/a |
| RS6 | Wall-thickness text inside the studio | "100", "200" | m | 8 | MISSED |
| RS7 | "30 m²" is met only on centrelines | GIA 5800 × 4800 = 27.8 | m | **new** (area basis) | n/a |

**4 · Café** (12000 × 7500, 90 m²; 24 seats at six 4-tops)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| RC1 | The bar counter has no service side: it backs onto the kitchen partition with its stools toward the wall. The kitchen opens to the seating through a doorless 800 mm opening beside it (NC2 again) | `bar_counter` x 6850–7450, y 5700–7400; `opening between dining and kitchen` y 4800–5600 | N | **new** (counter zoning) | MISSED |
| RC2 | Accessible WC: no grab-rail wall, the basin is out of reach from the pan, and the door swings in (NC4 again) | pan centreline x 8500, 950 mm to both side faces; basin y 1200–1800 on the west wall; `swing into wc_acc` | N | 5 (accessible) | MISSED |
| RC3 | The kitchen has no wash-hand basin | sink, stove, fridge, 1400 counter | m | 4 | MISSED |
| RC4 | The hob sits wholly under the kitchen window, and the fridge runs 100 mm across it | stove y 6000–6600, fridge y 4900–5500; `window_6` y 5400–6600 | m | 5 | MISSED |
| RC5 | Customers reach the accessible WC through the back passage, past the kitchen and store doors | `door between dining and hall`; `hall` serves `kitchen`, `store`, `wc_staff`, `wc_acc` | m | **new** (zoning) | n/a |
| RC6 | Chairs stand back to back 500 mm apart between tables (600 mm between rows) | east chair x 2050–2450, next west chair x 2950–3350 | m | 5 | MISSED |
| RC7 | The "entrance on the corner" is a door 600 mm from the corner (NC7 again) | `door on dining.bottom at 1200 from start` | m | **new** (brief) | n/a |
| RC8 | Wall-thickness text inside rooms | "200" in the seating, "100" in the passage | m | 8 | MISSED |

**5 · Townhouse** (two `level`s; ground 5500 × 10000, first 5600 × 10000)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| RT1 | The stair foot leaves 450 mm to the living-room partition ahead; the hall opens only to its side | `st` y 200–2500 `dir up`, foot at y 2500; partition face 2950 | N | 7 | MISSED |
| RT2 | The stair head arrives 100 mm from the north exterior wall, under the window; the way out is a turn onto the landing | head at y 200; wall face 100; `open between landing and stair1` | N | 7 | MISSED |
| RT3 | The first floor is 100 mm wider than the ground floor, so its east wall does not stand on the one below. `grid 100` silently snapped `size 2750x7000` to 2800 | L1 `bed1`/`bed2` width 2800 each (Plan JSON), `total_area` 55.7; L0 5500 | N | **new** (stacking) | MISSED (no diagnostic) |
| RT4 | The sofa faces south, 90° away from the TV on the east wall | `sofa_l` 2200 × 900, no rotate; `tv_unit` x 4900–5400 facing west | N | **new** (relation) | MISSED |
| RT5 | The hob stands alone on the east wall, 2 m from the sink, with no worktop beside it | stove x 4800–5400, y 7950–8550; counter and sink on the south wall | N | 4 / 5 | MISSED |
| RT6 | Both double beds stand 300 mm off the head wall and 300 mm off one side wall, because the corner anchor's `inset 300` applied on both axes | bed 1 x 400–2000, y 3350–5350; wall faces 100 and 3050 | m | 5 | MISSED |
| RT7 | Room names print across wall lines. Both "Stair" labels were pinned at (4750,2900), on the stair/living partition, to clear `W_ANNOTATION_OVERLAP`; "Bathroom" is wider than its 1500 mm room | `label "Stair" at (4750,2900)` on both levels | m | 8 | MISSED |
| RT8 | Wall-thickness text inside rooms (both levels) | "100", "200" | m | 8 | MISSED |

**6 · Clinic** (12000 × 10000, 120 m²)

| # | Defect | Geometry | Sev | Class | Lint |
|---|---|---|---|---|---|
| RK1 | No consulting room has a desk, chair or basin, only a couch. The staff room has a single 600 counter. Waiting has one L-sofa for three consulting rooms (NK1 again) | furniture list | N | 4 | MISSED |
| RK2 | Accessible WC: no grab-rail wall, the basin is 1.5 m from the pan, and the door swings in (NK2 again) | pan centreline x 6250, 1200 mm to both side faces; `swing into wc` | N | 5 (accessible) | MISSED |
| RK3 | The reception desk is reversed: its counter is against the west wall and window, and the receptionist's chair faces the wall with its back to the room | `reception_desk` x 100–1000, `rotate 270` resolved; chair drawn on the room side | N | **new** (relation; K7's class) | MISSED |
| RK4 | The waiting L-sofa is a transposed footprint (catalogue 2600 × 1600), drawn as a thin L | `sofa_l … size 900x2400`, no rotate | N | **new** (transposed) | MISSED |
| RK5 | The waiting room is open to the corridor that serves the staff room and store (NK6 again) | `open between waiting and corr width 1600` | m | **new** (zoning) | n/a |
| RK6 | "Accessible WC" was cut to "Access. WC" and pinned across the WC/staff partition to clear `W_ANNOTATION_OVERLAP` | `label "Access. WC" at (6600,7000)`; partition at x 7500 | m | 8 | MISSED |
| RK7 | Wall-thickness text inside rooms | "200" in Consulting 1, "100" in the waiting room | m | 8 | MISSED |

### Then and now

| Class | 10-18 | 10-24 | 10-25 |
|---|---|---|---|
| 1 Openings ignore walls | 4 | 0 | 0 |
| 3 Circulation and privacy | 2 | 3 | 0 |
| 4 Defining contents | 5 | 8 | 7 (2 hidden by typing, 1 made by deleting a counter) |
| 5 Clearances | 11 | 14 | 13 |
| 7 Stair | 1 | 2 (both B) | 2 (both N) |
| 8 Annotation | 8 | 6 | 9 (2 made by repairing `W_ANNOTATION_OVERLAP`, 1 unlabelled rooms) |
| new: furniture relation | 9 | 3 | 3 |
| new: transposed footprint | 3 | 1 | 3 |
| new: door–door and leaf across a corridor | 2 | 2 | 1 |
| new: other (brief, context, zoning, size, stacking, area, space) | 12 (3 area) | 9 (3 area) | 11 (3 area) |
| **Total (B / N / m)** | **57 (4 / 26 / 27)** | **48 (2 / 24 / 22)** | **49 (0 / 23 / 26)** |

Repeats of 2026-10-24 findings:
- the sofa back to the TV (NH2);
- kitchens hidden by `uses living` (NA1, NS1);
- the missing alcove (NS3);
- the counter zoning (NC2);
- the accessible WCs (NC4, NK2);
- no seat in the clinic (NK1);
- the corner entrance (NC7);
- the clinic zoning (NK6);
- thickness text on every plan.

New this run:
- the corridor modelled inside the flat (RA1);
- three transposed sofas, two of them `sofa_l`, which does carry a catalogued footprint;
- a storey 100 mm wider than the one below (RT3);
- a reversed reception desk (RK3).

### Q8 again: furniture turns and door swings

- **Seats at tables.**
  - The café drew 24 chairs in a `for` loop. 18 of 24 faced away before the loop: only the north chairs, at `rotate 0`, were right. Every one was reported, and the author fixed them with `rotate`. Final: 0 / 24.
  - The apartment and townhouse used `dining_table`, whose glyph draws its own chairs. The house table has none (RH6).
  - `facing`: 0 uses.
- **Sofas.**
  - 0 / 3 face a TV: RA3 is transposed beside it, RH1 has its back to it, RT4 is turned 90° away.
  - The studio sofa faces the bed (RS4).
  - Three of five sofas are transposed footprints (RA3, RS4, RK4). The 2026-10-24 run had one (NT3).
- **Exterior doors.** 8 / 8 hinged exterior or front doors open the intended way:
  - dwellings `swing into` the hall or entry;
  - café front and back `swing outward`;
  - clinic corridor exit `swing outward`;
  - clinic main door `swing into waiting`, acceptable for its occupancy of about 13.
  - `swing in`/`out` was used 0 times, `inward`/`outward` 3 times, `swing into` 35 times. K1 did not recur.

### Row 5's yield on authoring behaviour

- **Drafting codes in the loop.**
  - `W_ANNOTATION_OVERLAP` fired in 3 / 6 loops (house up to 2, townhouse 3, clinic 1), and all were cleared.
  - The house cleared its warning honestly, by moving the bathtub.
  - The townhouse and clinic cleared theirs by moving or shortening the label onto a wall line, and the rule does not see that (RT7, RK6).
  - `W_DIM_TEXT_MISMATCH` and `W_TITLE_OVERFLOW` never fired: every author used `dims auto all`, with no `dim` statement.
- **Taste and `next`.** Neither changed behaviour, because no author ran either: 0 / 6 called `score --taste`, `validate` or `describe`. The final taste scores rose on 5 of 6 briefs over 10-24 while the defect count moved 48 → 49. Within each brief, a higher score went with fewer defects in 3 briefs (house, café, townhouse), with more in 2 (apartment, studio), and 1 is level (clinic).
- **Taste on today's 49.**
  - R6 sees RA2 and RS2.
  - R11 = 0 on the house is a misread: "Kitchen / Dining" is typed `kitchen` only, so the dining table in it does not count as "where people eat".
  - Every other criterion below 1 is R16, R17 or R9, none of them an audited defect.
  - Taste reaches 2 / 49. Design Q11 predicted "few of the 48"; measured, it is 3 / 48 plus one partial.

---

## The row-5 verdict evidence (for the lead)

- **Acceptance, as worded.** "The taste score separates the corpus's known-bad from known-good plans monotonically", measured by the concordance line. It **holds on this commit**: 41 pairs, 37 ordered, 0 tied, 0 reversed (0 ledgered), 4 unjudged (`test/taste-separation.test.ts`). The 4 unjudged pairs are not separations.
- **First contact says taste's reach is small and orthogonal to the audit.**
  - It sees 0 / 57, 3 / 48 (+1 partial) and 2 / 49 of the audited defects. All of those are the typing class (R6) or the night zone (R15).
  - Its most active criteria, R16 and R17, judge things no audit counted.
  - It misreads typing once (R11, house) and a building type once (R11, 10-24 café).
- **Lint's reach on fresh plans did not move.** The only new default code that fires on first-contact plans is `W_ANNOTATION_OVERLAP`. It is true every time, but it caught 1.5 of the 57 and 0 of the 48. In cold loops its repair pressure produced 2 new class-8 defects.
- **The surviving-defect count is flat: 48 → 49.** Blockers fell 2 → 0, but by authoring chance: both stairs have an open side this time. No row-5 rule touches a stair.

## Candidate cards (not added to `../README.md`)

New evidence for existing cards:
- **PS2.30:** RA2, RS2 (2 / 6 kitchens typed `living` again). RS2 adds a laundering route: deleting the worktop to clear `W_FURNITURE_OVERLAP`.
- **PS2.31:** RH6, RK1.
- **PS2.32:** RS4 (a sofa facing a bed).
- **PS2.34:** RT1, RT2.
- **PS2.36 / PS2.16:** RC2, RK2, RC5, RK5.
- **PS2.11** `W_FURNITURE_OVER_WINDOW` (RH3, RC4, RS3), `W_WARDROBE_FRONT_CLEARANCE` (RH4), `W_LEAF_ACROSS_DOORWAY` (RA6), `W_FOOTPRINT_TRANSPOSED` (RA3, RS4, RK4).
- **PS3.11:** RA3, sofa. RS4 and RK4 are `sofa_l`, which does have a footprint, so `W_FOOTPRINT_TRANSPOSED` alone would see them.
- **PS2.39:** thickness text on 6 / 6 plans again.

New:
- **PS2.41 · A room label across a wall or outside its floor.**
  - *Intent:* `W_ANNOTATION_OVERLAP` sees a label over a symbol but not a label over a wall line, or one wider than its room. Authors now clear the warning by pinning the label onto a wall.
  - *Acceptance:* the 2026-10-25 townhouse ("Stair" both levels, "Bathroom" L1) and clinic ("Access. WC") warn, and so do the 2026-10-24 house's "Bathroom" and "Entrance Hall". The corpus clean twins stay silent.
- **PS2.42 · The front door opens onto a modelled room with no way out.**
  - *Intent:* a plan whose only exterior opening is a balcony or patio door, while a circulation room holds the hinged front door and has no exterior opening, is a dwelling with its context drawn inside. Warn, or read the corridor as the entrance side (PS2.14's dwelling context).
  - *Acceptance:* the 2026-10-25 apartment warns (today `access.entrances` = the balcony slider); the 2026-10-24 apartment is silent.
- **PS0.20 · Grid snapping of a declared size is silent.**
  - *Intent:* `grid 100` turns `size 2750x7000` into 2800 with no diagnostic, so a storey grows 100 mm (RT3). Report the snap (a `W_` with the snapped value, or a `describe` note), and check that adjacent storeys' exterior rings coincide.
  - *Acceptance:* a two-room `grid 100` plan of `2750` rooms reports the snap. The 2026-10-25 townhouse reports the 100 mm overhang.
- **PS2.43 · A counter or desk with its service side against a wall.**
  - *Intent:* a `reception_desk` or `bar_counter` whose staff side or customer side meets a wall face within 600 mm (RK3, RC1; K7, NC2). A sibling of PS2.32.
  - *Acceptance:* the 2026-10-25 clinic and café warn; their furniture turned 180° does not.
- **PS5.5 · R11 reads a dining table, not only a `uses` word.**
  - *Intent:* a kitchen holding a dining table is "where people eat", so R11 should score the 2026-10-25 house 1, not 0. Also gate R11 off non-residential plans, as the dwelling reading gates lint.
  - *Acceptance:* the 2026-10-25 house R11 = 1, the 2026-10-24 café R11 = n/a, and the concordance line is unchanged.
- **PS7.4 · Teach the taste step where cold authors read.**
  - *Intent:* 0 / 6 authors ran `score --taste` or `validate`. The `arch-author` role's loop (compile → describe → lint) predates the SKILL's step 7, and `spec.llm.md` names the step only in a CLI-list comment. Align the role text and the spec's loop paragraph with the SKILL, or decide that taste is a reviewer's tool, not an author's.
  - *Acceptance:* the next first-contact re-measure, on the same protocol, counts the calls.

Gaming and laundering observed:
- RS2: a deleted worktop.
- RT7, RK6: labels moved onto walls, and one abbreviated.
- The townhouse author swung the WC, bathroom and both bedroom doors outward onto the hall and landing to clear `W_SWING_OBSTRUCTED`. This is not counted as a defect, but it is repair pressure.
- No author relabelled a room to circulation to move R16, and none dropped a `uses`: no author ran taste.

## Corpus, concordance, tiling probe (same commit)

- **Defect corpus.** 53 / 72:
  - openings-ignore-walls 16/16, space-not-enclosed 6/6, circulation-privacy 11/12, missing-defining-contents 5/5, daylight 4/4;
  - clearances 5/18, stair-safety 0/4, annotation-collisions 6/7.
- **Concordance.** As in the verdict above.
- **`npx vitest run test/rooms-tiling-probe.test.ts`.** Passes, 27/27, with no re-pin. `first-contact-plans/` is an `INFO_DIRS` root (`scripts/probe-rooms-tiling.ts`), probed for information and never pinned, so the six new plans move no pinned count.
- **The four tests that read `first-contact-plans/`.** `lint-dwelling-reading`, `main-entrance`, `room-too-small-by-use` and `swing-building` all pass (120/120).

## Files

- `first-contact-plans/2026-10-25-rerun/<n>-<brief>.arch`: the six final plans as the cold authors left them.
- The lint, taste, validate, describe and Plan JSON outputs, the renders, the transcripts' call counts and the scripts were kept outside the repository.
