/**
 * The circulation-and-privacy lint rules (plan-soundness PS2.5–PS2.7, `src/lint/rules/privacy.ts`):
 * `W_ROOM_VIA_PRIVATE`, `W_WET_ROOM_DOOR` and `W_ENTRANCE_INTO_PRIVATE`.
 *
 * Each rule is shown firing, staying silent on the fixed plan, honouring its exemptions, and
 * skipping a room with no classified use. The defect-corpus cases are read from their files,
 * never retyped; the variants below change one statement of them (`replaceOnce`) or are small
 * plans of their own.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import { describe as describePlan, lint } from "../src/index.js";
import { LINT_RULES } from "../src/lint/rules/index.js";
import type { World } from "../src/world.js";

const CODES = ["W_ROOM_VIA_PRIVATE", "W_WET_ROOM_DOOR", "W_ENTRANCE_INTO_PRIVATE"] as const;
const CORPUS = "test/defect-corpus/circulation-privacy";
const corpusCase = (name: string): string => readFileSync(join(CORPUS, `${name}.arch`), "utf8");
const of = (src: string, code: string) => lint(src).filter((d) => d.code === code);

function replaceOnce(src: string, from: string, to: string): string {
  const parts = src.split(from);
  if (parts.length !== 2) throw new Error(`expected one "${from}", found ${parts.length - 1}`);
  return parts.join(to);
}

/** Hall and WC on the left, a bedroom in the middle, the room under test behind the bedroom. */
const SUITE = `plan "Suite" {
  units mm
  wall id=shell exterior thickness 200 { (0,0) (9000,0) (9000,4000) (0,4000) close }
  wall id=p1 partition thickness 100 { (3000,0) (3000,4000) }
  wall id=p2 partition thickness 100 { (6000,0) (6000,4000) }
  wall id=p3 partition thickness 100 { (0,2000) (3000,2000) }
  room id=r_hall at (0,0) size 3000x2000 label "Hall" uses hall
  room id=r_wc at (0,2000) size 3000x2000 label "WC" uses wc
  room id=r_bed at (3000,0) size 3000x4000 label "Bedroom" uses bedroom
  room id=r_back at (6000,0) size 3000x4000 label "En-suite" uses bath
  door id=d_front at (1500,0) width 1000 wall shell
  door id=d_wc at (1500,2000) width 700 wall p3
  door id=d_bed at (3000,1000) width 900 wall p1
  door id=d_back at (6000,2000) width 800 wall p2
}
`;
const BACK = 'room id=r_back at (6000,0) size 3000x4000 label "En-suite" uses bath';
const backAs = (label: string, uses: string): string =>
  replaceOnce(SUITE, BACK, `room id=r_back at (6000,0) size 3000x4000 label "${label}"${uses ? ` uses ${uses}` : ""}`);

