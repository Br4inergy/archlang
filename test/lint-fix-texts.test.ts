import { describe, expect, it } from "vitest";
import { compile, ERROR_CATALOG, lint } from "../src/index.js";
import { KITCHEN_FIX, WET_FIX } from "../src/lint/rules/per-room.js";

/**
 * Four lint diagnostics whose text an agent must be able to act on WITHOUT a second guess.
 *
 * Each case is a minimal plan the fresh-agent audit hit, and each test is the same proof of
 * "self-correctable": the diagnostic fires; the ONE edit its own hint text names is read out
 * of that text (never retyped here) and applied to the source; the diagnostic is gone. A hint
 * that names the wrong value, a statement that does not compile, or a remedy the rule does not
 * honour all fail at the second `lint()`.
 */

const of = (src: string, code: string) => lint(src).filter((d) => d.code === code);

/** The first backticked span of `text` that matches `re`, or a test failure. */
function quoted(text: string, re: RegExp): string {
  for (const m of text.matchAll(/`([^`]+)`/g)) if (re.test(m[1]!)) return m[1]!;
  throw new Error(`no backticked match for ${re} in: ${text}`);
}

/** Replace exactly one occurrence of `from` in `src` (a test failure if there is not exactly one). */
function replaceOnce(src: string, from: string, to: string): string {
  const parts = src.split(from);
  if (parts.length !== 2) throw new Error(`expected one "${from}", found ${parts.length - 1}`);
  return parts.join(to);
}

/** Insert a statement before the plan's closing brace. */
const insert = (src: string, stmt: string): string => src.replace(/\}\s*$/, `  ${stmt}\n}\n`);

const errorsOf = (src: string) => compile(src, { noCache: true }).diagnostics.filter((d) => d.severity === "error");

describe("W_ROOM_NO_FIXTURE — the hint's statement compiles and clears it, no import", () => {
  const BATH = `plan "Empty bath" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (3000,0) (3000,2500) (0,2500) close }
  room id=r_bath at (0,0) size 3000x2500 label "Bath" uses bath
  door id=d on w_out at 9500 width 900
}
`;
  const KITCHEN = BATH.replace('label "Bath" uses bath', 'label "Kitchen" uses kitchen').replace(/r_bath/g, "r_kit");

  for (const [name, src] of [
    ["bathroom", BATH],
    ["kitchen", KITCHEN],
  ] as const) {
    it(`${name}: fires, then the pasted statement clears it`, () => {
      const [d] = of(src, "W_ROOM_NO_FIXTURE");
      expect(d).toBeDefined();
      const hint = d!.hints!.join(" ");
      expect(hint).not.toMatch(/`import|lib\/fixtures/);
      const stmt = quoted(hint, /^furniture /);
      const fixed = insert(src, stmt);
      expect(errorsOf(fixed)).toEqual([]);
      expect(of(fixed, "W_ROOM_NO_FIXTURE")).toEqual([]);
    });
  }

  it("a polygon room is offered the `at (x,y) … in <room>` form, never `anchor` (E_PLACE_POLY)", () => {
    const poly = BATH.replace(
      "room id=r_bath at (0,0) size 3000x2500",
      "room id=r_bath polygon (0,0) (3000,0) (3000,2500) (0,2500)",
    );
    const [d] = of(poly, "W_ROOM_NO_FIXTURE");
    const stmt = quoted(d!.hints!.join(" "), /^furniture /);
    expect(stmt).toMatch(/^furniture wc at \(x,y\) size \d+x\d+ in r_bath$/);
    const placed = insert(poly, stmt.replace("(x,y)", "(1300,0)"));
    expect(errorsOf(placed)).toEqual([]);
    expect(of(placed, "W_ROOM_NO_FIXTURE")).toEqual([]);
  });

  it("the catalog fix names only built-in categories, each in the right room kind", () => {
    const fix = ERROR_CATALOG.W_ROOM_NO_FIXTURE!.fix;
    expect(fix).not.toMatch(/`import|lib\/fixtures/);
    const [wet, kitchen] = fix.split("; a kitchen");
    const cats = (s: string) => [...s.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]!);
    const wetCats = cats(wet!.split("(e.g.")[0]!);
    const kitCats = cats(kitchen!.split("(e.g.")[0]!);
    expect(wetCats.length).toBeGreaterThan(0);
    expect(kitCats.length).toBeGreaterThan(0);
    for (const c of wetCats) expect(WET_FIX.has(c), `${c} is not a wet-room fixture`).toBe(true);
    for (const c of kitCats) expect(KITCHEN_FIX.has(c), `${c} is not a kitchen fixture`).toBe(true);
    // The two worked statements in the fix compile and satisfy the rule in rooms of those ids.
    for (const stmt of [...fix.matchAll(/`(furniture [^`]+)`/g)].map((m) => m[1]!)) {
      const room = /in (\w+) anchor/.exec(stmt)![1]!;
      const src = BATH.replace(/r_bath/g, room).replace("uses bath", room === "kitchen" ? "uses kitchen" : "uses bath");
      const placed = insert(src, stmt);
      expect(errorsOf(placed)).toEqual([]);
      expect(of(placed, "W_ROOM_NO_FIXTURE")).toEqual([]);
    }
  });
});

