/**
 * The hosted ArchLang MCP Worker's request handler (docs/adr/0026-hosted-mcp-worker.md);
 * `worker.ts` is the entry that hands it the assets bundled at build time.
 *
 *   POST /mcp          stateless Streamable-HTTP MCP: no sign-in, no sessions, JSON responses
 *   GET  /svg/<payload> the plan in a `#z=` payload, compiled to `image/svg+xml`, cached a year
 *   GET  /             the `read_me` text
 *
 * Bounded by BYTES, checked before any compile work: a body over {@link BODY_CAP_BYTES} or a
 * source over {@link SOURCE_CAP_BYTES} is refused with `E_INPUT_TOO_LARGE`, as data. `compile()`'s
 * own budgets stay counts; a Worker that runs out of CPU anyway fails with the platform's 5xx,
 * which is never presented as a diagnostic.
 *
 * Nothing logs a body or a source. Each MCP message writes one Analytics Engine data point holding
 * its method and tool name; there is no other telemetry and no cookie.
 */
import { compile, type Diagnostic, diagnosticToJson, inputTooLarge } from "@chanmeng666/archlang";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { decodePlanHashWeb, PlanHashTooLarge } from "../../../src/cli/share-codec.web.mjs";
import { BODY_CAP_BYTES, PAYLOAD_CAP_CHARS, SOURCE_CAP_BYTES } from "./limits.js";
import { createHostedServer, type HostedAssets, readMe } from "./server.js";

/** Deterministic responses: the URL is the plan, so the bytes behind it never change. */
export const IMMUTABLE = "public, max-age=31536000, immutable";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-max-age": "86400",
};

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const jsonResponse = (body: unknown, status: number, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...extra },
  });

/** The `{ ok:false, diagnostics }` envelope every tool result uses, around one diagnostic. */
const envelope = (d: Diagnostic) => ({ ok: false, diagnostics: [diagnosticToJson("", d)] });

// ---------------------------------------------------------------------------
// telemetry: method + tool name, nothing else
// ---------------------------------------------------------------------------

/** A name worth counting, or a fixed bucket: a client-chosen string never reaches the dataset. */
const safeName = (v: unknown, shape: RegExp): string => (typeof v === "string" && shape.test(v) ? v : "(other)");

function count(env: Env, messages: unknown[]): void {
  if (!env.ANALYTICS) return;
  for (const m of messages) {
    const msg = (m ?? {}) as { method?: unknown; params?: { name?: unknown } };
    const method = msg.method === undefined ? "(response)" : safeName(msg.method, /^[a-z][a-zA-Z/_]{0,63}$/);
    const tool = method === "tools/call" ? safeName(msg.params?.name, /^[a-z][a-z_]{0,31}$/) : "";
    try {
      env.ANALYTICS.writeDataPoint({ blobs: [method, tool], indexes: [method] });
    } catch {
      /* telemetry never fails a request */
    }
  }
}

// ---------------------------------------------------------------------------
// /mcp
// ---------------------------------------------------------------------------

/** Read at most `cap` bytes of the body; `undefined` once it is longer (reading stops there). */
async function readCapped(req: Request, cap: number): Promise<string | undefined> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > cap) return undefined;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** The diagnostic a `tools/call` earns for an argument over the cap, else `undefined`. */
export function oversizeArgument(message: unknown): Diagnostic | undefined {
  const m = (message ?? {}) as { method?: unknown; params?: { arguments?: Record<string, unknown> } };
  if (m.method !== "tools/call") return undefined;
  const args = m.params?.arguments ?? {};
  if (typeof args.source === "string") {
    const d = inputTooLarge(args.source, SOURCE_CAP_BYTES, "source");
    if (d) return d;
  }
  if (args.plan_json !== undefined) {
    const d = inputTooLarge(JSON.stringify(args.plan_json) ?? "", SOURCE_CAP_BYTES, "plan_json");
    if (d) return d;
  }
  return undefined;
}

/**
 * Answer every over-cap `tools/call` in the body without starting the server: a normal tool result
 * (`isError`) whose text is the usual `{ ok:false, diagnostics }` envelope, so a model reads it as
 * it reads any failed compile. A batch with one over-cap call is refused whole.
 */
function refuseOversize(parsed: unknown): Response | undefined {
  const messages = Array.isArray(parsed) ? parsed : [parsed];
  const found = messages.map(oversizeArgument);
  if (found.every((d) => d === undefined)) return undefined;
  const replies = messages
    .map((m, i) => {
      const id = (m as { id?: unknown })?.id;
      if (id === undefined) return undefined; // a notification gets no reply
      const d = found[i];
      if (d)
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(envelope(d), null, 2) }], isError: true },
        };
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "batch refused: another call in it is over the input cap" },
      };
    })
    .filter((r) => r !== undefined);
  return jsonResponse(Array.isArray(parsed) ? replies : replies[0], 200);
}

