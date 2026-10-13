# @chanmeng666/arch-plan

`<arch-plan>`: a custom element that compiles an [ArchLang](https://archlang.uk) floor plan in
the browser and draws it. The compiler is
[`@chanmeng666/archlang`](https://www.npmjs.com/package/@chanmeng666/archlang), a peer dependency;
this package adds the element and nothing else.

```html
<script type="module" src="https://archlang.uk/arch-plan.js"></script>

<arch-plan src="https://archlang.uk/examples/studio.arch"></arch-plan>
```

Full usage (attributes, inline source, errors, styling): <https://archlang.uk/embed>.

## Builds

`npm run build` (after `npm run build` at the repo root) writes:

| File | The core | For |
| --- | --- | --- |
| `dist/arch-plan.js` | imported as the bare `@chanmeng666/archlang`, on the first render | a bundler; the package's default export |
| `dist/arch-plan.standalone.js` | inlined (about 700 KB) | a page that must not load a second origin |

The docs site serves a third build at `https://archlang.uk/arch-plan.js`: the element alone,
importing the core from its pinned jsDelivr `+esm` URL. It is generated into
`docs-site/public/arch-plan.js` by `npm run gen:arch-plan` at the repo root and held to the
build output by `check:drift` and `test/served-file.test.ts`; never edit it by hand.

## Publishing (maintainer)

This package is not wired into `release.yml`. Its first version is published by hand by the
owner, with 2FA, from the primary checkout after a root `npm run build`:

```bash
npm publish -w packages/web-component --access public
```

Then register the trusted publisher for it on npmjs.com, as for the other packages, before any
automated publish is added.
