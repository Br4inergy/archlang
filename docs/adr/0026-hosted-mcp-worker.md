# 26. A third, scripted Worker hosts the MCP server

- **Status:** Accepted (owner decision, 2026-10). Deployed to workers.dev only; the custom domain
  `mcp.archlang.uk` and the plan choice are the owner's (see "Owner steps").
- **Date:** 2026-10
- **Relates to:** [ADR 0019](0019-cloudflare-workers-hosting.md) (both sites are static assets with
  no `main`, and "a future feature that wants a request handler must justify the cap it buys"),
  [ADR 0012](0012-mcp-shim-discoverability.md) (the MCP server is the discoverability channel; the
  CLI stays primary), [ADR 0022](0022-exact-decisions-and-bounded-input.md) (budgets are counts).
- **Scope:** a new workspace, `packages/mcp-worker`, a new job in `deploy.yml`, one catalogued
  code (`E_INPUT_TOO_LARGE`) the core can build but never raises itself. No language change; no
  change to `compile()`, `describe()` or `lint()`; the two site Workers are untouched.

## Context

The MCP server ships as an npm package that a host starts over stdio (`npx -y
@chanmeng666/archlang-mcp`). A growing set of hosts cannot start a local process at all: a web
chat's connector settings, an app directory, an agent running in someone else's cloud. They take a
URL. Without one, ArchLang is invisible to them however good the stdio server is.

ADR 0019 made both public sites static-asset Workers with **no script**, on purpose: with no script
every request is a free, unmetered asset request, exempt from the Workers free plan's daily request
cap and CPU limit. It said that a request handler must justify the cap it buys. This ADR is that
justification, and it keeps the rule intact for the two sites.

## Decision

**A third Worker, `archlang-mcp`, with a `main` script, in its own workspace and its own deploy
job. It is the only scripted Worker in the repository; `archlang-docs` and `archlang-playground`
keep no `main`.**

- **Where:** `packages/mcp-worker/wrangler.jsonc`, `workers_dev: true`, no `routes` and no
  `account_id`. The owner attaches `mcp.archlang.uk` by hand once the measurement below is in.
- **What it serves:**
  - `POST /mcp` — Streamable HTTP, **stateless**: no sign-in, no session id, a fresh `McpServer`
    per request, one JSON reply per POST. `GET` and `DELETE` answer 405, because there is no
    session to resume and no server-initiated message to stream.
  - the stdio server's tool set, registered from one module (`packages/mcp/src/tools.ts`) by both
    hosts, plus a `read_me` tool that explains this server in one page;
  - the five `archlang://` resources, bundled at build time (a Worker has no filesystem), and the
    MCP App viewer `ui://archlang/viewer`;
  - `GET /svg/<payload>` — the playground's `#z=` payload (`deflate-raw` + base64url), compiled,
    answered as `image/svg+xml`, so `archlang link` and an image URL share one encoding.
- **How it is deployed:** `deploy.yml` job `deploy-mcp`, separate from the site matrix so the site
  job is byte-identical. It runs on a push to `main` only when something the Worker bundles changed
  (its package, the MCP tool set, the core, the served resources), or on a manual run, and
  smoke-checks the workers.dev URL `wrangler deploy` prints (`scripts/smoke.mjs --site mcp`).

### The transport: the SDK's own Web-standard transport

`@modelcontextprotocol/sdk` 1.29.0, the version the stdio package already uses, ships
`WebStandardStreamableHTTPServerTransport` (Request/Response/ReadableStream; it names Cloudflare
Workers as a target). In stateless mode (`sessionIdGenerator: undefined`) with
`enableJsonResponse: true` it is exactly the server wanted: no hand-written JSON-RPC, and the same
`McpServer` and tool registry the stdio host uses. A hand-rolled handler would have been a second
protocol implementation to keep in step with the SDK.

### The viewer: an MCP App, with the text result as the fallback

