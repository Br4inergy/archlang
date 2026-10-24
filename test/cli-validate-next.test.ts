import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runValidate, validateJsonDigests, validateJsonFiles } from "./validate-json-run.js";

/**
 * `validate` gains `next` (plan-soundness PS5.3).
 *
 * - **The byte law.** `validate --json` (and `--json --strict`) over every shipped example and
 *   every defect-corpus file prints exactly what `main` printed before `next` existed, plus one
 *   `next` key appended last: strip that key's bytes and the SHA-256 and the exit code equal the
 *   pin in `./validate-json-pre-next.json`, measured on `main` by the same body
 *   (`./validate-json-run.ts`) before this change.
 * - **The flags.** `--profile` and `--taste` take the names `lint --profile` and
 *   `score --taste` take (an unknown name exits 3), feed `next` its profile and taste tiers, and
 *   never change an exit code; `next` is last with `--intent` too; display filters never move
 *   it; the human `next (<tier>):` line is on stderr, and `--quiet` drops it.
 */

const PIN: Record<string, string> = JSON.parse(readFileSync("test/validate-json-pre-next.json", "utf8"));

/** `stdout` minus the trailing `"next"` key, byte for byte; throws if `next` is not the last key. */
function stripNext(stdout: string): string {
  const at = stdout.lastIndexOf('\n  "next": ');
  if (at < 1 || stdout[at - 1] !== ",") throw new Error(`no trailing next key in:\n${stdout}`);
  const parsed = JSON.parse(stdout) as Record<string, unknown>;
  const keys = Object.keys(parsed);
  if (keys[keys.length - 1] !== "next") throw new Error(`next is not the last key: ${keys.join(", ")}`);
  const stripped = `${stdout.slice(0, at - 1)}\n}\n`;
  const { next: _drop, ...rest } = parsed;
  // The stripped bytes are a complete document holding everything but `next`.
  expect(JSON.parse(stripped)).toEqual(rest);
  return stripped;
}

