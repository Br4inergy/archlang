/**
 * `nextDiagnostic(input)` — the ONE thing to fix first (plan-soundness PS5.3), chosen by a fixed
 * precedence over everything `arch validate` knows about a plan:
 *
 * 1. `error` — a `compile()` error. Nothing downstream means anything until the plan resolves.
 * 2. `validity` — a default-ruleset `lint()` warning whose rule is in the validity layer
 *    (`LINT_CODE_LAYERS`, ADR 0032). A code no rule declares counts as validity, as it does for
 *    the taste cap.
 * 3. `drafting` — a default `lint()` warning from a drafting-layer rule (the annotation family).
 *    Its own sub-tier after validity: a drafting code is never chosen ahead of a validity code.
 * 4. `warning` — a compile-channel warning (`W_DOOR_OFF_WALL`, `W_ROOM_OVERLAP`, the deprecations,
 *    …). The card's precedence names no place for them; they are not lint findings (ADR 0032: they
 *    never cap), so they come after the lint tiers, and before the brief, because they are still
 *    findings about the source itself.
 * 5. `intent` — a failing gating assertion of the brief, then a `--graph` mismatch (it gates
 *    too), then an advisory assertion.
 * 6. `profile` — a warning only the named lint profile raises. Default `lint()` warnings all
 *    rank above (tiers 2–3), so this tier is reached only when default `lint()` is empty and
 *    every profile warning is then profile-only.
 * 7. `taste` — the lowest-scoring assessable taste criterion that scored below 1.
 *
 * Within a tier the first in emission order wins, which is already deterministic. A tier whose
 * input was not supplied is empty. `null` when nothing in any tier is left to fix.
 *
 * Pure, sync, deterministic: it reads the results it is handed and computes nothing about the
 * plan itself, so it can never move `describe()`, `lint()` or the drawing.
 */

import type { Diagnostic } from "./diagnostics.js";
import { ERROR_CATALOG } from "./error-catalog.js";
import type { IntentCheckResult } from "./intent.js";
import { feedbackForResult } from "./intent.js";
import { LINT_CODE_LAYERS, type LintLayer } from "./lint.js";
import type { GraphCheck } from "./plan-json.js";
import type { TasteReport } from "./taste/report.js";

/** The tiers, in precedence order. */
export const NEXT_TIERS = ["error", "validity", "drafting", "warning", "intent", "profile", "taste"] as const;
export type NextTier = (typeof NEXT_TIERS)[number];

/** The one item to fix first. */
export interface NextItem {
  tier: NextTier;
  /** The diagnostic's `E_*`/`W_*` code, the intent violation's `E_INTENT_*` code, or the taste
   *  criterion's `A_*` advice code. `null` only for a diagnostic without a code and for a
   *  `--graph` mismatch, which has none. */
  code: string | null;
  message: string;
  /** `[start, end)` byte range, as in a JSON diagnostic; present only when the item has one. */
  span?: [number, number];
  /** The module `span` is measured in, when it is not the source being checked (an `import`). */
  file?: string;
  /** The storey that raised it, on a multi-storey plan. */
  level?: number;
  /** What to do: the diagnostic's first hint, else its catalogued fix; the intent violation's
   *  correction prompt; or the taste criterion, its score and its source. */
  hint?: string;
}

/** Everything `validate` has measured. Leave a field out and its tier is empty. */
export interface NextInput {
  /** The `compile()` diagnostics (errors and compile-channel warnings). */
  diagnostics: readonly Diagnostic[];
  /** Default-ruleset `lint()` diagnostics. */
  lint?: readonly Diagnostic[];
  /** Code → layer; default {@link LINT_CODE_LAYERS}. */
  layers?: Readonly<Record<string, LintLayer>>;
  /** `validateIntent()`'s result (`validate --intent`). */
  intent?: IntentCheckResult;
  /** `checkGraph()`'s result (`validate --graph`). */
  graph?: GraphCheck;
  /** `lint()` under a named profile (`validate --profile`). */
  profileLint?: readonly Diagnostic[];
  /** `taste()`'s report (`validate --taste`). */
  taste?: TasteReport;
}

function fromDiagnostic(tier: NextTier, d: Diagnostic): NextItem {
  const out: NextItem = { tier, code: d.code ?? null, message: d.message };
  if (d.span) out.span = [d.span.start, d.span.end];
  if (d.file !== undefined) out.file = d.file;
  if (d.level !== undefined) out.level = d.level;
  const hint = d.hints?.[0] ?? (d.code ? ERROR_CATALOG[d.code]?.fix : undefined);
  if (hint) out.hint = hint;
  return out;
}

/** The one item to fix first, or `null` when there is nothing left to fix. Pure. */
export function nextDiagnostic(input: NextInput): NextItem | null {
  const err = input.diagnostics.find((d) => d.severity === "error");
  if (err) return fromDiagnostic("error", err);

  const layers = input.layers ?? LINT_CODE_LAYERS;
  const lintWarnings = (input.lint ?? []).filter((d) => d.severity === "warning");
  const isDrafting = (d: Diagnostic): boolean => d.code !== undefined && layers[d.code] === "drafting";
  const validity = lintWarnings.find((d) => !isDrafting(d));
  if (validity) return fromDiagnostic("validity", validity);
  const drafting = lintWarnings.find(isDrafting);
  if (drafting) return fromDiagnostic("drafting", drafting);

  const compileWarning = input.diagnostics.find((d) => d.severity === "warning");
  if (compileWarning) return fromDiagnostic("warning", compileWarning);

  const intent = input.intent;
  if (intent) {
    const i = intent.violations.findIndex((v) => v.gate);
    if (i >= 0) return fromViolation(intent, i);
  }
  const graph = input.graph;
  const graphItem = graph && !graph.ok ? fromGraph(graph) : null;
  if (graphItem) return graphItem;
  if (intent && intent.violations.length > 0) return fromViolation(intent, 0);

  // Reached only when default lint() raised nothing (any warning of it returned above), so every
  // warning the profile raises is one only the profile raises: no difference to compute.
  const profile = input.profileLint?.find((d) => d.severity === "warning");
  if (profile) return fromDiagnostic("profile", profile);

  const t = input.taste;
  if (t?.ok) {
    let worst: TasteReport["criteria"][number] | undefined;
    for (const c of t.criteria) {
      if (!c.assessable || c.score === null || c.score >= 1) continue;
      if (worst === undefined || c.score < worst.score!) worst = c;
    }
    if (worst) {
      return {
        tier: "taste",
        code: worst.advice ?? worst.id,
        message: worst.message,
        hint: `${worst.id} ${worst.name} scored ${worst.score} under ${t.profile} (source: ${worst.source})`,
      };
    }
  }
  return null;
}

function fromViolation(intent: IntentCheckResult, i: number): NextItem {
  const v = intent.violations[i]!;
  const out: NextItem = { tier: "intent", code: v.code, message: v.message };
  const hint = feedbackForResult(intent)[i];
  if (hint) out.hint = hint;
  return out;
}

/** The first line `validate --graph` prints for a mismatch, in the same words; `null` if none. */
function fromGraph(g: GraphCheck): NextItem | null {
  const room = g.missing_rooms[0];
  const missing = g.missing_connections[0];
  const extra = g.extra_connections[0];
  const message =
    room !== undefined
      ? `graph: room "${room}" not found in plan`
      : missing !== undefined
        ? `graph: missing connection ${missing[0]} — ${missing[1]}`
        : extra !== undefined
          ? `graph: unexpected connection ${extra[0]} — ${extra[1]}`
          : null;
  return message === null ? null : { tier: "intent", code: null, message };
}
