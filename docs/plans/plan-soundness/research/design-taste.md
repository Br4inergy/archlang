> Research record, 2026-10-18, made against `main@98bd30b` (v1.43.1). Copied from the
> session's scratch: machine-local paths are replaced by `<scratch>/`, and closed-source
> and marketing material is removed. Read observations as evidence and diagnoses as
> hypotheses (the `docs/backlog.md` rule): re-measure before you build on a number.
> Programme entry: `../README.md`.

# ArchLang design-taste layer: research and rule catalogue

Date: 2026-10-18. Scope: research only. No repo was edited. Scratch: `<scratch>/taste\`.

Verification legend: **[V]** I read the source text myself (URL or file given). **[S]** confirmed only through secondary sources. **[M]** from memory of the standard; check before quoting it in a diagnostic.

---

## 0. Findings that change the plan

1. **A flagship example passes lint with a bad circulation layout.** `examples/two-bed.arch:1` calls itself "A two-bedroom apartment with a central corridor". Its access graph (`describe --json`) is a single chain: `exterior → Hall → Bathroom → Master Bedroom → Kitchen/Living → Bedroom 2`, and the doors are at `examples/two-bed.arch:21-25`. That means you walk through the bathroom and then the master bedroom to reach the living room. `arch lint examples/two-bed.arch --json` returns `[]`. `W_BATH_VIA_BEDROOM` (`src/error-catalog.ts:936`, `src/lint/rules/reachability.ts:44-58`) only checks one direction: it asks whether a *bath* is reached through a bedroom, never whether other rooms are reached through a bath or a bedroom. This is the single most important gap. Rule R1 below closes it.
2. **The taste layer depends on `uses`, and the label classifier never emits `living`/`dining`.** `classifyLabelUses` deliberately leaves living/dining out (`src/vocabulary.ts:212-216`), so `"Kitchen / Living"` classifies as `['kitchen']` while `studio.arch`'s authored `uses` gives `['living','kitchen']`. Any rule keyed on living/dining is blind on label-only plans. The taste report needs a coverage gate: it reports unclassified rooms first, and those criteria score as "not assessable" rather than as passing.
3. **ADR 0005 already allows this.** The core may compute facts and "honestly named, caveated *advisory*" checks, and may not claim compliance (`docs/adr/0005-no-invisible-architect.md:45-61`). It forbids profile names that sound like a code (`src/lint/ruleset.ts:113-118`: "Deliberately NOT named after a standard"). Profile names therefore have to be `cn-residential-advisory`, `uk-residential-advisory` and `us-residential-advisory`, not `gb50096` or `irc`. The source of each threshold goes in the rule's documentation.
4. **Keep taste out of `lint()`.** Each new lint code changes `lint()` over the example corpus (two-bed would start warning), and every new language form needs its byte-identity law. A separate `taste()` / `arch score --taste <profile>` channel lets the quality meter evolve without moving the `lint()` goldens. Only the few rules that are plainly *defects* (R1, R2, R5) graduate to `W_*`.

---

## 1. What ArchLang already covers (avoid duplicates)

| Existing | Where | Covers | Gap the taste layer fills |
|---|---|---|---|
| `W_BATH_VIA_BEDROOM` | `src/error-catalog.ts:936`, `src/analyze.ts:545` (`wetRoomsOnlyViaBedroom`) | a bath reached only through a bedroom | the general case: any room reached only through a private room (R1) |
| `W_ROOM_UNREACHABLE` / `W_ROOM_DISCONNECTED` / `W_NO_ENTRANCE` | catalog :884, :908 | reachability | — |
| `W_BEDROOM_NO_WINDOW` | :894, `src/lint/rules/per-room.ts:118` | a bedroom with zero windows | living/kitchen daylight, window-to-floor ratio (R7), two-sided light (Q-score) |
| `W_ROOM_NOT_EQUATOR_FACING` | :1104, `src/lint/rules/site.ts:82` | a habitable room with no equator-facing window (needs `site`) | sleeping to the east, dwelling-level aspect (R12, R13) |
| `W_ROOM_TOO_SMALL` | :929, default 4 m² (`src/lint/ruleset.ts:98`) | one generic area floor | per-use and per-profile area and width (R4) |
| `W_GARAGE_TOO_NARROW` | :1111 | garage short side | the same idea for bedrooms and kitchens (R4, R9) |
| `W_DOOR_CLEARANCE` (700 mm), `W_PATH_TOO_NARROW`, `W_CIRCUITOUS_PATH` (3×) | :901, :1034, :1041; thresholds `src/lint/ruleset.ts:96-108` | passable width, detour | per-destination corridor widths (CN 1.2/1.0/0.9 m) (R8) |
| `W_DOOR_NEAR_CORNER` | :1020 | jamb nib < wall thickness (too close) | the opposite taste: a door mid-wall in a small room (R16, Alexander 196) |
| `W_SWING_OBSTRUCTED`, `W_DOORWAY_BLOCKED`, `W_FURN_CLEARANCE`, `W_ROOM_NO_CLEAR_PATH` | :950, :1006, :985, :1027 | swings, landings, front clearance | profile clearances: the wc front clearance is 450 mm (`src/fixtures-catalog.ts:162`) against IRC 533 / NKBA 762 (R10) |
| `W_FIXTURE_BACK_TO_ROOM`, `W_FIXTURE_FLOATING`, `W_FIXTURE_WRONG_ROOM` | :978, :971, :992 | orientation and geometric containment | **use** mismatch, such as a bed in a kitchen or a sofa in a bath (R6) |
| `W_ROOM_NO_FIXTURE` | :957 | a wet room or kitchen with no fixture | a bedroom with no bed, a living room with no seating (R21) |
| `W_ROOM_NOT_ENCLOSED` | :943 | a wet room missing a partition | — |
| Room label relocation | `src/label-placement.ts:18-27` | relocates a label that collides with furniture or dims | a residual-collision fact (R30) |
| Space syntax facts | `src/analyze/syntax.ts:1-45` (`describe --facts syntax`) | depth, MD, RA, RRA, integration, control, cycle rank | rules on top of them (R3, R14, R15) |
| Symmetry facts | `src/analyze/symmetry.ts:900` (`--facts symmetry`) | D4 groups, repeats | facade rhythm and symmetry scores (R27) |
| `arch score --brief` | `src/cli/commands-analyze.ts:660-690` | intent satisfaction in [0,1] | a **taste** score is a second meter with the same shape |
| Positioning axes | `src/axes.ts:11-16` | author-declared grid, never derived | wall-axis economy and near-miss alignment (R5, R17) |

Nothing in `src/` measures: privacy ordering, wet-room door targets, near-miss alignment, aspect ratio, kitchen work triangle, dwelling aspect or cross-ventilation, wet-stack over habitable rooms, furniture-use match, or facade rhythm.

---

## 2. Codified planning knowledge, turned into computable criteria

### 2.1 Christopher Alexander, *A Pattern Language* (1977) [V]
Pattern texts were read from urbigenous.net (`https://urbigenous.net/a-pattern-language/pattern-NNN.html`, saved in `taste/papers/apl/`).

