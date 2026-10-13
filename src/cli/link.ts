/**
 * Share links for a plan: the playground URL that opens it in the editor, and the chrome-less
 * embed URL that only draws it. Published as `@chanmeng666/archlang/link` (Node only: it
 * compresses with `zlib`) so the MCP shim mints the same bytes `archlang link` prints.
 *
 * No query string and no tracking parameter: everything after the origin is the `#z=` fragment,
 * which the browser never sends to the server.
 */

import { decodePlanHash, encodePlanHash, PLAYGROUND_ORIGIN } from "./share-codec.mjs";

export { decodePlanHash, encodePlanHash, PLAYGROUND_ORIGIN };

/** What `archlang link --json` prints and the MCP `link` tool returns. */
export interface PlanLinks {
  /** Opens the plan in the playground editor, rendered, with its diagnostics. */
  playground: string;
  /** Draws the plan alone, for an `<iframe>`; append `&editable=1` or `&theme=<key>` to taste. */
  embed: string;
  /** Length of the compressed payload in bytes; the URL carries it base64url-encoded, about 4/3 as long. */
  bytes: number;
}

/** Mint both links for `source`. Pure and deterministic: the same source gives the same URLs. */
export function planLinks(source: string): PlanLinks {
  const payload = encodePlanHash(source);
  return {
    playground: `${PLAYGROUND_ORIGIN}/#z=${payload}`,
    embed: `${PLAYGROUND_ORIGIN}/embed.html#z=${payload}`,
    bytes: Buffer.from(payload, "base64url").length,
  };
}