describe("W_ROOM_VIA_PRIVATE", () => {
  it("fires once per cut-off room, naming the private rooms in route order and the depth", () => {
    const ds = of(corpusCase("living-via-bedrooms"), "W_ROOM_VIA_PRIVATE");
    expect(ds.map((d) => d.message.split(" (access depth")[0])).toEqual([
      '"Bedroom 2" is reached only through "Bedroom 1"',
      '"Living Room" is reached only through "Bedroom 1" then "Bedroom 2"',
    ]);
    expect(ds[1]!.message).toContain("(access depth 4)");
    // The one door that fixes it is offered, measured: the kitchen shares the living room's
    // 3000 mm west edge, and the kitchen is depth 1.
    expect(ds[1]!.hints!.some((h) => /^"Kitchen" \(r_kitchen\) shares 3000 mm of edge .* at depth 2 /.test(h))).toBe(
      true,
    );
    expect(ds[1]!.hints!.at(-1)).toMatch(/^Accept if /);
    expect(ds.every((d) => !d.fixes)).toBe(true);
  });

  it("is silent on the twin, where the kitchen opens onto the living room", () => {
    expect(of(corpusCase("living-via-bedrooms.clean"), "W_ROOM_VIA_PRIVATE")).toEqual([]);
  });

  it("does not report an en-suite, and the rule's control (a study there) does fire", () => {
    expect(lint(SUITE).filter((d) => (CODES as readonly string[]).includes(d.code!))).toEqual([]);
    const study = of(backAs("Study", "office"), "W_ROOM_VIA_PRIVATE");
    expect(study.map((d) => d.message.split(" (")[0])).toEqual(['"Study" is reached only through "Bedroom"']);
  });

  it("does not report a wardrobe (storage) behind the bedroom", () => {
    expect(of(backAs("Wardrobe", "storage"), "W_ROOM_VIA_PRIVATE")).toEqual([]);
  });

  it("skips a room with no classified use (until PS2.13 reports coverage)", () => {
    expect(of(backAs("Den", ""), "W_ROOM_VIA_PRIVATE")).toEqual([]);
  });

  it("leaves the storey's only bath behind a bedroom to W_BATH_VIA_BEDROOM", () => {
    const noWc = replaceOnce(
      replaceOnce(SUITE, 'room id=r_wc at (0,2000) size 3000x2000 label "WC" uses wc', ""),
      "door id=d_wc at (1500,2000) width 700 wall p3",
      "",
    );
    const codes = lint(noWc).map((d) => d.code);
    expect(codes).toContain("W_BATH_VIA_BEDROOM");
    expect(codes).not.toContain("W_ROOM_VIA_PRIVATE");
  });

  it("does not treat a bedsit (`uses bedroom living`) as private", () => {
    const bedsit = replaceOnce(
      backAs("Study", "office"),
      'label "Bedroom" uses bedroom',
      'label "Bedsit" uses bedroom living',
    );
    expect(of(bedsit, "W_ROOM_VIA_PRIVATE")).toEqual([]);
  });
});