| # | Pattern (resolution, quoted) | Computable test over ArchLang facts |
|---|---|---|
| 127 | Intimacy Gradient: "a sequence which begins with the entrance and the most public parts … finally to the most private domains" | Privacy rank per use (entry/hall 0 < living/dining/kitchen 1 < office 2 < bedroom/bath 3). Count inversions between public and bedroom pairs in `access.rooms[].depthFromEntrance` (tie-break with `circulation.rooms[].walkDistanceMm`). Score = 1 − inversions/pairs. |
| 129 | Common Areas at the Heart: "at the center of gravity … paths … lie tangent to it" | Living/dining integration rank from `syntax.rooms[].rra`: it should be in the most-integrated third. |
| 130/112 | Entrance Room / Entrance Transition | The exterior door's room has use entry/hall/living, never bedroom/bath (ResPlan: 99.7 % of front doors open into living/hall, 0.2 % into a kitchen). |
| 131/132 | Flow through Rooms ("private rooms open directly off these public rooms") / Short Passages | Corridor share = Σ area of hall/circulation ÷ net area. Score it, and flag a passage whose length exceeds about 4× its width with no window (advice). |
| 136 | Couple's Realm: "distinctly separate realm" | Master bedroom (the largest bedroom) has no door straight onto living/kitchen, or sits deeper than every other bedroom (advice). |
| 138 | Sleeping to the East | With `site`: a bedroom with an E or SE window, or E/W/S in the southern hemisphere (advice, taste). |
| 139 | Farmhouse Kitchen | The kitchen has a connector to living/dining (ResPlan: 99 % touch living, 79 % open to it). |
| 159 | Light on Two Sides of Every Room | Number of distinct `windows[].facing` per habitable room ≥ 2. A score, not a rule: in ResPlan only 18 % of bedrooms, 41 % of living rooms and 19 % of kitchens have windows on two sides. |
| 180 | Window Place | A habitable room with ≥ 1 window whose width ≥ 1200 mm or that faces a seat (advice). |
| 191 | Shape of Indoor Space: "a rough rectangle … near right angles" | Rectangularity = area ÷ minimum-rotated-rectangle area ≥ 0.9; interior angles within 90° ± 5°. |
| 196 | Corner Doors: "put the doors as near the corners of the room as possible. If the room has two doors … keep both doors at one end" | Room < 15 m²: the jamb nib to the nearest corner ≤ max(wall thickness, 600 mm), together with `W_DOOR_NEAR_CORNER`'s lower bound. Two doors: both in the same third of the long side. |

### 2.2 Francis D.K. Ching, *Architecture: Form, Space, and Order* (4th ed., Wiley 2014) [M; standard text]
Ordering principles (ch. 7): **axis, symmetry, hierarchy, datum, rhythm/repetition, transformation**. Circulation (ch. 5): approach, entrance, path configuration, and the path–space relation (**pass by / pass through / terminate in**). Ways to compute them:
- *Datum and alignment*: count the distinct wall axes, and count near-miss alignments (two parallel edges offset by 0 < Δ ≤ τ).
- *Hierarchy*: the living room is the largest habitable room. `area(living) ≥ max(area(bedroom))` (advice).
- *Pass-through vs pass-by*: a path between two public rooms should not *pass through* a private room (R1). ResPlan shows this nearly never happens.
- *Rhythm*: on each facade, the coefficient of variation (CV) of window centre spacing and the number of distinct window widths.
- *Symmetry*: already in `symmetryFacts`. Use it as a score bonus, never as a rule.

