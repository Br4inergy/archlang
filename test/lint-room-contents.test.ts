import { readdirSync, readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { USE_KINDS } from "../src/ast.js";
import { describe as describePlan, finish, FURNISH_TABLE, lint } from "../src/index.js";
import { CATALOG_CATEGORIES } from "../src/fixtures-catalog.js";
import { DEFINING, definingItems } from "../src/lint/defining.js";
import type { World } from "../src/world.js";

/**
 * `W_HABITABLE_NO_WINDOW` (PS2.8) and `W_ROOM_MISSING_DEFINING` (PS2.9): each fires on the
 * defect, is silent on its fix, and stays out of the territory of the rule beside it
 * (`W_BEDROOM_NO_WINDOW`, `W_ROOM_NO_FIXTURE`). The defining pieces are a reading of
 * `FURNISH_TABLE`, and the guards below hold that reading to the table, never a retyped list.
 */

const codesOf = (src: string): string[] => lint(src).map((d) => d.code ?? "");
const only = (src: string, code: string) => lint(src).filter((d) => d.code === code);

/** Two rooms side by side; `{L}`/`{R}` are the rooms' trailing clauses, `{X}` extra statements. */
const PAIR = (left: string, right: string, extra = ""): string => `plan "Pair" {
  units mm
  grid 50
  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,4000) (0,4000) close }
  wall id=w_mid partition thickness 100 { (4000,0) (4000,4000) }
  room id=r_a at (0,0) size 4000x4000 ${left}
  room id=r_b at (4000,0) size 4000x4000 ${right}
  door id=d_entry at (2000,4000) width 900 wall shell
  door id=d_mid at (4000,2000) width 800 wall w_mid
${extra}}
`;

describe("W_HABITABLE_NO_WINDOW", () => {
  const WIN_A = "  window at (2000,0) width 1500 wall shell\n";
  const WIN_B = "  window at (6000,0) width 1500 wall shell\n";

  for (const use of ["living", "dining", "kitchen"]) {
    it(`fires on a ${use} room with no window, and is silent once it has one`, () => {
      const bare = PAIR(`label "Room A" uses ${use}`, 'label "Store" uses storage', WIN_B);
      const ds = only(bare, "W_HABITABLE_NO_WINDOW");
      expect(ds).toHaveLength(1);
      expect(ds[0]!.message).toMatch(/^(Living room|Dining room|Kitchen) "Room A" \(16 m²\) has no window on any/);
      expect(ds[0]!.message).not.toContain("r_a");
      expect(ds[0]!.hints!.join(" ")).toContain("`shell`");
      expect(ds[0]!.hints!.join(" ")).toContain("`r_a`");
      expect(ds[0]!.fixes).toBeUndefined();
      expect(codesOf(PAIR(`label "Room A" uses ${use}`, 'label "Store" uses storage', WIN_A + WIN_B))).not.toContain(
        "W_HABITABLE_NO_WINDOW",
      );
    });
  }

  it('reads a label-only living room (no `uses`): "Living" classifies', () => {
    const src = PAIR('label "Living"', 'label "Bed" uses bedroom', WIN_B);
    expect(only(src, "W_HABITABLE_NO_WINDOW").map((d) => d.message)).toEqual([
      'Living room "Living" (16 m²) has no window on any of its walls; a room people live in needs daylight.',
    ]);
  });

  it("never reports a bedroom (that is W_BEDROOM_NO_WINDOW), even one that is also a living room", () => {
    const src = PAIR('label "Studio" uses bedroom living kitchen', 'label "Store" uses storage', WIN_B);
    const codes = codesOf(src);
    expect(codes).toContain("W_BEDROOM_NO_WINDOW");
    expect(codes).not.toContain("W_HABITABLE_NO_WINDOW");
  });

  it("never asks a bath, WC, hall, store or an unclassified room", () => {
    for (const clause of ['label "Bath" uses bath', 'label "WC" uses wc', 'label "Hall" uses hall', 'label "Room 1"']) {
      expect(codesOf(PAIR(clause, 'label "Store" uses storage', WIN_B)), clause).not.toContain("W_HABITABLE_NO_WINDOW");
    }
  });

  it("measures a polygon room on its own ring", () => {
    const L = (win: string) => `plan "L living" {
  units mm
  grid 50
  wall id=shell exterior thickness 200 { (0,0) (6000,0) (6000,3000) (3000,3000) (3000,6000) (0,6000) close }
  room id=r_l polygon (0,0) (6000,0) (6000,3000) (3000,3000) (3000,6000) (0,6000) label "Living" uses living
  door id=d at (1500,6000) width 900 wall shell
${win}}
`;
    expect(codesOf(L(""))).toContain("W_HABITABLE_NO_WINDOW");
    // On the inner corner's edge (x 3000, y 3000..6000): an edge the bounding box does not have.
    expect(codesOf(L("  window at (3000,4500) width 1200 wall shell\n"))).not.toContain("W_HABITABLE_NO_WINDOW");
  });

  it("says nothing when a window stands on an arc edge of the room (attribution unknown; PS0.12)", () => {
    const BAY = (glazed: boolean) => `plan "Bay" {
  units mm
  grid 50
  wall id=shell exterior thickness 200 { (0,0) (4800,0) (4800,6000) (4000,6000) arc (1400,6000) radius 2000 cw (0,6000) close }
  room id=r_living at (0,0) size 4800x6000 label "Living" uses living
  door id=d_garden at (700,6000) width 900 wall shell swing out
${glazed ? "  window id=win_bay on shell at 13000 width 1200\n" : ""}}
`;
    // The bay's window is on the arc, so describe gives it to no room; the solid bay is the defect.
    const glazed = BAY(true);
    const facts = describePlan(glazed) as { windows: { id: string; room: string | null }[] };
    expect(facts.windows).toEqual([expect.objectContaining({ id: "win_bay", room: null })]);
    expect(codesOf(glazed)).not.toContain("W_HABITABLE_NO_WINDOW");
    expect(codesOf(BAY(false))).toContain("W_HABITABLE_NO_WINDOW");
  });

  it("names only an outside face: an exterior wall shared with an attached wing is not one", () => {
    const src = `plan "Wing" {
  units mm
  grid 50
  wall id=shell exterior thickness 200 { (0,0) (4000,0) (4000,4000) (0,4000) close }
  wall id=w_wing exterior thickness 200 { (0,0) (-3000,0) (-3000,4000) (0,4000) }
  room id=r_l at (0,0) size 4000x4000 label "Living" uses living
  room id=r_g at (-3000,0) size 3000x4000 label "Garage" uses garage
  door id=d at (2000,4000) width 900 wall shell
  door id=d2 at (0,2000) width 900 wall shell
  window at (-1500,0) width 1200 wall w_wing
}
`;
    const [d] = only(src, "W_HABITABLE_NO_WINDOW");
    expect(d!.hints![0]).toBe("Add a `window` on wall `shell`, which runs along this room's (`r_l`) outside edge.");
  });

  it("names no wall the source cannot name: a generated wall id stays out of the hint", () => {
    const src = `plan "Anon" {
  units mm
  wall exterior thickness 200 { (0,0) (4000,0) (4000,4000) (0,4000) close }
  room id=r_l at (0,0) size 4000x4000 label "Living" uses living
  door id=d at (2000,4000) width 900 wall exterior
}
`;
    const [d] = only(src, "W_HABITABLE_NO_WINDOW");
    expect(d!.hints![0]).toBe(
      "Add a `window` on the `exterior` wall that runs along this room's (`r_l`) outside edge.",
    );
  });

  it("reads the window fact describe reads: a room describe gives a window is never reported", () => {
    const worldFor = (dir: string): World => ({
      read: (p) => {
        try {
          return readFileSync(resolvePath(dir, p), "utf8");
        } catch {
          return null;
        }
      },
    });
    let checked = 0;
    for (const dir of ["examples", "test/fixtures", "test/defect-corpus/daylight"]) {
      const abs = resolvePath(dir);
      for (const f of readdirSync(abs).filter((n) => n.endsWith(".arch"))) {
        const src = readFileSync(join(abs, f), "utf8");
        const world = worldFor(abs);
        type Storey = { windows?: { room: string | null }[]; rooms?: { id: string; label?: string }[] };
        const facts = describePlan(src, { world }) as Storey & { levels?: Storey[] };
        const lit = new Set((facts.levels ?? [facts]).flatMap((s) => (s.windows ?? []).map((w) => w.room)));
        const labelled = new Map(
          (facts.levels ?? [facts]).flatMap((s) => (s.rooms ?? []).map((r) => [r.label ?? r.id, r.id])),
        );
        for (const d of lint(src, { world }).filter((x) => x.code === "W_HABITABLE_NO_WINDOW")) {
          const label = /"([^"]+)"/.exec(d.message)![1]!;
          expect(lit.has(labelled.get(label) ?? label), `${dir}/${f}: ${d.message}`).toBe(false);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("W_ROOM_MISSING_DEFINING", () => {
  const BED = 'label "Bedroom 2" uses bedroom';
  const LIVING = 'label "Living" uses living';
  const WINS = "  window at (2000,0) width 1500 wall shell\n  window at (6000,0) width 1500 wall shell\n";

  it("fires on a furnished bedroom with no bed, naming what it holds; the id is in the hints only", () => {
    const src = PAIR(
      LIVING,
      BED,
      `${WINS}  furniture wardrobe in r_b anchor top-right flush size 1800x600\n  furniture desk in r_b anchor bottom-right flush size 1200x600\n`,
    );
    const ds = only(src, "W_ROOM_MISSING_DEFINING");
    expect(ds.map((d) => d.message)).toEqual([
      '"Bedroom 2" is furnished (wardrobe, desk) but has no bed: the piece that makes it a bedroom.',
    ]);
    expect(ds[0]!.hints!.some((h) => h.includes("in r_b"))).toBe(true);
    expect(ds[0]!.fixes).toBeUndefined();
  });

  it("is silent once the bed is there, and a `double_bed` is a bed (the catalogue's `serves`)", () => {
    for (const bed of ["bed", "double_bed"]) {
      const src = PAIR(
        LIVING,
        BED,
        `${WINS}  furniture wardrobe in r_b anchor top-right flush size 1800x600\n  furniture ${bed} in r_b anchor bottom flush size 1500x2000\n`,
      );
      expect(codesOf(src), bed).not.toContain("W_ROOM_MISSING_DEFINING");
    }
  });

  it("never reports an empty room: an empty bath or kitchen is W_ROOM_NO_FIXTURE's", () => {
    for (const clause of [
      BED,
      'label "Bath" uses bath',
      'label "Kitchen" uses kitchen',
      'label "Dining" uses dining',
    ]) {
      expect(codesOf(PAIR(LIVING, clause, WINS)), clause).not.toContain("W_ROOM_MISSING_DEFINING");
    }
    // A kitchen holding only a table is furnished, but it has no kitchen fixture at all: one
    // report, W_ROOM_NO_FIXTURE's, not two.
    const kit = PAIR(
      LIVING,
      'label "Kitchen" uses kitchen',
      `${WINS}  furniture table in r_b centered size 1200x800\n`,
    );
    expect(codesOf(kit)).toContain("W_ROOM_NO_FIXTURE");
    expect(codesOf(kit)).not.toContain("W_ROOM_MISSING_DEFINING");
  });

  it("asks a bath for a bathtub or shower only, and a WC for a WC only", () => {
    const bath = (pieces: string) =>
      PAIR(
        LIVING,
        'label "Bath" uses bath',
        `${WINS}${pieces
          .split(",")
          .map(
            (p) =>
              `  furniture ${p} against wall shell segment 1 offset ${1000 + 1200 * pieces.split(",").indexOf(p)} in r_b\n`,
          )
          .join("")}`,
      );
    expect(only(bath("wc,basin"), "W_ROOM_MISSING_DEFINING").map((d) => d.message)).toEqual([
      '"Bath" is furnished (wc, basin) but has no bathtub or shower: the piece that makes it a bathroom.',
    ]);
    // A shower room with no WC is a shower room, not a defect.
    expect(codesOf(bath("shower,basin"))).not.toContain("W_ROOM_MISSING_DEFINING");
    const wc = (pieces: string) =>
      PAIR(
        LIVING,
        'label "WC" uses wc',
        `${WINS}  furniture ${pieces} against wall shell segment 1 offset 1000 in r_b\n`,
      );
    expect(codesOf(wc("wc"))).not.toContain("W_ROOM_MISSING_DEFINING");
    expect(only(wc("basin"), "W_ROOM_MISSING_DEFINING").map((d) => d.message)).toEqual([
      '"WC" is furnished (basin) but has no wc: the piece that makes it a WC.',
    ]);
  });

  it("asks a kitchen for its sink and its hob; a `hob` is a stove, a bare `sink` a kitchen sink", () => {
    const kit = (pieces: string[]) =>
      PAIR(
        LIVING,
        'label "Kitchen" uses kitchen',
        `${WINS}${pieces.map((p, i) => `  furniture ${p} against wall shell segment 1 offset ${800 + 900 * i} in r_b\n`).join("")}`,
      );
    expect(only(kit(["fridge"]), "W_ROOM_MISSING_DEFINING").map((d) => d.message)).toEqual([
      '"Kitchen" is furnished (fridge) but has no kitchen sink and no stove: the pieces that make it a kitchen.',
    ]);
    expect(codesOf(kit(["sink", "hob", "fridge"]))).not.toContain("W_ROOM_MISSING_DEFINING");
  });

  it("does not check a living room (no one piece defines it)", () => {
    const src = PAIR(LIVING, 'label "Snug" uses living', `${WINS}  furniture armchair in r_b centered size 900x850\n`);
    expect(codesOf(src)).not.toContain("W_ROOM_MISSING_DEFINING");
  });

  it("reads a label-only dining room, and an unclassified room is skipped", () => {
    const sofa = "  furniture sofa in r_b anchor bottom flush size 2000x900\n";
    expect(only(PAIR(LIVING, 'label "Dining"', WINS + sofa), "W_ROOM_MISSING_DEFINING").map((d) => d.message)).toEqual([
      '"Dining" is furnished (sofa) but has no dining table: the piece that makes it a dining room.',
    ]);
    expect(codesOf(PAIR(LIVING, 'label "Room 2"', WINS + sofa))).not.toContain("W_ROOM_MISSING_DEFINING");
  });

  it("reads containment off a polygon room's ring: a bed in the notch of an L is not the L's", () => {
    const L = (bedAt: string) => `plan "L bedroom" {
  units mm
  grid 50
  wall id=shell exterior thickness 200 { (0,0) (6000,0) (6000,6000) (0,6000) close }
  wall id=w_l partition thickness 100 { (3000,3000) (6000,3000) }
  wall id=w_l2 partition thickness 100 { (3000,3000) (3000,6000) }
  room id=r_l polygon (0,0) (6000,0) (6000,3000) (3000,3000) (3000,6000) (0,6000) label "Bedroom" uses bedroom
  room id=r_n at (3000,3000) size 3000x3000 label "Store" uses storage
  door id=d at (1500,6000) width 900 wall shell
  door id=d2 at (4500,3000) width 800 wall w_l
  window at (1500,0) width 1200 wall shell
  furniture wardrobe at (300,300) size 1800x600
  furniture bed at ${bedAt} size 1500x2000
}
`;
    // Centre (4500, 4500): inside the L's bounding box, outside its floor.
    expect(codesOf(L("(3750,3500)"))).toContain("W_ROOM_MISSING_DEFINING");
    expect(codesOf(L("(750,3500)"))).not.toContain("W_ROOM_MISSING_DEFINING");
  });

  it("the statements its hint quotes, applied together, clear it and raise nothing new (both profiles)", () => {
    const dir = resolvePath("test/defect-corpus/missing-defining-contents");
    const cases = readdirSync(dir).filter((f) => f.endsWith(".arch") && !f.endsWith(".clean.arch"));
    let applied = 0;
    for (const f of cases) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const profile of [undefined, "accessibility-advisory"] as const) {
        const o = profile ? { profile } : {};
        const all = (s: string) => {
          const m = new Map<string, number>();
          for (const d of lint(s, o)) m.set(d.code ?? "", (m.get(d.code ?? "") ?? 0) + 1);
          return m;
        };
        const [d] = lint(src, o).filter((x) => x.code === "W_ROOM_MISSING_DEFINING");
        if (d === undefined) continue; // the todo case (no worktop) does not fire yet
        const stmts = [...d.hints![0]!.matchAll(/`(furniture [^`]+)`/g)].map((m) => m[1]!);
        expect(stmts.length, `${f}: ${d.hints![0]}`).toBeGreaterThan(0);
        const fixed = stmts.reduce((s, q) => s.replace(/\}\s*$/, `  ${q}\n}\n`), src);
        const before = all(src);
        const gained = [...all(fixed)].filter(([c, n]) => n > (before.get(c) ?? 0)).map(([c]) => c);
        expect(
          lint(fixed, o).filter((x) => x.code === "W_ROOM_MISSING_DEFINING"),
          f,
        ).toEqual([]);
        expect(gained, `${f} (${profile ?? "default"})`).toEqual([]);
        applied++;
      }
    }
    expect(applied).toBe(6); // three firing cases × two profiles
  });

  it("guard: every use whose furnish row marks a piece required has a reading here", () => {
    const rowed = USE_KINDS.filter((u) => (FURNISH_TABLE[u] ?? []).some((i) => i.required));
    expect(rowed.length).toBeGreaterThan(0);
    for (const u of rowed) expect(DEFINING[u], u).toBeDefined();
    // ... and no reading names a use the table has no row for.
    for (const u of Object.keys(DEFINING)) expect(FURNISH_TABLE[u as keyof typeof FURNISH_TABLE], u).toBeDefined();
  });

  it("guard: every pick names an item of its row, and every defining word is a catalogue word", () => {
    for (const [u, spec] of Object.entries(DEFINING)) {
      const row = FURNISH_TABLE[u as keyof typeof FURNISH_TABLE]!;
      if (typeof spec === "object" && "pick" in spec) {
        for (const c of spec.pick)
          expect(
            row.some((i) => i.category === c),
            `${u}: ${c}`,
          ).toBe(true);
      }
      for (const i of definingItems(u as keyof typeof FURNISH_TABLE)) {
        expect(row, u).toContain(i); // the row's own item, so a room holding its full row holds it
        for (const w of [i.category, ...(i.or ?? [])]) expect(CATALOG_CATEGORIES, w).toContain(w);
      }
    }
    // The readings the doc comment states, so a table edit that changes them is seen.
    const words = (u: keyof typeof FURNISH_TABLE) => definingItems(u).map((i) => [i.category, ...(i.or ?? [])]);
    expect(words("bedroom")).toEqual([["bed"]]);
    expect(words("dining")).toEqual([["dining_table"]]);
    expect(words("kitchen")).toEqual([["kitchen_sink"], ["stove"]]);
    expect(words("bath")).toEqual([["bathtub", "shower"]]);
    expect(words("wc")).toEqual([["wc"]]);
    expect(definingItems("living")).toEqual([]);
    expect(definingItems("office")).toEqual([]);
  });

  it("finish never writes a room this rule reports: an empty flat furnished by `finish` lints without it", () => {
    const FLAT = `plan "Flat" {
  units mm
  grid 50
  wall id=w_ext exterior thickness 200 { (0,0) (11000,0) (11000,5000) (0,5000) close }
  wall id=w_mid partition thickness 100 { (0,3600) (11000,3600) }
  wall id=w_bb partition thickness 100 { (4200,0) (4200,3600) }
  wall id=w_bk partition thickness 100 { (7000,0) (7000,3600) }
  room id=r_bed at (0,0) size 4200x3600 label "Bedroom" uses bedroom
  room id=r_bath at (4200,0) size 2800x3600 label "Bathroom" uses bath
  room id=r_kit at (7000,0) size 4000x3600 label "Kitchen" uses kitchen dining
  room id=r_hall at (0,3600) size 11000x1400 label "Hall" uses hall
  door id=d_bed on w_mid at 3400 width 900 swing into r_bed
  door id=d_bath on w_mid at 6200 width 800 swing into r_bath
  door id=d_kit on w_mid at 9000 width 900 swing into r_kit
  door id=d_front on w_ext at 62% width 1000 swing in
  window id=win_bed on w_ext at 2100 width 1600
  window id=win_kit on w_ext at 9000 width 1600
}
`;
    const r = finish(FLAT, { only: "furnish" });
    expect([...new Set(r.changes.map((c) => c.room))].sort()).toEqual(["r_bath", "r_bed", "r_kit"]);
    expect(codesOf(r.source)).not.toContain("W_ROOM_MISSING_DEFINING");
  });

  it("a bath with no room for a bathtub or shower is left empty by `finish` and reported by W_ROOM_NO_FIXTURE", () => {
    // 1.5 x 1.2 m: a WC and a basin fit along its walls, a 900 mm shower or 1700 mm bath does
    // not. Furnished with the WC and basin alone it would raise W_ROOM_MISSING_DEFINING, which
    // the empty plan does not, so the stage's never-worse gate refuses the room.
    const TINY = `plan "Tiny bath" {
  units mm
  grid 50
  wall id=w_ext exterior thickness 200 { (0,0) (5500,0) (5500,3000) (0,3000) close }
  wall id=w_v partition thickness 100 { (1500,0) (1500,1200) }
  wall id=w_h partition thickness 100 { (0,1200) (1500,1200) }
  room id=r_bath at (0,0) size 1500x1200 label "Bath" uses bath
  room id=r_hall at (0,1200) size 5500x1800 label "Hall" uses hall
  room id=r_rest at (1500,0) size 4000x1200 label "Store" uses storage
  door id=d_bath on w_h at 1050 width 700 swing out
  door id=d_rest on w_v at 600 width 700
  door id=d_front on w_ext at 50% width 1000 swing in
}
`;
    const r = finish(TINY, { only: "furnish" });
    expect(r.changes.filter((c) => c.room === "r_bath")).toEqual([]);
    expect(r.unresolved.some((u) => u.room === "r_bath")).toBe(true);
    const ds = lint(r.source).filter((d) => d.code === "W_ROOM_NO_FIXTURE" || d.code === "W_ROOM_MISSING_DEFINING");
    expect(ds.map((d) => d.code)).toEqual(["W_ROOM_NO_FIXTURE"]);
  });
});
