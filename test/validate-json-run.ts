/**
 * The runner behind the `validate --json` additivity law (PS5.3, `./cli-validate-next.test.ts`):
 * `cmdValidate` in-process (the real CLI command, not a lookalike) with stdout captured, over every
 * shipped example and every defect-corpus file, read from disk so a new file is covered the day it
 * lands.
 */

import { readdirSync, statSync } from "node:fs";
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
  return [...examples, ...walk("test/defect-corpus")];
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