### 2.3 UK: Nationally Described Space Standard (2015) [V]
`https://www.gov.uk/government/publications/technical-housing-standards-nationally-described-space-standard/technical-housing-standards-nationally-described-space-standard` §10:
- (c) single bedroom ≥ 7.5 m² and ≥ 2.15 m wide. (d) double/twin ≥ 11.5 m². (e) one double ≥ 2.75 m wide, every other double ≥ 2.55 m.
- Table 1 (1 storey): GIA / built-in storage = 1b2p 50/1.5, 2b3p 61/2.0, 2b4p 70/2.0, 3b5p 86/2.5 m².
- (i) floor-to-ceiling ≥ 2.3 m for ≥ 75 % of GIA. ArchLang heights draw nothing (AGENTS.md), so this is a height fact only.

London Plan Housing Design Standards LPG (2023) C4.1: "new homes should be dual aspect unless exceptional circumstances…" [S] (`https://www.london.gov.uk/programmes-strategies/planning/implementing-london-plan/london-plan-guidance/housing-design-standards-lpg`, PDF copy `https://wandsworth.gov.uk/media/large/Glassmills/CD5/CD5.28_GLA_LPG_Housing_Design_Standards_(2023).pdf`). London Plan Policy D6: "normally avoid the provision of single aspect dwellings". Single-aspect **north-facing** units are rejected at borough level (Lewisham, Camden) [S].

### 2.4 China: GB 50096-2011 住宅设计规范, now alongside GB 55038-2025 住宅项目规范
Verified clauses [V] come from the Guangzhou excerpt `https://www.gz.gov.cn/attachment/7/7475/7475554/8559179.doc` (text extracted to `taste/papers/gz-gb50096-excerpt.txt`):
- 卧室: 双人 ≥ 9 m², 单人 ≥ 5 m², 兼起居 ≥ 12 m². 起居室（厅）≥ 10 m². 套型 ≥ 30 m² (≥ 22 m² for the minimum 兼起居 type).
- **5.4.4 (强条)**: 卫生间不应直接布置在下层住户的卧室、起居室（厅）、厨房和餐厅的上层. A news report confirms this is a mandatory clause enforced in court: `https://paper.people.com.cn/rmrb/html/2024-09/12/nw.D110000renmrb_20240912_4-19.htm`.
- **5.7.1**: 套内入口过道净宽 ≥ 1.20 m (宜); 通往卧室、起居室 ≥ 1.00 m; 通往厨房、卫生间、贮藏室 ≥ 0.90 m.
- The mandatory-clause list (gongbiaoku TOC `https://www.gongbiaoku.com/mobile/book/7qt18074dbf`) includes 5.4.4, 7.1.5, 7.2.1 and 7.2.3.

From memory [M]; check before shipping:
- 5.2.3: 减少直接开向起居厅的门的数量; 起居室布置家具的墙面直线长度宜 > 3 m.
- 5.3.1: 厨房 ≥ 4.0 m² (3.5 for 兼起居 type). 5.3.2: 厨房宜布置在套内近入口处. 5.3.5: 单排净宽 ≥ 1.50 m; 双排两排间净距 ≥ 0.90 m.
- 5.4.3: 无前室的卫生间的门不应直接开向厨房.
- Table 5.8.7 door openings: 户门 1.00 (the 1.00 change is [S]), 起居/卧室 0.90, 厨房 0.80, 卫生间 0.70, 阳台 0.70.
- 7.1.3/7.1.5: 卧室、起居室、厨房应有直接天然采光; 窗地面积比 ≥ 1/7.
- 7.2.1/7.2.4: 自然通风; openable ≥ 1/20 floor (kitchen 1/10 and ≥ 0.60 m²).

Industry zoning rules that are not code text but are taught everywhere: **动静分区** (living/kitchen vs bedrooms), **洁污分区** (kitchen/bath vs living/bedroom), **公私分区** (= Alexander 127), **南北通透** (windows on both N and S facades with an open public-room path between them).

GB 55038-2025 replaced GB 50368-2005 from 2025-05-01 [S] (`https://www.news.cn/house/20250401/5701ed566ec14e68af711d504c930882/c.html`). I did not obtain its room-level clause text. Treat the GB 50096 numbers as the design-standard layer.

