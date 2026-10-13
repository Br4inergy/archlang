// Ambient types for the Worker. Only the handful of Cloudflare runtime APIs this package uses are
// declared here, so it needs no @cloudflare/workers-types dependency.

/** Workers Analytics Engine: one `writeDataPoint` per MCP call (src/worker.ts). */
interface AnalyticsEngineDataset {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

/** The Worker's bindings (wrangler.jsonc). Every binding is optional so local dev runs without it. */
interface Env {
  ANALYTICS?: AnalyticsEngineDataset;
  /** "1" adds the handler's elapsed time as a response header (measurement only; never deployed). */
  MEASURE_CPU?: string;
}

/** The subset of the Workers `ExecutionContext` used here. */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Cloudflare's per-colo default cache (the Cache API's `caches.default`). */
interface CacheStorage {
  readonly default: Cache;
}

/** Inlined at build time by scripts/build.mjs. */
declare const __WORKER_VERSION__: string;
declare const __VIEWER_VERSION__: string;

declare module "virtual:archlang-resources" {
  const texts: Readonly<Record<import("../../mcp/src/tools.js").ResourceName, string>>;
  export default texts;
}

declare module "virtual:archlang-viewer" {
  const html: string;
  export default html;
}
