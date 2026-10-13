/**
 * The hosted server's input caps — byte counts, checked BEFORE any compile work, never a clock.
 *
 * INTERIM: 64 KiB of source is a placeholder until the per-tool CPU measurement over `examples/`
 * (scripts/measure-cpu.mjs, docs/adr/0026-hosted-mcp-worker.md) sets it. The largest example is
 * well under it, so no corpus plan is refused.
 */

/** The most UTF-8 bytes of `.arch` source (or serialized `plan_json`) one call may carry. */
export const SOURCE_CAP_BYTES = 64 * 1024;

/**
 * The most bytes a request body may carry, read before it is parsed. JSON-escaping a source can
 * grow it (a quote becomes two bytes, a control character six), so this sits well above
 * {@link SOURCE_CAP_BYTES}; a body past it is refused with the same diagnostic.
 */
export const BODY_CAP_BYTES = 4 * SOURCE_CAP_BYTES;

/** The longest `/svg/<payload>` accepted. A cap-sized source that does not compress stays under it. */
export const PAYLOAD_CAP_CHARS = Math.ceil((SOURCE_CAP_BYTES * 4) / 3) + 1024;