### 2.5 US: IRC 2021 and NKBA
- IRC R304: habitable rooms ≥ 70 sq ft (6.5 m²), ≥ 7 ft (2134 mm) in any horizontal dimension, kitchens exempt [S, forum quote of the 2012 text].
- R303.1: glazing ≥ 8 % of floor area, openable ≥ 4 % [S] (`https://cityofboise.org/media/3923/433-irc-code-section-r303-light-ventilation.pdf`).
- P2705.1: water closet centreline ≥ 15 in (381 mm) to a side wall, ≥ 30 in between fixture centres. R307.1: 21 in (533 mm) clear in front [S].
- R310 emergency escape opening in every sleeping room, and R311.6 hallway ≥ 3 ft (914 mm) [M].
- **NKBA Kitchen Planning Guidelines** [V] (PDF `https://kb.nkba.org/uploads/2022/05/Kitchen-Planning-Guidelines.pdf`, text in `taste/papers/nkba-k.txt`):
  - G1: doorway clear opening ≥ 32 in (813 mm).
  - G3: work triangle total ≤ 26 ft (7.9 m), each leg 4–9 ft (1.2–2.7 m), measured from centre-front; no leg crosses an island by > 12 in.
  - G5: no major traffic through the triangle.
  - G6: work aisle ≥ 42 in (1067 mm) for one cook, 48 in (1219 mm) for several.
  - G7: walkway ≥ 36 in (914 mm).
  - G11: sink landing 24 in + 18 in. G16: fridge landing 15 in. G17: cooktop landing 12 in + 15 in.
- NKBA Bath (secondary [S], `https://www.hunker.com/13725105/what-are-the-nkba-guidelines-for-bathrooms/`): 18 in wc centreline to the side, 30 in clear in front of fixtures.

### 2.6 Neufert, *Architects' Data* (5th ed., Wiley 2019) / Time-Saver Standards [M]
Both are reference books with anthropometric clearances. Commonly used values (verify against the edition you cite):
- 600–700 mm beside a bed for access; a double bed reachable from both long sides.
- 900 mm minimum single-person passage.
- ≥ 1000–1200 mm in front of a kitchen run; 750–800 mm in front of a wc/basin.

These are the defaults behind the furniture-clearance rules. I could not verify page numbers online, so cite the book and edition, not a URL.

### 2.7 Shape grammars as sources of "well-formedness"
- Stiny & Mitchell, "The Palladian grammar", *Environment and Planning B* 5:5–18 (1978). Same issue: "Counting Palladian plans" and Mitchell, Stiny & Gips, "An evaluation of Palladian plans" [V bibliographic]. Takeaways: plans are generated on a **rectangular grid with bilateral symmetry**, and room shapes come from a small set of proportions. Palladio's canonical room ratios are 1:1, √2:1, 4:3, 3:2, 5:3 and 2:1 (from *I Quattro Libri*, I.xxi [M]), so **aspect ≤ 2:1**.
- Koning & Eizenberg, "The language of the prairie: Frank Lloyd Wright's prairie houses", *EPB* 8(3):295–323 (1981), `https://ideas.repec.org/a/sae/envirb/v8y1981i3p295-323.html` [V abstract]. A parametric grammar grows function zones around a **core** (the fireplace). The computable analogue is that public rooms cluster around one high-integration node.
- Lesson for ArchLang: "well-formed" here means **few axes, a grid, a small vocabulary of proportions, and a hierarchy around a core**. All four are measurable without a grammar engine.

---

## 3. Quantitative layout-quality metrics from research

- **Space syntax.** Hillier & Hanson, *The Social Logic of Space* (1984); Hanson, *Decoding Homes and Houses* (CUP 1998). ArchLang already computes MD/RA/RRA/integration/control/cycle rank (`src/analyze/syntax.ts`). The empirical regularity is that living/dining/circulation are the most integrated rooms and bedrooms and service rooms are more segregated. Recife apartments: living/dining/circulation RRA ≈ ≤ 1.0, bedrooms/baths/kitchens 1.0–1.5, servants' rooms 1.6–2.9 (`https://www.spacesyntax.net/symposia-archive/SSS4/shortpapers-posters/fabianacarvalhosss4shortpaper%202.pdf` [S]). Usable rules:
  1. the **integration inequality** (living most integrated, bedrooms least) as an ordered-rank score;
  2. **ringiness** (cycle rank) as a bonus for flats > 70 m², per Alexander 131 "loop";
  3. **depth of the private zone** ≥ depth of the public zone (127).
  Zanjan affordable-housing study: the best-scoring two-bed type had a central entrance with public and private zones on either side, and the worst had the kitchen at the door with bedrooms off the living room (`https://jfaup.ut.ac.ir/article_104005.html?lang=en` [S]).
- **Generative-model metrics** measure distribution or graph fidelity, not taste:
  - House-GAN uses realism (user study), diversity (FID) and compatibility (GED to the bubble graph) (`https://arxiv.org/pdf/2003.06988`; House-GAN++ `https://arxiv.org/pdf/2103.02574`).
  - FloorPlan-LLaMa (ACL 2025, `https://aclanthology.org/2025.acl-long.331`) says outright that FID/GED/PSNR "do not evaluate room functionality". It builds ArchiMetricsNet, with architect scores for **functionality**, **flow** and overall, and trains a multi-dimensional preference reward.
  - RLVR floor-plan generation (`https://arxiv.org/abs/2605.14117`, Findings ACL 2026) rewards topological and numerical constraint adherence plus non-overlap. This is exactly ArchLang's `score --brief` shape, so a taste score slots in as a second verifiable reward.
