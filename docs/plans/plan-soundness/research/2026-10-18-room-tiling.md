# Do rooms already tile the building? (measured 2026-10-18, `main@8d1e13e`, v1.43.1)

Evidence for decision D5 (`../README.md` §3): a form that derives every wall from the room tiling
is only worth building if plans are already written as tilings. Re-measure before relying on it.

## Method

For each top-level `examples/*.arch`, `node dist/cli.js describe <file> --json`, then:

- `coverage` = Σ `rooms[].area_m2` ÷ (`bbox.w` × `bbox.h` ÷ 10⁶). Room boxes and the plan `bbox` are
  both centreline measures, so a rectangular shell tiled by rooms gives exactly 100 %. A
  non-rectangular shell (L, hexagon, curved) reads under 100 % even when the rooms tile it, so the
  figure is a floor, not an exact tiling test.
- `rect` = rooms whose `floor_polygon` has four vertices.

## Result

| Plans | Coverage = 100 % | 89–97 % | < 89 % | Rooms | Rectangular rooms |
|---|---|---|---|---|---|
| 34 | 26 | 6 | 2 (`aquarium` 85 %, `hexagon-pavilion` 68 %) | 246 | 236 |

Of the eight plans under 100 %, six are non-rectangular shells (`courtyard-house`, `gallery-l`,
`garden-house`, `library`, `terrace-row`, `aquarium`) where the method under-reads; the two lowest
have curved or angled rooms. No rectangular-shell plan leaves floor outside its rooms.

## Reading

- Authors (human and AI) already write rooms that tile the building and leave corridors as rooms.
  A whole-tiling derivation (`walls from rooms`) therefore matches today's plans; it is not a new
  style agents would have to learn.
- Non-rectilinear rooms are 4 % of the corpus. Refusing them in v1 of the form (ADR 0005: refuse,
  never choose) costs little; §8 question 4 covers the honest extension.
- The audits' "unassigned floor" and "room outside the shell" defects (`../evidence.md` §2) all
  come from plans that broke the tiling. Under D5 those states are unwritable rather than checked.

## Caveat

The corpus is the repository's own examples, written by people who know the language. The
first-contact experiment (`../audits/2026-10-18-first-contact.md`, once written) is the check that a
new AI author also writes tilings.
