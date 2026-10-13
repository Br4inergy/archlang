/** VS Code extension entry — launches the ArchLang language server. */
import * as path from "node:path";
import type { ExtensionContext } from "vscode";
import { installArchFence, type CoreCompile, type MarkdownItLike } from "./markdown.js";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

/**
 * VS Code's built-in Markdown preview calls this (on the object `activate` returns)
 * to extend its markdown-it instance. The core is ESM-only, so it is `require`d here
 * (esbuild inlines it, lazily, into dist/extension.js: the same core the server
 * bundle carries) and only on the first arch fence rendered.
 */
export function extendMarkdownIt<T extends MarkdownItLike>(md: T): T {
  let compile: CoreCompile | undefined;
  return installArchFence(md, (source) => {
    compile ??= (require("@chanmeng666/archlang") as { compile: CoreCompile }).compile;
    return compile(source);
  });
}

export function activate(context: ExtensionContext): { extendMarkdownIt: typeof extendMarkdownIt } {
  const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "arch" }],
  };
  client = new LanguageClient("archlang", "ArchLang Language Server", serverOptions, clientOptions);
  void client.start();
  return { extendMarkdownIt };
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