`compile`'s definition and every `compile` result carry `_meta.ui.resourceUri =
"ui://archlang/viewer"` (and the deprecated flat key `ui/resourceUri`, as the SDK helper
`registerAppTool` writes it). The resource is one HTML page, `text/html;profile=mcp-app`, built
at build time with `@modelcontextprotocol/ext-apps` against the MCP Apps specification dated
2026-01-26: the drawing with pan and zoom, and the plan's lint findings (the viewer calls the
server's own `lint` tool when the host lets an app call tools, and otherwise lists the compile
diagnostics). The tool result's `content` is unchanged, so every host without MCP Apps gets the
same JSON text as before: that is the text fallback the specification requires.

- **Version: ext-apps 1.7.5, not 2.0.3.** 2.x declares peer dependencies on the SDK's v2 split
  packages (`@modelcontextprotocol/server` and friends); this repository is on the v1 SDK
  (`@modelcontextprotocol/sdk` 1.29.0), whose matching line is 1.7.x. Both implement the
  2026-01-26 specification. Moving to 2.x is moving the whole MCP package to SDK v2, which is its
  own change.
- **Not capability-gated.** The specification says a server SHOULD register UI-enabled tools only
  after seeing the host's `io.modelcontextprotocol/ui` capability. A stateless server never sees
  the `initialize` that carried it when it answers `tools/list`, so `_meta.ui` is always present; a
  host that does not know the key ignores it, and the result text is identical either way.
- **Size:** the page is about 513 KiB (111 KiB gzipped), most of it the SDK's schemas inside the
  `App` class. It is fetched once per host session, not per call.
- **Not verified:** whether any particular chat host renders a third-party MCP App from a remote
  connector. Nothing in this repository claims one does; it is an open proof (below).

### No `/png/`

The core's PNG backend is `@resvg/resvg-js`, a native module, and it reads its fonts through
`node:fs`. A Worker has neither. `@resvg/resvg-wasm` exists, but it would be a second renderer
path whose output is not proven against the first, plus fonts to bundle, at raster CPU cost far
past anything in the measurement below. `compile` with `format: "png"` answers `ok:false` with
`E_PNG_DEPENDENCY` and a sentence naming `svg` and `/svg/` instead; it never throws.

### Budgets stay counts; the host adds a byte cap

`compile()`'s budgets are counts (steps, drawn elements) and every input it is given returns a
diagnostic (ADR 0022). That does not change. What a Worker adds is a **CPU ceiling per request**,
and running out of it is a platform error (HTTP 5xx), not a diagnostic. So the host refuses large
input **before compiling**, by bytes, never by time:

- a `source` (or serialized `plan_json`) over **64 KiB** → `E_INPUT_TOO_LARGE` as a normal tool
  result (`isError`, the usual `{ ok:false, diagnostics }` envelope with the catalogued fix);
- a request body over 256 KiB → HTTP 413 carrying the same diagnostic;
- a `/svg/` payload that inflates past 64 KiB → 413, and decompression stops at the cap, so a small
  payload that inflates enormously costs at most the cap.

`E_INPUT_TOO_LARGE` is a catalogue row and a pure core helper, `inputTooLarge()`, that a host
calls; `compile()` never calls it. **The 64 KiB figure is interim**: the largest example is about
18 KB, so no corpus plan is refused, and it is set against the Paid plan's ceiling below, not the
free plan's.

A request that passes the cap and still exhausts the CPU limit fails with the platform's 5xx. That
is not dressed up as a diagnostic: it is the host failing, not the plan.

## The cap this buys, measured

The Workers free plan allows 10 ms of CPU per HTTP request and 100,000 requests a day. Requests
to static assets are free and unlimited, which is why the two sites are unaffected; but every MCP
call and every `/svg/` request reaches the script and counts. The daily allowance is the plan's,
not this Worker's, so any other scripted Worker in the same Cloudflare account draws on it too
(the owner should confirm what else runs there).

Measured with `packages/mcp-worker/scripts/measure-cpu.mjs` against `wrangler dev --local`
(wrangler 4.108.0, workerd 1.20260706) on the development machine, `MEASURE_CPU=1` making the
Worker report `performance.now()` around its own handler (1 ms resolution). Every top-level
`examples/*.arch` (30 plans) × 5 repetitions per tool, plus synthetic grids of rooms at 8, 16, 32
and 60 KB:

| tool | p50 ms | p95 ms | max ms | 60 KB synthetic, p50 ms |
|---|---:|---:|---:|---:|
| initialize | 2 | 3 | 3 | – |
| tools/list | 4 | 6 | 6 | – |
| compile | 8 | 34 | 105 | 663 |
| describe | 11 | 170 | 228 | 108 |
| lint | 13 | 232 | 309 | 169 |
| validate | 20 | 277 | 386 | 867 |
| score | 11 | 177 | 283 | 90 |
| repair | 19 | 210 | 639 | 50 |
| fix | 13 | 66 | 117 | 1232 |
| finish | 52 | 622 | 1341 | 2109 |
| suggest | 3 | 13 | 19 | 27 |
| complete | 3 | 14 | 28 | 40 |
| link | 8 | 46 | 141 | 664 |
| GET /svg/ (cache miss) | 13 | 69 | 193 | 623 |

These are wall-clock handler times on a shared desktop, not Cloudflare's billed CPU time, so read
them as a ranking and an order of magnitude. The order of magnitude is unambiguous: **the corpus
p95 of every tool that compiles is past 10 ms, several by 20× or more.** No byte cap rescues the free
plan, because the plans that exceed it are ordinary examples, not large inputs.

**Therefore: start on Workers Paid**, unless the owner's workers.dev measurement (below) shows the
p95s fitting 10 ms, which this table says it will not. Paid allows 30 s of CPU per request by
default (configurable to 5 minutes) and includes 10 million requests and 30 million CPU
milliseconds a month, for a $5 monthly minimum; the slowest 60 KB
case measured here (`finish`, about 2.1 s) sits more than 10× inside the default. That headroom is
what the interim 64 KiB cap is chosen against.

### The measurement plan, on Cloudflare

1. Deploy to workers.dev (CI `deploy-mcp`, or a manual run of the workflow).
2. Run `node packages/mcp-worker/scripts/measure-cpu.mjs --base https://archlang-mcp.<subdomain>.workers.dev`
   (`MEASURE_CPU` is not set in production, so the script falls back to client wall time; the
   number that matters is the dashboard's **CPU time** percentiles for the Worker over the run).
3. If CPU p95 per tool fits 10 ms, stay on Free; otherwise upgrade to Paid before attaching the
   custom domain, and set the cap from the measured ms-per-KB of the slowest tool.

The Cache API's effect on `*.workers.dev` is not verified here (Cloudflare documents cache
behaviour for custom domains), so a workers.dev run may see every `/svg/` request as a miss. That
only makes the measurement an upper bound.

## Privacy and telemetry

- No sign-in, no cookie, no session, nothing stored.
- Nothing logs a body or a source: the Worker logs nothing, `observability` (Workers Logs) is off,
  and source maps are not uploaded. The `internal error` path deliberately drops the error message,
  which could quote a source.
- Each MCP message writes **one** Analytics Engine data point: `blobs: [method, tool]`,
  `indexes: [method]`. A method or tool name that is not name-shaped is recorded as `(other)`, so a
  client cannot smuggle a source into the dataset through either field. The binding is optional;
  local dev runs without it.
- **A `/svg/` URL sends the plan to the server.** A playground link carries the plan after `#`,
  which a browser never sends; an `/svg/` URL carries it in the path, which reaches Cloudflare's
  edge like any URL. The Worker logs nothing, but the difference is real and `read_me` says so.

## Consequences

- One more thing deploys on a push to `main`, but only when its inputs changed. The site job is
  unchanged, and the two site Workers still have no script.
- The stdio server is unchanged in behaviour: `server.ts` reads the resources from disk and passes
  them, with the lazy link loader, to the shared registry. The tool set has one definition.
- `compile` on the hosted server says png is unavailable in its own description; on npm it says
  what it always said.
- The Worker bundles **this checkout's** core (`../../dist`, aliased by name in the build), never
  whatever `node_modules` resolves, so the hosted server and the deployed resources are one
  version.

## Owner steps (not agent work)

- **Plan:** decide Free or Paid from the workers.dev measurement; this ADR's local numbers say
  Paid.
- **Domain:** attach `mcp.archlang.uk` to `archlang-mcp` (a `routes` entry with
  `custom_domain: true`, or the dashboard) — DNS and certificate changes are owner-only.
- **Analytics:** query the `archlang_mcp` dataset (SQL API: `SELECT blob1 AS method, blob2 AS tool,
  count() FROM archlang_mcp GROUP BY method, tool`).
- **Open proof:** whether claude.ai (or any given host) renders this third-party MCP App from a
  remote connector. Until someone sees it render, no document says it does.
- **Listings:** the connector directories and app stores that take a remote MCP URL.

## Deferred, by name

- **`/png/`** — needs a Worker-compatible renderer proven byte-faithful to the native one.
- **ext-apps 2.x** — with the move of the MCP package to the v2 SDK.
- **Sessions, auth, server-initiated messages** — nothing here needs them.
- **A `link` result that also names the `/svg/` URL** — the tool's output is shared with the npm
  server, which has no origin to name; `read_me` says how to form it.