async function handleMcp(req: Request, env: Env, origin: string, assets: HostedAssets): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")
    return jsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Method not allowed: this server is stateless; POST JSON-RPC to /mcp." },
      },
      405,
      { allow: "POST, OPTIONS" },
    );

  const body = await readCapped(req, BODY_CAP_BYTES);
  if (body === undefined) {
    const d: Diagnostic = {
      severity: "error",
      code: "E_INPUT_TOO_LARGE",
      message: `request body is over ${BODY_CAP_BYTES} bytes; this host compiles at most ${SOURCE_CAP_BYTES} bytes of source`,
    };
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: d.message, data: envelope(d) } },
      413,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error: invalid JSON" } },
      400,
    );
  }
  count(env, Array.isArray(parsed) ? parsed : [parsed]);
  const refused = refuseOversize(parsed);
  if (refused) return refused;

  const server = createHostedServer(origin, assets);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session id is issued or checked
    enableJsonResponse: true, // one JSON reply per POST, no SSE stream to hold open
  });
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(req, { parsedBody: parsed });
    return withHeaders(res, { ...CORS, "cache-control": "no-store" });
  } finally {
    void server.close();
  }
}

// ---------------------------------------------------------------------------
// /svg/<payload>
// ---------------------------------------------------------------------------

const SVG_HEADERS: Record<string, string> = {
  "content-type": "image/svg+xml; charset=utf-8",
  "cache-control": IMMUTABLE,
  "x-content-type-options": "nosniff",
  // The drawing needs nothing external; nothing in it may run or load.
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  ...CORS,
};

async function handleSvg(req: Request, url: URL, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD")
    return jsonResponse({ ok: false, error: "use GET" }, 405, { allow: "GET, HEAD" });
  const head = req.method === "HEAD";
  const bodyless = (res: Response) => (head ? new Response(null, res) : res);

  // The path alone is the key: a query string cannot change the plan, so it cannot split the cache.
  const key = new Request(new URL(url.pathname, url.origin).toString(), { method: "GET" });
  const cache = typeof caches !== "undefined" ? caches.default : undefined;
  const hit = await cache?.match(key);
  if (hit) return bodyless(hit);

  let payload = url.pathname.slice("/svg/".length);
  if (payload.endsWith(".svg")) payload = payload.slice(0, -".svg".length);
  if (payload.length > PAYLOAD_CAP_CHARS) {
    const d: Diagnostic = {
      severity: "error",
      code: "E_INPUT_TOO_LARGE",
      message: `payload is ${payload.length} characters; a source of at most ${SOURCE_CAP_BYTES} bytes fits in ${PAYLOAD_CAP_CHARS}`,
    };
    return jsonResponse(envelope(d), 413);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(payload))
    return jsonResponse({ ok: false, error: "not a #z= payload: expected base64url after /svg/" }, 400);

  let source: string;
  try {
    source = await decodePlanHashWeb(payload, { maxBytes: SOURCE_CAP_BYTES });
  } catch (e) {
    if (e instanceof PlanHashTooLarge) {
      const d: Diagnostic = {
        severity: "error",
        code: "E_INPUT_TOO_LARGE",
        message: `source is over ${SOURCE_CAP_BYTES} bytes; this host compiles at most ${SOURCE_CAP_BYTES}`,
      };
      return jsonResponse(envelope(d), 413);
    }
    return jsonResponse({ ok: false, error: "not a #z= payload: it does not inflate (deflate-raw)" }, 400);
  }

  const { svg, diagnostics } = compile(source, { noCache: true });
  if (diagnostics.some((d) => d.severity === "error"))
    return jsonResponse({ ok: false, diagnostics: diagnostics.map((d) => diagnosticToJson(source, d)) }, 422);

  const res = new Response(svg, { status: 200, headers: SVG_HEADERS });
  if (cache) ctx.waitUntil(cache.put(key, res.clone()));
  return bodyless(res);
}

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------

/** The Worker, `{ fetch }`, over the given assets. */
export function makeWorker(assets: HostedAssets) {
  return {
    async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      // Measurement only (scripts/measure-cpu.mjs against `wrangler dev --var MEASURE_CPU:1`): the
      // handler's elapsed time as a response header. Unset in wrangler.jsonc, so never deployed.
      if (env.MEASURE_CPU !== "1") return route(req, env, ctx, assets);
      const t0 = performance.now();
      const res = await route(req, env, ctx, assets);
      // Read the body inside the timed span: a streamed reply is still being produced until then.
      const body = await res.arrayBuffer();
      const ms = performance.now() - t0;
      const headers = new Headers(res.headers);
      headers.set("x-archlang-handler-ms", ms.toFixed(3));
      return new Response(req.method === "HEAD" ? null : body, { status: res.status, headers });
    },
  };
}

async function route(req: Request, env: Env, ctx: ExecutionContext, assets: HostedAssets): Promise<Response> {
  const url = new URL(req.url);
  try {
    if (url.pathname === "/mcp") return await handleMcp(req, env, url.origin, assets);
    if (url.pathname.startsWith("/svg/")) return await handleSvg(req, url, ctx);
    if (url.pathname === "/" && (req.method === "GET" || req.method === "HEAD"))
      return new Response(req.method === "HEAD" ? null : readMe(url.origin), {
        headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-cache", ...CORS },
      });
    return new Response("not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch {
    // A bug in this Worker, never a user's input (inputs get diagnostics). The error is not
    // logged: its message could quote a source.
    return jsonResponse({ ok: false, error: "internal error" }, 500);
  }
}