describe("W_FIXTURE_BACK_TO_ROOM — the size's aspect decides the wall; the hint swaps it", () => {
  // The audit's case: a WC anchored on the EAST wall at 400x700 (depth running along the wall).
  const SRC = `plan "Side-wall WC" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (4000,0) (4000,3000) (0,3000) close }
  room id=r_bath at (0,0) size 4000x3000 label "Bath" uses bath
  door id=d on w_out at 12000 width 900
  furniture wc in r_bath anchor right flush size 400x700
}
`;

  it("fires with no machine fix, and the hint's swapped size alone clears it", () => {
    const [d] = of(SRC, "W_FIXTURE_BACK_TO_ROOM");
    expect(d).toBeDefined();
    expect(d!.fixes ?? []).toEqual([]);
    const hint = d!.hints!.join(" ");
    expect(hint).not.toMatch(/let the rotation be derived\.$/); // the old, contradictory advice
    const size = quoted(hint, /^size \d+x\d+$/);
    expect(size).toBe("size 700x400");
    const fixed = replaceOnce(SRC, "size 400x700", size);
    expect(of(fixed, "W_FIXTURE_BACK_TO_ROOM")).toEqual([]);
  });

  it("at `at (x,y)`: the swapped size plus the hint's rotate clears it", () => {
    // Same WC hard against the east wall's inner face (x 3900), placed by coordinates.
    const at = replaceOnce(SRC, "in r_bath anchor right flush size 400x700", "at (3500,1150) size 400x700");
    const [d] = of(at, "W_FIXTURE_BACK_TO_ROOM");
    expect(d).toBeDefined();
    const hint = d!.hints!.join(" ");
    const size = quoted(hint, /^size \d+x\d+$/);
    const rotate = quoted(hint, /^rotate \d+$/);
    expect([size, rotate]).toEqual(["size 700x400", "rotate 90"]);
    // The box keeps its east edge on the wall face: 3900 − 700 = 3200.
    const fixed = replaceOnce(at, "at (3500,1150) size 400x700", `at (3200,1300) ${size} ${rotate}`);
    expect(errorsOf(fixed)).toEqual([]);
    expect(of(fixed, "W_FIXTURE_BACK_TO_ROOM")).toEqual([]);
    expect(of(fixed, "W_FURNITURE_WALL_COLLISION")).toEqual([]);
  });

  it("the catalog fix states the aspect rule with the WC example, and the example is true", () => {
    const fix = ERROR_CATALOG.W_FIXTURE_BACK_TO_ROOM!.fix;
    expect(fix).toContain("`size 400x700` against a north or south wall");
    expect(fix).toContain("`size 700x400` against an east or west one");
    // North wall at 400x700 and east wall at 700x400 are both clean when anchored.
    const north = replaceOnce(SRC, "anchor right flush size 400x700", "anchor top flush size 400x700");
    const east = replaceOnce(SRC, "anchor right flush size 400x700", "anchor right flush size 700x400");
    expect(of(north, "W_FIXTURE_BACK_TO_ROOM")).toEqual([]);
    expect(of(east, "W_FIXTURE_BACK_TO_ROOM")).toEqual([]);
  });
});

