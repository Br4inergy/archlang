/**
 * Backlog PS0.5: an element that READS a relationally placed room — `furniture … against
 * wall … in <room>` (side inference), `furniture … in <room> centered|anchor`, a door's
 * `swing into <room>` and a garage door's floor probe — used to resolve while that room still
 * sat at its (0,0) placeholder, so every reader refused any room carrying `_rel`
 * (`E_FURN_AGAINST`, `E_PLACE_REF`, `W_SWING_ROOM_NOT_ADJACENT`).
 *
 * Rooms now resolve, and relational ones are placed, before every other kind (ADR 0028 §1),
 * so the readers refuse only a room that could not be placed (`_unplaced`). The law: a plan
 * whose room is placed `right-of` draws exactly what the same plan with that room written at
 * its resolved `at` draws.
 */

import { describe as suite, expect, it } from "vitest";
import { compile } from "../src/index.js";
import { link } from "../src/import.js";
import { resolve, type RDoor, type ResolvedPlan, type RFurniture } from "../src/ir.js";
import { parse } from "../src/parser.js";
import { BUILTIN_REGISTRY } from "../src/registry.js";
import { NULL_WORLD } from "../src/world.js";

const plan = (kitchen: string): string =>
  [
    'plan "R" {',
    "  units mm",
    "  grid 50",
    "  wall id=shell exterior thickness 200 { (0,0) (8000,0) (8000,4000) (0,4000) close }",
    "  wall id=mid partition thickness 100 { (5000,0) (5000,4000) }",
    '  room id=living at (0,0) size 5000x4000 label "Living"',
    `  room id=kitchen ${kitchen} size 3000x4000 label "Kitchen"`,
    "  door id=d on mid at 2000 width 900 swing into kitchen",
    "  furniture id=f_counter counter against wall mid in kitchen",
    "  furniture id=f_table table in kitchen centered size 1200x800",
    "}",
    "",
  ].join("\n");

const RELATIONAL = plan("right-of living align top gap 0");
const ABSOLUTE = plan("at (5000,0)");
const UNPLACED = plan("right-of nowhere");

function irOf(src: string): ResolvedPlan {
  const { plan: ast } = parse(src, BUILTIN_REGISTRY);
  if (!ast) throw new Error("the test plan did not parse");
  return resolve(link(ast, NULL_WORLD, BUILTIN_REGISTRY).plan, BUILTIN_REGISTRY, NULL_WORLD).ir;
}

/** The resolved piece: where it was placed and how it was turned. */
function furniture(src: string, id: string): Pick<RFurniture, "at" | "size" | "rotate"> {
  const ir = irOf(src);
  const f = ir.elements.find((e): e is RFurniture => e.kind === "furniture" && e.id === id);
  if (!f) throw new Error(`no furniture ${id}`);
  return { at: f.at, size: f.size, rotate: f.rotate };
}

suite("PS0.5 — readers of a relational room", () => {
  it("the repro compiles: no reader refuses the placed relational room", () => {
    expect(compile(RELATIONAL, { noCache: true }).diagnostics).toEqual([]);
  });

  it("draws exactly what the same plan with the room written at its resolved `at` draws", () => {
    const rel = compile(RELATIONAL, { noCache: true });
    const abs = compile(ABSOLUTE, { noCache: true });
    expect(abs.diagnostics).toEqual([]);
    expect(rel.svg).toBe(abs.svg);
  });

  it("the counter backs onto `mid` on the KITCHEN side, the table sits in the kitchen", () => {
    const counter = furniture(RELATIONAL, "f_counter");
    const table = furniture(RELATIONAL, "f_table");
    expect(counter.at.x).toBeGreaterThan(5000);
    expect(table.at.x).toBeGreaterThan(5000);
    expect(counter).toEqual(furniture(ABSOLUTE, "f_counter"));
    expect(table).toEqual(furniture(ABSOLUTE, "f_table"));
  });

  it("the door swings into the relational kitchen, as it does into the absolute one", () => {
    const swing = (src: string) => irOf(src).elements.find((e): e is RDoor => e.kind === "door")!.swing;
    expect(swing(RELATIONAL)).toBe(swing(ABSOLUTE));
    // Control: naming the OTHER room flips it, so the clause was really read.
    expect(swing(RELATIONAL.replace("swing into kitchen", "swing into living"))).not.toBe(swing(RELATIONAL));
  });

  it("a room that could NOT be placed is still refused by every reader", () => {
    const codes = compile(UNPLACED, { noCache: true }).diagnostics.map((d) => d.code);
    expect(codes).toEqual(["W_SWING_ROOM_NOT_ADJACENT", "E_FURN_AGAINST", "E_PLACE_REF", "E_LAYOUT_REF"]);
    const against = compile(UNPLACED, { noCache: true }).diagnostics.find((d) => d.code === "E_FURN_AGAINST")!;
    expect(against.message).toContain("could not be placed");
  });
});