- **Construction rationality.** Brandão (2008, *Ambiente Construído*; `https://arla.ubiobio.cl/vufind/Record/ojs-article-3712/Description?lng=en`) scores 83 Brazilian flats by **wall density, number of wall segments, and number of wall double junctions**. This is the published basis for a wall-economy metric.
- **Compliance-from-rules.** Gautam et al. (`https://arxiv.org/abs/2607.00015`) have an LLM compile codes (SEPP65 and the Australian apartment design guides) into executable rules over a building graph. That is the same rules-over-graph architecture proposed here.
- **Facade regularity.** Ching's rhythm principle, and split grammars (Wonka et al., "Instant Architecture", SIGGRAPH 2003 [M]), model facades as repeated tiles. Computable as the CV of window spacing and the number of distinct window widths and sill/head datums per facade.

---

## 4. Dataset priors mined from ResPlan (CC BY 4.0)

ResPlan (`https://github.com/m-agour/ResPlan`, paper `https://arxiv.org/pdf/2508.14006`): 17,000 listing-derived plans. Swiss Dwellings v2.2.1 is 875 MB (`https://zenodo.org/records/7716698`). CubiCasa5k is several GB. RPLAN needs a request form. I mined ResPlan (100 MB zip).

- **Safety**: the pickle was opcode-audited first. Its only globals are `shapely.io.from_wkb`, `numpy dtype` and `numpy scalar`. It was then loaded with an allow-list unpickler (`taste/scripts/pkl_globals.py`, `taste/scripts/load.py`).
- **Script**: `taste/scripts/priors.py`. Output: `taste/priors_resplan.json`. 16,317 plans with augmented copies excluded, 16,035 of them with a sane metric scale.
- **Caveats**:
  - Coordinates are canvas units, not metres, despite the README. I scale each plan by √(listing area ÷ inner area) and keep plans whose wall thickness falls in 0.15–0.35 m.
  - Door width then has a median of 1.00 m, so metric figures run about 10–15 % high; multiply lengths by about 0.88 and areas by about 0.77.
  - ResPlan's `living` merges living, dining and hallways, so depth and "bath from living" cannot tell a hall from a living room.
  - The stock skews toward large plans (some have pools and parking).

| Prior | Value | Use |
|---|---|---|
| Bedroom→bedroom door | 24 of 39,075 bedrooms (0.06 %) | R1 is safe as a warning |
| Non-bath room reachable only via a bedroom | living 15, kitchen 4, bedroom 5, out of ~71k rooms (≈ 0.03 %). Balconies via a bedroom are common (12,973); baths via a bedroom = ensuites (22,028) | R1 must exempt balconies, ensuite baths and wardrobes |
| Bath access | 57 % ensuite-only, 42 % off living/hall, **0.3 % off the kitchen** (122/38,770) | R2: bath → kitchen is a warning; bath → living is advice |
| Kitchen ↔ living | 99 % touch, 79 % open plan | R11 (139) |
| Front door into | living/hall 99.7 %, kitchen 0.2 %, never a bedroom or bath | R13 |
| Windowed rooms | bedroom 82.5 %, living 88.6 %, kitchen 93 %, bath 92.5 % | R7 |
| Windows on ≥ 2 sides | bedroom 18 %, living 41 %, kitchen 19 % | score Q-light, never a warning |
| Aspect ratio (min rotated rectangle) p50/p95 | bedroom 1.19/1.57; kitchen 1.29/1.90; bath 1.58/2.24; living 1.32/2.26 | R9: warn above 2.0 (bath 2.5) |
| Rectangularity p10 | bedroom 0.83, bath 0.98, kitchen 0.93 (living 0.44, because halls are merged) | R18 |
| Short side (scaled, ×0.88 to correct) p5/p50 | bedroom 3.24/4.02 m (≈ 2.85/3.54 m); kitchen 1.96/2.88 m; bath 1.27/1.75 m | per-profile minimums are far below these medians, so they are lenient |
| Door jamb to nearest room corner p50/p75 | bedroom 0.09/0.81 m; bath 0.04/0.12 m; living 0.19/0.74 m | about half of bedroom doors and three quarters of bath doors sit at a corner (196). Supports R16 |
| Distinct wall axes per plan p50/p95 (axes per non-hall room) | 15/23 (2.33/3.0) | R17 score. ArchLang's counting differs (room centrelines), so calibrate on the corpus: examples run 0.7–2.0 |
| Orthogonal edge share p10 | 0.96 | R18 |