describe("W_FURNITURE_WALL_COLLISION — names the wall; `offset` is the CENTRE", () => {
  // The audit's case: a fridge `against wall w_north` whose `offset` was read as its left edge.
  const SRC = `plan "Fridge through a partition" {
  units mm
  wall id=w_north exterior thickness 200 { (0,0) (8000,0) }
  wall id=w_south exterior thickness 200 { (0,4000) (8000,4000) }
  wall id=w_west exterior thickness 200 { (0,0) (0,4000) }
  wall id=w_east exterior thickness 200 { (8000,0) (8000,4000) }
  wall id=w_part partition thickness 100 { (4000,0) (4000,4000) }
  room id=r_store at (0,0) size 4000x4000 label "Store"
  room id=r_kit at (4000,0) size 4000x4000 label "Kitchen" uses kitchen
  door on w_south at 6000 width 900
  door on w_part at 2000 width 900
  furniture fridge against wall w_north offset 4100 in r_kit
  furniture stove against wall w_north offset 5200 in r_kit
}
`;

  it("fires naming the crossed wall, and the hint's `offset` clears it", () => {
    const [d] = of(SRC, "W_FURNITURE_WALL_COLLISION");
    expect(d).toBeDefined();
    expect(d!.message).toBe(
      'Furniture "fridge" penetrates partition wall "w_part" at x 4000 — 100 mm into its 100 mm thickness.',
    );
    const hint = d!.hints!.join(" ");
    expect(hint).toContain("CENTRE");
    const offset = quoted(hint, /^offset \d+$/);
    const fixed = replaceOnce(SRC, "offset 4100", offset);
    expect(errorsOf(fixed)).toEqual([]);
    expect(of(fixed, "W_FURNITURE_WALL_COLLISION")).toEqual([]);
  });

  it("an `at (x,y)` piece is not told about `offset` it never wrote, and still learns the wall", () => {
    const at = replaceOnce(
      SRC,
      "furniture fridge against wall w_north offset 4100 in r_kit",
      "furniture fridge at (3800,100) size 600x650",
    );
    const [d] = of(at, "W_FURNITURE_WALL_COLLISION");
    expect(d!.message).toContain('wall "w_part"');
    expect(d!.hints!.join(" ")).not.toMatch(/`offset \d+`/);
  });
});

describe("W_PATH_TOO_NARROW — names the door, once per bottleneck", () => {
  // Bedroom and bath off one hall; the bath door is 700 nominal = 640 clear.
  const SRC = `plan "Narrow bath door" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (8000,0) (8000,5000) (0,5000) close }
  wall id=w_hall partition thickness 100 { (0,2500) (8000,2500) }
  wall id=w_mid partition thickness 100 { (4000,0) (4000,2500) }
  room id=r_bed at (0,0) size 4000x2500 label "Bedroom" uses bedroom
  room id=r_bath at (4000,0) size 4000x2500 label "Bath" uses bath
  room id=r_hall at (0,2500) size 8000x2500 label "Hall" uses hall entry
  door id=d_front on w_out at 22000 width 900
  door id=d_bed on w_hall at 2000 width 900
  door id=d_bath on w_hall at 6000 width 700
  window on w_out at 2000 width 1200
  furniture wc in r_bath anchor top-right flush size 400x700
  furniture basin in r_bath anchor top flush size 600x450
}
`;

  it("one diagnostic for the one door (the bedroom → bath route through it is not repeated)", () => {
    const ds = of(SRC, "W_PATH_TOO_NARROW");
    expect(ds.map((d) => d.message)).toEqual([
      'The walk from the entrance to "Bath" squeezes to 640 mm (60 mm below the 700 mm minimum) — the bottleneck is its door "d_bath", 640 mm clear.',
    ]);
  });

  it("the hint's `width` on that door clears it", () => {
    const [d] = of(SRC, "W_PATH_TOO_NARROW");
    const width = quoted(d!.hints!.join(" "), /^width \d+$/);
    const fixed = replaceOnce(
      SRC,
      "door id=d_bath on w_hall at 6000 width 700",
      `door id=d_bath on w_hall at 6000 ${width}`,
    );
    expect(of(fixed, "W_PATH_TOO_NARROW")).toEqual([]);
    expect(of(fixed, "W_DOOR_CLEARANCE")).toEqual([]);
  });

  it("a pinch the doors do not explain names no door (furniture, not a 900 door)", () => {
    // Widen the door to 900 (840 clear) and pinch the hall between the front door and the bath
    // door with two cabinets instead, leaving a 550 mm gap.
    const furnished = insert(
      insert(
        replaceOnce(SRC, "door id=d_bath on w_hall at 6000 width 700", "door id=d_bath on w_hall at 6000 width 900"),
        "furniture cabinet at (3000,2550) size 600x1500",
      ),
      "furniture cabinet at (3000,4600) size 600x300",
    );
    const ds = of(furnished, "W_PATH_TOO_NARROW");
    expect(ds.length).toBeGreaterThan(0); // the control: the pinch is real and reported
    for (const d of ds) {
      expect(d.message).not.toContain("bottleneck is");
      expect(d.hints!.join(" ")).not.toMatch(/`width \d+`/);
    }
  });
});

describe("diagnostic texts name the `archlang` command, never the coreutils-shadowed `arch`", () => {
  it("no catalog entry tells the reader to run `arch <cmd>`", () => {
    for (const [code, e] of Object.entries(ERROR_CATALOG)) {
      for (const field of [e.message, e.cause, e.fix, e.example]) {
        expect(field ?? "", code).not.toMatch(/(^|[`"' (])arch [a-z]/);
      }
    }
  });
});
