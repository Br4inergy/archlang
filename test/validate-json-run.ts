/**
 * One body for the `validate --json` byte law (PS5.3), importable WITHOUT vitest: the test runs it
 * on the current `src/`, and the pin in `./validate-json-pre-next.json` was measured by running it
 * on `main@b1f06577`, before `next` existed (`npx tsx test/validate-json-run.ts > …`), and is
 * never re-measured to go green. Two callers, one body.
 *
 * It runs `cmdValidate` in-process (the real CLI command, not a lookalike) over every shipped
 * example and every defect-corpus file, with stdout captured, and hashes what it printed.
 */

import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cmdValidate } from "../src/cli/commands-analyze.js";
import { parseArgs } from "../src/cli/io.js";

/** Every `.arch` file the law covers, as forward-slash paths from the repository root, sorted. */
export function validateJsonFiles(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir)
      .sort()
      .flatMap((f) => {
        const p = `${dir}/${f}`;
        return statSync(p).isDirectory() ? walk(p) : f.endsWith(".arch") ? [p] : [];
      });
  const examples = readdirSync("examples")
    .filter((f) => f.endsWith(".arch"))
    .sort()
    .map((f) => `examples/${f}`);
  return [...examples, ...walk(join("test", "defect-corpus").replace(/\\/g, "/"))];
}

/** Run `validate <argv…>` in-process; return its exit code and everything it wrote to stdout. */
export function runValidate(argv: string[]): { exit: number; stdout: string } {
  let stdout = "";
  const write = process.stdout.write.bind(process.stdout);
  const writeErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    return { exit: cmdValidate(parseArgs(argv)), stdout };
  } finally {
    process.stdout.write = write;
    process.stderr.write = writeErr;
  }
}

/** The argument lists the law runs on each file. */
export const VALIDATE_JSON_VARIANTS: readonly (readonly string[])[] = [["--json"], ["--json", "--strict"]];

export const sha256 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

/** `{ "<file> <args>": "<exit> <sha256 of stdout>" }` over every file and variant. */
export function validateJsonDigests(strip: (stdout: string) => string = (s) => s): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of validateJsonFiles())
    for (const v of VALIDATE_JSON_VARIANTS) {
      const r = runValidate([f, ...v]);
      out[`${f} ${v.join(" ")}`] = `${r.exit} ${sha256(strip(r.stdout))}`;
    }
  return out;
}

// Measurement entry point: `npx tsx test/validate-json-run.ts` prints the pin.
if (process.argv[1] !== undefined && /validate-json-run\.ts$/.test(process.argv[1].replace(/\\/g, "/")))
  process.stdout.write(`${JSON.stringify(validateJsonDigests(), null, 2)}\n`);
