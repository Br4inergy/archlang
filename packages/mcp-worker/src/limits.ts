/**
 * The hosted server's caps — byte counts and request counts, checked BEFORE any compile work,
 * never a clock (docs/adr/0026-hosted-mcp-worker.md).
 *
 * INTERIM: 64 KiB of source is a placeholder until the per-tool CPU measurement on Cloudflare
 * (scripts/measure-cpu.mjs) sets it. The largest example is well under it, so no corpus plan is
 * refused.
 */

/** The most UTF-8 bytes any one tool argument (`source`, `plan_json`, `intent`, …) may carry. */
export const SOURCE_CAP_BYTES = 64 * 1024;

/**
 * The most bytes a request body may carry, read before it is parsed. JSON-escaping a source can
 * grow it (a quote becomes two bytes, a control character six), so this sits well above
 * {@link SOURCE_CAP_BYTES}; a body past it is refused with the same diagnostic.
 */
export const BODY_CAP_BYTES = 4 * SOURCE_CAP_BYTES;

/** The longest `/svg/<payload>` accepted. A cap-sized source that does not compress stays under it. */
export const PAYLOAD_CAP_CHARS = Math.ceil((SOURCE_CAP_BYTES * 4) / 3) + 1024;

/**
 * Per-address request rates, enforced by the Workers rate-limiting bindings declared in
 * wrangler.jsonc (`ratelimits`), whose `simple` blocks a test holds to these numbers. The period
 * is one of the two the binding allows (10 or 60 s).
 */
export const RATE_PERIOD_SECONDS = 60;
/** `POST /mcp` requests per address per period. */
export const MCP_PER_PERIOD = 60;
/** `/svg/` cache MISSES per address per period (a hit compiles nothing and is not counted). */
export const SVG_PER_PERIOD = 300;
