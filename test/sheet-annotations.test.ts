/**
 * The issued-sheet statements: `notes "…"` and the title block's `number`/`revision` fields.
 *
 * What carries the weight — **the byte-identity law, both halves.** A plan that writes none
 * of the forms is untouched — pinned for the whole corpus by the existing law tables
 * (`byte-identity-baseline.ts`, `while-byte-identity-baseline.ts`), which this branch only
 * ADDED rows to. And a plan that writes them changes its DRAWING only: `describe()`,
 * `lint()` and `compile().diagnostics` are byte-identical to the same source with every new
 * statement removed (`examples/sheet-notes.arch` below), which is what "draws only" means.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compile, describe as describePlan, lint } from "../src/index.js";
import { format } from "../src/format.js";
import { parse } from "../src/parser.js";
import { resolve } from "../src/ir.js";
import { planFromJson, planToJson } from "../src/plan-json.js";
import { drawBudgetDiagnostic, storeyPassUnits } from "../src/draw-budget.js";
import { BUILTIN_REGISTRY } from "../src/registry.js";
import type { Scene, SceneNode } from "../src/scene.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = readFileSync(join(HERE, "..", "examples", "sheet-notes.arch"), "utf8");

const sceneOf = (src: string): Scene => {
  const { scene, errors } = compile(src, { noCache: true });
  expect(errors).toEqual([]);
  return scene!;
};
const texts = (nodes: readonly SceneNode[]): string[] =>
  nodes.flatMap((n) => (n.prim.t === "text" ? [n.prim.value] : []));

/** The new statements, stripped line by line — the source the example "would be" without them. */
const withoutSheetAnnotations = (src: string): string =>
  src
    .split("\n")
    .filter((l) => !/^\s*(notes\b|schedule openings\b)/.test(l))
    .map((l) => l.replace(/ number "[^"]*"/, "").replace(/ revision "[^"]*"/, ""))
    .join("\n");

const box = (body: string): string =>
  `plan "P" {\n  units mm\n  paper A3\n  wall id=w exterior thickness 200 { (0,0) (6000,0) (6000,4000) (0,4000) close }\n` +
  `  room id=r at (0,0) size 6000x4000 label "Hall"\n${body}}\n`;

describe("parsing — the two forms", () => {
  it("`notes` takes one or more strings and repeats append, in source order", () => {
    const p = parse(box(`  notes "a" "b"\n  notes "c"\n`)).plan!;
    expect(p.notes).toEqual(["a", "b", "c"]);
  });

  it("`notes` with no string is a parse error, never a silent no-op", () => {
    const out = parse(box(`  notes\n`));
    expect(out.diagnostics.map((d) => d.code)).toContain("E_PARSE");
  });

  it("title takes `number` and `revision`", () => {
    const p = parse(box(`  title { project "X" number "A-101" revision "B" }\n`)).plan!;
    expect(p.title).toMatchObject({ project: "X", number: "A-101", revision: "B" });
  });

  it("the formatter is a fixed point and keeps every note, number and revision", () => {
    const src = box(`  notes "One \\"quoted\\" {brace}" "Two"\n  title { project "X" number "A-1" revision "C" }\n`);
    const once = format(src);
    expect(format(once)).toBe(once);
    const p = parse(once).plan!;
    expect(p.notes).toEqual(['One "quoted" {brace}', "Two"]);
    expect(p.title).toMatchObject({ number: "A-1", revision: "C" });
  });
});

