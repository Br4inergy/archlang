/**
 * A host's input-size refusal, as a catalogued diagnostic.
 *
 * `compile()` has no size cap of its own: it is bounded by counts (the step and drawing budgets),
 * never by bytes or time, and every input returns. A HOST can still have a ceiling the core does
 * not — the hosted MCP Worker (`packages/mcp-worker`) runs under a per-request CPU limit — and
 * refuses a source above its cap before any compile work starts. This is the one shape that
 * refusal takes, so a caller reads it like every other diagnostic: `E_INPUT_TOO_LARGE`, whose
 * catalog entry says what to do. `compile()`, `describe()` and `lint()` never call it.
 *
 * Pure: it measures the string it is given and allocates nothing proportional to it.
 */

import type { Diagnostic } from "./diagnostics.js";
import { plainDigits } from "./num-format.js";

/** The UTF-8 length of `s` in bytes, counted without encoding it. */
export function utf8ByteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        n += 4;
        i++;
      } else n += 3;
    } else n += 3;
  }
  return n;
}

/**
 * `E_INPUT_TOO_LARGE` when `source` is longer than `capBytes` of UTF-8, else `undefined`.
 * Whole-input, so it carries no span. `what` names the input in the message ("source",
 * "plan_json"), because a host may cap more than one argument.
 */
export function inputTooLarge(source: string, capBytes: number, what = "source"): Diagnostic | undefined {
  const bytes = utf8ByteLength(source);
  if (bytes <= capBytes) return undefined;
  return {
    severity: "error",
    code: "E_INPUT_TOO_LARGE",
    message: `${what} is ${plainDigits(bytes)} bytes; this host compiles at most ${plainDigits(capBytes)}`,
  };
}
