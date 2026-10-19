/**
 * The lint coverage report (plan-soundness PS2.13): which rule families ran on a plan, which
 * were skipped and why, and which rooms no use-reading rule could judge.
 *
 * A rule that declines to judge something says so through ONE typed seam,
 * {@link import("./context.js").LintContext.skip}: a {@link LintSkipReason} and, when the
 * skip is about one room, that room. The family is never passed by the rule: it is the
 * {@link import("./context.js").LintRule.family} the rule declares, attached by the fold in
 * `src/lint.ts`, so a rule cannot file a skip under another family's name. Nothing here reads
 * a diagnostic's text, and nothing here changes what `lint()` returns: the report comes from
 * {@link import("../lint.js").lintWithCoverage}, beside the diagnostics, never inside them.
 *
 * **Adding a family or a reason** (the hook for later cards): add the id to {@link LintFamily}
 * and its words to {@link FAMILY_NOUN}, or the reason to {@link LintSkipReason} and its words to
 * {@link SKIP_WHY}; both tables are `Record`s over the union, so the compiler refuses a member
 * with no words. Then call `ctx.skip(reason, room?)` at the exact line where the rule declines.
 * Three reasons are reserved for families not built yet and have no caller:
 * `no-brief` (intent-given sizes, PS4.4), `no-dwelling` (the across-dwellings rule, PS2.14) and
 * `no-operable-window-data` (escape-window checks, PS2.16).
 *
 * `describe()` never reads any of this.
 */

import type { RRoom } from "../ir.js";

/** The rule families, in the order their first rule appears in `LINT_RULES`. */
export type LintFamily =
  | "rooms"
  | "furniture"
  | "reachability"
  | "doors"
  | "circulation"
  | "classification"
  | "annotation"
  | "vertical"
  | "orientation"
  | "outdoor"
  | "privacy"
  | "openings"
  | "daylight"
  | "contents"
  | "enclosure";

/**
 * Why a rule declined to judge. A room-level reason is filed with the room; a plan-level one
 * without.
 */
export type LintSkipReason =
  /** The room has no `uses` and its label classifies to no use (`roomUses` is empty). */
  | "no-uses"
  /** The plan declares no `site`, so no window has a compass facing. */
  | "no-site"
  /** A vertical run on a plan with one storey: there is no other storey to match it on. */
  | "single-storey"
  /** A window on a curved wall edge of the room is attributed to no room (PS0.12). */
  | "arc-window-unattributed"
  /** The rule measures a rectangle and declines a polygon room rather than its bounding box. */
  | "non-rectangular-room"
  /** The storey has no way in (no exterior door, no shaft arrival), so no walk is measured. */
  | "no-entrance"
  /** Reserved: an intent brief is needed (PS4.4). No caller yet. */
  | "no-brief"
  /** Reserved: rooms must be grouped into declared dwellings (PS2.14). No caller yet. */
  | "no-dwelling"
  /** Reserved: windows carry no operable-sash data (PS2.16). No caller yet. */
  | "no-operable-window-data"
  /** Every door to the outside opens onto a balcony or terrace, which the privacy rules do not
   *  count as a way in (the access graph and the walk do). */
  | "balcony-only-entrance"
  /** The door's host wall is angled or curved, which the rule does not measure. */
  | "unsupported-host-geometry"
  /** A room that is a kitchen and also the living room holds no kitchen fixture, so
   *  the rule cannot tell which end of it is the kitchen. */
  | "no-kitchen-fixtures"
  /** The storey's walls enclose more regions, or more nested or crowded ones, than the face
   *  rules' counted budget measures (`src/analyze/wall-faces.ts`, charged before the work). */
  | "enclosure-budget";

/** What each family checks, as the human coverage line names it. */
export const FAMILY_NOUN: Readonly<Record<LintFamily, string>> = {
  rooms: "room checks",
  furniture: "furniture checks",
  reachability: "reachability",
  doors: "door checks",
  circulation: "circulation walk",
  classification: "use classification",
  annotation: "annotation checks",
  vertical: "storey matching",
  orientation: "orientation",
  outdoor: "outdoor checks",
  privacy: "privacy checks",
  openings: "opening checks",
  daylight: "daylight",
  contents: "room contents",
  enclosure: "enclosure checks",
};

/** Why a reason stops a rule, as one clause. */
export const SKIP_WHY: Readonly<Record<LintSkipReason, string>> = {
  "no-uses": "no classified use",
  "no-site": "the plan declares no site",
  "single-storey": "the plan has one storey",
  "arc-window-unattributed": "a window on a curved wall is attributed to no room",
  "non-rectangular-room": "the rule measures rectangles only",
  "no-entrance": "the storey has no way in",
  "no-brief": "no brief is given",
  "no-dwelling": "no dwelling is declared",
  "no-operable-window-data": "windows carry no operable-sash data",
  "balcony-only-entrance": "the only way in is a balcony or terrace door",
  "unsupported-host-geometry": "the door's wall is angled or curved",
  "no-kitchen-fixtures": "the room holds no kitchen fixtures to locate the kitchen",
  "enclosure-budget": "too many walled regions to measure",
};

/** One recorded skip, as the fold collects it. */
export interface SkipNote {
  /** The `LintRule.name` that filed it. */
  rule: string;
  family: LintFamily;
  reason: LintSkipReason;
  /** The room the skip is about; absent for a plan-level skip. */
  room?: RRoom;
  /** The storey, on a multi-storey plan. */
  level?: number;
}

