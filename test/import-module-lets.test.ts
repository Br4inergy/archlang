/**
 * An imported component sees its OWN module's plan-level `let`s (backlog M.5, owner decision:
 * the old `E_UNKNOWN_REF` was a defect).
 *
 * The rule, as built (`moduleFallback`, `src/ir.ts`; `moduleBindings`, `src/import.ts`): inside
 * the body of a component imported from module M — by name, or reached through a whole-file
 * `import … as` — a name that no parameter, no `let` of the body, no root plan `let` and no
 * built-in binds resolves against M's own plan-level `let`s (and value-functions), evaluated in
 * M's own scope. The rule is ADDITIVE: the fallback is consulted only by a lookup that would
 * otherwise be `E_UNKNOWN_REF` / `E_UNKNOWN_FN`, so no plan that compiles today can change, the
 * root's `let` still wins, and the importer's own statements never see M's names.
 *
 * The byte-identity law closes the file: every shipped example (incl. `lib`), fixture, recovery
 * plan and eval plan, every storey, with `compile().diagnostics`, against digests measured on
 * `main`'s `src/` at `25c053d` (a `git archive` of the branch point, through the same
 * `allStoreysDigestWithDiagnostics` body this test runs).
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { describe as suite, expect, it } from "vitest";
import { compile, describe as describePlan, lint, makeVirtualWorld } from "../src/index.js";
import type { Diagnostic, World } from "../src/index.js";
import { MAX_EVAL_STEPS } from "../src/expr.js";
import { allStoreysDigestWithDiagnostics, type CompilerApi } from "./byte-identity-digest.js";

const API: CompilerApi = { compile, describe: describePlan, lint };

/** The backlog's reproduction module: a plan-level `let` and a component written in it. */
const M = `plan "m" {
  units mm
  let W = 5000
  component s1() {
    room id=r at (0,0) size W x 3000
  }
}
`;

const plan = (body: string): string => `plan "P" {\n  units mm\n${body}\n}\n`;

/** Compile with the given modules in a virtual World; never cached. */
function run(src: string, files: Record<string, string> = { "m.arch": M }) {
  return compile(src, { world: makeVirtualWorld(files), noCache: true });
}

/** `lint()` with each diagnostic's `file` dropped: an imported body's findings name the module
 *  they were written in (`Diagnostic.file`), which is the one way an import may differ. */
const lintNoFile = (src: string, world?: World) => lint(src, world ? { world } : {}).map(({ file: _file, ...d }) => d);

const errors = (ds: readonly Diagnostic[]) => ds.filter((d) => d.severity === "error");

/** The resolved size of one room, from `describe()`. */
function roomBox(src: string, id: string, files: Record<string, string> = { "m.arch": M }) {
  const s = describePlan(src, { world: makeVirtualWorld(files) });
  if (!s.ok) throw new Error(JSON.stringify(s.diagnostics));
  const room = s.rooms.find((r) => r.id === id);
  if (!room) throw new Error(`no room ${id} in ${s.rooms.map((r) => r.id).join(", ")}`);
  return room.bbox;
}

suite("the reproduction (backlog M.5)", () => {
  const imported = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
  const inline = plan(
    `  let W = 5000\n  component s1() {\n    room id=r at (0,0) size W x 3000\n  }\n  place s1() as g at (0,0)`,
  );

  it('compiles — it used to fail with E_UNKNOWN_REF Unknown name "W"', () => {
    const r = run(imported);
    expect(r.diagnostics).toEqual([]);
    expect(r.svg).not.toBe("");
  });

  it("draws, describes and lints exactly what the inline form does", () => {
    const world = makeVirtualWorld({ "m.arch": M });
    expect(compile(imported, { world, noCache: true }).svg).toBe(compile(inline, { noCache: true }).svg);
    expect(describePlan(imported, { world })).toEqual(describePlan(inline));
    expect(lintNoFile(imported, world)).toEqual(lintNoFile(inline));
    expect(roomBox(imported, "g.r")).toEqual({ x: 0, y: 0, w: 5000, h: 3000 });
  });

  it("a bare call sees the module's `let` too", () => {
    const src = plan(`  import "m.arch": s1\n  s1()`);
    expect(run(src).diagnostics).toEqual([]);
    expect(roomBox(src, "r")).toEqual({ x: 0, y: 0, w: 5000, h: 3000 });
  });

  it("an aliased import is the same component", () => {
    const src = plan(`  import "m.arch": s1 as wing\n  place wing() as g at (0,0)`);
    expect(roomBox(src, "g.r").w).toBe(5000);
  });
});