describe("validate --json · the byte law against main", () => {
  it("the pin covers every file and variant the law runs (nothing added or dropped)", () => {
    const files = validateJsonFiles();
    expect(files.length).toBeGreaterThan(150);
    expect(Object.keys(PIN).length).toBe(files.length * 2);
  });

  it("output minus the appended next key is byte-identical to main's, with the same exit code", () => {
    const now = validateJsonDigests(stripNext);
    const moved = Object.keys(PIN).filter((k) => now[k] !== PIN[k]);
    expect(moved).toEqual([]);
    expect(Object.keys(now).sort()).toEqual(Object.keys(PIN).sort());
  }, 600_000);
});

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}
function cli(args: string[], input?: string): Run {
  const r = spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "validate", ...args], {
    input,
    encoding: "utf8",
    cwd: process.cwd(),
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Lint-clean under the default ruleset; `accessibility-advisory` raises W_PATH_TOO_NARROW; taste
// scores its daylight below 1.
const CLEAN = "test/defect-corpus/annotation-collisions/title-overflow.arch";
// A validity warning (W_ROOM_VIA_PRIVATE) first in emission order.
const BAD = "test/defect-corpus/circulation-privacy/bedroom-via-bedroom.arch";

describe("validate · next tiers through the CLI", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "arch-next-"));
    // Nine rooms asked for, fewer in the plan: a gating intent violation.
    writeFileSync(join(dir, "brief.json"), JSON.stringify({ rooms: 9 }));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("error: a parse error is next, exit 2", () => {
    const r = cli(["-", "--json"], 'plan "x" { units mm room id=a at (0,0) size 0x }');
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout).next).toMatchObject({ tier: "error", code: "E_PARSE" });
  });

  it("warning: a compile-channel warning is next when lint has nothing", () => {
    const r = cli(["-", "--json"], 'plan "x" { units mm }');
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).next).toMatchObject({ tier: "warning", code: "W_EMPTY_PLAN" });
  });

  it("validity: the first validity warning, with its span", () => {
    const r = runValidate([BAD, "--json"]);
    const out = JSON.parse(r.stdout);
    expect(out.next).toMatchObject({ tier: "validity", code: "W_ROOM_VIA_PRIVATE" });
    expect(out.next.span).toEqual(out.diagnostics.find((d: { code: string }) => d.code === "W_ROOM_VIA_PRIVATE").span);
  });

  it("nothing: null, and no human next line", () => {
    const r = runValidate([CLEAN, "--json"]);
    expect(JSON.parse(r.stdout).next).toBeNull();
    const h = cli([CLEAN]);
    expect(h.status).toBe(0);
    expect(h.stderr).not.toMatch(/next \(/);
  });

  it("--profile: the profile's own warning is next; the diagnostics are the profile's, as lint --profile", () => {
    const r = runValidate([CLEAN, "--json", "--profile", "accessibility-advisory"]);
    expect(r.exit).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.next).toMatchObject({ tier: "profile", code: "W_PATH_TOO_NARROW" });
    expect(out.diagnostics.map((d: { code: string }) => d.code)).toContain("W_PATH_TOO_NARROW");
    // --strict gates on them, exactly as `lint --profile --strict` does.
    expect(runValidate([CLEAN, "--json", "--strict", "--profile", "accessibility-advisory"]).exit).toBe(2);
  });

  it("--taste: the lowest-scoring criterion is next; never gates", () => {
    const r = runValidate([CLEAN, "--json", "--taste", "generic"]);
    expect(r.exit).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.ok).toBe(true);
    expect(out.next).toMatchObject({ tier: "taste", code: expect.stringMatching(/^A_/) });
    expect(out.next.hint).toMatch(/ scored .* under generic \(source: /);
    // A higher tier still wins with --taste given.
    expect(JSON.parse(runValidate([BAD, "--json", "--taste", "generic"]).stdout).next.tier).toBe("validity");
  });

  it("--intent: a gating violation is next, and next is still the last key", () => {
    const r = runValidate([CLEAN, "--json", "--intent", join(dir, "brief.json")]);
    expect(r.exit).toBe(2);
    const out = JSON.parse(r.stdout);
    expect(Object.keys(out)).toEqual(["ok", "strict", "diagnostics", "intent", "next"]);
    expect(out.next).toMatchObject({ tier: "intent", code: "E_INTENT_ROOM_COUNT" });
  });

  it("a display filter narrows the diagnostics, never next", () => {
    const all = JSON.parse(runValidate([BAD, "--json"]).stdout).next;
    const filtered = JSON.parse(runValidate([BAD, "--json", "--severity", "error"]).stdout);
    expect(filtered.diagnostics).toEqual([]);
    expect(filtered.next).toEqual(all);
  });

  it("unknown profile names are bad usage (exit 3) with a did-you-mean", () => {
    const p = cli([CLEAN, "--profile", "acessibility-advisory"]);
    expect(p.status).toBe(3);
    expect(p.stderr).toMatch(
      /unknown lint profile "acessibility-advisory" \(did you mean "accessibility-advisory"\?\)/,
    );
    const t = cli([CLEAN, "--taste", "generik"]);
    expect(t.status).toBe(3);
    expect(t.stderr).toMatch(/unknown taste profile "generik" \(did you mean "generic"\?\)/);
  });

  it("human mode: one next line on stderr (plus its help line); --quiet drops it", () => {
    const h = cli([BAD]);
    expect(h.status).toBe(0);
    const lines = h.stderr.split("\n").filter((l) => l.startsWith("next ("));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^next \(validity\): W_ROOM_VIA_PRIVATE at \d+:\d+: /);
    expect(h.stdout).not.toMatch(/next/);
    expect(cli([BAD, "--quiet"]).stderr).not.toMatch(/next \(/);
  });
});