describe("W_WET_ROOM_DOOR", () => {
  it("sub-case 1: the only connector is a leaf-less opening onto a habitable room", () => {
    const [d, ...rest] = of(corpusCase("bath-leafless-to-living"), "W_WET_ROOM_DOOR");
    expect(rest).toEqual([]);
    expect(d!.message).toMatch(
      /^"Bathroom 1" has no door: its only way in is a leaf-less opening 800 mm wide from "Living Room"\./,
    );
    expect(d!.hints![0]).toContain("write `door` in place of `opening` for o_bath");
    expect(of(corpusCase("bath-leafless-to-living.clean"), "W_WET_ROOM_DOOR")).toEqual([]);
  });

  it("sub-case 2: a door straight onto a kitchen or a dining room, citing GB 50096-2011 5.4.3", () => {
    const src = corpusCase("bath-door-off-kitchen");
    const [d] = of(src, "W_WET_ROOM_DOOR");
    expect(d!.message).toMatch(/^"Bathroom 2" opens straight into "Kitchen", a kitchen, through a door 700 mm wide\./);
    expect(d!.message).toContain("GB 50096-2011 5.4.3, cited as advice, not compliance");
    expect(d!.hints![0]).toMatch(/^"Hall" \(r_hall\) shares 2500 mm of edge with "Bathroom 2" \(r_bath\)/);
    expect(of(corpusCase("bath-door-off-kitchen.clean"), "W_WET_ROOM_DOOR")).toEqual([]);
    const dining = replaceOnce(src, 'label "Kitchen" uses kitchen', 'label "Dining" uses dining');
    expect(of(dining, "W_WET_ROOM_DOOR")[0]!.message).toContain('"Dining", a dining room,');
  });

  it("sub-case 2 leaves an open-plan kitchen/living room alone (scored, never warned)", () => {
    const src = replaceOnce(
      corpusCase("bath-door-off-kitchen"),
      'label "Kitchen" uses kitchen',
      'label "Kitchen / Living" uses kitchen living',
    );
    expect(of(src, "W_WET_ROOM_DOOR")).toEqual([]);
  });

  it("sub-case 3: a WC that is the passage between two rooms", () => {
    const [d] = of(corpusCase("wc-utility-passage"), "W_WET_ROOM_DOOR");
    expect(d!.message).toMatch(/^"Utility" is a passage: its 2 connectors join "Hall" and "Garage"/);
    expect(d!.hints![0]).toMatch(/^"Hall" \(r_hall\) shares 6000 mm of edge with "Garage" \(r_garage\).*re-host d_gar/);
    expect(of(corpusCase("wc-utility-passage.clean"), "W_WET_ROOM_DOOR")).toEqual([]);
  });

  it("sub-case 3 leaves a Jack-and-Jill bath and a bath with a second door to the hall alone", () => {
    const JACK_AND_JILL = `plan "Jack and Jill" {
  units mm
  wall id=shell exterior thickness 200 { (0,0) (9000,0) (9000,5000) (0,5000) close }
  wall id=band partition thickness 100 { (0,2000) (9000,2000) }
  wall id=p1 partition thickness 100 { (3000,2000) (3000,5000) }
  wall id=p2 partition thickness 100 { (6000,2000) (6000,5000) }
  room id=r_hall at (0,0) size 9000x2000 label "Hall" uses hall
  room id=r_b1 at (0,2000) size 3000x3000 label "Bedroom 1" uses bedroom
  room id=r_bath at (3000,2000) size 3000x3000 label "Bathroom" uses bath
  room id=r_b2 at (6000,2000) size 3000x3000 label "Bedroom 2" uses bedroom
  door id=d_front at (4500,0) width 1000 wall shell
  door id=d_b1 at (1500,2000) width 900 wall band
  door id=d_b2 at (7500,2000) width 900 wall band
  door id=d_j1 at (3000,3500) width 800 wall p1
  door id=d_j2 at (6000,3500) width 800 wall p2
}
`;
    const quiet = (src: string) => lint(src).filter((d) => (CODES as readonly string[]).includes(d.code!));
    expect(quiet(JACK_AND_JILL)).toEqual([]);
    const hallDoor = replaceOnce(
      JACK_AND_JILL,
      "door id=d_j2",
      "door id=d_bh at (4500,2000) width 800 wall band\n  door id=d_j2",
    );
    expect(quiet(hallDoor)).toEqual([]);
  });

  it("skips a wet room with no classified use", () => {
    const src = replaceOnce(corpusCase("bath-door-off-kitchen"), 'label "Bathroom 2" uses bath', 'label "Wet Room"');
    expect(of(src, "W_WET_ROOM_DOOR")).toEqual([]);
  });
});

describe("W_ENTRANCE_INTO_PRIVATE", () => {
  it("fires on the only front door into a bedroom, and not once it opens into the living room", () => {
    const [d, ...rest] = of(corpusCase("entry-into-bedroom"), "W_ENTRANCE_INTO_PRIVATE");
    expect(rest).toEqual([]);
    expect(d!.message).toMatch(/^The only door from outside opens into "Bedroom", a bedroom\./);
    expect(d!.message).toContain("ResPlan: 0 of 16,317 front doors");
    expect(d!.hints![0]).toMatch(
      /^Move d_entry onto "Living Room" \(r_living\).*"Bedroom" \(r_bed\) is then at depth 2\./,
    );
    expect(of(corpusCase("entry-into-bedroom.clean"), "W_ENTRANCE_INTO_PRIVATE")).toEqual([]);
  });

  it("does not report a bedroom's garden door when the front door opens into the living room", () => {
    const src = replaceOnce(
      corpusCase("entry-into-bedroom.clean"),
      "door id=d_mid",
      "door id=d_garden sliding at (700,0) width 800 wall shell\n  door id=d_mid",
    );
    expect(lint(src).filter((d) => d.code === "W_ENTRANCE_INTO_PRIVATE")).toEqual([]);
  });

  it("does not report a front door into a kitchen (culture-dependent; a profile may add it)", () => {
    const src = replaceOnce(
      corpusCase("entry-into-bedroom.clean"),
      'label "Living Room" uses living',
      'label "Kitchen" uses kitchen',
    );
    expect(of(src, "W_ENTRANCE_INTO_PRIVATE")).toEqual([]);
  });

  it("does not count a door onto an `outdoor balcony` as a way in (control: without the balcony it does)", () => {
    const base = corpusCase("entry-into-bedroom");
    const withBalcony = replaceOnce(
      base,
      "  window at (2000,0)",
      '  outdoor id=g balcony at (1000,4100) size 2000x1200 label "Balcony"\n  window at (2000,0)',
    );
    expect(of(base, "W_ENTRANCE_INTO_PRIVATE")).toHaveLength(1);
    expect(of(withBalcony, "W_ENTRANCE_INTO_PRIVATE")).toEqual([]);
  });

  it("does not report a fragment of private rooms alone, nor a bedroom beside an unclassified room", () => {
    const fragment = readFileSync("test/defect-corpus/annotation-collisions/label-over-bed.arch", "utf8");
    expect(of(fragment, "W_ENTRANCE_INTO_PRIVATE")).toEqual([]);
    const den = replaceOnce(corpusCase("entry-into-bedroom"), 'label "Living Room" uses living', 'label "Den"');
    expect(of(den, "W_ENTRANCE_INTO_PRIVATE")).toEqual([]);
  });
});

