/**
 * What `compile` says about `format:"png"`, written once.
 *
 * PNG needs the core's OPTIONAL renderer, which the core imports lazily on the first PNG
 * render and never at load time. An npm install of this server usually has it (the core
 * lists it as an optional dependency); the `.mcpb` bundle never does, because the bundler
 * leaves it out (`external` in `scripts/build-mcpb.ts`). So the one sentence that tells a
 * model PNG is unavailable is a constant here, and the tool description, the error the call
 * returns, the bundle build's own check and the bundle prover all read it rather than
 * retyping it.
 */

/** The optional renderer the core's PNG backend imports lazily. */
export const PNG_RENDERER = "@resvg/resvg-js";

/** The range `compile`'s `width` input is clamped to, in pixels. */
export const PNG_MIN_WIDTH = 256;
export const PNG_MAX_WIDTH = 4096;

/** Clamp a requested png width into [{@link PNG_MIN_WIDTH}, {@link PNG_MAX_WIDTH}]. */
export const clampPngWidth = (w: number): number => Math.min(PNG_MAX_WIDTH, Math.max(PNG_MIN_WIDTH, Math.round(w)));

/** Where the server was installed from npm and the renderer is missing. */
export const PNG_NEEDS_RENDERER = `png needs the optional renderer: npm i ${PNG_RENDERER} beside this server, or use format "svg".`;

/** The `.mcpb` bundle: it ships without the renderer, so png can never work there. */
export const PNG_NOT_IN_BUNDLE = `format "png" is unavailable in this bundle, which ships without the optional renderer ${PNG_RENDERER}; use format "svg".`;

/**
 * Set to `true` by the bundle build (esbuild `define`); a free identifier everywhere else, so
 * `typeof` reads `"undefined"` under tsup, tsx and vitest.
 */
declare const __ARCHLANG_MCPB__: boolean | undefined;

/** Is this server the `.mcpb` bundle? Fixed at build time, never sniffed at run time. */
export const IN_MCPB_BUNDLE: boolean = typeof __ARCHLANG_MCPB__ !== "undefined" && __ARCHLANG_MCPB__ === true;

/** The error a png call returns when it cannot render: the bundle's sentence, or the npm one. */
export const pngUnavailable = (inBundle: boolean = IN_MCPB_BUNDLE): string =>
  inBundle ? PNG_NOT_IN_BUNDLE : PNG_NEEDS_RENDERER;

/**
 * The png sentence of `compile`'s description. In the bundle it IS {@link PNG_NOT_IN_BUNDLE},
 * the same string the call returns; elsewhere it says what png returns and what it needs.
 */
export const compilePngSentence = (inBundle: boolean = IN_MCPB_BUNDLE): string =>
  inBundle
    ? PNG_NOT_IN_BUNDLE
    : `format "png" returns the usual result as text, then the drawing (the lowest storey, or \`level\`) as image content, as wide as \`width\` says; it needs the optional renderer ${PNG_RENDERER}, and without it the call returns ok:false with an error saying how to install it.`;
