import { readdirSync, readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, describe as describePlan, ERROR_CATALOG, lint } from "../src/index.js";
import { DEFAULT_RULESET } from "../src/lint.js";
import { KITCHEN_FIX, WET_FIX } from "../src/lint/rules/per-room.js";
import type { World } from "../src/world.js";

/**
 * Four lint diagnostics whose text an agent must be able to act on WITHOUT a second guess.
 *
 * Each case is a minimal plan the fresh-agent audit (or its red team) hit, and each test is the
 * same proof of "self-correctable": the diagnostic fires; the edit its own hint text names is
 * read out of that text (never retyped here) and applied to the source; the diagnostic is gone
 * AND nothing new appears — a hint that trades one warning for another is not a fix.
 */

const of = (src: string, code: string) => lint(src).filter((d) => d.code === code);

/** Every code the plan raises, compile and lint, as a multiset. */
function codes(src: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of [...compile(src, { noCache: true }).diagnostics, ...lint(src)])
    m.set(d.code ?? "", (m.get(d.code ?? "") ?? 0) + 1);
  return m;
}

/** The codes `after` raises more often than `before` did — what an edit introduced. */
function gained(before: string, after: string): string[] {
  const a = codes(before);
  return [...codes(after)].filter(([c, n]) => n > (a.get(c) ?? 0)).map(([c]) => c);
}

/** Every backticked span of `text` that matches `re`. */
const allQuoted = (text: string, re: RegExp): string[] =>
  [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).filter((q) => re.test(q));