suite("precedence: everything that resolved before still wins", () => {
  it("the root plan's `let` shadows the module's", () => {
    const src = plan(`  let W = 4000\n  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(run(src).diagnostics).toEqual([]);
    expect(roomBox(src, "g.r").w).toBe(4000);
  });

  it("a parameter and the body's own `let` shadow the module's", () => {
    const mod = `plan "m" {\n  units mm\n  let W = 5000\n  let H = 3000\n  component s1(W) {\n    let H = 2000\n    room id=r at (0,0) size W x H\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1(6000) as g at (0,0)`);
    expect(roomBox(src, "g.r", { "m.arch": mod })).toEqual({ x: 0, y: 0, w: 6000, h: 2000 });
  });

  it("a built-in shadows a module `let` of the same name (it resolved before, so it still does)", () => {
    const mod = `plan "m" {\n  units mm\n  let min(a, b) = 9000\n  component s1() {\n    room id=r at (0,0) size min(5000, 6000) x 3000\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(5000);
  });

  it("the module's `let`s are NOT exported: the importer's own statements cannot see them", () => {
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)\n  room id=x at (0,4000) size W x 3000`);
    const errs = errors(run(src).diagnostics);
    expect(errs.map((d) => d.code)).toContain("E_UNKNOWN_REF");
    const unknown = errs.find((d) => d.code === "E_UNKNOWN_REF")!;
    expect(unknown.message).toBe('Unknown name "W"');
    // Reported in the importer's own source, not the module.
    expect(unknown.file).toBeUndefined();
    expect(src.slice(unknown.span!.start, unknown.span!.end)).toBe("W");
  });

  it("a component declared in the root still does not see a module's `let`s", () => {
    const src = plan(
      `  import "m.arch": s1\n  component mine() {\n    room id=q at (0,0) size W x 3000\n  }\n  place s1() as g at (0,0)\n  place mine() as h at (0,4000)`,
    );
    expect(errors(run(src).diagnostics).map((d) => d.code)).toContain("E_UNKNOWN_REF");
  });
});

suite("what a module `let` can be", () => {
  it("a value-function, called from the component", () => {
    const mod = `plan "m" {\n  units mm\n  let half(x) = x / 2\n  component s1() {\n    room id=r at (0,0) size half(10000) x 3000\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(run(src, { "m.arch": mod }).diagnostics).toEqual([]);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(5000);
  });

  it("a value-function that uses another module `let` (evaluated in the module's scope, not the root's)", () => {
    const mod = `plan "m" {\n  units mm\n  let K = 1000\n  let wide(n) = n * K\n  component s1() {\n    room id=r at (0,0) size wide(5) x 3000\n  }\n}\n`;
    // The root's K is a different number: the function must close over the MODULE's.
    const src = plan(`  let K = 7\n  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(5000);
  });

  it("a function written in the component body reaches the module's `let`s too", () => {
    const mod = `plan "m" {\n  units mm\n  let W = 5000\n  component s1() {\n    let w2(n) = W - n\n    room id=r at (0,0) size w2(1000) x 3000\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(4000);
  });

  it("a `let` that depends on another module `let`", () => {
    const mod = `plan "m" {\n  units mm\n  let A = 2000\n  let W = A + 3000\n  component s1() {\n    room id=r at (0,0) size W x A\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(roomBox(src, "g.r", { "m.arch": mod })).toEqual({ x: 0, y: 0, w: 5000, h: 2000 });
  });

  it("a `let` inside a top-level `zone` (a zone is not a scope)", () => {
    const mod = `plan "m" {\n  units mm\n  zone z {\n    let W = 5000\n  }\n  component s1() {\n    room id=r at (0,0) size W x 3000\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(5000);
  });
});

suite("composition", () => {
  it("a module's component calling another of the same module's components", () => {
    const mod = `plan "m" {\n  units mm\n  let W = 5000\n  component s2() {\n    room id=r2 at (0,3000) size W x 2000\n  }\n  component s1() {\n    room id=r at (0,0) size W x 3000\n    place s2() as k at (0,0)\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1, s2\n  place s1() as g at (0,0)`);
    expect(run(src, { "m.arch": mod }).diagnostics).toEqual([]);
    expect(roomBox(src, "g.k.r2", { "m.arch": mod })).toEqual({ x: 0, y: 3000, w: 5000, h: 2000 });
  });

  it("nested import: each component sees the module it was WRITTEN in", () => {
    const n = `plan "n" {\n  units mm\n  let D = 1000\n  component n1() {\n    room id=q at (0,0) size D x D\n  }\n}\n`;
    const m = `plan "m" {\n  units mm\n  import "n.arch": n1\n  let W = 5000\n  component s1() {\n    room id=r at (0,0) size W x 3000\n    place n1() as k at (W, 0)\n  }\n}\n`;
    const files = { "n.arch": n, "m.arch": m };
    const src = plan(`  import "m.arch": *\n  place s1() as g at (0,0)`);
    expect(run(src, files).diagnostics).toEqual([]);
    expect(roomBox(src, "g.r", files).w).toBe(5000);
    expect(roomBox(src, "g.k.q", files)).toEqual({ x: 5000, y: 0, w: 1000, h: 1000 });
  });

  it("nested import: N's component does not see M's `let`s (M only imports it)", () => {
    const n = `plan "n" {\n  units mm\n  component n1() {\n    room id=q at (0,0) size W x 1000\n  }\n}\n`;
    const m = `plan "m" {\n  units mm\n  import "n.arch": n1\n  let W = 5000\n  component s1() {\n    place n1() as k at (0,0)\n  }\n}\n`;
    const src = plan(`  import "m.arch": *\n  place s1() as g at (0,0)`);
    const errs = errors(run(src, { "n.arch": n, "m.arch": m }).diagnostics);
    expect(errs.find((d) => d.code === "E_UNKNOWN_REF")?.file).toBe("n.arch");
  });

  it("a component reached through a whole-file import sees its module's `let`s", () => {
    const mod = `plan "m" {\n  units mm\n  let W = 5000\n  component helper() {\n    room id=r at (0,0) size W x 3000\n  }\n  helper()\n}\n`;
    const src = plan(`  import "m.arch" as whole\n  place whole() as g at (0,0)`);
    expect(run(src, { "m.arch": mod }).diagnostics).toEqual([]);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(5000);
  });

  it("whole-file import is unchanged: the file's own body still binds its `let`s locally (over the root's)", () => {
    const mod = `plan "m" {\n  units mm\n  let W = 5000\n  room id=r at (0,0) size W x 3000\n}\n`;
    const src = plan(`  let W = 4000\n  import "m.arch" as whole\n  place whole() as g at (0,0)`);
    expect(run(src, { "m.arch": mod }).diagnostics).toEqual([]);
    expect(roomBox(src, "g.r", { "m.arch": mod }).w).toBe(5000);
  });

  it("whole-file import is unchanged: a use before the file's `let` is still unknown (no forward reference)", () => {
    const mod = `plan "m" {\n  units mm\n  room id=r at (0,0) size W x 3000\n  let W = 5000\n}\n`;
    const src = plan(`  import "m.arch" as whole\n  place whole() as g at (0,0)`);
    const unknown = errors(run(src, { "m.arch": mod }).diagnostics).find((d) => d.code === "E_UNKNOWN_REF");
    expect(unknown?.file).toBe("m.arch");
  });

  const FRAMES: string[] = [];
  for (const r of [0, 90, 180, 270]) for (const m of ["", " mirror x", " mirror y"]) FRAMES.push(`rotate ${r}${m}`);
  it.each(FRAMES)("the same component under `place … %s` draws what the inline form draws", (frame) => {
    const body = `component s1() {\n    wall id=shell exterior thickness 200 { (0,0) (W,0) (W,3000) (0,3000) close }\n    room id=r at (0,0) size W x 3000\n    door id=d on shell at 25% width 900\n  }`;
    const mod = `plan "m" {\n  units mm\n  let W = 5000\n  ${body}\n}\n`;
    const world = makeVirtualWorld({ "m.arch": mod });
    const imported = plan(`  import "m.arch": s1\n  place s1() as g at (10000,10000) ${frame}`);
    const inline = plan(`  let W = 5000\n  ${body}\n  place s1() as g at (10000,10000) ${frame}`);
    const a = compile(imported, { world, noCache: true });
    expect(a.diagnostics).toEqual([]);
    expect(a.svg).toBe(compile(inline, { noCache: true }).svg);
    expect(describePlan(imported, { world })).toEqual(describePlan(inline));
    expect(lintNoFile(imported, world)).toEqual(lintNoFile(inline));
  });
});

suite("a module `let` that fails reports as it does in the module", () => {
  it("same code and span as compiling the module itself, with `file` naming the module", () => {
    const mod = `plan "m" {\n  units mm\n  let W = Q + 5000\n  component s1() {\n    room id=r at (0,0) size W x 3000\n  }\n  room id=own at (0,0) size W x 3000\n}\n`;
    const own = errors(compile(mod, { noCache: true }).diagnostics).find((d) => d.code === "E_UNKNOWN_REF")!;
    expect(own.message).toBe('Unknown name "Q"');
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    const errs = errors(run(src, { "m.arch": mod }).diagnostics);
    expect(errs.map((d) => d.code)).toEqual(["E_UNKNOWN_REF"]);
    expect(errs[0]!.file).toBe("m.arch");
    expect(errs[0]!.span).toEqual(own.span);
    expect(errs[0]!.message).toBe(own.message);
    expect(mod.slice(errs[0]!.span!.start, errs[0]!.span!.end)).toBe("Q");
  });

  it("is reported once, however many instances look into the module", () => {
    const mod = `plan "m" {\n  units mm\n  let W = Q\n  component s1() {\n    room id=r at (0,0) size 3000 x 3000\n    room id=s at (0,3000) size 3000 x (W + 1000)\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as a at (0,0)\n  place s1() as b at (10000,0)`);
    const errs = errors(run(src, { "m.arch": mod }).diagnostics);
    expect(errs.filter((d) => d.code === "E_UNKNOWN_REF" && d.file === "m.arch")).toHaveLength(1);
  });

  it("a module that is never looked into is never evaluated: a broken `let` the component does not use reports nothing", () => {
    const mod = `plan "m" {\n  units mm\n  let W = Q\n  component s1() {\n    room id=r at (0,0) size 3000 x 3000\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    expect(run(src, { "m.arch": mod }).diagnostics).toEqual([]);
  });

  it("a module `let` past the step budget still returns E_STEP_LIMIT, at the module's `let`", () => {
    const mod = `plan "m" {\n  units mm\n  let f(n) = if n < 2 { 1 } else { f(n - 1) + f(n - 2) }\n  let X = f(40)\n  component s1() {\n    room id=r at (0,0) size X x 3000\n  }\n}\n`;
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    const r = run(src, { "m.arch": mod });
    const errs = errors(r.diagnostics);
    expect(errs.map((d) => d.code)).toEqual(["E_STEP_LIMIT"]);
    expect(errs[0]!.message).toContain(String(MAX_EVAL_STEPS));
    expect(errs[0]!.file).toBe("m.arch");
    expect(mod.slice(errs[0]!.span!.start, errs[0]!.span!.end)).toBe("let X = f(40)");
    expect(r.svg).toBe("");
  }, 60_000);
});

/**
 * The byte-identity law. Digests measured on `main`'s `src/` at `25c053d` (`git archive`, the
 * same digest body); the module's new names can only ever be reached by a lookup that failed
 * there, so not one row may move. A move is a finding, never a re-measure.
 *
 * Seven rows re-measured for a DRAWING change, not this rule: a room name too wide for its room
 * on one line is now drawn on several when that fits (`wrapLabels`, `src/label-placement.ts`).
 * `examples/clinic.arch` and `test/recovery-corpus/clinic.arch` ("Accessible WC"),
 * `eval/fidelity-plans/wide-doorways.{faithful,laundered}.arch` ("Wet Room"),
 * `eval/goldens/core-and-shell.arch` ("Circulation Core"), `three-bed-2bath.arch` ("Master
 * Bedroom", "Main Bathroom") and `two-bed-hall.arch` ("Kitchen / Living"). In each only that
 * room's name and area figure move: the old SVG put back into the new payload reproduces the
 * old row, so `describe()`, `lint()` and `compile().diagnostics` are byte-identical.
 *
 * Six rows re-measured for a LINT change, not this rule: `W_BATH_VIA_BEDROOM` no longer names
 * an en-suite on a storey with another wet room reached without passing through a bedroom,
 * and its hint says so ("… add a second bathroom or WC on the same storey that is reached
 * without passing through a bedroom."). In every row the SVG, `describe()` and
 * `compile().diagnostics` are byte-identical and no other diagnostic moves:
 *   - `examples/hillside-villa.arch`: `lint()` loses that one diagnostic (the master ensuite,
 *     span 2564); put back at its old index in the new payload it reproduces the old row.
 *   - `eval/fidelity-plans/min-bedroom-flat.{faithful,laundered}.arch`,
 *     `over-programmed-flat.laundered.arch` and `wide-doorways.{faithful,laundered}.arch`:
 *     each plan's only wet room is behind a bedroom, so the warning stays; only its `hints[0]`
 *     sentence moves. The old sentence put back into the new payload reproduces the old row.
 *
 * Twenty-one rows re-measured for a deliberate diagnostic-TEXT change, not this rule (case (3)
 * in `./byte-identity-baseline.ts`'s header; `test/lint-fix-texts.test.ts`). In every row the
 * SVG, `describe()` and `compile().diagnostics` are byte-identical, and hashing the new payload
 * with the OLD `lint()` reproduces the old row:
 *   - `W_ROOM_NO_FIXTURE`'s hint no longer suggests importing the unshipped `lib/fixtures.arch`
 *     and gives a pasteable built-in statement: `test/fixtures/diff-{a,b}.arch`,
 *     `eval/goldens/core-and-shell.arch`, and `eval/fidelity-plans/capped-wet-room.laundered`,
 *     `min-bedroom-flat.{faithful,laundered}`, `over-programmed-flat.laundered`,
 *     `two-bed-min-area.{faithful,laundered}` and `wide-doorways.{faithful,laundered}`.
 *   - `W_FIXTURE_BACK_TO_ROOM`, where the size's aspect rules out every walled edge, now says to
 *     swap the size (with the `rotate` that follows): `eval/goldens/l-shaped-flat`,
 *     `reception-suite`, `sized-office-mix`, `three-bed-2bath`, `two-bath-flat`, `two-bed-hall`.
 *   - `W_FURNITURE_WALL_COLLISION` names the wall it crosses and how deep:
 *     `eval/faults/furniture-through-wall.arch`.
 *   - `arch repair` -> `archlang repair` in the `W_SWING_OBSTRUCTED`/`W_DOORWAY_BLOCKED` hints:
 *     `eval/faults/blocked-doorway.arch`, `eval/faults/combined.arch` (and `capped-wet-room`).
 *   - `W_PATH_TOO_NARROW` names the en-suite doors and withdraws the duplicate Master Suite ->
 *     Ensuite route: `examples/hillside-villa.arch` (the same row as
 *     `./while-byte-identity-baseline.ts`).
 * Ten of those rows re-measured a second time, after the red team's review, again `lint()` text
 * only (the previous `lint()` put back reproduces each previous row): `hillside-villa` (the
 * named en-suite door is now the one on the widest door path); `core-and-shell` and
 * `two-bed-min-area.{faithful,laundered}` (the `W_ROOM_NO_FIXTURE` statement is now placed
 * clear of doors, swings and furniture, so its anchor moved); and the six back-to-room goldens
 * (`W_FIXTURE_BACK_TO_ROOM`'s size hint no longer adds "or, placed `in <room> anchor`" to a
 * piece placed `at`, and asks no `rotate` of an anchored one). `hillside-villa` re-measured a
 * third time when every named door became re-measured before it is quoted: the same three
 * doors, hint wording only; the previous `lint()` put back reproduces the previous row.
 *
 * Two rows ADDED, not re-measured: `test/fixtures/star30.arch` and `test/fixtures/chain30.arch`,
 * new fixtures pinning `W_PATH_TOO_NARROW`'s re-measure count; first measured with the same
 * digest body on the tree that adds them (the same rows as `./while-byte-identity-baseline.ts`).
 * `test/fixtures/off-path-bypass.arch` likewise (the doorway-band bypass repro).
 *
 * Twenty-two rows re-measured for the thickness call-out station, the drawing only: every
 * corpus plan that draws a `dims auto all`/`walls` call-out (the sixteen examples,
 * `test/fixtures/axes-grid` and `schedule-sheet`, the `test/recovery-corpus/` copies of
 * `clinic`, `materials` and `two-storey`, and `eval/goldens/dims-auto-cottage`). Hashing the
 * new payload with the OLD SVG put back reproduces each old row. Each moved call-out in
 * `./byte-identity-baseline.ts`, "thickness call-outs keep off doorways and fixtures".
 *
 * EVERY row re-measured once for net internal area (owner decision 2): `describe()` gains
 * `net_area_m2` / `totals.net_floor_area_m2`; SVG and lint unchanged except room schedules.
 * A hybrid run of this file, unedited, with `describe()` from the pre-change tree (`1eb1bf9`)
 * and `compile()`/`lint()` from the new one reproduces every old row except the plans that
 * set `schedule rooms`: the twelve examples (`aquarium`, `bungalow`, `clinic`,
 * `courtyard-house`, `furnished-flat`, `garden-house`, `hillside-villa`, `library`,
 * `materials`, `museum-wings`, `sheet-notes`, `transit-hall`),
 * `test/fixtures/schedule-sheet.arch` and `zones-wings.arch`, and the `test/recovery-corpus/`
 * copies of `clinic` and `materials`, whose SVG gains the
 * ROOM SCHEDULE's NET AREA column; their `compile().diagnostics` is byte-identical, and with
 * `compile()` too from the old tree they reproduce as well. The account is in
 * `./byte-identity-baseline.ts`, "EVERY row re-measured, once". The same schedule rows,
 * and only they, were re-measured once more when the AREA column took its owner-given label
 * `AREA (CENTRELINE, m²)`; no other row moved.
 *
 * Re-measured once more when net area became the room less every wall band on it (ADR 0027):
 * the rows of `aquarium`, `hexagon-pavilion`, `hillside-villa`, `materials`, `tiny-house` and
 * `townhouse` (and the `test/recovery-corpus/` copy of `materials`), whose `describe()`
 * moves in its net figures only. Field by field in `./byte-identity-baseline.ts`, "Six
 * plans re-measured again".
 *
 * Five rows re-measured when two lint messages stopped quoting element ids (a consumer may show
 * `message` to someone who never sees the source; the id stays in the hint), `lint()` `message`
 * text only. Hashing the new payload with the previous `lint()` reproduces each previous row:
 *   - `W_PATH_TOO_NARROW` names a bottleneck door by the rooms it joins:
 *     `examples/hillside-villa.arch` (field by field in `./byte-identity-baseline.ts`, "names a
 *     door by its rooms"), `test/fixtures/chain30.arch`, `star30.arch` and
 *     `off-path-bypass.arch` (the same rows as `./while-byte-identity-baseline.ts`;
 *     `off-path-bypass` also moves in the collision below, `penetrates exterior wall "w_s" at
 *     y 2000` → `penetrates the exterior wall at y 2000`).
 *   - `W_FURNITURE_WALL_COLLISION` names the wall by its kind and line:
 *     `eval/faults/furniture-through-wall.arch`, `penetrates partition wall "partition_2" at
 *     x 4000` → `penetrates the partition wall at x 4000`.
 *
 * Three rows re-measured when a connector on a wall began to join the space off each face of
 * that wall, with an additive `straddles` (backlog C.4, plan-soundness PS0.1; field by field
 * in `./byte-identity-baseline.ts`, "read off the host wall's faces"). Hashing the new
 * `compile()` with the previous `describe()` and `lint()` reproduces each previous row: every
 * storey's SVG and `compile().diagnostics` are byte-identical.
 *   - `examples/hillside-villa.arch`: `describe()` gains `straddles` on `o_entry_dining` only.
 *   - `eval/goldens/strip-attach-clean.arch`: `d_bath` (800 mm at y 3750 on `w_bath`, which
 *     starts at y 3500) runs 150 mm past its host's end across the `w_mid` T, so `doors[4]`
 *     and `access.edges[4]` gain `straddles: ["r_live", "r_bed2", "r_hall", "r_bath"]`.
 *     `between` and `lint()` unchanged.
 *   - `test/fixtures/schedule-sheet.arch`: `door on shell at 20%` is centred on the T where
 *     `part` meets the shell, (4000, 0). It used to join `living` and `bath` and the plan had no
 *     entrance. It is now `between ["exterior", "living"]` (each room covers 400 mm of the inner
 *     face's clear span, so room order breaks the tie), `exterior: true`, `straddles ["living",
 *     "bath"]`; `access` gains the entrance, both rooms' depths and bottlenecks, `circulation`
 *     is measured (it was `null`) and the caption names the entrance. `lint()` withdraws
 *     `W_NO_ENTRANCE`, its only diagnostic, and gains nothing.
 */
const BASELINE: [string, string][] = [
  ["examples/accessible.arch", "dd7d71ebb95715ca666f7a087af5456436cba420936c111d20cb497159715529"],
  ["examples/aquarium.arch", "9b8e70c3cd7838abbb883062d3abd06dfb54ec7336f523bb4369ad917301cbb4"],
  ["examples/attached.arch", "591f4199087b7f7fcab65af3cab3f12dbe062456954e7ef0f02969a974d34b93"],
  ["examples/bungalow.arch", "1fc9881f7b2e3bf0015b0a978fd3858f22a7ea72d60de472bf083a716ca71ef2"],
  ["examples/classroom-block.arch", "4c5bb36d1d66957fd2f608184efca9fa7ded3854cebfcb5afdab8c88e1e482e7"], // added with the example, re-measured for net area, see header
  ["examples/clinic.arch", "fac5d9fab49df93fe8cbff6cc0bf26b9e84b1a32c26128e155d0eeb5da99feb1"],
  ["examples/corner-cafe.arch", "3434595cfa60533d5bac28bbd694fb69184b366522a2ee326d08549d7b5216af"], // added with the example, re-measured for net area, see header
  ["examples/courtyard-house.arch", "464e42474edfc5d02502ccd9d14d314cd2943687b2a07fb928096235d82d4ecc"],
  ["examples/furnished-flat.arch", "83dea7656305cfdd95df0eb33cb6f509b66f1930a3c58e6da8a7a0db8bb36181"],
  ["examples/gallery-l.arch", "cc37c7d8d73b535358978674f3c5da26af87af4d066e6cd67a8bd1f8506e7f5f"],
  // Re-measured because the EXAMPLE changed (backlog D.1, its doubled chairs removed), and again
  // for the legend's ground swatches (backlog D.3, level 1's SVG only): the same row, with the
  // same digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/garden-house.arch", "ffe33b785e9b5d6a2d2b83b0c5fe416bb1df75e9cfe2755cd9721df2e424f85d"],
  ["examples/garden-loft.arch", "eb6ba7bdcd33231cd0cfd2072a1a99e2b416be039e6efc2cc0a5ea76129738f2"],
  ["examples/hexagon-pavilion.arch", "edef621837ae7adb96218de65b346e231ffe0c006dcd72f70a7e8d3b14777858"],
  // Re-measured for the facade-probe fix (level 2's `dims auto` chains only), and again because
  // the EXAMPLE changed (backlog D.2, its piano turned and moved): the same row, with the same
  // digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/hillside-villa.arch", "5b0e09055cd843b9bf4dab057beb6281ba095b5c4cf76a7a79a68733c34aabd2"], // re-measured, see header
  ["examples/imports.arch", "f1b5ff9ee7189d217cd8df57d04a1af5d2876bbc69ec588be202f28c68f47a5b"],
  ["examples/laneway-house.arch", "d87dea46b06ea13b539e0a7c03674038e15762d15948a7bc27632e1b8afd11e2"],
  ["examples/library.arch", "cd5e1d08ae576e6303bc71ededc689e3033456929ffa3bee1568bafc01d45c33"],
  ["examples/materials.arch", "29bb896c24060364f51b4cbad9d4065a21dc40444e6e95024bc85cf276b54e9c"],
  ["examples/museum-wing.arch", "6e01f37f15c674c544fac6651e9f3bd32d4d6e4865fdafba36ed97feca9ff33a"],
  ["examples/museum-wings.arch", "da7749539514ba637c3f58f8f74aa4b86d3f8e939fcedd20f2961e76d9f5fbc8"],
  ["examples/museum.arch", "e84e5b6d863c6fd71c0e7e39810277879c6d3a3774fe6808b2c7927546acbdf3"],
  ["examples/one-room.arch", "e12596f5401f097b5cf431fda952e96fc6523d7ca6a97c1518ffe6dd64e72cbe"],
  ["examples/parametric.arch", "982d09bc2018a495ca4c50d1cf5a99dcbb92f235b86f9cb722c4e931c839e921"],
  ["examples/practice-office.arch", "1692d70a7c06b0ebd17a64b47004afd37fd98b0a65e79df3de8d2f110162073e"], // added with the example, re-measured for net area, see header
  ["examples/relational.arch", "e152e9a813406d1188e87584acdb63bb4c4a48438006e33420db2c760bc8f9ec"],
  // ADDED with the new example (the issued-sheet statements), then re-measured once when the
  // thickness call-out change met it (drawing only): the same row, with the same digest body,
  // as `./while-byte-identity-baseline.ts`, whose header has both.
  ["examples/sheet-notes.arch", "0104550fc3b3a39a71c1a005da79c3db5ea10ae21d9739e11a6d1f18ee7b7420"],
  ["examples/studio.arch", "ed8513998b1bc62fa08d73a67c0897777ab68f186609896ae491b868adf463d8"],
  ["examples/terrace-row.arch", "514aa86e7acbac76a0c1a0c38c43f7f6cf6cf40bb9121576b2abacbe0344cfe8"],
  ["examples/themed.arch", "6b6c68980f86565d82c396ee618dbe75ef5435bb4ad2be134822dc6d0aef6ead"],
  ["examples/tiny-house.arch", "cbd44f2c14aa28ea42f1fac0c7029f6257e6d7bcaab42c21ec290cecc3bd1933"],
  ["examples/townhouse.arch", "a3252455577b780dfed37d5eebeea1f8725c2df9d5c538b0e61c091418022f94"],
  ["examples/transit-hall.arch", "b8ec53697030c76a35fdd875115c89cedca4e5ff591837eab5b1fb1209024ad9"],
  ["examples/two-bed.arch", "63fdc9d0c77062228876013f4b0e8172f496fc80f4f943184a2bff3098dec5ad"],
  ["examples/two-storey.arch", "17402c97f15a8aeb54ded52a2460ced472e1788d7d5415fa83b1c91042ce59d6"],
  ["examples/lib/doors.arch", "232f7d4cf35f3d44678b3e3641c4815139f9412a9fd079f99639026b99f005b6"],
  ["examples/lib/fixtures.arch", "25e792ed80e5571a57ac00323283b58af9ffd96646008637646f99600f4716f8"],
  ["examples/lib/furniture.arch", "0b3f57be12defbd32e7dd349a5c81619acc3c2650bcf2e2bffaff1669b7a112a"],
  ["test/fixtures/axes-grid.arch", "bf15439e40c442b499b4b43025cea4827954e3fd2c2e89102e7d6c527d7375b3"],
  ["test/fixtures/chain30.arch", "13411e1dbffca14e73601338837daf6517ddf9fc2447695021101fc051073cb6"], // new fixture, see header
  ["test/fixtures/dense-bays.arch", "c01f946b1cd01d07fb673f33c210388d647aeab75049be76a9e5a6c30c00ac46"],
  ["test/fixtures/diff-a.arch", "1cff5f9be081933217e1ee78804a2cf68cf17dba8d9997a51efc89ea3cbc7632"],
  ["test/fixtures/diff-b.arch", "baab46a8480793499c0992812fc3867988f1d874df02fe5ce5fc187373bfcdda"],
  ["test/fixtures/diff-circ-a.arch", "272184ab44393f0f5cf74f5ad7a41c65ee2e16fbaf837dd9d0a1fb40ab71a335"],
  ["test/fixtures/diff-circ-b.arch", "68ba4e31f6e1bcb57fda4bc7eefc2afba407b1e0038497fb4a65079be210864d"],
  ["test/fixtures/off-path-bypass.arch", "b8123c5f00d6ce700209f6c5f6a479847f0e5218cf99c8bb2d4af66006289415"], // new fixture, see header
  ["test/fixtures/schedule-sheet.arch", "474794afd827a6a73d0c0103b9945b5d8ab57be3f2c5aff75910715499d930d4"], // re-measured, see header
  ["test/fixtures/star30.arch", "eb21a2460d3cd302bc0b470184924cb46c947fa9ca95a7d8d7cbda839f791761"], // new fixture, see header
  ["test/fixtures/zones-levels.arch", "3bcbe8f909a76528732dc309234e17526c80030e7baff7605e1879dd328ab10b"],
  ["test/fixtures/zones-wings.arch", "a709a63178d723d6ceff5b39103b35dd16823449fd87200523c43a848a77cda2"],
  ["test/recovery-corpus/attached.arch", "591f4199087b7f7fcab65af3cab3f12dbe062456954e7ef0f02969a974d34b93"],
  ["test/recovery-corpus/clinic.arch", "fac5d9fab49df93fe8cbff6cc0bf26b9e84b1a32c26128e155d0eeb5da99feb1"],
  ["test/recovery-corpus/materials.arch", "29bb896c24060364f51b4cbad9d4065a21dc40444e6e95024bc85cf276b54e9c"],
  ["test/recovery-corpus/parametric.arch", "982d09bc2018a495ca4c50d1cf5a99dcbb92f235b86f9cb722c4e931c839e921"],
  ["test/recovery-corpus/studio.arch", "ed8513998b1bc62fa08d73a67c0897777ab68f186609896ae491b868adf463d8"],
  ["test/recovery-corpus/terrace-row.arch", "514aa86e7acbac76a0c1a0c38c43f7f6cf6cf40bb9121576b2abacbe0344cfe8"],
  ["test/recovery-corpus/themed.arch", "6b6c68980f86565d82c396ee618dbe75ef5435bb4ad2be134822dc6d0aef6ead"],
  ["test/recovery-corpus/two-storey.arch", "17402c97f15a8aeb54ded52a2460ced472e1788d7d5415fa83b1c91042ce59d6"],
  ["eval/goldens/accessible-bath.arch", "0f2e47f8b1a0afe5e110117ea229b829861353fe1d115b9a8af1ec2085774d14"],
  ["eval/goldens/accessible-flat.arch", "721d479d06915e309d209c1c84dbb4a5b1c40b7c8195891499ed5078c650fe3e"],
  ["eval/goldens/against-wall-bath.arch", "7143284cc5553b270dba5bf920573d6d0537ebd863898ef2c16c3167140f3348"],
  ["eval/goldens/anchor-furniture.arch", "9466376bdf01ff576c4dd89d901e11be9a7f1b855b6bac92e333926adb2951a9"],
  ["eval/goldens/attach-openings.arch", "d9d0546ad4f314c22b2bee8ceec59241505744b822a903756c2d8b44386ac1f8"],
  ["eval/goldens/bungalow.arch", "2205e6505a37378b5d3e54f64066abfafb1bea07a67b62d5f08c724162842168"],
  ["eval/goldens/compact-studio.arch", "92281f423de9e161598f55bce297bc4bb38fb693cce92b230141e78491d7f56f"],
  ["eval/goldens/core-and-shell.arch", "208d6ff373fea05b02e3e9fc6029bdc8f2aaf417bfccdd22a3aa329c812d5cfb"],
  ["eval/goldens/dims-auto-cottage.arch", "ca327599910fd97d0f8ced7ea4f03bb93312541b92e12119e12e976b0e76b5d8"],
  ["eval/goldens/galley-kitchen.arch", "af379acc431baaa7728fde7eee94f2a34fef2e4303ab967cabb029a7b3837669"],
  ["eval/goldens/l-shaped-flat.arch", "d30c51f32a98dcad06472c9d69ce0d42506c24de079b4cfa86325313060080eb"],
  ["eval/goldens/office.arch", "2aa4b26730b2f4104f7464abab0012f6f1861ab21e7e55da416256e99d84fd10"],
  ["eval/goldens/open-plan-loft.arch", "2efcf0fdc611e4c017621e8de25030ea3a7afed4069a6816217ba2f7cfca762a"],
  ["eval/goldens/reception-suite.arch", "c0c109d44f1ed01a0747e81bcf57c8d0e37d60a47bd147cd3db9a2df83b332ff"],
  ["eval/goldens/relational-studio.arch", "8b65d8b712ac5ffcc4157bdf3ad210d02db860d3183f88eff5ac97454362274a"],
  ["eval/goldens/scripting-units.arch", "6f64fd2f54b9684990933bd56df84b800c97074564c18baf6402cfedd9837c2b"],
  ["eval/goldens/sized-bedrooms.arch", "7282d52c3265cb20f67e27f445e7fdd42ceb56912133bb36c845048a9ddf164f"],
  ["eval/goldens/sized-kitchen-flat.arch", "d53a6f4fef770d801976b2368ff9ce3c828b33085f82616803e3517927aa2bf2"],
  ["eval/goldens/sized-office-mix.arch", "a393fe780123bcc94a86e642874c87863c4f7a6d38528c13e34108e864b3975a"],
  ["eval/goldens/sized-wet-room.arch", "b73b7c5a2ad1eedf1a402331c6c0991ac3a985adf8b23c9b73fa5d4a4c46129a"],
  ["eval/goldens/strip-attach-clean.arch", "d1db261cb6d81842ad6a43bbf045049392b751ecebed1f9f3e2ddf5108e09bba"], // re-measured, see header
  ["eval/goldens/strip-corridor.arch", "2b471514e89a72253310c75cff0c6589938f3f1d9bb39e97235b95cc2d7aa17e"],
  ["eval/goldens/three-bed-2bath.arch", "c1cf107a1e2c22198336c05c3f50c79895c9313d92d3296349caa83a5f80ba84"],
  ["eval/goldens/two-bath-flat.arch", "4238d0b5c2d363d15809a6fd3357bd5d97fdbfe02be2caa76022ad7b5e32a305"],
  ["eval/goldens/two-bed-hall.arch", "36a87e7c15583c6a819e071f55e1727014a4dbc13a39421588acd1c07ffd2ce8"],
  [
    "eval/fidelity-plans/capped-wet-room.laundered.arch",
    "0870510426ec170f90cefe58530d8c52cc1a4520b53d300b00468a65f2103245",
  ],
  [
    "eval/fidelity-plans/four-bed-cap.laundered.arch",
    "e33991f8e4628e12c8a3251bcb566cee2f742c001424e40b7c089c0e342ef260",
  ],
  [
    "eval/fidelity-plans/min-bedroom-flat.faithful.arch",
    "e114d2d8d6069b2bb3e676b96db40c9eba5f61054675e499dc0ddb02a55b99c9",
  ],
  [
    "eval/fidelity-plans/min-bedroom-flat.laundered.arch",
    "4a9b74bab7ac9c6c3f46b9ac785c4ce4770929f403b09b7301080aa029ac900a",
  ],
  [
    "eval/fidelity-plans/over-programmed-flat.laundered.arch",
    "ce2c52b413bc502be1de34a004e3f907f84339c5226f6d499fc10d9e912b4389",
  ],
  [
    "eval/fidelity-plans/two-bed-min-area.faithful.arch",
    "5ae9e355dd22c5802b2ba37885fcb4b330ae12a25f824dddb0c3cc7e1d27bce0",
  ],
  [
    "eval/fidelity-plans/two-bed-min-area.laundered.arch",
    "bd4aef076a435ae3240b70954a23af02e4e896685bf1680668fa3565b9603fc2",
  ],
  [
    "eval/fidelity-plans/wide-doorways.faithful.arch",
    "2883507b745bec028773d17cd9506e40c0f5ad1de88feeafc15d276498a4871d",
  ],
  [
    "eval/fidelity-plans/wide-doorways.laundered.arch",
    "b1f4f024aa9f70714ee853c59f7c41f74dc9b375f083486aa2d77e4d0b0e15c7",
  ],
  ["eval/faults/blocked-doorway.arch", "7f35390a12c0e596cd2bc43d0f9d3c34ffcbb5cf373b0c6159fa4ba72f68fd3c"],
  ["eval/faults/combined.arch", "d3740a0d13d8117fa16eb80308713f68f0b645d193ebaca01ef23f85784cec6d"],
  ["eval/faults/furniture-through-wall.arch", "d6f67fc6b02a0e869063c7b2c0084053505acea98eb1d5d5b30bf260335129c7"],
  ["eval/faults/off-wall-door.arch", "c74fceee88106e783d23ffa40c1004a0413b2a20537541f45899e226b61d58e1"],
  ["eval/faults/off-wall-opening.arch", "52a35945771a2840340f56006f6e17824f127075fc830ce957e4c36e52b605f4"],
  ["eval/faults/off-wall-window.arch", "2665dac70c4431a9d12e0a17a43fc1f85fdc8e99c6695c6743545f4f81ae2cd3"],
];

const ROOT = resolvePath(__dirname, "..");
const CORPUS_DIRS = [
  "examples",
  "examples/lib",
  "test/fixtures",
  "test/recovery-corpus",
  "eval/goldens",
  "eval/fidelity-plans",
  "eval/faults",
];

function worldFor(dir: string): World {
  return {
    read: (p) => {
      try {
        return readFileSync(resolvePath(dir, p), "utf8");
      } catch {
        return null;
      }
    },
    now: () => new Date(0),
  };
}

suite("byte identity — every corpus plan, every storey, with compile().diagnostics", () => {
  it("covers the whole corpus — it cannot silently shrink", () => {
    const corpus = CORPUS_DIRS.flatMap((d) =>
      readdirSync(join(ROOT, d))
        .filter((f) => f.endsWith(".arch"))
        .sort()
        .map((f) => `${d}/${f}`),
    );
    expect(BASELINE.map(([n]) => n)).toEqual(corpus);
  });

  it.each(BASELINE)("digest unchanged: %s", (name, hash) => {
    const path = join(ROOT, name);
    expect(allStoreysDigestWithDiagnostics(API, readFileSync(path, "utf8"), { world: worldFor(dirname(path)) })).toBe(
      hash,
    );
  });

  it("is not vacuous: the reproduction's digest is not the one it had before this rule", () => {
    // Measured on the same `main`: the plan failed with E_UNKNOWN_REF there.
    const src = plan(`  import "m.arch": s1\n  place s1() as g at (0,0)`);
    const world = makeVirtualWorld({ "m.arch": M });
    expect(allStoreysDigestWithDiagnostics(API, src, { world })).not.toBe(
      "5697a839c36ae7e89b6ef97ef927f6dd216e1ea7023a8dffe459e67209ded731",
    );
  });
});
