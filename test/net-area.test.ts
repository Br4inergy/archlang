/**
 * NET internal area (`describe().rooms[].net_area_m2`, `totals.net_floor_area_m2`; the rule:
 * `docs/adr/0027-net-internal-area.md`, the code: `src/analyze/net-area.ts`).
 *
 * Three kinds of evidence, each independent of the code under test in its own way:
 *
 * 1. The agent-UX audit plan's numbers, derived by hand from its walls (the card's DoD).
 * 2. Hand-computed insets for small rooms whose answer is a product a reader can check: a
 *    rectangle, a rectangle of four different walls, an open side, an L with an inside corner,
 *    a part-walled edge, a 3-4-5 triangle (an oblique ring, inset to a similar triangle) and a
 *    circle walled all round or half round.
 * 3. A property over every room of the corpus (examples, fixtures, recovery plans, eval goldens
 *    and fidelity plans, the docs gallery): net ≤ area, net > 0 wherever area > 0, and on every
 *    rectilinear room the slab sweep and the inset-ring construction agree — two procedures that
 *    share nothing past the stretches they read.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { describe as suite, expect, it } from "vitest";
import { describe as describePlan } from "../src/index.js";
import { resolvePlan, roomAreaMm2, roomNetAreaMm2 } from "../src/analyze.js";
import { insetRingArea, rectilinearNetArea, ringStretches } from "../src/analyze/net-area.js";
import { segmentsOfWall } from "../src/geometry.js";
import type { RRoom } from "../src/ir.js";
import type { World } from "../src/world.js";

const plan = (body: string): string => `plan "P" {\n  units mm\n${body}\n}\n`;

/** The one room's net area in mm², exactly as computed (no rounding), and its describe() row. */
function measure(src: string, id: string): { mm2: number; m2: number; area_m2: number } {
  const { ir } = resolvePlan(src);
  if (!ir) throw new Error("plan did not resolve");
  const room = ir.elements.find((e): e is RRoom => e.kind === "room" && e.id === id)!;
  const segs = ir.walls.flatMap((w) => segmentsOfWall(w));
  const row = describePlan(src).rooms.find((r) => r.id === id)!;
  return { mm2: roomNetAreaMm2(room, segs), m2: row.net_area_m2, area_m2: row.area_m2 };
}

suite("net area — the agent-UX audit plan (the card's numbers, by hand)", () => {
  // test/callout-fixtures/agent-ux-flat.arch is the audit plan verbatim under a header.
  const src = readFileSync(resolvePath("test/callout-fixtures/agent-ux-flat.arch"), "utf8");
  const s = describePlan(src);
  const net = (id: string): number => s.rooms.find((r) => r.id === id)!.net_area_m2;

  it("Bedroom 1 nets 11.56 m²: 3450 × 3350 inside a 200 shell on two sides and 100 partitions on two", () => {
    // 3600 − 100 (w_west) − 50 (w_hall_w) = 3450; 3500 − 100 (w_north) − 50 (w_beds) = 3350.
    expect(net("r_bed1")).toBe(11.56);
    expect(measure(src, "r_bed1").mm2).toBe(3450 * 3350);
  });

  it("each room is its centreline rectangle less half of each of its own walls", () => {
    expect(measure(src, "r_bed2").mm2).toBe((3600 - 100 - 50) * (3000 - 50 - 100)); // 3450 × 2850
    expect(measure(src, "r_bath").mm2).toBe((2000 - 50 - 50) * (2200 - 100 - 50)); // 1900 × 2050
    expect(measure(src, "r_hall").mm2).toBe((2000 - 50 - 50) * (4300 - 50 - 100)); // 1900 × 4150
    expect(measure(src, "r_live").mm2).toBe((4400 - 50 - 100) * (6500 - 100 - 100)); // 4250 × 6300
  });

  it("reports about 60.0 m² net beside the 65.00 m² centreline total", () => {
    expect(s.totals.floor_area_m2).toBe(65);
    // The sum of the rooms' rounded nets, as floor_area_m2 sums the rounded areas: 59.96
    // (the unrounded sum is 59.945 m²).
    expect(s.totals.net_floor_area_m2).toBe(59.96);
    expect(s.totals.net_floor_area_m2).toBeCloseTo(60.0, 0);
  });

  it("the drawn ROOM SCHEDULE carries the same net figures", () => {
    expect(s.schedule!.map((r) => r.net_area_m2)).toEqual(s.rooms.map((r) => r.net_area_m2));
  });
});

