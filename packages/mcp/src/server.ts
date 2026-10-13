/**
 * ArchLang MCP server — a thin stdio Model Context Protocol shim over the
 * `@chanmeng666/archlang` LIBRARY (never a subprocess of the CLI). Every tool
 * wraps one pure, exported function; the core stays zero-dependency — the MCP SDK
 * lives ONLY in this package.
 *
 * Positioning (ADR 0012): the agent-native `archlang` CLI remains the primary
 * interface — it costs nothing in an agent's context window until it is called,
 * whereas an MCP tool schema sits in the window permanently. This server exists so
 * MCP-speaking hosts can *discover* ArchLang through the registry; it is the
 * discoverability channel, not a replacement for the CLI.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyFixes,
  checkGraph,
  compile,
  completion,
  describe,
  diagnosticToJson,
  type Diagnostic,
  feedbackForResult,
  finish,
  type FixSuggestion,
  intentFromJson,
  type IntentCheckResult,
  lint,
  PLAN_JSON_SCHEMA,
  planFromJson,
  planToJson,
  renderAscii,
  renderPng,
  repair,
  type Scene,
  suggestTopology,
  validateIntent,
} from "@chanmeng666/archlang";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { compilePngSentence, IN_MCPB_BUNDLE, pngUnavailable } from "./png.js";

const HERE = dirname(fileURLToPath(import.meta.url));
// Repo root when the server runs from src/ (tests); irrelevant but harmless from dist/.
const REPO = resolve(HERE, "..", "..", "..");

/** Read a shipped resource: flat next to the built server (dist/), else the repo tree. */
function readResource(flat: string, repoRel: string): string {
  for (const p of [resolve(HERE, flat), resolve(REPO, repoRel)]) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return `(${flat} not found — run \`npm run mcp:build\`)`;
}

/**
 * This shim's own version, for the MCP handshake — **derived, never retyped**. It was a
 * hardcoded literal through 0.2.1–0.2.2, so the published server introduced itself as
 * "0.2.0" and a host had no reliable way to tell which shim it was talking to. Mirrors the
 * core's `readVersion()` (`src/cli/io.ts`): `../package.json` resolves from both `dist/`
 * (the packed artifact — npm always includes package.json) and `src/` (the tests).
 */
function readShimField(pick: (pkg: any) => unknown, fallback: string): string {
  for (const rel of ["../package.json", "../../package.json"]) {
    const p = resolve(HERE, rel);
    if (existsSync(p)) {
      try {
        const v = pick(JSON.parse(readFileSync(p, "utf8")));
        if (typeof v === "string") return v;
      } catch {
        /* fall through to the next candidate */
      }
    }
  }
  return fallback;
}
export const SHIM_VERSION = readShimField((pkg) => pkg.version, "0.0.0");

/**
 * The core this shim was released against, from its own dependency range (`^1.x.y` → `1.x.y`).
 * The lockstep test holds that range to the core that first exports `./link`, so this is the
 * version to name when an older core is installed under the shim.
 */
const CORE_MIN = readShimField((pkg) => pkg.dependencies?.["@chanmeng666/archlang"], "").replace(/^[\^~]/, "");

/** What the `link` tool reports when the installed core predates the `./link` subpath. */
export interface LinkUnavailable {
  ok: false;
  error: string;
}

/**
 * Load the share-link minter on first use, not at startup. The rest of the server needs only the
 * core's main entry, so a host that resolved an older core without `./link` keeps ten working
 * tools and gets this as data from `link`, instead of a server that dies at load.
 */
