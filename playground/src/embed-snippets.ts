/**
 * The snippets the Embed dialog offers, built from the playground's base URL and a
 * `#z=` share hash. Pure so it can be unit-tested; the dialog lives in actions.ts.
 *
 * `embed.html` is an HTML page, so it can only be framed, never used as an image:
 * the iframe snippet points at it, and the Markdown snippet is a plain LINK to the
 * playground share URL (Markdown has no way to embed a live page). The hash is a
 * fragment, so the plan source in it never reaches the server either way.
 */

export interface EmbedSnippets {
  /** The playground URL that opens this plan (`<base>#z=…`), the same one Copy link copies. */
  shareUrl: string;
  /** The chrome-less embed page for this plan (`<base>embed.html#z=…`). */
  embedUrl: string;
  /** An `<iframe>` of the embed page, for HTML hosts. */
  iframe: string;
  /** A Markdown link to the share URL. Never an image: `embed.html` is not one. */
  markdown: string;
}

/** `base` is the directory URL the playground is served from, ending in `/`. */
export function embedSnippets(base: string, hash: string): EmbedSnippets {
  const shareUrl = `${base}${hash}`;
  const embedUrl = `${base}embed.html${hash}`;
  const iframe = `<iframe src="${embedUrl}" width="720" height="480" style="border:1px solid #e3e0d8;border-radius:10px" title="ArchLang floor plan" loading="lazy"></iframe>`;
  const markdown = `[ArchLang floor plan — open it in the playground](${shareUrl})`;
  return { shareUrl, embedUrl, iframe, markdown };
}
