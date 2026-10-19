import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { accessDigraph, buildDoorAccessGraph, reachFrom, resolvePlan, roomBox, type RoomBox } from "../src/analyze.js";
import { entranceInputs, walkAccessGraph, walkWays } from "../src/analyze/entrance.js";
import type { RDoor, ROpening, RRoom } from "../src/ir.js";
import { describe as describePlan, lint } from "../src/index.js";

/**
 * The main entrance (plan-soundness PS0.10). Reachability and the walk were seeded from every
 * exterior door, so a patio or balcony door masked a route blocked from the front door
 * (first-contact audit T2 and A2, each proven there by turning the secondary door into a
 * window). `describe().access` now names the front door when the plan says so unambiguously,
 * and the circulation and privacy rules judge a route from it.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const FIRST_CONTACT = "docs/plans/plan-soundness/audits/first-contact-plans";

const narrow = (src: string) => lint(src).filter((d) => d.code === "W_PATH_TOO_NARROW");

describe("PS0.10 — the main entrance", () => {
  it("A2: a balcony door is not a way in for the walk, so the laundry blocked from the front door is reported", () => {
    const src = read(`${FIRST_CONTACT}/1-apartment.arch`);
    const s = describePlan(src);
    expect(s.access.entrances).toEqual(["d_front", "d_bal"]);
    // The balcony slider is no candidate, so the front door is the only door from the ground.
    expect(s.access.mainEntrance).toEqual({ door: "d_front", basis: "sole", candidates: ["d_front"] });
    // The audit's proof: with the balcony door made a window, the same warning appears.
    const masked = src.replace(
      "door id=d_bal   sliding on w_s at 2000 width 2000",
      "window id=d_bal on w_s at 2000 width 2000",
    );
    const [d] = narrow(src);
    expect(d!.message).toBe(narrow(masked)[0]!.message);
    expect(d!.message).toContain('"Laundry" squeezes to 400 mm and stops there');
    expect(d!.message).not.toContain("d_front");
    expect(d!.hints!.at(-1)).toBe(
      "Measured from the main entrance `d_front` (the only door from outside, garage and balcony doors aside). The other door from outside, `d_bal`, is a way into its own room only, since the main entrance reaches that room from inside.",
    );
  });

  it("T2: the door into the hall is the main entrance, so the living room behind the patio is measured from it", () => {
    const src = read(`${FIRST_CONTACT}/5-townhouse.arch`);
    const ground = (s: ReturnType<typeof describePlan>) => s.levels!.find((l) => l.level === 0)!;
    // Width never decides: the 1600 mm patio slider is not the front door; the door into the Hall is.
    expect(ground(describePlan(src)).access.mainEntrance).toEqual({
      door: "g_front",
      basis: "entry-room",
      candidates: ["g_front"],
    });
    // Living has no door of its own from outside: from the front door, the sofa seals it. The
    // kitchen opens onto the garden through the patio door itself, which is a way into it.
    expect(narrow(src).map((d) => d.message)).toEqual([
      'The walk from the entrance to "Living" squeezes to 200 mm and stops there — no way in is wider, so no route reaches the room (500 mm below the 700 mm minimum).',
    ]);
  });

  const twoDoors = (front: string, side: string, store = "") => `plan "P" {
  units mm
  grid 100
  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,5000) (0,5000) close }
  wall id=p partition thickness 100 { (3000,0) (3000,5000) }
  ${store ? "wall id=q partition thickness 100 { (6000,0) (6000,5000) }" : ""}
  room id=r_hall at (0,0) size 3000x5000 label "Hall" uses hall
  room id=r_live at (3000,0) size ${store ? "3000" : "5000"}x5000 label "Living" uses living
  ${store}
  door id=d_hl on p at 2500 width 900
  door id=d_a ${front}
  door id=d_b ${side}
}`;

  it("two doors into rooms that are not entrance spaces, and no `site`: refused as a tie, and it says so", () => {
    // Both doors open into the living room; nothing singles one out, width included.
    const src = twoDoors("at (4500,0) width 900 wall shell", "at (5500,5000) width 1200 wall shell").replace(
      "door id=d_hl on p at 2500 width 900",
      "door id=d_hl on p at 2500 width 700",
    );
    const s = describePlan(src);
    expect(s.access.mainEntrance).toEqual({ door: null, basis: "tie", candidates: ["d_a", "d_b"] });
    expect(s.access.rooms.every((r) => !("depthFromMainEntrance" in r))).toBe(true);
    // The walk keeps every way in, and the warning says the main entrance was refused.
    const [d] = narrow(src);
    expect(d!.message).toContain('"Hall" squeezes to 640 mm');
    expect(d!.hints!.at(-1)).toBe("Measured from every exterior door because no main entrance could be named (tie).");
  });

  it("a room reached only by its own door from outside keeps that door, and reads depthFromMainEntrance null", () => {
    const src = twoDoors(
      "at (1500,0) width 1000 wall shell",
      "at (7000,0) width 800 wall shell",
      `room id=r_store at (6000,0) size 2000x5000 label "Store" uses storage`,
    );
    const s = describePlan(src);
    expect(s.access.mainEntrance).toEqual({ door: "d_a", basis: "entry-room", candidates: ["d_a"] });
    expect(s.access.rooms.map((r) => [r.id, r.depthFromEntrance, r.depthFromMainEntrance])).toEqual([
      ["r_hall", 1, 1],
      ["r_live", 2, 2],
      ["r_store", 1, null],
    ]);
  });

  // The review round's probes (test/main-entrance-fixtures/): each pins the fact, and that lint says
  // exactly what it said before PS0.10 (no false warning on a room that has its own door, on the
  // hall that holds the front door, or from a wider back or delivery door crowned by width).
  const FIX = "test/main-entrance-fixtures";
  const NOT_EQUATOR =
    'W_ROOM_NOT_EQUATOR_FACING: Room "Living" has 1 window(s), none facing S (the equator side in the northern hemisphere) — they face N.';
  const UTILITY_640 =
    'W_PATH_TOO_NARROW: The walk from the entrance to "Utility" squeezes to 640 mm (60 mm below the 700 mm minimum) — the bottleneck is the door between "Living" and "Utility", 640 mm clear.';
  const probes: Array<[string, unknown, string[] | null]> = [
    // A 1000 mm back door into the Utility beside the 900 mm front door into the Hall.
    ["p1b-wider-back.arch", { door: "d_front", basis: "entry-room", candidates: ["d_front"] }, []],
    // The same, 10 mm wider at grid 10.
    ["p1c-grid10.arch", { door: "d_front", basis: "entry-room", candidates: ["d_front"] }, []],
    // The front door on the side wall, the back door on the street side.
    ["p2-side-front.arch", { door: "d_front", basis: "entry-room", candidates: ["d_front"] }, [NOT_EQUATOR]],
    // A 2400 mm slider on the street beside the hinged front door into the Hall: step (a) names
    // the Hall's door; the Utility, which has no door of its own, read 640 mm before PS0.10 too.
    [
      "p3-street-slider.arch",
      { door: "d_front", basis: "entry-room", candidates: ["d_front"] },
      [UTILITY_640, NOT_EQUATOR],
    ],
    // Four doors, none into an entrance space and no `site`: refused, a 1100 mm delivery door included.
    [
      "p4-cafe-delivery1100.arch",
      { door: null, basis: "tie", candidates: ["d_entry_a", "d_entry_b", "d_back", "d_delivery"] },
      null,
    ],
    // A 2400 mm courtyard slider into Living loses to the hinged door into the Entry hall at step (a).
    ["c1-courtyard.arch", { door: "d_front", basis: "entry-room", candidates: ["d_front"] }, [NOT_EQUATOR]],
    // The kitchen has its own back door: from the front it is behind the bedroom, but that door is
    // a way into it, so W_ROOM_VIA_PRIVATE does not say it is reached only through the bedroom.
    ["v1-privacy.arch", { door: "d_front", basis: "entry-room", candidates: ["d_front"] }, []],
  ];
  it.each(probes)("probe %s: the fact, and lint as before", (name, fact, lintAsBefore) => {
    const src = read(`${FIX}/${name}`);
    expect(describePlan(src).access.mainEntrance).toEqual(fact);
    const got = lint(src).map((d) => `${d.code}: ${d.message}`);
    if (lintAsBefore) expect(got).toEqual(lintAsBefore);
    else expect(got.filter((m) => m.startsWith("W_PATH_TOO_NARROW") || m.startsWith("W_ROOM_VIA_PRIVATE"))).toEqual([]);
  });

  it("an upper storey a stair arrives on names no main entrance, and walks from every way in (PS0.3)", () => {
    const src = read(`${FIX}/p5-upper-terrace.arch`);
    const s = describePlan(src);
    expect(s.levels!.map((l) => l.access.mainEntrance ?? null)).toEqual([
      null,
      { door: null, basis: "upper-storey", candidates: [] },
    ]);
    // The two deck doors open into the bedrooms; nothing is measured from either of them as a front door.
    expect(lint(src).map((d) => d.code)).toEqual(["W_ENTRANCE_INTO_PRIVATE", "W_ENTRANCE_INTO_PRIVATE"]);
  });

  it("a storey with one entrance or none gains no key at all", () => {
    const s = describePlan(read("examples/studio.arch"));
    expect(s.access.entrances.length).toBeLessThanOrEqual(1);
    expect("mainEntrance" in s.access).toBe(false);
    expect(s.access.rooms.some((r) => "depthFromMainEntrance" in r)).toBe(false);
  });

  // Over every example storey: the fact is present exactly when there is a choice, the walk's
  // graph reaches exactly the rooms the full graph reaches (so W_ROOM_UNREACHABLE cannot move),
  // and `depthFromEntrance` is untouched.
  const examples = readdirSync(join(root, "examples")).filter((f) => f.endsWith(".arch"));
  it.each(examples)("%s: the walk's ways in reach every room the doors reach", (name) => {
    const src = read(`examples/${name}`);
    const { ir, levels } = resolvePlan(src, {
      world: {
        read: (p: string) => {
          try {
            return readFileSync(join(root, "examples", p), "utf8");
          } catch {
            return null;
          }
        },
        now: () => new Date(0),
      },
    });
    const storeys = levels.length > 0 ? levels.map((l) => l.ir) : ir ? [ir] : [];
    for (const st of storeys) {
      const rooms = st.elements.filter((e): e is RRoom => e.kind === "room");
      const doors = st.elements.filter((e): e is RDoor => e.kind === "door");
      const openings = st.elements.filter((e): e is ROpening => e.kind === "opening");
      const rects = new Map<string, RoomBox>(rooms.map((r) => [r.id, roomBox(r)]));
      const full = buildDoorAccessGraph(rooms, doors, 200, undefined, openings);
      const keep = walkWays(full, entranceInputs(st, rects));
      const walk = walkAccessGraph(full, keep);
      const ids = rooms.map((r) => r.id);
      expect([...reachFrom(accessDigraph(ids, walk.edges))].sort()).toEqual(
        [...reachFrom(accessDigraph(ids, full.edges))].sort(),
      );
      if (keep === null) expect(walk).toBe(full);
      else expect(keep.size).toBeGreaterThan(0);
    }
    const summaries = levels.length > 0 ? describePlan(src).levels! : [describePlan(src)];
    for (const sum of summaries) {
      expect("mainEntrance" in sum.access).toBe(sum.access.entrances.length > 1);
      const named = sum.access.mainEntrance?.door != null;
      for (const r of sum.access.rooms) expect("depthFromMainEntrance" in r).toBe(named);
    }
  });
});
