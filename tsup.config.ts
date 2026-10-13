import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  // `src/cli/link.ts` is the Node-only `@chanmeng666/archlang/link` subpath (it uses zlib), so
  // the MCP shim mints the same share links as `archlang link`; the main entry stays browser-safe.
  entry: ["src/index.ts", "src/cli.ts", "src/cli/link.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Optional export-backend deps are lazy-imported; never bundle them so the
  // core build stays self-contained and they remain truly optional.
  external: ["pdfkit", "clipper2-wasm", "@resvg/resvg-js", "@chanmeng666/archlang-font-cjk"],
  // CLI needs a shebang; library entry stays clean.
  banner: ({ format }) => (format === "esm" ? {} : {}),
  // Ship the PNG backend's bundled font next to the emitted chunks so
  // `backends/png.ts` can resolve `./assets/Roboto-Regular.ttf` at runtime. The
  // font is read lazily (only when rendering PNG), so it stays out of the JS bundle.
  onSuccess: async () => {
    mkdirSync("dist/assets", { recursive: true });
    copyFileSync("assets/fonts/Roboto-Regular.ttf", "dist/assets/Roboto-Regular.ttf");
  },
});