suite("net area — hand-checked rooms", () => {
  it("a rectangle inside one wall all round: (w − t) × (h − t)", () => {
    const src = plan(
      "  wall exterior thickness 200 { (0,0) (4000,0) (4000,3000) (0,3000) close }\n  room id=r at (0,0) size 4000x3000",
    );
    expect(measure(src, "r").mm2).toBe(3800 * 2800);
    expect(measure(src, "r").m2).toBe(10.64);
  });

  it("each wall insets by ITS OWN half-thickness: 300 shell, 100 and 200 partitions", () => {
    const src = plan(
      [
        "  wall exterior thickness 300 { (0,4000) (0,0) (5000,0) }",
        "  wall partition thickness 100 { (5000,0) (5000,4000) }",
        "  wall partition thickness 200 { (0,4000) (5000,4000) }",
        "  room id=r at (0,0) size 5000x4000",
      ].join("\n"),
    );
    // x: 5000 − 150 − 50; y: 4000 − 150 − 100.
    expect(measure(src, "r").mm2).toBe(4800 * 3750);
    expect(measure(src, "r").m2).toBe(18);
  });

  it("an edge with no wall is not inset", () => {
    const src = plan(
      "  wall exterior thickness 200 { (0,3000) (0,0) (4000,0) (4000,3000) }\n  room id=r at (0,0) size 4000x3000",
    );
    // The south side is open: 3800 wide, 3000 − 100 deep.
    expect(measure(src, "r").mm2).toBe(3800 * 2900);
  });

  it("a room with no wall on it nets its whole area", () => {
    const src = plan("  room id=r at (0,0) size 4000x3000");
    const m = measure(src, "r");
    expect(m.mm2).toBe(4000 * 3000);
    expect(m.m2).toBe(m.area_m2);
  });

  it("an L: the inside corner's square is wall, not floor", () => {
    const src = plan(
      [
        "  wall exterior thickness 200 { (0,0) (6000,0) (6000,3000) (3000,3000) (3000,6000) (0,6000) close }",
        "  room id=r polygon (0,0) (6000,0) (6000,3000) (3000,3000) (3000,6000) (0,6000)",
      ].join("\n"),
    );
    // Inset by 100 all round: the 5800 × 2800 top bar and the 2800 × 3000 leg below it,
    // meeting at the inset corner (2900, 2900) — the 100 × 100 square at (2900..3000,
    // 2900..3000) lies in both walls' corner and is not floor.
    expect(measure(src, "r").mm2).toBe(5800 * 2800 + 2800 * 3000);
    expect(measure(src, "r").area_m2).toBe(27);
    expect(measure(src, "r").m2).toBe(24.64);
  });

  it("a part-walled edge steps square where its wall ends", () => {
    const src = plan(
      [
        "  wall exterior thickness 200 { (2000,0) (0,0) (0,3000) (6000,3000) (6000,0) }",
        "  room id=r at (0,0) size 6000x3000",
      ].join("\n"),
    );
    // The north wall runs only from x 0 to 2000. Without it the floor is 5800 × 2900 (from
    // y 0); its band takes 1900 × 100 back (x 100..2000, y 0..100).
    expect(measure(src, "r").mm2).toBe(5800 * 2900 - 1900 * 100);
  });

  it("an oblique ring: a 3-4-5 triangle walled all round insets to a similar triangle", () => {
    const src = plan(
      "  wall exterior thickness 200 { (0,0) (4000,0) (0,3000) close }\n  room id=r polygon (0,0) (4000,0) (0,3000)",
    );
    // Inradius = area / semi-perimeter = 6e6 / 6000 = 1000; inset by 100 scales it by 0.9.
    expect(measure(src, "r").mm2).toBeCloseTo(6e6 * 0.81, 3);
    expect(measure(src, "r").m2).toBe(4.86);
  });

  it("a circle walled all round by one concentric arc wall: π(r − t/2)²", () => {
    const src = plan(
      [
        "  wall exterior thickness 200 { (8000,5000) arc (2000,5000) radius 3000 arc (8000,5000) radius 3000 }",
        "  room id=r circle at (5000,5000) radius 3000",
      ].join("\n"),
    );
    expect(measure(src, "r").mm2).toBe(Math.PI * 2900 * 2900);
    expect(measure(src, "r").m2).toBe(26.42);
  });

  it("a circle walled half round: the walled half inset, the open half not", () => {
    const src = plan(
      [
        "  wall exterior thickness 200 { (8000,5000) arc (2000,5000) radius 3000 }",
        "  room id=r circle at (5000,5000) radius 3000",
      ].join("\n"),
    );
    expect(measure(src, "r").mm2).toBeCloseTo((Math.PI * 2900 * 2900) / 2 + (Math.PI * 3000 * 3000) / 2, 3);
    expect(measure(src, "r").m2).toBe(27.35);
  });

  it("a straight wall never insets a circle, and an arc never insets a straight edge", () => {
    const circle = plan(
      "  wall exterior thickness 200 { (2000,2000) (8000,2000) (8000,8000) (2000,8000) close }\n  room id=r circle at (5000,5000) radius 3000",
    );
    expect(measure(circle, "r").mm2).toBe(Math.PI * 3000 * 3000);
    // A rectangle whose south edge is the chord of an outward bay: the arc's ends sit on the
    // edge, but it is not the edge's wall, so the edge is open along the chord.
    const bay = plan(
      [
        "  wall exterior thickness 200 { (0,3000) (0,0) (4000,0) (4000,3000) (3000,3000) arc (1000,3000) radius 1000 (0,3000) }",
        "  room id=r at (0,0) size 4000x3000",
      ].join("\n"),
    );
    // 3800 wide; depth 2900 along the 2000 of chord, 2800 along the 1000 + 1000 of straight
    // wall either side of it, less the 100 each end that the side walls already took.
    expect(measure(bay, "r").mm2).toBe(3800 * 2900 - (900 + 900) * 100);
  });
});

