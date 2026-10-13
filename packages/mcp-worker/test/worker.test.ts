/**
 * The hosted MCP Worker, driven the way the platform drives it: `fetch(Request, env, ctx)` on the
 * handler (`src/app.ts`), with the assets the build would inline read from the repo instead. The
 * built bundle and `wrangler dev` are exercised by `scripts/smoke.mjs --site mcp`; this suite pins
 * the contract without a build.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compile, ERROR_CATALOG } from "../../../src/index.js";
import { encodePlanHash } from "../../../src/cli/share-codec.mjs";
import { connect } from "../../mcp/test/helpers.js";
import { INSTRUCTIONS, RESOURCE_DEFS } from "../../mcp/src/tools.js";
import { resourcePaths } from "../scripts/resource-paths.mjs";
import { IMMUTABLE, makeWorker } from "../src/app.js";
import { BODY_CAP_BYTES, SOURCE_CAP_BYTES } from "../src/limits.js";
import { PNG_HOSTED, VIEWER_URI } from "../src/server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

const paths = resourcePaths(read("packages/mcp/src/server.ts"));
const resources = Object.fromEntries(Object.entries(paths).map(([n, rel]) => [n, read(rel)])) as never;
const VIEWER = "<!doctype html><title>viewer stub</title>";
const worker = makeWorker({ resources, viewerHtml: VIEWER, version: "0.0.0-test" });

const points: Array<{ blobs?: string[]; indexes?: string[]; doubles?: number[] }> = [];
const env = { ANALYTICS: { writeDataPoint: (p: (typeof points)[number]) => points.push(p) } };
const ctx = { waitUntil: () => {} };
const ORIGIN = "https://mcp.test";

const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
let id = 0;
async function post(body: unknown): Promise<Response> {
  return worker.fetch(
    new Request(`${ORIGIN}/mcp`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) }),
    env,
    ctx,
  );
}
async function rpc(method: string, params: unknown = {}): Promise<Record<string, any>> {
  const res = await post({ jsonrpc: "2.0", id: ++id, method, params });
  expect(res.status).toBe(200);
  const msg = (await res.json()) as Record<string, any>;
  expect(msg.error).toBeUndefined();
  return msg.result;
}
const toolText = (result: Record<string, any>) => JSON.parse(result.content.find((c: any) => c.type === "text").text);

const STUDIO = read("examples/studio.arch");
const TINY = 'plan "Smoke" {\n  room at (0,0) size 4000x3000 label "Room"\n}\n';

const HAS_DEFLATE_RAW = (() => {
  try {
    new DecompressionStream("deflate-raw");
    return true;
  } catch {
    return false;
  }
})();

describe("hosted MCP over Streamable HTTP", () => {
  it("initialize carries the stdio server's instructions", async () => {
    const r = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "t", version: "0" },
    });
    expect(r.serverInfo).toEqual({ name: "archlang", version: "0.0.0-test" });
    expect(r.instructions).toBe(INSTRUCTIONS);
  });

  it("lists the stdio tool set plus read_me — derived from the stdio server, not retyped", async () => {
    const stdio = (await (await connect()).listTools()).tools.map((t) => t.name);
    const hosted = (await rpc("tools/list")).tools.map((t: { name: string }) => t.name);
    expect(hosted).toEqual([...stdio, "read_me"]);
  });

  it("compile links the viewer: on its definition and on every result", async () => {
    const def = (await rpc("tools/list")).tools.find((t: { name: string }) => t.name === "compile");
    expect(def._meta.ui.resourceUri).toBe(VIEWER_URI);
    const res = await rpc("tools/call", { name: "compile", arguments: { source: STUDIO } });
    expect(res._meta.ui.resourceUri).toBe(VIEWER_URI);
    expect(res._meta["ui/resourceUri"]).toBe(VIEWER_URI);
    // The text fallback every host gets is the stdio result, unchanged.
    expect(toolText(res)).toMatchObject({ ok: true, format: "svg", output: compile(STUDIO, { noCache: true }).svg });
  });

  it("serves every archlang:// resource byte-equal to the repo, and the viewer as an MCP App", async () => {
    const listed = (await rpc("resources/list")).resources.map((r: { uri: string; mimeType: string }) => [
      r.uri,
      r.mimeType,
    ]);
    expect(listed).toContainEqual([VIEWER_URI, "text/html;profile=mcp-app"]);
    for (const [name, uri] of RESOURCE_DEFS) {
      const c = (await rpc("resources/read", { uri })).contents[0];
      expect(c.text, uri).toBe(read(paths[name]!));
    }
    const v = (await rpc("resources/read", { uri: VIEWER_URI })).contents[0];
    expect(v).toMatchObject({ uri: VIEWER_URI, mimeType: "text/html;profile=mcp-app", text: VIEWER });
  });

  it("the build bundles exactly the stdio server's resource set", () => {
    expect(Object.keys(paths).sort()).toEqual(RESOURCE_DEFS.map(([n]) => n).sort());
  });

  it('format "png" is refused with E_PNG_DEPENDENCY and a Worker-specific fix, never an exception', async () => {
    const out = toolText(await rpc("tools/call", { name: "compile", arguments: { source: TINY, format: "png" } }));
    expect(out).toMatchObject({ ok: false, format: "png", code: "E_PNG_DEPENDENCY", error: PNG_HOSTED });
    // The catalogued code rides inside `diagnostics`, as on npm, but its `fix` is this host's own
    // sentence: the catalogue's says to install a renderer, which nothing can do in a Worker.
    const dep = out.diagnostics.find((d: { code: string }) => d.code === "E_PNG_DEPENDENCY");
    expect(dep).toEqual({ code: "E_PNG_DEPENDENCY", severity: "error", message: PNG_HOSTED, fix: PNG_HOSTED });
    expect(dep.fix).not.toBe(ERROR_CATALOG.E_PNG_DEPENDENCY!.fix);
    // One storey of a multi-storey plan is refused the same way, and the description says so up front.
    const two = toolText(
      await rpc("tools/call", {
        name: "compile",
        arguments: { source: read("examples/two-storey.arch"), format: "png", level: 1 },
      }),
    );
    expect(two).toMatchObject({ ok: false, code: "E_PNG_DEPENDENCY", error: PNG_HOSTED, level: 1 });
    const def = (await rpc("tools/list")).tools.find((t: { name: string }) => t.name === "compile");
    expect(def.description).toContain(PNG_HOSTED);
  });

  it("link mints the same URLs the CLI does (one encoder)", async () => {
    const out = toolText(await rpc("tools/call", { name: "link", arguments: { source: TINY } }));
    expect(out.embed).toBe(`https://playground.archlang.uk/embed.html#z=${encodePlanHash(TINY)}`);
  });

  it("read_me explains the server, including its cap", async () => {
    const text = (await rpc("tools/call", { name: "read_me", arguments: {} })).content[0].text as string;
    expect(text).toContain(`${ORIGIN}/svg/`);
    expect(text).toContain(`${SOURCE_CAP_BYTES / 1024} KB`);
    expect(text).toContain("E_INPUT_TOO_LARGE");
  });

  it("is stateless: GET and DELETE are 405, and no session id is issued", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await worker.fetch(new Request(`${ORIGIN}/mcp`, { method, headers: HEADERS }), env, ctx);
      expect(res.status, method).toBe(405);
    }
    const res = await post({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} });
    expect(res.headers.get("mcp-session-id")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("the input cap: a Diagnostic envelope before any compile work, never a 5xx", () => {
  const over = "x".repeat(SOURCE_CAP_BYTES + 1);

  it("a source one byte over the cap gets E_INPUT_TOO_LARGE as a tool result", async () => {
    const res = await rpc("tools/call", { name: "compile", arguments: { source: over } });
    expect(res.isError).toBe(true);
    const out = toolText(res);
    expect(out.ok).toBe(false);
    expect(out.diagnostics).toEqual([
      {
        code: "E_INPUT_TOO_LARGE",
        severity: "error",
        message: `source is ${SOURCE_CAP_BYTES + 1} bytes; this host compiles at most ${SOURCE_CAP_BYTES}`,
        fix: ERROR_CATALOG.E_INPUT_TOO_LARGE!.fix,
      },
    ]);
  });

  it("a source AT the cap is compiled (no refusal)", async () => {
    const at = `${TINY}${"#".repeat(SOURCE_CAP_BYTES - TINY.length)}`;
    expect(at.length).toBe(SOURCE_CAP_BYTES);
    const out = toolText(await rpc("tools/call", { name: "lint", arguments: { source: at } }));
    expect(out.diagnostics.map((d: { code: string }) => d.code)).not.toContain("E_INPUT_TOO_LARGE");
  });

  it("every tool taking a source is capped, and plan_json too", async () => {
    for (const name of ["describe", "lint", "validate", "repair", "fix", "finish", "suggest", "link"]) {
      const out = toolText(await rpc("tools/call", { name, arguments: { source: over } }));
      expect(out.diagnostics[0].code, name).toBe("E_INPUT_TOO_LARGE");
    }
    const big = { rooms: [{ name: "x".repeat(SOURCE_CAP_BYTES) }] };
    const out = toolText(await rpc("tools/call", { name: "compile", arguments: { plan_json: big } }));
    expect(out.diagnostics[0]).toMatchObject({ code: "E_INPUT_TOO_LARGE" });
    expect(out.diagnostics[0].message).toMatch(/^plan_json is /);
  });

  it("a body over the body cap is a 413 carrying the same diagnostic", async () => {
    const res = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "compile", arguments: { source: "\u0001".repeat(BODY_CAP_BYTES / 5) } },
    });
    expect(res.status).toBe(413);
    const msg = (await res.json()) as Record<string, any>;
    expect(msg.error.data.diagnostics[0].code).toBe("E_INPUT_TOO_LARGE");
  });

  it("malformed JSON is a JSON-RPC parse error, not a 5xx", async () => {
    const res = await worker.fetch(
      new Request(`${ORIGIN}/mcp`, { method: "POST", headers: HEADERS, body: "{" }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as Record<string, any>).error.code).toBe(-32700);
  });
});

describe("telemetry: one data point per MCP message, method and tool name only", () => {
  it("records [method, tool] and nothing from the arguments", async () => {
    points.length = 0;
    await rpc("tools/call", { name: "lint", arguments: { source: TINY } });
    expect(points).toEqual([{ blobs: ["tools/call", "lint"], indexes: ["tools/call"] }]);
  });

  it("a client-chosen name that is not name-shaped is bucketed, so a source cannot ride in on it", async () => {
    points.length = 0;
    await post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: 'plan "Secret" {', arguments: {} } });
    expect(points).toEqual([{ blobs: ["tools/call", "(other)"], indexes: ["tools/call"] }]);
  });

  it("runs without the binding (local dev)", async () => {
    const res = await makeWorker({ resources, viewerHtml: VIEWER, version: "0" }).fetch(
      new Request(`${ORIGIN}/mcp`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }),
      {},
      ctx,
    );
    expect(res.status).toBe(200);
  });
});

describe.skipIf(!HAS_DEFLATE_RAW)("GET /svg/<payload>", () => {
  const get = (path: string, method = "GET") => worker.fetch(new Request(`${ORIGIN}${path}`, { method }), env, ctx);

  it("answers compile()'s SVG for a payload minted by the shared encoder, immutable", async () => {
    const res = await get(`/svg/${encodePlanHash(STUDIO)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(await res.text()).toBe(compile(STUDIO, { noCache: true }).svg);
    // A trailing `.svg` names the same image; HEAD has headers and no body.
    expect(await (await get(`/svg/${encodePlanHash(STUDIO)}.svg`)).text()).toBe(compile(STUDIO, { noCache: true }).svg);
    const head = await get(`/svg/${encodePlanHash(STUDIO)}`, "HEAD");
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("a plan that does not compile is 422 with its diagnostics, not an image", async () => {
    const res = await get(`/svg/${encodePlanHash('plan "Bad" { room at (0,0) size 0x0 }')}`);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });

  it("a payload that inflates past the cap is 413 E_INPUT_TOO_LARGE, inflated no further", async () => {
    const res = await get(`/svg/${encodePlanHash("#".repeat(SOURCE_CAP_BYTES * 20))}`);
    expect(res.status).toBe(413);
    expect(((await res.json()) as Record<string, any>).diagnostics[0].code).toBe("E_INPUT_TOO_LARGE");
  });

  it("garbage is 400", async () => {
    expect((await get("/svg/not!base64")).status).toBe(400);
    expect((await get("/svg/AAAA")).status).toBe(400);
  });
});

describe("configuration laws", () => {
  /** wrangler.jsonc as data: `//` line comments removed (none of these files puts `//` in a string). */
  const jsonc = (rel: string) => JSON.parse(read(rel).replace(/^\s*\/\/.*$/gm, ""));

  it("the two site Workers keep NO main script (ADR 0019); this Worker is the only scripted one", () => {
    expect(jsonc("docs-site/wrangler.jsonc").main).toBeUndefined();
    expect(jsonc("playground/wrangler.jsonc").main).toBeUndefined();
    expect(jsonc("packages/mcp-worker/wrangler.jsonc").main).toBe("dist/worker.js");
  });

  it("carries no account id and no route: DNS and the custom domain are the owner's", () => {
    const w = jsonc("packages/mcp-worker/wrangler.jsonc");
    expect(w.account_id).toBeUndefined();
    expect(w.routes).toBeUndefined();
    expect(w.route).toBeUndefined();
    expect(w.workers_dev).toBe(true);
    expect(w.observability).toEqual({ enabled: false });
  });
});