export async function loadPlanLinks(
  importer: () => Promise<typeof import("@chanmeng666/archlang/link")> = () => import("@chanmeng666/archlang/link"),
): Promise<typeof import("@chanmeng666/archlang/link") | LinkUnavailable> {
  try {
    return await importer();
  } catch (e) {
    const code = (e as { code?: unknown }).code;
    if (code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" && code !== "ERR_MODULE_NOT_FOUND") throw e;
    const need = CORE_MIN ? ` >= ${CORE_MIN}` : " with the ./link export";
    return { ok: false, error: `link needs @chanmeng666/archlang${need}; the installed core has no ./link export` };
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Wrap a value as an MCP text-content tool result (pretty JSON). */
function json(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

const errorCount = (ds: Diagnostic[]): number => ds.filter((d) => d.severity === "error").length;
const toJson = (source: string, ds: Diagnostic[]) => ds.map((d) => diagnosticToJson(source, d));

/** The agent-facing projection of one intent violation. The predicate objects are dropped
 *  on purpose — a band's `maxM2` can be `Infinity`, which `JSON.stringify` would null. */
const violationJson = (v: IntentCheckResult["violations"][number]) => ({
  code: v.code,
  message: v.message,
  gate: v.gate,
});

/**
 * Run a raw intent object through the same gate/meter path the CLI uses. Returns pathed
 * shape errors as DATA (never a throw) when the intent JSON is malformed; otherwise the
 * checked result plus its deterministic per-violation feedback prompts.
 */
function checkIntent(
  source: string,
  intentRaw: unknown,
): { intentErrors: string[] } | { result: IntentCheckResult; feedback: string[] } {
  const { intent, errors } = intentFromJson(intentRaw);
  if (intent === null) return { intentErrors: errors };
  const result = validateIntent(source, intent);
  return { result, feedback: feedbackForResult(result) };
}

/** Resolve a tool's `source` | `plan_json` input to `.arch` source (or JSON error diagnostics). */
function resolveSource(input: {
  source?: string;
  plan_json?: unknown;
}): { source: string } | { diagnostics: ReturnType<typeof diagnosticToJson>[] } {
  if (input.plan_json !== undefined) {
    const { source, diagnostics } = planFromJson(input.plan_json);
    if (source === undefined || errorCount(diagnostics) > 0) return { diagnostics: toJson(source ?? "", diagnostics) };
    return { source };
  }
  if (typeof input.source === "string") return { source: input.source };
  return { diagnostics: [] };
}

/**
 * `compile`'s `format:"png"` result: the drawing as MCP image content, then the usual JSON
 * result as text. The renderer is the core's lazy optional import, reached only here, on the
 * first png call; when it is absent (always, in the `.mcpb` bundle) the call returns the
 * error as data, like every other tool, never an exception.
 */
async function pngResult(
  source: string,
  pageScene: Scene,
  meta: Record<string, unknown>,
  diagnostics: ReturnType<typeof diagnosticToJson>[],
) {
  const unavailable = () =>
    json({ ok: false, format: "png", error: pngUnavailable(), code: "E_PNG_DEPENDENCY", ...meta, diagnostics });
  if (IN_MCPB_BUNDLE) return unavailable();
  const warnings: Diagnostic[] = [];
  let bytes: Uint8Array;
  try {
    bytes = await renderPng(pageScene, { onDiagnostic: (d) => warnings.push(d) });
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    if (/resvg|optional dependency/i.test(message)) return unavailable();
    return json({ ok: false, format: "png", error: message, ...meta, diagnostics });
  }
  const text = JSON.stringify(
    {
      ok: true,
      format: "png",
      ...meta,
      bytes: bytes.length,
      diagnostics: [...diagnostics, ...toJson(source, warnings)],
    },
    null,
    2,
  );
  return {
    content: [
      { type: "image" as const, data: Buffer.from(bytes).toString("base64"), mimeType: "image/png" },
      { type: "text" as const, text },
    ],
  };
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

/**
 * The `instructions` every host reads at `initialize`, on every session — so it stays short
 * (a test caps it at 900 characters). It is SKILL.md's loop, condensed: a test holds the
 * commands it names to the CLI manifest and to the order SKILL.md's loop names them in, so the
 * two cannot drift apart silently.
 */
export const INSTRUCTIONS = [
  "ArchLang compiles `.arch` text to SVG floor plans. Before writing any `.arch`, read the " +
    "`archlang://spec` resource: the whole language (from a shell: `npx -y @chanmeng666/archlang spec`).",
  "The loop:",
  "1. Write the plan as `.arch` source.",
  "2. `compile` it. Errors are diagnostics, usually with a byte span, often a fix; `fix` applies the " +
    "machine-applicable ones, edit the rest by hand.",
  "3. `describe` it; check rooms, areas and doors against the brief.",
  "4. `validate` with strict:true (parse, resolve, `lint`); fix every warning, then back to 2.",
  "5. `finish` once lint is clean, before export: it furnishes empty rectangular rooms (single-storey plans) " +
    "and adds the missing sheet statements (paper, scale, dimensions, title, room schedule, legend).",
  "With a shell, the CLI runs the same loop at no context cost: `archlang <cmd>`, " +
    "or `npx -y @chanmeng666/archlang <cmd>` without a global install.",
].join("\n");

/** Build the fully-configured ArchLang MCP server (tools + resources). */
export function createServer(): McpServer {
  const server = new McpServer({ name: "archlang", version: SHIM_VERSION }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "compile",
    {
      title: "Compile ArchLang → SVG, ASCII, Plan JSON or PNG",
      description:
        'Compile ArchLang `.arch` source (or a Plan-JSON object) to an SVG floor plan, or with `format` to a plain-text ASCII plan ("txt"), Plan JSON ("json") or an image ("png"). Format "json" returns the plan as an object, with `schema` naming its JSON Schema; passed back as `plan_json` it compiles to the same drawing, unless the plan uses a part of the language Plan JSON does not carry (the sheet, styles, curves, roofs, storeys, `place`). Returns the output plus diagnostics; a diagnostic usually carries a byte span with line/col and an E_/W_ code, and often a fix, sometimes one the `fix` tool can apply. Errors come back as data, never as exceptions: read `diagnostics` and correct the source. A multi-storey plan (`level <n> { … }`) returns the lowest storey in `output` and every storey in `pages[]` ({ level, name, output }); pass `level` to render just one. ' +
        compilePngSentence(),
      inputSchema: {
        source: z.string().optional().describe('ArchLang source (a `plan "…" { … }`). Provide this OR plan_json.'),
        plan_json: z
          .record(z.string(), z.any())
          .optional()
          .describe("Plan JSON (RPLAN shape) as an alternative to `source`; converted to .arch then compiled."),
        format: z
          .enum(["svg", "txt", "json", "png"])
          .optional()
          .describe(
            "svg (default), txt (zero-dependency ASCII), json (Plan JSON, the shape `plan_json` takes) or png (an image; needs the optional renderer).",
          ),
        accessible: z.boolean().optional().describe("Emit <title>/<desc>/role/aria accessibility metadata (SVG only)."),
        overlay: z.enum(["circulation"]).optional().describe("Draw an opt-in circulation overlay (SVG only)."),
        level: z
          .number()
          .int()
          .optional()
          .describe("Render only this storey of a multi-storey plan. An undeclared level is an error, not a guess."),
      },
    },
    async (a) => {
      const r = resolveSource(a);
      if ("diagnostics" in r) return json({ ok: false, diagnostics: r.diagnostics });
      const format = a.format ?? "svg";
      const { svg, diagnostics, scene, pages } = compile(r.source, {
        noCache: true,
        ...(a.accessible ? { accessible: true } : {}),
        ...(a.overlay === "circulation" ? { overlays: ["circulation"] as const } : {}),
        ...(format === "txt" ? { annotate: true } : {}),
      });
      const diags = toJson(r.source, diagnostics);
      if (errorCount(diagnostics) > 0 || !scene) return json({ ok: false, format, diagnostics: diags });
      // `json` is the plan's model, not a drawing of the Scene: the same projection `plan_json`
      // reads back, one document per storey exactly as the drawing formats have one page each.
      const projection = format === "json" ? planToJson(r.source) : undefined;
      if (projection && !projection.json)
        return json({ ok: false, format, error: "Plan JSON projection failed", diagnostics: diags });
      const schema = projection ? { schema: PLAN_JSON_SCHEMA.$id } : {};
      const render = (pageSvg: string, pageScene: typeof scene, level?: number): unknown => {
        if (projection) {
          const page = level === undefined ? undefined : projection.pages?.find((p) => p.level === level);
          return page ? page.json : projection.json;
        }
        return format === "txt" ? renderAscii(pageScene) : pageSvg;
      };
      // A `level` this plan does not declare is refused with the real set — never silently
      // answered with the ground floor, which would look like a successful render of it.
      if (a.level !== undefined) {
        const levels = pages?.map((p) => p.level) ?? [];
        const want = pages?.find((p) => p.level === a.level);
        if (!want)
          return json({ ok: false, format, error: `no level ${a.level} in this plan`, levels, diagnostics: diags });
        if (format === "png") return pngResult(r.source, want.scene, { level: want.level, levels }, diags);
        return json({
          ok: true,
          format,
          ...schema,
          level: want.level,
          output: render(want.svg, want.scene, want.level),
          levels,
          diagnostics: diags,
        });
      }
      // One image per call: a multi-storey plan draws its lowest storey and names the rest.
      if (format === "png")
        return pngResult(r.source, scene, pages ? { levels: pages.map((p) => p.level) } : {}, diags);
      return json({
        ok: true,
        format,
        ...schema,
        output: render(svg, scene),
        // Present only for a genuinely multi-storey plan, so a single-storey result is unchanged.
        ...(pages
          ? {
              pages: pages.map((p) => ({
                level: p.level,
                ...(p.name !== undefined ? { name: p.name } : {}),
                output: render(p.svg, p.scene, p.level),
              })),
            }
          : {}),
        diagnostics: diags,
      });
    },
  );

  server.registerTool(
    "describe",
    {
      title: "Describe a plan (facts, no render)",
      description:
        "Report a plan's facts without rendering, so you can check it against the brief without looking at an image. Returns rooms (area, bbox, adjacency, use, and the exact shape: `floor_polygon` for a `room polygon`, `floor_circle` for a `room circle`, whose area is exactly πR²), doors (what each connects), windows, circulation (walk distance, bottleneck width, detour), zones, storeys (`levels[i]` carries the same facts per floor) with the shafts that join them and which storeys stay reachable (`vertical`), the drawing extent (`bbox`, `bbox_outer`), `freedom` (which positions are hand-authored and which are derived), and totals.",
      inputSchema: { source: z.string().describe("ArchLang source.") },
    },
    async ({ source }) => {
      const s = describe(source);
      return json({ ...s, diagnostics: toJson(source, s.diagnostics) });
    },
  );

  server.registerTool(
    "lint",
    {
      title: "Lint architectural soundness",
      description:
        'List advisory architectural-soundness warnings (`W_*` codes) as data: unreachable room, windowless bedroom, too-narrow door, blocked doorway, furniture through a wall, circuitous path, and more. `profile` selects a ruleset ("residential-basic", "accessibility-advisory", …).',
      inputSchema: {
        source: z.string().describe("ArchLang source."),
        profile: z.string().optional().describe("Advisory ruleset name (default: the built-in ruleset)."),
      },
    },
    async ({ source, profile }) => json({ ok: true, diagnostics: toJson(source, lint(source, { profile })) }),
  );

  server.registerTool(
    "validate",
    {
      title: "Validate (parse + resolve + lint)",
      description:
        "Check a plan in one pass without returning a drawing (parse, resolve and lint): the gate a plan passes before it ships. `strict:true` makes advisory warnings fail too. Optional `graph` checks the plan's interior-door adjacency against an intended room graph (`{ room: [neighbours] }`); a mismatch fails. Optional `intent` (a brief's expectations, shaped as the `archlang://intent-schema` resource describes) is checked against the plan: a missed gating assertion (room count, existence, area, total area, windows) fails, while adjacency and reachability are advisory and only score. A malformed intent returns `{ ok:false, intentErrors }` as data, never an exception. Returns { ok, diagnostics, graph?, intent? }.",
      inputSchema: {
        source: z.string().describe("ArchLang source."),
        strict: z.boolean().optional().describe("Advisory warnings fail too."),
        graph: z
          .record(z.string(), z.array(z.string()))
          .optional()
          .describe("Intended interior-door adjacency: { room: [neighbour rooms] }."),
        intent: z
          .record(z.string(), z.any())
          .optional()
          .describe("A brief's intent JSON (shape: the archlang://intent-schema resource); gating assertions fail."),
      },
    },
    async ({ source, strict, graph, intent }) => {
      const { diagnostics } = compile(source, { noCache: true });
      const all = [...diagnostics, ...lint(source)];
      const errs = errorCount(all);
      const warns = all.length - errs;
      let graphReport: unknown;
      let graphOk = true;
      if (graph) {
        const gc = checkGraph(source, graph);
        graphOk = gc.ok;
        graphReport = {
          ok: gc.ok,
          missing_rooms: gc.missing_rooms,
          missing_connections: gc.missing_connections,
          extra_connections: gc.extra_connections,
        };
      }
      let intentBlock: Record<string, unknown> | undefined;
      let intentErrors: string[] | undefined;
      let intentOk = true;
      if (intent !== undefined) {
        const checked = checkIntent(source, intent);
        if ("intentErrors" in checked) {
          intentErrors = checked.intentErrors;
          intentOk = false;
        } else {
          const { result, feedback } = checked;
          intentOk = result.ok;
          intentBlock = {
            ok: result.ok,
            satisfied: result.satisfied,
            total: result.total,
            subscores: result.subscores,
            violations: result.violations.map(violationJson),
            feedback,
          };
        }
      }
      const ok = errs === 0 && (!strict || warns === 0) && graphOk && intentOk;
      if (intentErrors) return json({ ok: false, strict: strict ?? false, intentErrors });
      return json({
        ok,
        strict: strict ?? false,
        diagnostics: toJson(source, all),
        ...(graph ? { graph: graphReport } : {}),
        ...(intentBlock ? { intent: intentBlock } : {}),
      });
    },
  );

  server.registerTool(
    "score",
    {
      title: "Score a plan against a brief (intent meter)",
      description:
        "Measure how much of a brief's intent JSON a plan satisfies, without gating. Returns { ok, satisfied, total, score, subscores, violations }, where `score` is satisfied/total in [0,1] (an empty intent scores 1); call it across edits to watch a plan approach the brief. The intent's shape is the `archlang://intent-schema` resource. A malformed intent returns `{ ok:false, intentErrors }` as data, never an exception.",
      inputSchema: {
        source: z.string().describe("ArchLang source."),
        brief: z
          .record(z.string(), z.any())
          .describe("A brief's intent JSON (shape: the archlang://intent-schema resource) to measure against."),
      },
    },
    async ({ source, brief }) => {
      const checked = checkIntent(source, brief);
      if ("intentErrors" in checked) return json({ ok: false, intentErrors: checked.intentErrors });
      const { result } = checked;
      const score = result.total === 0 ? 1 : Math.round((result.satisfied / result.total) * 10000) / 10000;
      return json({
        ok: result.ok,
        satisfied: result.satisfied,
        total: result.total,
        score,
        subscores: result.subscores,
        violations: result.violations.map(violationJson),
      });
    },
  );

  server.registerTool(
    "repair",
    {
      title: "Repair furniture placement",
      description:
        "Correct furniture placement and return the corrected `.arch` source with a change log. It pushes furniture out of walls, doorways and door swings, separates overlapping pieces, moves fixtures that sit in the wrong room, and snaps floating pieces to walls. A piece it may not rewrite is listed in `unresolved` with the reason. It never adds doors or windows (that is a design choice); use `suggest` for those.",
      inputSchema: { source: z.string().describe("ArchLang source to correct.") },
    },
    async ({ source }) => {
      const r = repair(source);
      return json({ ok: true, changed: r.changed, changes: r.changes, unresolved: r.unresolved, source: r.source });
    },
  );

  server.registerTool(
    "fix",
    {
      title: "Apply machine-applicable diagnostic fixes",
      description:
        "Apply the machine-applicable fixes attached to a plan's compile diagnostics and return the edited source. It corrects source-level faults (an opening off its wall becomes the attachment form, an out-of-range position is clamped, …); furniture geometry is `repair`'s job. It runs at most 4 passes and rolls back a pass that raises the error count. `unsafe:true` also applies `maybe-incorrect` fixes. Returns { ok, passes, applied, skipped, source }.",
      inputSchema: {
        source: z.string().describe("ArchLang source to fix."),
        unsafe: z
          .boolean()
          .optional()
          .describe("Also apply `maybe-incorrect` fixes (default: machine-applicable only)."),
      },
    },
    async ({ source, unsafe }) => {
      const maxApplicability = unsafe ? ("maybe-incorrect" as const) : ("machine-applicable" as const);
      const applied: Array<{ code?: string; title: string; applicability: string }> = [];
      const skipped: Array<{ code?: string; reason: string }> = [];
      let current = source;
      let passes = 0;
      for (let pass = 0; pass < 4; pass++) {
        const { diagnostics } = compile(current, { noCache: true });
        const fixes: FixSuggestion[] = [];
        const codeOf = new Map<FixSuggestion, string | undefined>();
        for (const d of diagnostics) {
          for (const f of d.fixes ?? []) {
            fixes.push(f);
            codeOf.set(f, d.code);
          }
        }
        if (fixes.length === 0) break;
        const report = applyFixes(current, fixes, { maxApplicability });
        if (report.applied.length === 0) break;
        const errBefore = errorCount(diagnostics);
        const errAfter = errorCount(compile(report.output, { noCache: true }).diagnostics);
        if (errAfter > errBefore) break; // rolled back
        current = report.output;
        passes++;
        for (const f of report.applied)
          applied.push({ code: codeOf.get(f), title: f.title, applicability: f.applicability });
        for (const s of report.skipped) skipped.push({ code: codeOf.get(s.suggestion), reason: s.reason });
      }
      const ok = errorCount(compile(current, { noCache: true }).diagnostics) === 0;
      return json({ ok, passes, applied, skipped, source: current });
    },
  );

  server.registerTool(
    "finish",
    {
      title: "Finish the drawing",
      description:
        "Complete a plan for export by adding what it lacks; run it once `lint` is clean. Two stages. `furnish` puts furniture, by room use, in each rectangular room that holds none (single-storey plans; a furnished room is never touched; placement is `against wall` / `in <room> anchor`, never absolute). `sheet` adds the sheet statements the plan lacks (`paper`, `scale`, `dims auto`, `title`, `schedule rooms`, `legend`), choosing the finest standard scale on the smallest sheet that holds the drawing. It fills only what is missing and deletes nothing; `only` runs one stage; `reissue:true` may replace `paper`/`scale` (only those) when the drawing does not fit them. Returns { ok, changed, changes, unresolved, source }; a plan that does not compile comes back untouched with `ok:false`, and a room or a sheet that would raise a new diagnostic is left as it was, with the reason in `unresolved`.",
      inputSchema: {
        source: z.string().describe("ArchLang source to finish."),
        only: z
          .enum(["sheet", "furnish"])
          .optional()
          .describe("Run only this stage. Default: `furnish`, then `sheet`."),
        reissue: z
          .boolean()
          .optional()
          .describe("Allow `paper` and `scale` to be replaced when the drawing does not fit the authored sheet."),
      },
    },
    async ({ source, only, reissue }) => {
      const r = finish(source, { ...(only ? { only } : {}), ...(reissue ? { reissue: true } : {}) });
      const ok = errorCount(compile(source, { noCache: true }).diagnostics) === 0;
      return json({ ok, changed: r.changed, changes: r.changes, unresolved: r.unresolved, source: r.source });
    },
  );

  server.registerTool(
    "suggest",
    {
      title: "Suggest topology fixes (advisory)",
      description:
        "Suggest the doors and windows a plan's room graph needs, as data; nothing is applied. For a room with no path back, a building with no entrance, a bath reachable only through a bedroom, or a windowless bedroom, it returns ready-to-paste `door`/`window` statements with a rationale, for you to choose among and insert. Each names its wall by an authored id or a unique wall category, else by absolute `at (x, y)` coordinates. Door candidates avoid furniture in the door's approach; window candidates do not consider furniture.",
      inputSchema: { source: z.string().describe("ArchLang source.") },
    },
    async ({ source }) => json({ ok: true, suggestions: suggestTopology(source) }),
  );

  server.registerTool(
    "complete",
    {
      title: "Completions at a source offset",
      description:
        "List the completion items in scope at a source byte offset: keywords, element names, ids and enum values, the same items an editor's language server offers. For structured or assisted authoring.",
      inputSchema: {
        source: z.string().describe("ArchLang source."),
        at: z.number().int().nonnegative().describe("Source byte offset to complete at."),
      },
    },
    async ({ source, at }) => json({ ok: true, items: completion(source, at) }),
  );

  server.registerTool(
    "link",
    {
      title: "Share link to the rendered plan",
      description:
        "Make two URLs that show a plan in the browser with nothing to install, for handing to a person. `playground` opens it in the hosted editor, rendered; `embed` draws it alone, for an iframe. The plan travels inside the URL, after the `#`, so it is never sent to a server and the URL carries nothing else. A plan that does not compile still gets links, and the page shows its diagnostics; `ok` says whether it compiles, and `errors` counts the errors when it does not. `bytes` is the size of the compressed plan in the URL.",
      inputSchema: { source: z.string().describe("ArchLang source.") },
    },
    async ({ source }) => {
      const link = await loadPlanLinks();
      if ("error" in link) return json(link);
      return json(link.linkResult(source, compile(source, { noCache: true }).diagnostics));
    },
  );

  // Resources: the static context artifacts, read once at server start.
  const RESOURCES: Array<[string, string, string, string, string, string]> = [
    [
      "spec",
      "archlang://spec",
      "ArchLang language spec",
      "The whole ArchLang language on one page. Read it before writing any `.arch`.",
      "text/markdown",
      readResource("spec.llm.md", "spec.llm.md"),
    ],
    [
      "context",
      "archlang://context",
      "ArchLang full agent context",
      "The spec, the authoring workflow, the CLI reference and the error catalog in one document, for a system prompt.",
      "text/markdown",
      readResource("llms-full.txt", "llms-full.txt"),
    ],
    [
      "schema",
      "archlang://schema",
      "Plan JSON schema",
      "JSON Schema (2020-12) for the Plan-JSON object `compile` accepts as `plan_json`.",
      "application/schema+json",
      readResource("plan.schema.json", "schemas/plan.schema.json"),
    ],
    [
      "grammar",
      "archlang://grammar",
      "ArchLang GBNF grammar",
      "GBNF grammar that constrains generation to ArchLang's statement shapes; it is looser than the parser, which remains the authority.",
      "text/plain",
      readResource("archlang.gbnf", "grammars/archlang.gbnf"),
    ],
    [
      "intent-schema",
      "archlang://intent-schema",
      "ArchLang intent JSON schema",
      "JSON Schema (2020-12) for a brief's Intent — the shape `validate`'s `intent` and `score`'s `brief` take.",
      "application/schema+json",
      readResource("intent.schema.json", "schemas/intent.schema.json"),
    ],
  ];
  for (const [name, uri, title, description, mimeType, text] of RESOURCES) {
    server.registerResource(name, uri, { title, description, mimeType }, async (u) => ({
      contents: [{ uri: u.href, mimeType, text }],
    }));
  }

  return server;
}

/** Start the server over stdio (the bin entry). */
async function main(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

// Run only when executed directly as the bin — not when imported by a test.
// realpath both sides so a `node_modules/.bin` symlink still matches.
const invokedDirectly = (() => {
  try {
    return (
      process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) void main();
