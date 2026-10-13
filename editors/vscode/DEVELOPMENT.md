# ArchLang VS Code extension: development notes

Developer notes. The Marketplace README is `README.md` (user-facing); this file is not packaged.

**Not part of the published core.** All LSP deps live here; the core stays
zero-dependency. The extension depends on the core via `file:../..` and pulls it
in at runtime through a dynamic import (the core is ESM-only). The language-service
functions (`hover`/`completion`/`definition`/`rename`/`signatureHelp`) all live in
the pure core (`src/lsp.ts`); this server is a thin LSP adapter over them.

## Layout

- `src/diagnostics.ts` — pure mapping of `compile().diagnostics` → LSP diagnostics
  (dependency-injected `compile`, no LSP import). Unit-tested by the core suite:
  `test/lsp-diagnostics.test.ts`.
- `src/server.ts` — the language server: declares the hover/completion/definition/
  rename/signature-help capabilities and, on document change, compiles and
  `sendDiagnostics`. Each request delegates to the corresponding core function.
- `src/extension.ts` — the client: launches the server over IPC for
  `language === "arch"`.

- `src/markdown.ts` — the Markdown-preview plugin: a markdown-it fence rule for `arch`
  fences (pure, compile injected). `extension.ts` exposes it as `extendMarkdownIt` on the
  object `activate` returns, which is what `contributes.markdown.markdownItPlugins` makes
  VS Code call. `activate` is async: it `import()`s the ESM-only core (its exports map has
  only an `import` condition, so `require` cannot reach it) before returning. The Markdown
  preview activates the extension too, so the language server starts only once an `arch`
  document is open. Every SVG id is prefixed per fence so two plans on one page do not share
  patterns. Styles: `markdown-preview.css`. Tests: `test/markdown.test.ts`.
- `dist/core.js` — the core, bundled ONCE by `esbuild.mjs`; `dist/extension.js` and
  `dist/server.js` leave it external and load it by `import()`.

## Build & run

```bash
npm run build                         # build the core (dist/) first
npm install --prefix editors/vscode   # installs LSP deps + links the core
npm run build --prefix editors/vscode # tsc -> editors/vscode/dist/
```

Then press **F5** in VS Code with `editors/vscode` open to launch an Extension
Development Host, and open any `.arch` file: keywords highlight and compiler
errors/warnings appear inline (squiggles + Problems panel).

> Packaging note: `contributes.languages`/`grammars` reference the grammar and
> language-configuration in `../`. For `vsce package`, copy those two files into
> this folder (or adjust the paths) so they're included in the `.vsix`.

## Open VSX (owner step)

Not yet published there. Once the owner has created a namespace and a token, publish the
packaged `.vsix` (built in the PRIMARY checkout). ovsx reads the token from the `OVSX_PAT`
environment variable (set it in the shell, so it is never in argv),
never from a file in the repo; `ovsx` is pinned to 1.2.0 (the npm latest on 2026-10-13):

```bash
npx ovsx@1.2.0 publish archlang-<version>.vsix
```
