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
 *     Two surfaces no digest here pins move with it, on this row and on
 *     `docs/plans/plan-soundness/repro/door-on-tee.arch` (no row): Plan JSON (`compile -f json`),
 *     whose edge for that door goes from `living`→`bath`, `interior` to `exterior`→`living`,
 *     `front`; and `lint()` under `accessibility-advisory`, which gains `W_PATH_TOO_NARROW` twice
 *     (one walk per room, 840 and 740 mm clear against the 900 mm minimum) now that a route exists.
 *   - 2026-10-18, plan-soundness PS2.5–PS2.7 (three circulation-and-privacy lint rules
 *     appended): `examples/two-bed`, `examples/garden-house`, `test/fixtures/axes-grid` and
 *     `chain30` as in `./while-byte-identity-baseline.ts`; and four eval plans, `lint()` only, each
 *     reproduced by hashing with `lint()` minus the three new codes:
 *     `eval/goldens/reception-suite` (`W_WET_ROOM_DOOR`: the WC door opens into "Kitchenette"),
 *     `relational-studio` (`W_WET_ROOM_DOOR`: the bathroom door opens into "Kitchen"),
 *     `strip-attach-clean` (`W_ROOM_VIA_PRIVATE`: "Bedroom 2" is reached only through
 *     "Bathroom", depth 3) and `eval/fidelity-plans/four-bed-cap.laundered` (three
 *     `W_ROOM_VIA_PRIVATE`: bedrooms 2 and 3 only through bedroom 1, bedroom 4 through 1 then 3).
 *     After the rules' review, `two-bed` and the three goldens moved again on their hint wording
 *     alone (see `./byte-identity-baseline.ts`): the first commit's `lint()` reproduces each row.
 *
 * Fifteen rows re-measured on 2026-10-18 for the opening rules (plan-soundness PS2.1–PS2.3),
 * each with a held swap-back proof:
 *   - SOURCE fixed, `lint()` unchanged (field by field in `./byte-identity-baseline.ts`, "Six
 *     examples fixed for the opening rules"): `examples/` courtyard-house, furnished-flat,
 *     hillside-villa, library, terrace-row, two-storey, and `test/fixtures/axes-grid.arch`
 *     (`door on shell at 20%` → `25%`: the door ran x 3950–4850 across the partition at x 4000;
 *     the right room's walk 2800 → 1700) and `schedule-sheet.arch` (`20%` → `17%`: the door was
 *     centred on the T; it loses `straddles`, two walks move, 3000 → 2600 and 2800 → 3300).
 *     The new `lint()` with the previous SVG, `describe()` and `compile().diagnostics`
 *     reproduces each previous row.
 *   - SOURCE unchanged, `lint()` gains the new codes (true positives, left as written):
 *     `test/recovery-corpus/` terrace-row and two-storey (frozen copies, never edited), and
 *     `eval/goldens/` against-wall-bath, anchor-furniture, strip-attach-clean, three-bed-2bath
 *     and `eval/fidelity-plans/two-bed-min-area.faithful.arch` (holdout, never edited). The new
 *     SVG, `describe()` and `compile().diagnostics` with the previous `lint()` reproduce each
 *     previous row.
 *
 * Five of them re-measured again in the opening rules' review round, against `bc5c55f`, each
 * with a held swap-back proof: `examples/terrace-row.arch` (`win_bath` moved, the drawing only,
 * see `./byte-identity-baseline.ts`), and four whose `lint()` alone moved. The move hints now say
 * what the move was measured to open into ("still opens between …"), which rewords the hints
 * of `test/recovery-corpus/terrace-row.arch`, `eval/goldens/against-wall-bath.arch` and
 * `anchor-furniture.arch`; and `strip-attach-clean.arch` loses its `W_CONNECTOR_AMBIGUOUS`
 * (each straddled sliver is 100 mm, 50 mm net of the partition's body, under the 100 mm a
 * jamb's nib needs), keeping its `W_OPENING_AT_JUNCTION`.
 *
 * The rows moved by both plan-soundness branches are re-measured on their merge, as recorded
 * in `./byte-identity-baseline.ts` (the last paragraph of its header).
 * Thirty-two rows re-measured on 2026-10-18 (plan-soundness PS2.8 + PS2.9), with this test's own
 * digest body: the eleven of `./while-byte-identity-baseline.ts` (same reason), plus rows that
 * move on `lint()` alone. Hashing the new SVG, `describe()` and `compile().diagnostics` with the
 * previous `lint()` reproduces every previous row of those, measured with each payload separately.
 *   - `test/recovery-corpus/terrace-row.arch`, `two-storey.arch` (frozen copies, never edited):
 *     `W_ROOM_MISSING_DEFINING` — four "Living" rooms tagged dining with no table; a kitchen with
 *     a sink and no hob, a bath with a WC and basin and no bathtub or shower.
 *   - `eval/goldens/*` (never edited; holdout): `against-wall-bath`, `attach-openings`,
 *     `compact-studio` (kitchen without a hob), `core-and-shell`, `l-shaped-flat`,
 *     `relational-studio`, `sized-bedrooms`, `sized-kitchen-flat` (living room or kitchen with no
 *     window), `office`, `reception-suite`, `sized-office-mix` (both); `core-and-shell` also
 *     `W_ROOM_NO_FIXTURE`'s hint.
 *   - `eval/fidelity-plans/*` (eight rows): `W_ROOM_NO_FIXTURE`'s hint only.
 * Six rows re-measured on 2026-10-19 (plan-soundness PS2.4), with this test's own digest body:
 * the six of `./while-byte-identity-baseline.ts`, for the same reasons (the space-enclosure
 * rules move `lint()` only; three examples' sources fixed). No eval golden, fidelity plan or
 * recovery copy raises the three new codes.
 * `examples/hillside-villa.arch` re-measured for plan-soundness PS0.12, with this test's own
 * digest body, as `./while-byte-identity-baseline.ts` records (the bay window's `describe()`
 * `room`; the previous `describe()` put back reproduces the previous row).
 * Nineteen rows re-measured for plan-soundness PS0.10 (`describe().access` names the main
 * entrance; `describe()` only, the previous `describe()` put back reproduces each previous row):
 * the fifteen examples `./while-byte-identity-baseline.ts` lists, plus
 * `eval/goldens/scripting-units.arch` and `test/recovery-corpus/materials.arch`, `parametric.arch`
 * and `terrace-row.arch` (frozen copies, never edited), each a storey with more than one
 * entrance whose fact is refused (`tie`, `kind-conflict`): `access.mainEntrance` appended.
 * Fifteen re-measured again in the PS0.10 review round (width no longer decides; `kind-conflict`
 * is gone), `describe()` only, the first measurement's `describe()` put back reproducing each.
 * Eight again in review round 2 (the seven examples `./while-byte-identity-baseline.ts` names, and
 * `test/recovery-corpus/terrace-row.arch`), `describe()` only, the same way.
 *
 * 2026-10-20, plan-soundness PS2.17 (the kitchen row requires a worktop): the eleven examples
 * that gained one, as `./while-byte-identity-baseline.ts` says; and, `lint()` only, rows whose
 * SOURCE did not change (`test/recovery-corpus/terrace-row.arch` and `two-storey.arch`,
 * `eval/goldens/core-and-shell.arch`, seven `eval/fidelity-plans`): they gain the worktop
 * finding or a `W_ROOM_NO_FIXTURE` hint that quotes the worktop, and the new SVG, `describe()`
 * and `compile().diagnostics` with the PREVIOUS `lint()` reproduce each previous row.
 * Review round 1 (same card): the hint's placement search tries the worktop's 400 mm module
 * too, as `finish` does, so `core-and-shell` and five `eval/fidelity-plans` quote paste-able
 * statements again (sink, stove and worktop) where the first commit's hint said "make room
 * first"; `lint()` only, and the first commit's `lint()` put back reproduces each of its rows.
 * The same size fallback reaches every defining piece with more than one size: a bed's hint
 * now tries 1500 then 900 mm (`docs/plans/plan-soundness/repro/family-apartment.arch`'s "no
 * bed" quotes `bed … size 900x2000`; not a row here). Review round 2: a hint's set is linted
 * with its pieces standing and is not quoted if it would raise any other finding, and a corner
 * worktop the resolver would not turn quotes its `rotate`; `two-bed-min-area.laundered`'s kitchen
 * hint now says its placement would raise another finding (pasted, its pieces opened the
 * bathroom straight onto the kitchen, `W_WET_ROOM_DOOR`); `lint()` only, round 1's `lint()` put
 * back reproduces its row (e621f33b…).
 *
 * 2026-10-20, plan-soundness PS2.18 (dwelling-reading rules decline on a non-residential plan):
 * `eval/goldens/core-and-shell.arch`, `office.arch`, `reception-suite.arch` and
 * `sized-office-mix.arch` read as offices, so `W_HABITABLE_NO_WINDOW` no longer asks their
 * kitchenette for a window. `lint()` only: the new SVG, `describe()` and `compile().diagnostics`
 * with the PREVIOUS `lint()` reproduce each previous row (ddcdc0c9…, f4725500…, 2d52aba1…,
 * 019a62d8…).
 */
const BASELINE: [string, string][] = [
  ["examples/accessible.arch", "37750afda8d897db7e4e03b20db72ffe0873a840210eca21d494aaefa7cfc0a2"],
  ["examples/aquarium.arch", "95ad80d00f98c5d796e25e680c5ad5ee0bdbb5032351ed589cc84c664421ca30"], // re-measured for PS2.4, see header
  ["examples/attached.arch", "591f4199087b7f7fcab65af3cab3f12dbe062456954e7ef0f02969a974d34b93"],
  ["examples/bungalow.arch", "5fddcfb20684e94f609c770e7632c207df253d8acdae244243327df6b926b7df"],
  ["examples/classroom-block.arch", "48ee65709fc9f1b2875c7b96fd680d03a8012811d0bd18bc4a3a45422f19fe79"], // added with the example, re-measured for net area, see header
  ["examples/clinic.arch", "fac5d9fab49df93fe8cbff6cc0bf26b9e84b1a32c26128e155d0eeb5da99feb1"],
  ["examples/corner-cafe.arch", "e0df9ca7fb18917da864b13ea713257106e29216a955976f2465338c8062f90d"], // added with the example, re-measured for net area, see header
  ["examples/courtyard-house.arch", "6ed177a87b487397decc32787c289ebaed4fa30108dd3be95d5cb87470dc6e14"], // re-measured for PS2.4, see header
  // Re-measured 2026-10-20 (PS2.19), `describe()` only: "Utility" reads `utility` (`byte-identity-baseline.ts`).
  ["examples/furnished-flat.arch", "c66caa1865a7b96d6edf80fa48a2d53eac0efa6475198983a3babb5b1b56a894"],
  ["examples/gallery-l.arch", "cc37c7d8d73b535358978674f3c5da26af87af4d066e6cd67a8bd1f8506e7f5f"],
  // Re-measured because the EXAMPLE changed (backlog D.1, its doubled chairs removed), and again
  // for the legend's ground swatches (backlog D.3, level 1's SVG only): the same row, with the
  // same digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/garden-house.arch", "61b1f27c03dd240fa9bb72a866c666970c5bd05d7f825ebb7d45cc360656a891"],
  ["examples/garden-loft.arch", "c71a830b8dd98fa134a662c9ffd9a7138d84bafc086d56857e1c00f2ca935c94"],
  ["examples/hexagon-pavilion.arch", "edef621837ae7adb96218de65b346e231ffe0c006dcd72f70a7e8d3b14777858"],
  // Re-measured for the facade-probe fix (level 2's `dims auto` chains only), and again because
  // the EXAMPLE changed (backlog D.2, its piano turned and moved): the same row, with the same
  // digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/hillside-villa.arch", "3ea454598ba34a492fac3e30285b404d33957624ac5722ef92ee0c722ab123b9"], // re-measured, see header
  ["examples/imports.arch", "f1b5ff9ee7189d217cd8df57d04a1af5d2876bbc69ec588be202f28c68f47a5b"],
  ["examples/laneway-house.arch", "7ae6603a78b63faff8a5bf9b393226cfa5d32b428e5297821ea9db6599228b2a"],
  ["examples/library.arch", "35dcd343befa526864edfe86efc7bc8d332413598c4cbfac661e3f1db79381bd"],
  ["examples/materials.arch", "8d9b58a1bc8dcdccb6d530b0f2d246777406e2eaa25849a3128de0dfcd850398"],
  ["examples/museum-wing.arch", "6e01f37f15c674c544fac6651e9f3bd32d4d6e4865fdafba36ed97feca9ff33a"],
  ["examples/museum-wings.arch", "273fcdf2e5493e731893362b345c15804299d81d30c681a0d11fd78adfe605b6"],
  ["examples/museum.arch", "9cef24555d4447feb381dc9a5b75fba06ea9cb8edb3e53fa2daca0a3cbc27d0e"],
  ["examples/one-room.arch", "e12596f5401f097b5cf431fda952e96fc6523d7ca6a97c1518ffe6dd64e72cbe"],
  ["examples/parametric.arch", "4b4e50a6118cdca922c93a88e9c783abe17fd7d29458e27f98f0400721c2c8c7"],
  ["examples/practice-office.arch", "469f2d99f8911d59d91d2e7c0fdfaf21628cb5cfc92d3a0f08634699d57e2012"], // added with the example, re-measured for net area, see header
  // Re-measured 2026-10-18 (PS0.7, the label classifier emits living; `describe()` only): the
  // same row, with the same digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/relational.arch", "0daebc6c46696e5be32690a293ce40d159e5c690948180767c409b53ccd28190"], // re-measured for PS2.4, see header
  // ADDED with the new example (the issued-sheet statements), then re-measured once when the
  // thickness call-out change met it (drawing only): the same row, with the same digest body,
  // as `./while-byte-identity-baseline.ts`, whose header has both.
  ["examples/sheet-notes.arch", "0104550fc3b3a39a71c1a005da79c3db5ea10ae21d9739e11a6d1f18ee7b7420"],
  ["examples/studio.arch", "ed8513998b1bc62fa08d73a67c0897777ab68f186609896ae491b868adf463d8"],
  ["examples/terrace-row.arch", "2d5fba9f0db68736e8da81277cb775268e1d3f35cceeb8d4a75c8c12fe5649c0"],
  // Re-measured 2026-10-18 (PS0.7, the label classifier emits living; `describe()` only): the
  // same row, with the same digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/themed.arch", "083872e0955d587897a87084c2f0bfe395856b02c643d7a8920e02f4bde870c1"],
  ["examples/tiny-house.arch", "c3d562235b68223d1018f22230e28fc54404a8fed6f1a617816ce834aa0f5b01"],
  ["examples/townhouse.arch", "fe8e58b3b89a6e35101d852a82a425bee082d28735de04f1ad6546b9be3466f8"],
  ["examples/transit-hall.arch", "36eeb0b92a45d3e1db704bd302ce34731bef4cb2ed637021e90ddca7f9744d76"],
  // Re-measured 2026-10-18 (PS0.7, the label classifier emits living; `describe()` only): the
  // same row, with the same digest body, as `./while-byte-identity-baseline.ts`, whose header has the reasons.
  ["examples/two-bed.arch", "38dce8b3f9b2f408286f53ab8fd5af8501deff388f493ccced6277a9fb40e740"],
  ["examples/two-storey.arch", "76b5e43457bd8723b53bf77739de5083718f478b5fd29cf937b6eacf6fd91632"],
  ["examples/lib/doors.arch", "232f7d4cf35f3d44678b3e3641c4815139f9412a9fd079f99639026b99f005b6"],
  ["examples/lib/fixtures.arch", "25e792ed80e5571a57ac00323283b58af9ffd96646008637646f99600f4716f8"],
  ["examples/lib/furniture.arch", "0b3f57be12defbd32e7dd349a5c81619acc3c2650bcf2e2bffaff1669b7a112a"],
  ["test/fixtures/axes-grid.arch", "a0a729cd0ec5bbfd90353f47e0fc9d3ee45601b66dbb67df459f54165465e8ff"],
  ["test/fixtures/chain30.arch", "858da6001d3d8032a10d372a3dac4c4eae453ad898c4f930ec4dd09ad4d9c54a"], // new fixture, see header
  ["test/fixtures/dense-bays.arch", "01ec7328bb74d5e67b80e9c2301db4bdf6734542b398ba714a3c19807b1bfa57"],
  ["test/fixtures/diff-a.arch", "55aa08f8cc9c48bc3535b14e15cab82ac4002a88709c7bd691f171f74512308a"], // re-measured for PS2.4, see header
  ["test/fixtures/diff-b.arch", "36af79705f9dcbf671117c2d0cb263d309ec0540d7e689bcc6cc3bfaee4c6a8e"],
  ["test/fixtures/diff-circ-a.arch", "272184ab44393f0f5cf74f5ad7a41c65ee2e16fbaf837dd9d0a1fb40ab71a335"],
  ["test/fixtures/diff-circ-b.arch", "68ba4e31f6e1bcb57fda4bc7eefc2afba407b1e0038497fb4a65079be210864d"],
  ["test/fixtures/off-path-bypass.arch", "b8123c5f00d6ce700209f6c5f6a479847f0e5218cf99c8bb2d4af66006289415"], // new fixture, see header
  ["test/fixtures/schedule-sheet.arch", "a139fa2e1dcf9a045d5b58507882b29eac8a5156c70c48645f923f055748d975"], // re-measured, see header
  ["test/fixtures/star30.arch", "eb21a2460d3cd302bc0b470184924cb46c947fa9ca95a7d8d7cbda839f791761"], // new fixture, see header
  ["test/fixtures/zones-levels.arch", "3a6f8bc7115bcd0a1471ce008b984f5c121cafc3e8b4a8269f0dcc94af18ecb8"], // re-measured for PS2.4, see header
  ["test/fixtures/zones-wings.arch", "f7ee2a2b343dee5164a308b00204c546f3f8cfcfde21a32f128f58d5e2a1f072"], // re-measured for PS2.4, see header
  ["test/recovery-corpus/attached.arch", "591f4199087b7f7fcab65af3cab3f12dbe062456954e7ef0f02969a974d34b93"],
  ["test/recovery-corpus/clinic.arch", "fac5d9fab49df93fe8cbff6cc0bf26b9e84b1a32c26128e155d0eeb5da99feb1"],
  ["test/recovery-corpus/materials.arch", "8d9b58a1bc8dcdccb6d530b0f2d246777406e2eaa25849a3128de0dfcd850398"],
  ["test/recovery-corpus/parametric.arch", "4b4e50a6118cdca922c93a88e9c783abe17fd7d29458e27f98f0400721c2c8c7"],
  ["test/recovery-corpus/studio.arch", "ed8513998b1bc62fa08d73a67c0897777ab68f186609896ae491b868adf463d8"],
  ["test/recovery-corpus/terrace-row.arch", "2d0b625c755cc704b1bac6c86a6d0817045ef873996681fa2a2540214feb01e9"],
  // Re-measured 2026-10-18 (PS0.7): a copy of `examples/themed.arch`, the same cause and value.
  ["test/recovery-corpus/themed.arch", "083872e0955d587897a87084c2f0bfe395856b02c643d7a8920e02f4bde870c1"],
  ["test/recovery-corpus/two-storey.arch", "d911af2b9affed091c6bf157fde296fed715aff055619f015f3338caff273f68"],
  ["eval/goldens/accessible-bath.arch", "0f2e47f8b1a0afe5e110117ea229b829861353fe1d115b9a8af1ec2085774d14"],
  ["eval/goldens/accessible-flat.arch", "721d479d06915e309d209c1c84dbb4a5b1c40b7c8195891499ed5078c650fe3e"],
  ["eval/goldens/against-wall-bath.arch", "37f238a6b64aaac8fb0650437e11b392cc6f49160cc8823d9bb8eb0a41fb319e"],
  ["eval/goldens/anchor-furniture.arch", "5ae5239f1fceec9d9021bcdee198503bd9edb4f92ad21bf887dc6c6777fec2fa"],
  ["eval/goldens/attach-openings.arch", "a0ac00b106622e0d3d049b88dccfd35700f0c634649941d190f55651fb6c36a6"],
  ["eval/goldens/bungalow.arch", "2205e6505a37378b5d3e54f64066abfafb1bea07a67b62d5f08c724162842168"],
  ["eval/goldens/compact-studio.arch", "7af1ccb4b35aca496489c382593142d103d9d2a52958a17fb3980576b81b4cd7"],
  ["eval/goldens/core-and-shell.arch", "51edb95aa3a6c8414aeb32aec98a4510cec889b1a0a527a4a7810dfb258300bc"],
  ["eval/goldens/dims-auto-cottage.arch", "ca327599910fd97d0f8ced7ea4f03bb93312541b92e12119e12e976b0e76b5d8"],
  ["eval/goldens/galley-kitchen.arch", "af379acc431baaa7728fde7eee94f2a34fef2e4303ab967cabb029a7b3837669"],
  ["eval/goldens/l-shaped-flat.arch", "9634e0daba1977009de1013018e4f774212ae7632c2079600864ef25fa972255"],
  // Re-measured 2026-10-20 for PS2.19 (`describe()` only: "Open Office" reads `office`) and again for
  // PS2.18 (`lint()` only: the kitchenette's daylight warning declines); see header.
  ["eval/goldens/office.arch", "7c7925bb950f8b8f5ee0519bf175f1e9fc8b7cf7c4aee4c579b93828accd20f1"],
  ["eval/goldens/open-plan-loft.arch", "2efcf0fdc611e4c017621e8de25030ea3a7afed4069a6816217ba2f7cfca762a"],
  ["eval/goldens/reception-suite.arch", "b2d8484329cdf29957e587deba367ae007fe24eacf30bf50851e9fca29f8f5cc"],
  ["eval/goldens/relational-studio.arch", "845f133cddc2eb0f98d363b611c4bccfc87a69ca5554cdd316350030d2883bd5"],
  ["eval/goldens/scripting-units.arch", "fa309f7c081cb373d133708d513a6fdfb0e0699fccbb0c8a602eb31a29c7a8c8"],
  ["eval/goldens/sized-bedrooms.arch", "a828ac8af20e216f6b2fed310695e253dfb0fa33b34f1a9dcfcfd4dc8a979b10"],
  ["eval/goldens/sized-kitchen-flat.arch", "36f1dc563dfbc0f10190bcc2ad2435ac100f00f3e7d2729db9781a87cf1b847f"],
  ["eval/goldens/sized-office-mix.arch", "a9293aa1dcb8239994e82594b105dede14c445340a60f2ddc14441cc1cd80f8a"],
  ["eval/goldens/sized-wet-room.arch", "b73b7c5a2ad1eedf1a402331c6c0991ac3a985adf8b23c9b73fa5d4a4c46129a"],
  ["eval/goldens/strip-attach-clean.arch", "5a42e4f024480e5cabc0c1c8e16ffa4a4b1c05f7b24457aab9e3676ff2539d79"], // re-measured, see header
  ["eval/goldens/strip-corridor.arch", "2b471514e89a72253310c75cff0c6589938f3f1d9bb39e97235b95cc2d7aa17e"],
  ["eval/goldens/three-bed-2bath.arch", "41a6646380327d878c4bc2ee25d722009069750024a3b8e3521ed9d818ef06ca"],
  ["eval/goldens/two-bath-flat.arch", "4238d0b5c2d363d15809a6fd3357bd5d97fdbfe02be2caa76022ad7b5e32a305"],
  ["eval/goldens/two-bed-hall.arch", "36a87e7c15583c6a819e071f55e1727014a4dbc13a39421588acd1c07ffd2ce8"],
  [
    "eval/fidelity-plans/capped-wet-room.laundered.arch",
    "58e3553acf88e96d8f89dd349434cfd1f6636ab7eb2488e2fa30d05dce57af2b",
  ],
  [
    "eval/fidelity-plans/four-bed-cap.laundered.arch",
    "f429aedaf782d49151055a261b869c2225423b23b46e943d1bf1eb8d56ae639a",
  ],
  [
    "eval/fidelity-plans/min-bedroom-flat.faithful.arch",
    "849b77f80e0b45648fdd9f4b55da31fdeaae4bd16831e59933f9f590d1693821",
  ],
  [
    "eval/fidelity-plans/min-bedroom-flat.laundered.arch",
    "939244eeb49bda4e93fbc18d42644b36abf74949506a6b8b239f83a313c83a78",
  ],
  [
    "eval/fidelity-plans/over-programmed-flat.laundered.arch",
    "7340c22c8401c015133f24cda5fd3bb36cfe08d08b25b48379e5340aab50ccb3",
  ],
  [
    "eval/fidelity-plans/two-bed-min-area.faithful.arch",
    "def845b79d221073f162cc6d1a74c9a535e44653ac1124f9321e612c2b6d8cf7",
  ],
  [
    "eval/fidelity-plans/two-bed-min-area.laundered.arch",
    "f34b44502b0d494422c40d073d52068a14a9fe3066085cb1b297c897e6492d3d",
  ],
  [
    "eval/fidelity-plans/wide-doorways.faithful.arch",
    "2ce59bd2c5c613503fa5ff562c83ef4527ee6af9f9cbbd7b78856d4717c8a335",
  ],
  [
    "eval/fidelity-plans/wide-doorways.laundered.arch",
    "c3a5e6f53a1a903834500e5706145a485adf6f11cff315a02eddc36a86aa5751",
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
