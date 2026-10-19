/**
 * The lint ruleset: tunable thresholds, named advisory profiles, and the options
 * type. Split from `lint.ts` so individual rule modules (`./rules/*.ts`) can import
 * the types without a cycle through the `lint()` entry point; `lint.ts` re-exports
 * everything here, so the public surface is unchanged.
 */

import type { AnalyzeOptions } from "../analyze.js";
import type { UseKind } from "../ast.js";
import { DEFAULT_TOL } from "../analyze.js";
import { FIXTURE_WALL_TOL_MM } from "../fixture-orientation.js";

/** Tunable thresholds for the lint rules. All distances in mm, areas in m². */
export interface LintRuleset {
  /** Rooms smaller than this (m²) warn as implausibly small. Default 4. A room whose every
   *  use has its own entry in {@link minRoomAreaByUseM2} is held to that instead. */
  minRoomAreaM2: number;
  /** Doors narrower than this (mm) warn as sub-passable. Default 700 (≥800 recommended). */
  minDoorWidthMm: number;
  /** Edge-touch tolerance for "is this opening on that room?" (mm). Default 200. */
  tolMm: number;
  /**
   * A wet room (bath/WC) whose perimeter has an unwalled run longer than this (mm)
   * warns as not enclosed. Default 300 — long enough to ignore a normal door/window
   * opening (those are not gaps anyway), short enough to catch a missing partition.
   */
  maxUnenclosedMm: number;
  /** Extra clearance (mm) added when testing door-swing collisions. Default 0. */
  swingClearanceMm: number;
  /**
   * How close (mm) a wall-requiring fixture's edge must be to a wall centerline to
   * count as "against the wall". Default 300 — comfortably more than a wall's
   * half-thickness (a fixture backs onto the wall *face*) plus a small setback.
   * The default is {@link FIXTURE_WALL_TOL_MM}, the same constant resolve uses to
   * derive a room-anchored fixture's rotation, so the two can never drift.
   */
  fixtureWallTolMm: number;
  /**
   * Clear landing depth (mm) required on each side of a door opening — the straight
   * approach path through the doorway. Furniture inside this zone trips
   * `W_DOORWAY_BLOCKED`. Default 300; accessibility guidance wants more.
   */
  doorwayLandingMm: number;
  /**
   * Minimum clear floor area (m²) a room's doorways must be able to reach by walking
   * (grid flood-fill). Below this a reachable-but-packed room trips
   * `W_ROOM_NO_CLEAR_PATH`. Default 1.0 — about enough to stand and turn.
   */
  minClearAreaM2: number;
  /**
   * Minimum unavoidable clear width (mm) on the walk from the entrance into a room
   * (and along key room→room routes). Below this the circulation model trips
   * `W_PATH_TOO_NARROW`. Default 700 — a standard door's clear opening, matching
   * `minDoorWidthMm`; the accessibility profile raises it toward wheelchair passage.
   */
  minPathClearWidthMm: number;
  /**
   * How many times its straight-line distance a room's walk from the entrance may be
   * before it trips `W_CIRCUITOUS_PATH`. Default 3.0 — deliberately generous: a normal
   * tucked-away wet room routed off a hall runs ~2.5–2.7×, so a tighter ratio would
   * false-positive on sound plans; this catches only genuinely roundabout access.
   */
  maxDetourRatio: number;
  /**
   * End clearance (mm) a `pocket` door needs beyond its own width, for the jamb, the
   * pull and the panel's stop. `W_POCKET_RUN` requires
   * `width + max(pocketRunClearanceMm, width × 5%)`. Default 50.
   *
   * **A deliberate divergence from the source this rule is borrowed from.**
   * planscript-rust's `pocket_door_wall_run` requires a flat `width × 1.05`. A pure
   * ratio is wrong on narrow doors — a 700 mm pocket would ask for 35 mm of end
   * clearance, which does not fit a real jamb and pull — and we are not publishing a
   * comparison against that project, so matching its constant buys nothing.
   * Architectural correctness outranks reference-comparability, the same call that
   * put GB/T's `A-ANNO-DIMS` ahead of the reference's coarser `A-DIMS`. The ratio
   * limb is kept so a wide opening still scales.
   */
  pocketRunClearanceMm: number;
  /**
   * The shortest nib of wall a door's jamb may leave at a **corner**, as a multiple of
   * that wall's own thickness. `W_DOOR_NEAR_CORNER` requires
   * `thickness × minCornerNibRatio`. Default 1.0 — a nib at least as long along the run
   * as the wall is deep across it.
   *
   * **Why the wall's own thickness, and why one limb.** The thickness is the only length
   * in the drawing intrinsic to the wall being measured, so the threshold needs no new
   * absolute constant and scales by itself: a 100 mm partition asks for 100 mm, a 400 mm
   * shell for 400. It is also the dimension the defect is about — a piece of wall drawn
   * deeper than it is long stops reading as wall and reads as a chamfer on the corner,
   * and its returned face has nowhere to carry a door frame and architrave.
   * {@link pocketRunClearanceMm} needs a second, absolute limb because it compares a
   * wall run against the DOOR's width, which can be narrow enough to make a pure ratio
   * meaningless; here both sides of the comparison belong to the same wall, so a second
   * constant would be invented rather than evidenced.
   */
  minCornerNibRatio: number;
  /**
   * The shortest nib of wall an opening's jamb may leave to the FACE of a wall that meets
   * its host run (a tee, a crossing, or — for windows and cased openings — a corner).
   * `W_OPENING_AT_JUNCTION` requires `max(minJunctionNibMm, host thickness ×
   * junctionNibThicknessRatio)`. Default 100.
   *
   * **Source.** 100 mm is the low end of the trade practice (100-150 mm) for the return a
   * frame and architrave or a lining need beside a jamb, recorded with its source in
   * `docs/plans/plan-soundness/research/associativity.md` (the door-nib row, BuildHub
   * "architrave offset") and `research/prior-art.md` (T5: an opening's span stays clear of
   * wall junctions by at least a nib).
   */
  minJunctionNibMm: number;
  /**
   * The thickness limb of `W_OPENING_AT_JUNCTION`'s nib, as a multiple of the HOST wall's
   * thickness, measured to the meeting wall's FACE. Default 0.5.
   *
   * **Why half, at the face.** It is `W_DOOR_NEAR_CORNER`'s own threshold restated at the
   * datum this rule measures from. That rule asks for a nib of one wall thickness measured to
   * the corner's CENTRELINE point; the meeting wall's face stands half its thickness short of
   * that point, so for two walls of one thickness the same requirement read at the face is
   * half the thickness. The plan-soundness audit proposed the same `max(100, H.thickness/2)`
   * at the face (`docs/plans/plan-soundness/audits/showcase-and-examples.md`, proposed check
   * 1) and found no false positive on its corpus.
   *
   * **Measured against the plan's first reading, a full thickness (ratio 1.0).** The PS2.1
   * card states `max(100 mm, host thickness)`. Read at the face, that raised 38 more
   * warnings than 0.5 does, in 11 of the shipped examples, and every one was a nib of
   * 100-250 mm, mostly beside a window on a 200-300 mm wall. Those returns sit inside or above
   * the 100-150 mm trade range, so they are not defects, and 0.5 is the default. A profile that
   * wants the stricter reading sets 1.0.
   */
  junctionNibThicknessRatio: number;
  /**
   * The thinnest pier of wall that may separate two openings on one run — a mullion.
   * `W_OPENING_OVERLAP` fires when two openings' along-run spans intersect, or leave less
   * than this between them. Default 100: the mullion width the plan-soundness audit used
   * (`docs/plans/plan-soundness/audits/archcanvas-public-examples.md`, proposed check 1),
   * the same 100 mm as {@link minJunctionNibMm}'s first limb, since either side of the pier
   * has a frame to carry.
   */
  minMullionMm: number;
  /**
   * The least length of a SECOND room a straddling connector's face must cover, net of the
   * body of any wall meeting the host there, before `W_CONNECTOR_AMBIGUOUS` reads it as
   * opening into that room. The threshold is `max(minStraddleCoverMm, host thickness ×
   * junctionNibThicknessRatio)`. Default 100.
   *
   * **Why the junction nib.** A sliver of the other room beside a meeting wall is the same
   * length of wall `W_OPENING_AT_JUNCTION` measures as the jamb's nib: below the nib a jamb
   * needs, it is a jamb set against the meeting wall, not a way into the room beyond it, and
   * that warning already reports it. One defect gets one warning, so below this length only
   * the junction warning speaks. At or above it the doorway really does open onto two rooms,
   * and both warnings stand: one about the wall in the opening, one about which rooms it
   * serves. The meeting wall's body is taken out because the rooms are drawn to its
   * centreline, so half its thickness counts as floor that nobody can stand on.
   */
  minStraddleCoverMm: number;
  /**
   * How near (mm) a kitchen fixture must stand to a bath or WC door before `W_WET_ROOM_DOOR`
   * reads the door as opening onto the KITCHEN of a room that is also the living room.
   * Measured from the doorway's face on that room's side (jamb, centre, jamb) to the nearest
   * sink, hob, oven, fridge, worktop, island or dishwasher footprint on that room's floor, in
   * whole mm; the door warns when the fixture is nearer than this. Default 1500.
   *
   * **Why 1500.** It is the clear width GB 50096-2011 5.3.5 gives a kitchen with one row of
   * fixtures (at least 1.50 m, cited as advice; `docs/plans/plan-soundness/research/
   * design-taste.md` R23): the band a kitchen run needs in front of it. A door inside that band
   * opens into the kitchen itself; one beyond it opens into the living or dining end of the
   * room, which the taste layer grades and no rule warns.
   */
  wetDoorKitchenProximityMm: number;
  /**
   * The longest stretch of a run two rooms share that may have no wall, door, cased opening
   * or fixed counter on it before `W_BOUNDARY_NO_WALL` fires. Default 900: a doorway, the
   * width the plan-soundness card names (`docs/plans/plan-soundness/README.md`, PS2.4) and a
   * standard single leaf's nominal width. A gap no wider than a door is the missing door's
   * report (`W_ROOM_DISCONNECTED`, `W_ROOM_UNREACHABLE`), not a missing wall.
   */
  maxBoundaryGapMm: number;
  /**
   * The share of a walled face the rooms must cover before `W_FLOOR_UNASSIGNED` is quiet.
   * Default 0.95, the card's threshold (PS2.4): a plan whose rooms are drawn on the wall
   * centrelines covers its faces completely, so 5 % is room for rooms drawn to a wall's face
   * or a little short of it, never a strip a person could stand in.
   */
  minFaceCoverRatio: number;
  /**
   * The least floor (m²) a walled face must leave in no room for `W_FLOOR_UNASSIGNED` to
   * report it, whatever its share. Default 0.5: below it the walls enclose a riser, a duct or
   * the sliver a room drawn a little short of its wall leaves, not floor anyone forgot.
   */
  minUnassignedM2: number;
  /**
   * The least floor (m²) of a room outside every walled face and wall before
   * `W_ROOM_OUTSIDE_SHELL` reports it. Default 0.1: a 100 mm strip a metre long. A room drawn
   * on the wall centrelines, or to the outer face, has none outside at all.
   */
  minOutsideShellM2: number;
  /**
   * `W_ROOM_TOO_SMALL`'s floor (m²) for a room of a given use, read from {@link roomUses}
   * (its `uses`, else its label). `null` exempts the use: no floor at all. A use with no
   * entry, and a room with no classified use, keep {@link minRoomAreaM2}. A room with
   * several uses takes the highest floor among them, so `uses kitchen storage` is held to
   * the kitchen's 4 m² and `uses hall storage` to none.
   *
   * **Why per use.** One 4 m² floor for every room made the rule ask a WC and a cupboard to
   * be the size of a kitchen; repairing against it, an author inflated a café's staff WC to
   * 1.6 × 3.4 m and deleted a house's linen store (plan-soundness audit, first contact,
   * "repair pressure"). The defaults:
   *  - `wc` 1.1: GB 50096-2011 5.4.2 item 5, a room with a WC alone, at least 1.10 m².
   *  - `bath` 2.0: GB 50096-2011 5.4.2 items 2 and 3, the smallest combinations with a
   *    shower or bath (WC + shower, basin + shower), at least 2.00 m². A three-fixture
   *    bathroom wants 2.50 m² (5.4.1); the rule does not count fixtures, so it asks the lower.
   *  - `storage`, `utility`, `hall`, `circulation`, `entry` exempt: the standard sets no area
   *    for a store, a laundry or a lobby, and a cupboard is a room. A passage is judged by its
   *    width (`W_PATH_TOO_NARROW`), never its area.
   * Clauses as read in `docs/plans/plan-soundness/research/prior-art.md` §3.1 (full text
   * extracted), applied as advice, never as compliance (ADR 0005).
   *
   * Merged PER USE ({@link resolveRuleset}): a profile or a caller that sets `{ wc: 1.5 }` changes
   * the WC's floor and keeps every other default, exemptions included.
   */
  minRoomAreaByUseM2: Readonly<Partial<Record<UseKind, number | null>>>;
  /**
   * How {@link minRoomAreaM2} and {@link minRoomAreaByUseM2} combine. `"by-use"` (the default):
   * a use's own floor replaces the generic one. `"at-least-generic"`: every room is held to at
   * least the generic floor, and a use's own floor applies only where it is higher (an exempt use
   * counts as no floor of its own). {@link resolveRuleset} picks `"at-least-generic"` whenever a
   * profile or the caller sets `minRoomAreaM2` explicitly, so a stricter generic floor (the
   * `accessibility-advisory` profile's 5 m²) is not undone by the per-use table, which has no
   * researched accessible values yet. Writing the default itself, `ruleset: { minRoomAreaM2: 4 }`,
   * also picks `"at-least-generic"`, so every room is held to 4 m² again, as before the per-use
   * table.
   */
  roomAreaFloorMode: "by-use" | "at-least-generic";
}