/** The first backticked span of `text` that matches `re`, or a test failure. */
function quoted(text: string, re: RegExp): string {
  const [q] = allQuoted(text, re);
  if (q === undefined) throw new Error(`no backticked match for ${re} in: ${text}`);
  return q;
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

describe("W_ROOM_NO_FIXTURE — the hint's statement compiles, clears it, and raises nothing new", () => {
  const BATH = `plan "Empty bath" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (3000,0) (3000,2500) (0,2500) close }
  room id=r_bath at (0,0) size 3000x2500 label "Bath" uses bath
  door id=d on w_out at 9500 width 900
}
`;
  const KITCHEN = BATH.replace('label "Bath" uses bath', 'label "Kitchen" uses kitchen').replace(/r_bath/g, "r_kit");
  // The door on the TOP wall, swinging in: `anchor top` would land the WC in its swing.
  const DOOR_ON_TOP = replaceOnce(
    BATH,
    "door id=d on w_out at 9500 width 900",
    "door id=d on w_out at 1500 width 900 swing in",
  );
  const POLY = replaceOnce(
    BATH,
    "room id=r_bath at (0,0) size 3000x2500",
    "room id=r_bath polygon (0,0) (3000,0) (3000,2500) (0,2500)",
  );
  const L_SHAPE = `plan "L bath" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (3000,0) (3000,1500) (1500,1500) (1500,3000) (0,3000) close }
  room id=r_bath polygon (0,0) (3000,0) (3000,1500) (1500,1500) (1500,3000) (0,3000) label "Bath" uses bath
  door id=d on w_out at 2000 width 900
}
`;

  for (const [name, src] of [
    ["bathroom", BATH],
    ["kitchen", KITCHEN],
    ["bathroom with its door on the top wall", DOOR_ON_TOP],
    ["polygon bathroom (`at (x,y)` form)", POLY],
    ["L-shaped bathroom", L_SHAPE],
  ] as const) {
    it(`${name}: fires, then the pasted statement clears it and raises nothing new`, () => {
      const [d] = of(src, "W_ROOM_NO_FIXTURE");
      expect(d).toBeDefined();
      const hint = d!.hints!.join(" ");
      expect(hint).not.toMatch(/`import|lib\/fixtures/);
      const stmt = quoted(hint, /^furniture /);
      if (src === POLY || src === L_SHAPE)
        expect(stmt).toMatch(/^furniture wc at \(\d+,\d+\) size \d+x\d+( rotate \d+)? in r_bath$/);
      const fixed = insert(src, stmt);
      expect(errorsOf(fixed)).toEqual([]);
      expect(of(fixed, "W_ROOM_NO_FIXTURE")).toEqual([]);
      expect(gained(src, fixed)).toEqual([]);
    });
  }

  it("a room with no clear wall run gets the footprint, not a statement that would collide", () => {
    // A 900 mm square closet whose only door swings across it.
    const tiny = `plan "Closet WC" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (900,0) (900,900) (0,900) close }
  room id=r_wc at (0,0) size 900x900 label "WC" uses wc
  door id=d on w_out at 450 width 800 swing in
}
`;
    const [d] = of(tiny, "W_ROOM_NO_FIXTURE");
    expect(d).toBeDefined();
    const hint = d!.hints!.join(" ");
    expect(allQuoted(hint, /^furniture /)).toEqual([]);
    expect(hint).toContain("make room first");
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

  it("anchored: fires with no machine fix; the hint's swapped size alone clears it, and no `rotate` is asked for", () => {
    const [d] = of(SRC, "W_FIXTURE_BACK_TO_ROOM");
    expect(d).toBeDefined();
    expect(d!.fixes ?? []).toEqual([]);
    const hint = d!.hints!.join(" ");
    expect(hint).not.toMatch(/let the rotation be derived\.$/); // the old, contradictory advice
    expect(allQuoted(hint, /^rotate /)).toEqual([]); // the anchor derives it
    const size = quoted(hint, /^size \d+x\d+$/);
    expect(size).toBe("size 700x400");
    const fixed = replaceOnce(SRC, "size 400x700", size);
    expect(of(fixed, "W_FIXTURE_BACK_TO_ROOM")).toEqual([]);
    expect(gained(SRC, fixed)).toEqual([]);
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
    expect(gained(at, fixed)).toEqual([]);
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

describe("W_FURNITURE_WALL_COLLISION — names the wall; `offset` is the CENTRE; a quoted offset is checked", () => {
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
  /** Fires, paste the hint's `offset`, gone and nothing new. */
  function pasteClears(src: string, from: string): void {
    const [d] = of(src, "W_FURNITURE_WALL_COLLISION");
    expect(d).toBeDefined();
    const offset = quoted(d!.hints!.join(" "), /^offset \d+$/);
    const fixed = replaceOnce(
      src,
      from,
      from.replace(/offset \d+|in r_kit$/, (m) => (m === "in r_kit" ? `${offset} in r_kit` : offset)),
    );
    expect(errorsOf(fixed)).toEqual([]);
    expect(of(fixed, "W_FURNITURE_WALL_COLLISION")).toEqual([]);
    expect(gained(src, fixed)).toEqual([]);
  }

  it("fires naming the crossed wall, and the hint's `offset` clears it", () => {
    const [d] = of(SRC, "W_FURNITURE_WALL_COLLISION");
    expect(d!.message).toBe(
      'Furniture "fridge" penetrates partition wall "w_part" at x 4000 — 100 mm into its 100 mm thickness.',
    );
    expect(d!.hints!.join(" ")).toContain("CENTRE");
    pasteClears(SRC, "furniture fridge against wall w_north offset 4100 in r_kit");
  });

  it("red-team repro A: near a stub partition and the segment end, the offset clears EVERY wall (no ping-pong)", () => {
    const stub = replaceOnce(
      insert(SRC, "wall id=w_p2 partition thickness 100 { (7300,0) (7300,1000) }"),
      "offset 4100 in r_kit",
      "offset 7400 in r_kit",
    );
    const [d] = of(stub, "W_FURNITURE_WALL_COLLISION");
    expect(d!.message).toContain('wall "w_p2"');
    expect(quoted(d!.hints!.join(" "), /^offset \d+$/)).toBe("offset 6950");
    pasteClears(stub, "furniture fridge against wall w_north offset 7400 in r_kit");
  });

  it("red-team repro B: no `offset` written (the midpoint) — the quoted offset keeps it in its room", () => {
    const mid = replaceOnce(
      SRC,
      "furniture fridge against wall w_north offset 4100 in r_kit",
      "furniture fridge against wall w_north in r_kit",
    );
    const [d] = of(mid, "W_FURNITURE_WALL_COLLISION");
    expect(quoted(d!.hints!.join(" "), /^offset \d+$/)).toBe("offset 4350");
    pasteClears(mid, "furniture fridge against wall w_north in r_kit");
  });

  it("no clear position on the wall: the hint says so instead of quoting a number", () => {
    const stubs = [4500, 5100, 5700, 6300, 6900, 7500]
      .map((x) => `wall partition thickness 100 { (${x},0) (${x},1000) }`)
      .reduce(insert, replaceOnce(SRC, "offset 4100 in r_kit", "offset 4800 in r_kit"));
    const [d] = of(stubs, "W_FURNITURE_WALL_COLLISION");
    expect(d).toBeDefined();
    const hint = d!.hints!.join(" ");
    expect(allQuoted(hint, /^offset \d+$/)).toEqual([]);
    expect(hint).toContain("move it to another wall or shorten it");
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

describe("W_PATH_TOO_NARROW — names the bottleneck door(s), once per bottleneck opening", () => {
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
  // The red team's series repro: hall —700 d_c— corridor —700 d_b— bath, every room walled.
  const SERIES = `plan "Doors in series" {
  units mm
  wall id=w_out exterior thickness 200 { (0,0) (9000,0) (9000,4000) (0,4000) close }
  wall id=w_1 partition thickness 100 { (3000,0) (3000,4000) }
  wall id=w_2 partition thickness 100 { (6000,0) (6000,4000) }
  room id=r_hall at (0,0) size 3000x4000 label "Hall" uses hall entry
  room id=r_corr at (3000,0) size 3000x4000 label "Corridor" uses circulation
  room id=r_bath at (6000,0) size 3000x4000 label "Bath" uses bath
  door id=d_front on w_out at 23000 width 900
  door id=d_c on w_1 at 2000 width 700
  door id=d_b on w_2 at 2000 width 700
  furniture wc in r_bath anchor top flush size 400x700
}
`;
  /** Apply every `Widen door "x" to \`width N\`` hint of `ds` to `src`. */
  function widenAll(src: string, hints: readonly string[]): string {
    let out = src;
    for (const h of hints) {
      const m = /^Widen (?:door|opening) "([^"]+)" to `width (\d+)`/.exec(h);
      if (!m) continue;
      out = out.replace(new RegExp(`(door id=${m[1]} [^\\n]*?)width \\d+`), `$1width ${m[2]}`);
    }
    return out;
  }

  it("one diagnostic for the one door (the bedroom → bath route through it is not repeated)", () => {
    expect(of(SRC, "W_PATH_TOO_NARROW").map((d) => d.message)).toEqual([
      'The walk from the entrance to "Bath" squeezes to 640 mm (60 mm below the 700 mm minimum) — the bottleneck is door "d_bath", 640 mm clear.',
    ]);
  });

  it("the hint's `width` on that door clears it, and raises nothing new", () => {
    const [d] = of(SRC, "W_PATH_TOO_NARROW");
    const fixed = widenAll(SRC, d!.hints!);
    expect(fixed).not.toBe(SRC);
    expect(of(fixed, "W_PATH_TOO_NARROW")).toEqual([]);
    expect(gained(SRC, fixed)).toEqual([]);
  });

  it("doors in series: the bath names BOTH doors, and widening every named door clears it", () => {
    const bath = of(SERIES, "W_PATH_TOO_NARROW").find((d) => d.message.includes('"Bath"'));
    expect(bath!.message).toBe(
      'The walk from the entrance to "Bath" squeezes to 640 mm (60 mm below the 700 mm minimum) — the bottlenecks are door "d_c" and door "d_b", each 640 mm clear: widen all of them.',
    );
    const fixed = widenAll(SERIES, bath!.hints!);
    expect(of(fixed, "W_PATH_TOO_NARROW")).toEqual([]);
    expect(gained(SERIES, fixed)).toEqual([]);
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
      expect(d.message).not.toContain("bottleneck");
      expect(d.hints!.join(" ")).not.toMatch(/`width \d+`/);
    }
  });

  it("dedupe only DROPS: over the corpus, the warnings are a sub-multiset of one per room plus one route per unwarned origin", () => {
    // The pre-dedupe selection, re-derived independently from `describe()`'s circulation facts:
    // every room under the minimum (measured or blocked), then each route under it whose origin
    // was not already warned, at most one per origin.
    const min = DEFAULT_RULESET.minPathClearWidthMm;
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
    let checked = 0;
    for (const dir of ["examples", "test/fixtures"]) {
      const abs = resolvePath(dir);
      for (const f of readdirSync(abs).filter((x) => x.endsWith(".arch"))) {
        const src = readFileSync(join(abs, f), "utf8");
        const world = worldFor(abs);
        type Storey = {
          rooms?: { id: string; label?: string }[];
          circulation?: {
            rooms: { roomId: string; bottleneckClearWidthMm: number }[];
            routes: { fromRoomId: string; bottleneckClearWidthMm: number }[];
            blocked?: { roomId: string }[];
          } | null;
        };
        const facts = describePlan(src, { world }) as Storey & { levels?: Storey[] };
        const allowed = new Map<string, number>();
        const bump = (k: string) => allowed.set(k, (allowed.get(k) ?? 0) + 1);
        for (const s of facts.levels ?? [facts]) {
          const c = s.circulation;
          if (!c) continue;
          const label = (id: string) => s.rooms?.find((r) => r.id === id)?.label ?? id;
          const warned = new Set<string>();
          for (const r of s.rooms ?? []) {
            const rc = c.rooms.find((x) => x.roomId === r.id);
            if (c.blocked?.some((b) => b.roomId === r.id) || (rc && rc.bottleneckClearWidthMm < min)) {
              warned.add(r.id);
              bump(`walk:${label(r.id)}`);
            }
          }
          for (const rt of c.routes) {
            if (rt.bottleneckClearWidthMm >= min || warned.has(rt.fromRoomId)) continue;
            warned.add(rt.fromRoomId);
            bump(`route:${label(rt.fromRoomId)}`);
          }
        }
        for (const d of lint(src, { world }).filter((x) => x.code === "W_PATH_TOO_NARROW")) {
          const walk = /^The walk from the entrance to "(.+?)" /.exec(d.message);
          const route = /^The route from "(.+?)" to /.exec(d.message);
          const k = walk ? `walk:${walk[1]}` : `route:${route![1]}`;
          const left = allowed.get(k) ?? 0;
          expect(left, `${f}: ${d.message}`).toBeGreaterThan(0);
          allowed.set(k, left - 1);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0); // the corpus does raise it, so the check ran
  });
});

describe("diagnostic texts name the `archlang` command, never the coreutils-shadowed `arch`", () => {
  const ARCH_CMD = /(^|[`"' (])arch [a-z]/;
  it("no catalog entry tells the reader to run `arch <cmd>`", () => {
    for (const [code, e] of Object.entries(ERROR_CATALOG)) {
      for (const field of [e.message, e.cause, e.fix, e.example]) {
        expect(field ?? "", code).not.toMatch(ARCH_CMD);
      }
    }
  });

  it("no lint message or hint over the shipped corpus does either (the door rules quote `repair`)", () => {
    let hints = 0;
    for (const dir of ["examples", "test/fixtures", "eval/faults", "eval/fidelity-plans"]) {
      const abs = resolvePath(dir);
      for (const f of readdirSync(abs).filter((x) => x.endsWith(".arch"))) {
        const src = readFileSync(join(abs, f), "utf8");
        for (const profile of [undefined, "accessibility-advisory"] as const) {
          for (const d of lint(src, profile ? { profile } : {})) {
            for (const t of [d.message, ...(d.hints ?? [])]) {
              expect(t, `${dir}/${f} ${d.code}`).not.toMatch(ARCH_CMD);
              if (t.includes("archlang repair")) hints++;
            }
          }
        }
      }
    }
    expect(hints).toBeGreaterThan(0); // the corpus does carry such a hint, so the check ran
  });
});