// ---------------------------------------------------------------------------

const CORPUS_DIRS = [
  "examples",
  "test/fixtures",
  "test/callout-fixtures",
  "test/finish-fixtures",
  "test/recovery-corpus",
  "eval/goldens",
  "eval/fidelity-plans",
  "eval/faults",
  "docs/gallery",
];

function archFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...archFiles(p));
    else if (name.endsWith(".arch")) out.push(p);
  }
  return out;
}

const worldFor = (dir: string): World => ({
  read: (p) => {
    try {
      return readFileSync(resolvePath(dir, p), "utf8");
    } catch {
      return null;
    }
  },
  now: () => new Date(0),
});

const ringOf = (r: RRoom) =>
  r.poly ?? [
    { x: r.at.x, y: r.at.y },
    { x: r.at.x + r.size.w, y: r.at.y },
    { x: r.at.x + r.size.w, y: r.at.y + r.size.h },
    { x: r.at.x, y: r.at.y + r.size.h },
  ];

suite("net area — a property of every room in the corpus", () => {
  const files = CORPUS_DIRS.flatMap((d) => archFiles(resolvePath(d)));
  const rooms: { where: string; room: RRoom; segs: ReturnType<typeof segmentsOfWall> }[] = [];
  for (const f of files) {
    const { ir, levels } = resolvePlan(readFileSync(f, "utf8"), { world: worldFor(dirname(f)) });
    if (!ir) continue;
    for (const storey of levels.length > 0 ? levels.map((l) => l.ir) : [ir]) {
      const segs = storey.walls.flatMap((w) => segmentsOfWall(w));
      for (const e of storey.elements)
        if (e.kind === "room") rooms.push({ where: `${f.slice(resolvePath(".").length + 1)} ${e.id}`, room: e, segs });
    }
  }

  it("is a real corpus: hundreds of rooms, most of them inset by a wall", () => {
    expect(files.length).toBeGreaterThan(90);
    expect(rooms.length).toBeGreaterThan(500);
    const inset = rooms.filter((r) => roomNetAreaMm2(r.room, r.segs) < roomAreaMm2(r.room));
    expect(inset.length).toBeGreaterThan(450);
    // Every shape the rule names is in it: polygons, circles, rectangles.
    expect(rooms.some((r) => r.room.circle)).toBe(true);
    expect(rooms.some((r) => r.room.poly && !r.room.circle)).toBe(true);
  });

  it("net ≤ area for every room, and net > 0 for every room with area > 0", () => {
    const bad: string[] = [];
    for (const { where, room, segs } of rooms) {
      const gross = roomAreaMm2(room);
      const net = roomNetAreaMm2(room, segs);
      if (!(net <= gross)) bad.push(`${where}: net ${net} > area ${gross}`);
      if (gross > 0 && !(net > 0)) bad.push(`${where}: net ${net} with area ${gross}`);
    }
    expect(bad).toEqual([]);
  });

  it("on every rectilinear room the slab sweep and the inset ring give one area", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const { where, room, segs } of rooms) {
      if (room.circle) continue;
      const ring = ringOf(room);
      if (!ring.every((a, i) => a.x === ring[(i + 1) % ring.length]!.x || a.y === ring[(i + 1) % ring.length]!.y))
        continue;
      const stretches = ringStretches(ring, segs);
      const slab = rectilinearNetArea(ring, stretches);
      const inset = insetRingArea(ring, stretches);
      checked++;
      if (Math.abs(slab - inset) > 1e-6) bad.push(`${where}: slab ${slab} vs ring ${inset}`);
    }
    expect(checked).toBeGreaterThan(500);
    expect(bad).toEqual([]);
  });

  it("describe() reports the same inequality after rounding, on every example", () => {
    for (const f of archFiles(resolvePath("examples"))) {
      const s = describePlan(readFileSync(f, "utf8"), { world: worldFor(dirname(f)) });
      for (const r of (s.levels ?? [s]).flatMap((l) => l.rooms)) {
        expect(r.net_area_m2).toBeLessThanOrEqual(r.area_m2);
        if (r.area_m2 > 0) expect(r.net_area_m2).toBeGreaterThan(0);
      }
    }
  });
});