export const DEFAULT_RULESET: LintRuleset = {
  minRoomAreaM2: 4,
  minDoorWidthMm: 700,
  tolMm: DEFAULT_TOL,
  maxUnenclosedMm: 300,
  swingClearanceMm: 0,
  fixtureWallTolMm: FIXTURE_WALL_TOL_MM,
  doorwayLandingMm: 300,
  minClearAreaM2: 1.0,
  minPathClearWidthMm: 700,
  maxDetourRatio: 3.0,
  pocketRunClearanceMm: 50,
  minCornerNibRatio: 1.0,
  minJunctionNibMm: 100,
  junctionNibThicknessRatio: 0.5,
  minMullionMm: 100,
  minStraddleCoverMm: 100,
  wetDoorKitchenProximityMm: 1500,
  maxBoundaryGapMm: 900,
  minFaceCoverRatio: 0.95,
  minUnassignedM2: 0.5,
  minOutsideShellM2: 0.1,
  minRoomAreaByUseM2: Object.freeze({
    wc: 1.1,
    bath: 2.0,
    storage: null,
    utility: null,
    hall: null,
    circulation: null,
    entry: null,
  }),
  roomAreaFloorMode: "by-use",
};

/**
 * Named, **advisory** lint profiles — partial ruleset overrides over
 * {@link DEFAULT_RULESET}. Deliberately NOT named after a standard (`ada`, `iso`):
 * a profile is an advisory soundness check, never a compliance guarantee, and
 * ArchLang does not model everything a code requires (clear opening width, approach
 * clearances, hardware). Every override is a documented, traceable threshold.
 */