describe("the three rules' texts", () => {
  it("are the last three rules, in card order", () => {
    expect(LINT_RULES.slice(-3).map((r) => r.name)).toEqual([
      "room-via-private",
      "wet-room-door",
      "entrance-into-private",
    ]);
  });

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
  const plans = ["examples", "test/fixtures", CORPUS].flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".arch"))
      .map((f) => ({ name: `${dir}/${f}`, src: readFileSync(join(dir, f), "utf8"), world: worldFor(dir) })),
  );
  type Storey = { rooms?: { id: string; label?: string; adjacent: string[] }[]; doors?: { id: string }[] };

  it("name rooms by label, keep ids in the hints, and propose a door only on an edge two rooms share", () => {
    const seen = new Map<string, number>();
    let edges = 0;
    for (const { name, src, world } of plans) {
      const ds = lint(src, { world }).filter((d) => (CODES as readonly string[]).includes(d.code!));
      if (ds.length === 0) continue;
      const facts = describePlan(src, { world }) as Storey & { levels?: Storey[] };
      const storeys = facts.levels ?? [facts];
      const rooms = storeys.flatMap((s) => s.rooms ?? []);
      const labels = new Set(rooms.map((r) => r.label ?? r.id));
      const ids = [...rooms.map((r) => r.id), ...storeys.flatMap((s) => (s.doors ?? []).map((d) => d.id))].filter(
        (id) => ![...labels].some((l) => l.includes(id)),
      );
      const adjacent = new Map(rooms.map((r) => [r.id, new Set(r.adjacent)]));
      for (const d of ds) {
        seen.set(d.code!, (seen.get(d.code!) ?? 0) + 1);
        for (const [, q] of d.message.matchAll(/"([^"]+)"/g))
          expect(labels.has(q!), `${name}: ${d.message}`).toBe(true);
        for (const id of ids)
          expect(new RegExp(`\\b${id}\\b`).test(d.message), `${name}: ${id} in ${d.message}`).toBe(false);
        expect(d.fixes, name).toBeUndefined();
        for (const h of d.hints ?? []) {
          // Never "shrink until silent": the only shrink a hint names is the one it forbids.
          for (const m of h.matchAll(/shrink/g)) expect(h.slice(Math.max(0, m.index! - 7), m.index), h).toBe("do not ");
          const m = /^"[^"]+" \((\S+)\) shares \d+ mm of edge with "[^"]+" \((\S+)\)/.exec(h);
          if (!m) continue;
          expect(adjacent.get(m[2]!)?.has(m[1]!), `${name}: ${h}`).toBe(true);
          edges++;
        }
      }
    }
    // Not vacuous: every code is exercised, and some option was checked against an edge.
    for (const c of CODES) expect(seen.get(c) ?? 0, c).toBeGreaterThan(0);
    expect(edges).toBeGreaterThan(0);
  });
});
