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
    expect(s.access.mainEntrance).toEqual({ door: "d_front", basis: "widest", candidates: ["d_front"] });
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
      "Measured from the main entrance `d_front` (the widest door from outside, garage and balcony doors aside). The other door from outside, `d_bal`, is not counted as a way in, because the main entrance reaches its room from inside.",
    );
  });

  it("T2: with no `site`, a patio slider wider than the hinged front door is refused; with `site` the street door decides", () => {
    const src = read(`${FIRST_CONTACT}/5-townhouse.arch`);
    const ground = (s: ReturnType<typeof describePlan>) => s.levels!.find((l) => l.level === 0)!;
    // Width alone would crown the patio door; the plan does not say which is the front door.
    expect(ground(describePlan(src)).access.mainEntrance).toEqual({
      door: null,
      basis: "kind-conflict",
      candidates: ["g_patio", "g_front"],
    });
    expect(narrow(src)).toEqual([]); // refused: every way in is kept, as before
    // The plan's own comment says the street is to the south.
    const sited = src.replace("  north up\n", "  north up\n  site { street south }\n");
    expect(ground(describePlan(sited)).access.mainEntrance).toEqual({
      door: "g_front",
      basis: "street",
      candidates: ["g_front"],
    });
    expect(narrow(sited).map((d) => d.message)).toEqual([
      'The walk from the entrance to "Living" squeezes to 200 mm and stops there — no way in is wider, so no route reaches the room (500 mm below the 700 mm minimum).',
      'The walk from the entrance to "Kitchen / Dining" squeezes to 200 mm and stops there — no way in is wider, so no route reaches the room (500 mm below the 700 mm minimum).',
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

  it("two equal hinged doors and no `site`: refused as a tie, and nothing is chosen", () => {
    const src = twoDoors("at (1500,0) width 900 wall shell", "at (4500,0) width 900 wall shell");
    const s = describePlan(src);
    expect(s.access.mainEntrance).toEqual({ door: null, basis: "tie", candidates: ["d_a", "d_b"] });
    expect(s.access.rooms.every((r) => !("depthFromMainEntrance" in r))).toBe(true);
  });

  it("a room reached only by its own door from outside keeps that door, and reads depthFromMainEntrance null", () => {
    const src = twoDoors(
      "at (1500,0) width 1000 wall shell",
      "at (7000,0) width 800 wall shell",
      `room id=r_store at (6000,0) size 2000x5000 label "Store" uses storage`,
    );
    const s = describePlan(src);
    expect(s.access.mainEntrance).toEqual({ door: "d_a", basis: "widest", candidates: ["d_a", "d_b"] });
    expect(s.access.rooms.map((r) => [r.id, r.depthFromEntrance, r.depthFromMainEntrance])).toEqual([
      ["r_hall", 1, 1],
      ["r_live", 2, 2],
      ["r_store", 1, null],
    ]);
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