export const LINT_PROFILES: Readonly<Record<string, Partial<LintRuleset>>> = Object.freeze({
  /** The shipped residential baseline (identical to {@link DEFAULT_RULESET}). */
  "residential-basic": {},
  /**
   * Stricter passage + clearances inspired by accessibility guidance (e.g. the ADA's
   * ~815 mm clear door opening and generous turning/approach space). Advisory only.
   */
  "accessibility-advisory": {
    minDoorWidthMm: 850, // a nominal width giving roughly an 815 mm clear opening
    minRoomAreaM2: 5,
    swingClearanceMm: 150,
    doorwayLandingMm: 450, // a deeper clear approach in front of each door
    minPathClearWidthMm: 900, // a continuous clear width for wheelchair passage
  },
});

/** The names of the built-in {@link LINT_PROFILES}, for CLI validation. */
export const LINT_PROFILE_NAMES: readonly string[] = Object.keys(LINT_PROFILES);

const hasOwn = (o: object | undefined, k: string): boolean => o !== undefined && Object.hasOwn(o, k);

/**
 * The ruleset cascade `lint()` runs: defaults, then the named profile's overrides, then the
 * caller's. Flat keys are replaced; `minRoomAreaByUseM2` is merged per use (later layers win
 * per key, the other keys keep their defaults). `roomAreaFloorMode` is `"at-least-generic"`
 * when a profile or the caller sets `minRoomAreaM2` without setting the mode.
 */
export function resolveRuleset(profile: Partial<LintRuleset> = {}, ruleset: Partial<LintRuleset> = {}): LintRuleset {
  const mode =
    ruleset.roomAreaFloorMode ??
    profile.roomAreaFloorMode ??
    (hasOwn(profile, "minRoomAreaM2") || hasOwn(ruleset, "minRoomAreaM2") ? "at-least-generic" : "by-use");
  return {
    ...DEFAULT_RULESET,
    ...profile,
    ...ruleset,
    minRoomAreaByUseM2: {
      ...DEFAULT_RULESET.minRoomAreaByUseM2,
      ...profile.minRoomAreaByUseM2,
      ...ruleset.minRoomAreaByUseM2,
    },
    roomAreaFloorMode: mode,
  };
}

export interface LintOptions extends AnalyzeOptions {
  /** A named profile from {@link LINT_PROFILES} (applied before `ruleset`). */
  profile?: string;
  /** Override any subset of {@link DEFAULT_RULESET} (wins over `profile`). */
  ruleset?: Partial<LintRuleset>;
}