/** One reason a family skipped, with the rooms it skipped for it. */
export interface LintCoverageSkip {
  reason: LintSkipReason;
  /** {@link SKIP_WHY} for the reason. */
  why: string;
  /** The rooms, named as a person would (label, else id); absent for a plan-level skip. */
  rooms?: string[];
  /** The same rooms' ids, in the same order: the machine field. */
  roomIds?: string[];
  /** The storey of a room-level skip, on a multi-storey plan. */
  level?: number;
  /** The storeys a plan-level skip was filed on, present only when some storey did not. */
  levels?: number[];
}

/** One family's coverage on this plan. */
export interface LintCoverageFamily {
  family: LintFamily;
  /**
   * `ran`: nothing skipped. `skipped`: every rule of the family filed a plan-level skip on
   * every storey, so the family judged nothing. `partial`: anything between (some rooms
   * skipped, or some of its rules).
   */
  status: "ran" | "partial" | "skipped";
  /** Absent when `status` is `ran`. */
  skipped?: LintCoverageSkip[];
}

/** A room whose use no vocabulary entry and no `uses` gives. */
export interface LintUnclassifiedRoom {
  /** As a person would name it: its label, else its id. */
  name: string;
  id: string;
  level?: number;
}

/** What `lintCoverage()` returns: purely additive to the lint diagnostics. */
export interface LintCoverage {
  families: LintCoverageFamily[];
  unclassifiedRooms: LintUnclassifiedRoom[];
}

/**
 * Fold the recorded notes into the report. `families` lists every family of `rules` once, in
 * the order its first rule appears. Rooms keep the order their notes arrived in (source order,
 * rule by rule), and a room appears once per (family, reason, storey). A plan-level reason is
 * one entry whatever the number of storeys that filed it, with `levels` only when some storey
 * did not. `storeys` is how many storeys were linted: a family is `skipped` only when every
 * one of its rules filed a plan-level skip on every storey.
 */
export function foldCoverage(
  rules: readonly { name: string; family: LintFamily }[],
  notes: readonly SkipNote[],
  unclassified: readonly LintUnclassifiedRoom[],
  storeys: number,
): LintCoverage {
  const families: LintCoverageFamily[] = [];
  for (const family of [...new Set(rules.map((r) => r.family))]) {
    const mine = notes.filter((n) => n.family === family);
    if (mine.length === 0) {
      families.push({ family, status: "ran" });
      continue;
    }
    const groups = new Map<string, LintCoverageSkip>();
    const planLevels = new Map<string, Set<number>>();
    const planRuns = new Set<string>();
    for (const n of mine) {
      const key = n.room ? `${n.reason}|room|${n.level ?? ""}` : `${n.reason}|plan`;
      let g = groups.get(key);
      if (!g) {
        g = {
          reason: n.reason,
          why: SKIP_WHY[n.reason],
          ...(n.room ? { rooms: [], roomIds: [] } : {}),
          ...(n.room && n.level !== undefined ? { level: n.level } : {}),
        };
        groups.set(key, g);
      }
      if (!n.room) {
        planRuns.add(`${n.rule}|${n.level ?? ""}`);
        if (n.level !== undefined) {
          const ls = planLevels.get(key) ?? new Set<number>();
          planLevels.set(key, ls.add(n.level));
        }
      } else if (!g.roomIds!.includes(n.room.id)) {
        g.rooms!.push(n.room.label ?? n.room.id);
        g.roomIds!.push(n.room.id);
      }
    }
    for (const [key, ls] of planLevels) if (ls.size < storeys) groups.get(key)!.levels = [...ls];
    const ruleCount = new Set(rules.filter((r) => r.family === family).map((r) => r.name)).size;
    families.push({
      family,
      status: planRuns.size >= ruleCount * storeys ? "skipped" : "partial",
      skipped: [...groups.values()],
    });
  }
  return { families, unclassifiedRooms: [...unclassified] };
}

/** `A`, `A and B`, `A, B and C`. */
function andList(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** `"A"`, `"A" and "B"`, `"A", "B" and "C"`. */
const quotedList = (names: readonly string[]): string => andList(names.map((n) => `"${n}"`));

/**
 * The one human line for a report with any skip, or `null` when nothing was skipped and no
 * room is unclassified. Rooms are named by label, so an id appears only where a room has no
 * label, as in every lint message. Unclassified rooms are named once, with the families that
 * skipped them, rather than once per family; on a multi-storey plan each is named with its
 * storey, so the count always equals the names listed.
 */
export function coverageLine(c: LintCoverage): string | null {
  const parts: string[] = [];
  const noUses: LintFamily[] = [];
  for (const f of c.families) {
    for (const s of f.skipped ?? []) {
      if (s.reason === "no-uses") {
        if (!noUses.includes(f.family)) noUses.push(f.family);
        continue;
      }
      const lv = s.levels ?? (s.level !== undefined ? [s.level] : []);
      const on = lv.length > 0 ? ` on level${lv.length === 1 ? "" : "s"} ${andList(lv.map(String))}` : "";
      const rooms = s.rooms ? ` for ${quotedList(s.rooms)}` : "";
      parts.push(`${FAMILY_NOUN[f.family]}${rooms}${on} (${s.why})`);
    }
  }
  if (noUses.length > 0 && c.unclassifiedRooms.length > 0) {
    const named = c.unclassifiedRooms.map((r) => `"${r.name}"${r.level !== undefined ? ` on level ${r.level}` : ""}`);
    const n = named.length;
    parts.push(
      `${andList(noUses.map((f) => FAMILY_NOUN[f]))} for ${n} room${n === 1 ? "" : "s"} with no classified use (${andList(named)})`,
    );
  }
  if (parts.length === 0) return null;
  return `lint coverage: skipped ${parts.join("; ")}.`;
}
