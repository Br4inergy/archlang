/**
 * Markdown preview support: a markdown-it plugin that renders ```arch fences as the
 * compiled floor plan.
 *
 * Pure and dependency-injected (the compile function is passed in), like
 * `diagnostics.ts`: no `vscode` import, no Node API, no markdown-it import — only the
 * few structural shapes of markdown-it it touches. The compile is sync and
 * deterministic, so the plugin renders synchronously, as markdown-it requires.
 */

/** The slice of the core's `compile()` result this plugin reads. */
export interface CoreCompileResult {
  svg: string;
  diagnostics: ReadonlyArray<{ severity: "error" | "warning"; message: string; code?: string }>;
}
export type CoreCompile = (source: string) => CoreCompileResult;

interface FenceToken {
  info: string;
  content: string;
}
type FenceRule = (tokens: FenceToken[], idx: number, options: unknown, env: unknown, self: unknown) => string;
/** The slice of a markdown-it instance the plugin needs. */
export interface MarkdownItLike {
  renderer: { rules: { fence?: FenceRule } };
}

/** Fence languages rendered as plans. `archlang` is tolerated as an alias. */
const ARCH_LANGS: ReadonlySet<string> = new Set(["arch", "archlang"]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The first word of a fence info string (` ```arch title=x ` -> `arch`). */
function fenceLang(info: string): string {
  return info.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
}

/** The HTML for one arch fence body. Never throws. */
export function renderArchFence(compile: CoreCompile, source: string): string {
  let result: CoreCompileResult;
  try {
    result = compile(source);
  } catch (e) {
    // The core returns diagnostics instead of throwing; this only guards a broken bundle.
    const message = e instanceof Error ? e.message : String(e);
    result = { svg: "", diagnostics: [{ severity: "error", message, code: "E_INTERNAL" }] };
  }
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  if (errors.length === 0 && result.svg !== "") {
    // The SVG is the compiler's own output, embedded verbatim: nothing is stripped
    // or added, and the compiler emits no script.
    return `<div class="archlang-preview">${result.svg}</div>\n`;
  }
  const lines = errors.map((d) => `${d.code ?? "error"}: ${d.message}`);
  return (
    `<div class="archlang-preview archlang-preview-error">` +
    `<pre class="archlang-diagnostics">${escapeHtml(lines.join("\n"))}</pre>` +
    `<pre><code class="language-arch">${escapeHtml(source)}</code></pre></div>\n`
  );
}

/**
 * Register the arch fence rule on a markdown-it instance and return it. Any other
 * fence falls through to the previously installed (default) renderer.
 */
export function installArchFence<T extends MarkdownItLike>(md: T, compile: CoreCompile): T {
  const fallback: FenceRule | undefined = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (ARCH_LANGS.has(fenceLang(token.info))) return renderArchFence(compile, token.content);
    if (fallback) return fallback(tokens, idx, options, env, self);
    return `<pre><code>${escapeHtml(token.content)}</code></pre>\n`;
  };
  return md;
}