**ArchLang corpus prototype**: `taste/scripts/taste-proto.mjs`, output `taste/proto_examples.json`. It ran nine rules over `describe --json` for every `examples/*.arch`:
- R1 fires only on `two-bed.arch` (through-bath and through-bedroom).
- R2 fires on `garden-loft` and `laneway-house` (bath opens onto the living/kitchen). Both are tiny 3-room plans where that is normal, so R2 should apply to dwellings with ≥ 2 bedrooms or have a "lobby or hall" escape.
- R3 inversions: terrace-row 16/32, furnished-flat 2/6, two-bed 1/4.
- R9 (aspect > 2): only staff rooms in library and transit-hall (non-residential, out of profile).
- R11 false positives come only from the `uses` gap (two-bed's "Kitchen / Living") and from non-residential plans.

The rule false-positive rate on the corpus is low, and the hits are real.

---

## 5. Taste-layer design

### 5.1 Two channels
- **Validity (must).** A small set of rules that are code-, ergonomics- or defect-grade. They emit `W_*` through `lint()` with a profile, as today, and each ships with its byte-identity law and corpus goldens.
- **Quality (score).** `taste(src, {profile})` returns, and `arch score --taste <profile> [--json]` prints:

```json
{ "profile": "cn-residential-advisory", "coverage": {"classified": 5, "rooms": 5, "unclassified": []},
  "validity": {"pass": false, "failures": ["R1"]},
  "score": 0.61, "capped": true,
  "subscores": {"circulation": 0.4, "zoning": 0.7, "light": 0.55, "geometry": 0.9, "furnishing": 0.6, "facade": 0.8},
  "criteria": [{"id": "R3", "name": "intimacy-gradient", "value": 0.75, "target": 1.0, "score": 0.75,
      "weight": 3, "kind": "taste", "source": "Alexander 127", "evidence": ["r_kitchen", "r_bed1"],
      "advice": "A_INTIMACY_INVERSION", "fix": "..."}] }
```

- **Scoring.** Each criterion maps a measured value to [0,1] with a piecewise-linear ramp from its *threshold* (0) to its *ideal* (1). Subscores are weighted means. The total is a weighted mean **capped at 0.5 while any validity rule fails**, so a pretty plan with a through-bathroom cannot score high.
- **Determinism and bounds.** Everything is pure and count-based. Charge steps on the existing meter (rule R1 is O(rooms × (V+E)) BFS, already bounded by the access graph). Ratios print through `fmt4`. Round before thresholding, as `syntax.ts` does.
- **Coverage first.** Rooms without a classified use are listed, and use-keyed criteria report `"assessable": false` instead of passing. The fix-it is "add `uses …`", which a machine fix can apply via the ADR 0011 seam *only when the label classifier produced exactly one use*.
- **Profiles.** Names are advisory per ADR 0005: `generic`, `cn-residential-advisory`, `uk-residential-advisory`, `us-residential-advisory`, plus the existing `accessibility-advisory`. A profile is a `Partial<TasteRuleset>` with each number's source in a doc comment, mirroring `src/lint/ruleset.ts:119-133`.

### 5.2 Rule catalogue
Ranked by impact on LLM-authored plans × objectivity × ease of computation.

Columns: Sev = W (lint warning, validity) / S (scored criterion with advice code `A_*`); Kind = O (objective: code, ergonomics, defect) / T (taste, pattern). Profiles: g = generic, cn, uk, us.

| # | Name (proposed code) | Test over ArchLang facts | Threshold (profile) | Sev | Kind | Source |
|---|---|---|---|---|---|---|
| R1 | Pass-through private room `W_ROOM_VIA_PRIVATE` | For each room P with use bedroom/bath/wc: BFS from `exterior` over `access.edges` avoiding P. Any other room that becomes unreachable, other than P's own ensuite bath, wardrobe/storage or balcony, fires. Generalises `wetRoomsOnlyViaBedroom` (`src/analyze.ts:545`) | 0 (all) | W | O | Ching pass-through; Alexander 131; ResPlan 0.03 % |
| R2 | Wet-room door target `A_WET_DOOR_ONTO_KITCHEN`/`…_LIVING` | An edge bath/wc ↔ kitchen or dining fires, unless a lobby room lies between | kitchen: W (cn, 5.4.3 [M]); living/dining: S (g), skipped below 2 bedrooms | W/S | O/T | GB 50096 5.4.3; ResPlan 0.3 % |
| R3 | Intimacy gradient `A_INTIMACY_INVERSION` | Inversions of (public, bedroom) pairs in `depthFromEntrance`, ties broken by `walkDistanceMm` | score = 1 − inv/pairs; advice if > 0 | S | T | Alexander 127; 公私分区 |
| R4 | Room size and width by use | Bedroom area/short side; living area; kitchen area | cn: double bedroom 9 m², single 5, living 10, kitchen 4.0 (3.5). uk: 7.5 m²/2.15 m single, 11.5 m²/2.75 m main double, 2.55 m other doubles. us: 6.5 m², 2134 mm. g: bedroom 7 m²/2.4 m | W | O | GB 50096 [V]; NDSS 10(c-e) [V]; IRC R304 [S] |
| R5 | Near-miss alignment `W_NEAR_MISS_ALIGN` | Collect axis-parallel room edges and wall centrelines. A pair of parallel lines with 0 < Δ ≤ τ that overlap in projection fires (a ragged partition) | τ = max(150 mm, thinner wall thickness) | W | O (drafting defect) | Ching datum; Brandão wall segments |
| R6 | Furniture–use match `A_FURNITURE_USE_MISMATCH` | `furniture[].room` uses ∉ category's allowed uses (bed→bedroom; wc/basin/shower/bathtub→bath/wc; stove/fridge/kitchen_sink→kitchen; sofa→living/office; dining_table→dining/kitchen/living). Derive from `FIXTURE_FAMILIES`/catalog `zones` (`src/fixtures-catalog.ts:156`) | 0 | S (W for a plumbed fixture in a dry room) | O | — |
| R7 | Daylight ratio | Σ window width × (head − sill) ÷ room floor area, for bedroom, living, kitchen | cn 1/7; us 8 %; g 1/10. Zero windows on living/kitchen = W | W/S | O | GB 50096 7.1.5 [M]; IRC R303.1 [S] |
| R8 | Corridor width by destination | Use `circulation.rooms[].bottleneckClearWidthMm` per destination use | cn: entry 1200 (宜), to bed/living 1000, to kitchen/bath/storage 900. us: 914. g: 900 | W | O | GB 50096 5.7.1 [V]; IRC R311.6 [M] |
| R9 | Proportion `A_ROOM_ELONGATED` | Aspect of min rotated rectangle (from the shape, not the bbox, per AGENTS.md) | habitable > 2.0, bath > 2.5; hall exempt | S | T | Palladio 2:1; ResPlan p95 1.57/2.24 |
| R10 | WC/basin clearances (profile values) | Existing `W_FURN_CLEARANCE` with per-profile `clearanceMm` plus a centreline-to-side check | us: 381 side / 533 front; us-nkba: 457/762; g: 450 front | W | O | IRC P2705.1/R307.1 [S]; NKBA [S] |
| R11 | Kitchen–dining link (139) | The kitchen has a connector or open edge to living/dining | advice if absent | S | T | Alexander 139; ResPlan 99 % |
| R12 | Dwelling aspect `A_SINGLE_ASPECT` | Distinct `windows[].facing` over habitable rooms. 1 = single aspect; single + N (or S in the southern hemisphere, with `site`) = worse | uk: W for single-aspect north; g: S | W/S | O/T | London Plan D6, LPG C4.1 [S] |
| R13 | Entrance lands in public room | The room on the `access.entrances[]` door has use entry/hall/living/dining (kitchen = advice) | bedroom/bath = W | W | O | Alexander 112/130; ResPlan 99.7 % |
| R14 | Common area at the heart | Living/dining RRA rank among rooms (`--facts syntax`) | score = 1 if in the most integrated third, else linear | S | T | Alexander 129; Hanson 1998 |
| R15 | Night zone contiguity (动静分区) | The subgraph of bedrooms + their baths + halls is connected, without passing through living/kitchen | score = share of bedroom pairs whose path avoids kitchen/living; advice | S | T | 动静分区; Alexander 136 |
| R16 | Corner doors | Room < 15 m²: door nib to nearest corner > max(t, 600 mm) on both sides → advice. Two doors: not in the same third → advice | — | S | T | Alexander 196; ResPlan p50 0.09 m |
| R17 | Axis economy | (distinct x + distinct y room/wall lines, clustered at 100 mm) ÷ rooms | ideal ≤ 1.5, zero at ≥ 2.5 (corpus calibrated) | S | T | Ching datum; Brandão |
| R18 | Shape regularity (191) | Rectangularity ≥ 0.9; jogs < 600 mm counted | bedroom/bath/kitchen | S | T | Alexander 191 |
| R19 | Toilet over habitable `W_WET_OVER_HABITABLE` | Multi-level: the plan-projected area of a bath/wc on level n+1 that overlaps bedroom/living/kitchen/dining on level n is > 0.5 m² | cn: W (across dwellings 强条, within one dwelling advice per 5.4.5 [M]); g: S | W/S | O | GB 50096 5.4.4 [V] |
| R20 | Wet-stack and wet-core economy | Wet rooms share walls (adjacent) or stack across levels; count wet clusters | score: 1 cluster per level = 1 | S | O | plumbing practice; 洁污分区 |
| R21 | Furnishing completeness | Bedroom has a bed, living has seating, dining has a table (extends `W_ROOM_NO_FIXTURE`) | advice | S | O | — |
| R22 | Kitchen work triangle | Centre-fronts of sink, stove and fridge: each leg 1200–2700 mm, sum ≤ 7900; no leg crosses an island by > 305 mm | us/g | S | O | NKBA G3 [V] |
| R23 | Kitchen aisle and run width | Clear distance between facing counter fronts; single-run room clear width | us: 1067 (1 cook); cn: single run 1500, double 900 [M] | W | O | NKBA G6 [V]; GB 5.3.5 [M] |
| R24 | Traffic through kitchen triangle | The nav-grid route between two other rooms crosses the triangle polygon | advice | S | O | NKBA G5 [V] |
| R25 | Bed access | Double bed: ≥ 600 mm clear on both long sides and the foot; single: one side | g | S | O | Neufert [M] |
| R26 | Window placement in wall | Window centre offset from its host room-edge centre ≤ 10 % of the edge, or edges aligned with another window on the same facade (shared x/y), or with a stacked window on the level above | score | S | T | Ching rhythm/datum |
| R27 | Facade rhythm | Per facade: CV of window centre spacing ≤ 0.25; ≤ 3 distinct widths; one sill/head datum | score | S | T | Ching; split grammars |
| R28 | Living wall for furniture | The living room's longest wall run with no door or opening ≥ 3000 mm; door count on the living room ≤ 4 | cn advice | S | O | GB 50096 5.2.3 [M] |
| R29 | Cross-ventilation (南北通透) | Exists a window facing N and one facing S (or E/W) in rooms joined by a path of public rooms or open edges | cn advice; g score | S | T | 南北通透; GB 7.2 |
| R30 | Label legibility | Fact: after `label-placement` relocation, the room label box still overlaps furniture or another label by > COLLIDE_MIN | advice | S | O | drafting |
| R31 | Circulation share | Area of hall/circulation ÷ net area | ideal 0.08–0.15; > 0.2 advice | S | T | Alexander 131/132 [heuristic] |
| R32 | Short passages | A hall/corridor whose length > 4 × its width with no window | advice | S | T | Alexander 132 |
| R33 | Couple's realm | Master bedroom (largest) does not open onto living/kitchen, or has an ensuite | advice | S | T | Alexander 136 |
| R34 | Sleeping to the east | `site`: a bedroom with an E/SE window | advice | S | T | Alexander 138 |
| R35 | Storage provision | Σ storage-use rooms + wardrobe footprints vs bedspaces | uk Table 1 | S | O | NDSS [V] |
| R36 | Hierarchy | The living room is the largest habitable room | advice | S | T | Ching hierarchy |
| R37 | Bedroom escape window | Every bedroom has a window on an exterior wall with width ≥ 508 mm (20 in) | us | W | O | IRC R310 [M] |

Not proposed: anything that needs a sun model, heights-as-geometry, or a dwelling-boundary concept ArchLang lacks. R19 across dwellings needs a "unit" concept: until there is one, treat each level as one dwelling and cap at advice.

### 5.3 Explaining a rule to an LLM author
Use the existing diagnostic shape (byte `span`, catalogued code, `hints`), plus three fields the taste report adds.

```
A_ROOM_VIA_PRIVATE  r_kitchen "Kitchen / Living" is reachable only through r_bath "Bathroom" then r_bed1 "Master Bedroom".
  measured: path exterior → r_hall → r_bath → r_bed1 → r_kitchen (depth 4); public room behind 2 private rooms.
  why: circulation must not pass through a bedroom or bathroom (privacy, hygiene) — Ching "pass-through"; Alexander 131.
  precondition facts: r_hall is adjacent to [r_bath, r_bed1]; r_kitchen is adjacent to [r_bed1, r_bed2]
    (no shared edge hall↔kitchen, so "add one door" is NOT an option — the compiler checked).
  fix options (pick one; each is a geometric decision you make):
    1. carve a corridor: shrink r_bath/r_bed1 along y=5000 to free a ≥1000 mm strip from r_hall to r_kitchen,
       give it `uses circulation`, then door r_kitchen and r_bed2 off it;
    2. re-zone so the hall shares a full edge with r_kitchen (e.g. a hall strip along y=5000 under r_kitchen
       and r_bed1) and every bedroom and the bath open off it (a future `arch suggest` mode could list candidate
       swaps with the adjacency each leaves — measured, not picked; today's `suggest` does not do this);
    3. move the entrance: put d_front on r_kitchen's exterior wall so the public room is depth 1.
  accept-if: r_bath is an en-suite that a second, hall-reached WC duplicates (then R1 exempts it).
```

Principles:
- **Lead with the measured fact and its numbers.** The model repairs numbers best.
- **One why-line with the source**, so the model can weigh taste against the brief.
- **Enumerate geometric options, never pick one silently** (ADR 0005). Compute each option's *precondition*: which walls are shared, using `rooms[].adjacent`, so no option is impossible. This is the same discipline as `W_PATH_TOO_NARROW`'s re-measured hints (`src/error-catalog.ts:1038`).
- **No constraint laundering.** Never suggest shrinking or relabelling to silence a rule (`W_DOOR_NEAR_CORNER` fix text, `src/error-catalog.ts:1024`).
- **Machine-applicable fixes (ADR 0011) only where the edit is unique**: adding `uses` from an unambiguous label, or a `rotate` for orientation. Taste fixes are geometric and stay prose plus `arch suggest` candidates.
- **Ship the taste rules as a short section in `skills/archlang/SKILL.md`**: the top 10 rules in one line each, plus the loop `compile → lint → score --taste → repair`. A rule the model knows about before writing is cheaper than one it repairs after.

### 5.4 Suggested sequencing
1. A taste facts block: privacy ranks, wet-door edges, near-miss lines, per-room aspect and rectangularity, facade groups (pure facts, opt-in `--facts taste`).
2. Validity `W_*`: R1, R5, R13, then R2-kitchen, R4, R8 behind profiles.
3. `arch score --taste` with R3, R6, R7, R9, R11, R12, R14–R18, R22, R26, R27.
4. SKILL text and eval: measure whether giving the score to the agent raises architect-judged quality (the FloorPlan-LLaMa protocol).

---

## 6. Files produced
- `<scratch>/taste\scripts\priors.py`, `load.py`, `pkl_globals.py`, `peek.py`, `scale.py`, `taste-proto.mjs`
- `<scratch>/taste\priors_resplan.json`, `proto_examples.json`, `out_test.json`
- `<scratch>/taste\papers\` (NKBA kitchen PDF and text, GB 50096 excerpt doc and text, GB 50096 PDF with non-extractable text, Alexander pattern pages)
- `<scratch>/taste\repos\ResPlan` (clone), `data\resplan\ResPlan.pkl` (258 MB), `venv\` (shapely, numpy)