describe("the byte-identity law — the forms draw, and only draw", () => {
  it("the example's describe(), lint() and diagnostics equal the same plan without the forms", () => {
    const bare = withoutSheetAnnotations(EXAMPLE);
    expect(bare).not.toBe(EXAMPLE);
    const code = bare
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    expect(code).not.toMatch(/\bnotes\b|schedule openings|\bnumber "|\brevision "/);
    expect(JSON.stringify(describePlan(EXAMPLE))).toBe(JSON.stringify(describePlan(bare)));
    expect(JSON.stringify(lint(EXAMPLE))).toBe(JSON.stringify(lint(bare)));
    expect(JSON.stringify(compile(EXAMPLE, { noCache: true }).diagnostics)).toBe(
      JSON.stringify(compile(bare, { noCache: true }).diagnostics),
    );
    // …and the drawing DID change, so the comparison above is not vacuous.
    expect(compile(EXAMPLE, { noCache: true }).svg).not.toBe(compile(bare, { noCache: true }).svg);
  });

  it("a plan with none of the forms draws no tag, no NOTES and no new title row", () => {
    const s = sceneOf(box(`  door on w at 1000 width 900\n  window on w at 3000 width 1200\n`));
    const all = texts(s.nodes);
    expect(all.some((t) => /^[DW]\d\d$/.test(t))).toBe(false);
    expect(all).not.toContain("NOTES");
    expect(all).not.toContain("DOOR & WINDOW SCHEDULE");
    expect(s.chrome?.titleBlock?.rows.map((r) => r.k) ?? []).not.toContain("DRAWING NO.");
    expect(s.chrome?.tables).toBeUndefined();
  });
});

describe("what the sheet draws", () => {
  it("the title block gains DRAWING NO. and REVISION rows, before SCALE", () => {
    const s = sceneOf(EXAMPLE);
    expect(s.chrome?.titleBlock?.rows).toEqual([
      { k: "PROJECT", v: "Sheet Notes Flat" },
      { k: "DRAWN BY", v: "ArchLang" },
      { k: "DATE", v: "2026-10-13" },
      { k: "DRAWING NO.", v: "A-101" },
      { k: "REVISION", v: "B" },
      { k: "SCALE", v: "1:50" },
    ]);
  });

  it("NOTES draws a numbered row per note, and a `\\n` note continues unnumbered", () => {
    const s = sceneOf(box(`  notes "First" "Second\\nwraps"\n`));
    const t = s.chrome!.tables!.notes!;
    expect(t.lines).toEqual([
      { no: "1.", text: "First" },
      { no: "2.", text: "Second" },
      { no: "", text: "wraps" },
    ]);
    expect(texts(s.nodes)).toEqual(expect.arrayContaining(["NOTES", "1.", "First", "2.", "Second", "wraps"]));
  });

  it("the sheet fit reserves the new rows: the example's A3 page is not grown", () => {
    const s = sceneOf(EXAMPLE);
    expect(s.sheet?.grown).toBe(false);
    expect(describePlan(EXAMPLE).sheet?.fits).toBe(true);
  });
});

describe("budgets and round-trips", () => {
  it("the drawing budget counts at least what the NOTES and title rows draw", () => {
    const src = EXAMPLE;
    const ir = resolve(parse(src).plan!).ir;
    const withForms = storeyPassUnits(ir, BUILTIN_REGISTRY);
    const bareIr = resolve(parse(withoutSheetAnnotations(src)).plan!).ir;
    const without = storeyPassUnits(bareIr, BUILTIN_REGISTRY);
    const drawn = sceneOf(src).nodes.length - sceneOf(withoutSheetAnnotations(src)).nodes.length;
    expect(withForms - without).toBeGreaterThanOrEqual(drawn);
    expect(drawBudgetDiagnostic([{ ir }], BUILTIN_REGISTRY, undefined)).toBeUndefined();
  });

  it("a huge NOTES list is refused by the drawing budget, not drawn", () => {
    const many = Array.from({ length: 2000 }, (_, i) => `"n${i}"`).join(" ");
    const src = box(`  notes ${Array.from({ length: 100 }, () => many).join("\n  notes ")}\n`);
    const out = compile(src, { noCache: true });
    expect(out.diagnostics.map((d) => d.code)).toContain("E_DRAWING_LIMIT");
  });

  it("Plan JSON round-trips the title block's number and revision", () => {
    const src = `plan "J" {\n  units mm\n  room id=r at (0,0) size 3000x3000\n  title { project "J" number "A-7" revision "C" }\n}\n`;
    const { json } = planToJson(src);
    expect(json?.title).toEqual({ project: "J", number: "A-7", revision: "C" });
    const back = planFromJson(json);
    expect(back.diagnostics).toEqual([]);
    expect(back.ast?.title).toMatchObject({ project: "J", number: "A-7", revision: "C" });
  });
});
