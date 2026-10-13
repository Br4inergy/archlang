// Plain-markdown rendering of the HAND-WRITTEN docs-site pages (SITE_PAGES in
// sync-docs.mjs), published at `/<route>.md`. Pure apart from reading the repo: the build
// facts it needs (the compiler, `describe`, the permalink codec) are INJECTED, so
// `test/site-markdown.test.ts` can run the very same transform over all six pages
// without the built `dist/`.
//
// Contract: nothing is dropped silently. A Vue component is replaced by its text (the
// home page's feature cards and facts band are read out of their component sources), and
// any markup this file cannot map is a build error — a silent drop would publish a page
// with a hole in it.
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Markup → plain text: tags removed, the few entities the components use decoded. */
function plain(html) {
  return html
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, "`$1`")
    .replace(/<em>([\s\S]*?)<\/em>/g, "*$1*")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&rarr;/g, "->")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The first match of `re` in `src`, or a build error naming the component that moved. */
function pull(src, re, what) {
  const m = re.exec(src);
  if (!m) throw new Error(`site-markdown: cannot find ${what} — the component changed shape; update site-markdown.mjs`);
  return m;
}

/**
 * @param {string} src repo-relative path of the page (e.g. `docs-site/guide.md`)
 * @param {{
 *   repo: string,
 *   compile: (source: string, opts: object) => { pages?: Array<{ level: number }> },
 *   describe: (source: string) => any,
 *   encodePlanHash: (source: string) => string,
 *   levelSvgName: (name: string, level: number) => string,
 *   playground: string,
 * }} deps
 */
export function siteMarkdown(src, deps) {
  const { repo, compile, describe, encodePlanHash, levelSvgName, playground } = deps;
  const read = (...p) => readFileSync(join(repo, ...p), "utf8").replace(/\r\n/g, "\n");
  const raw = read(src);
  let text = raw.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/<script setup>[\s\S]*?<\/script>\n?/, "");
  const alias = {}; // `const hero = EXAMPLES["one-room"]` in the page's own script
  for (const m of raw.matchAll(/const (\w+) = EXAMPLES\["([^"]+)"\]/g)) alias[m[1]] = m[2];
  const example = (name) => read("examples", `${name}.arch`).trimEnd();
  const fence = (body) => `\`\`\`arch\n${body}\n\`\`\``;
  const playgroundLink = (source) => `${playground}/#z=${encodePlanHash(source)}`;

  // <ArchLive :src="EXAMPLES['x']" /> → the compiled drawing's route + the source.
  text = text.replace(/^<ArchLive :src="([^"]+)"[^>]*\/>$/gm, (_, expr) => {
    const name = /^EXAMPLES\['([^']+)'\]$/.exec(expr)?.[1] ?? alias[expr];
    if (!name) throw new Error(`${src}: cannot resolve <ArchLive :src="${expr}">`);
    return `![${name}.arch, compiled](/examples/${name}.svg)\n\n${fence(example(name))}`;
  });

  // <AgentPlan id="x" /> → the same provenance the component prints, the sheets, the source.
  const galleryDir = join("docs", "gallery");
  text = text.replace(/^<AgentPlan id="([^"]+)" \/>$/gm, (_, id) => {
    const entry = JSON.parse(read(galleryDir, "gallery.json")).find((e) => e.id === id);
    if (!entry) throw new Error(`${src}: <AgentPlan id="${id}"> is not in docs/gallery/gallery.json`);
    const brief = read(galleryDir, `${id}.brief.txt`).trim().replace(/^/gm, "> ");
    const source = read(galleryDir, `${id}.arch`);
    const pages = compile(source, { noCache: true }).pages;
    const files = pages?.length ? pages.map((p) => levelSvgName(id, p.level)) : [`${id}.svg`];
    const sheets = files.map((f, i) => {
      const alt =
        files.length > 1
          ? `${entry.title}: compiled floor plan, sheet ${i + 1} of ${files.length}`
          : `${entry.title}: compiled floor plan`;
      return `![${alt}](/gallery/${f})`;
    });
    return [
      "Brief:",
      brief,
      `Written by **${entry.model}**, then completed with \`arch finish\`.`,
      sheets.join("\n\n"),
      fence(source.trimEnd()),
      `[Open in Playground](${playgroundLink(source)}) · [Raw source](/gallery/${id}.arch)`,
    ].join("\n\n");
  });

  text = text.replace(/^<img src="([^"]+)" alt="([^"]*)"[^>]*\/>$/gm, "![$2]($1)");

  // The home page: hero (CompileSeam.vue), feature cards (SheetGrid.vue), facts (FactsSection.vue).
  const theme = join("docs-site", ".vitepress", "theme");
  text = text.replace(/^<SheetGrid \/>\n*/m, () => {
    const vue = read(theme, "SheetGrid.vue");
    const heading = plain(pull(vue, /<h2 class="dimdiv__label">([\s\S]*?)<\/h2>/, "SheetGrid's section heading")[1]);
    const cards = [
      ...vue.matchAll(
        /no: "(A-\d+)",\s*tag: "([^"]+)",\s*title: "([^"]+)",\s*body:\s*"((?:[^"\\]|\\.)*)",\s*(?:example: "([^"]+)",)?(?:\s*art: \{ levels: \[([\d, ]+)\] \},)?/g,
      ),
    ];
    const expected = (vue.match(/\bno: "A-\d+"/g) ?? []).length;
    if (expected === 0 || cards.length !== expected) {
      throw new Error(
        `site-markdown: parsed ${cards.length} of ${expected} SheetGrid cards — the card literal changed shape`,
      );
    }
    const out = cards.map(([, no, tag, title, body, ex, levels]) => {
      const art = !ex
        ? ""
        : levels
          ? levels
              .split(",")
              .map((n) => `![${ex}.arch storey ${n.trim()}](/examples/${ex}.L${n.trim()}.svg)`)
              .join("\n\n")
          : `![${title}](/examples/${ex}.svg)`;
      return [`### ${no} · ${tag} — ${title}`, JSON.parse(`"${body}"`), art].filter(Boolean).join("\n\n");
    });
    return `## ${heading}\n\n${out.join("\n\n")}\n\n`;
  });
  text = text.replace(/^<FactsSection \/>\n*/m, () => {
    const vue = read(theme, "FactsSection.vue");
    const plan = pull(vue, /const PLAN = "([^"]+)"/, "FactsSection's PLAN")[1];
    const eyebrow = plain(pull(vue, /<p class="facts__eyebrow">([\s\S]*?)<\/p>/, "FactsSection's eyebrow")[1]);
    const title = plain(pull(vue, /<h2 class="facts__title">([\s\S]*?)<\/h2>/, "FactsSection's title")[1]);
    const lede = plain(pull(vue, /<p class="facts__lede">([\s\S]*?)<\/p>/, "FactsSection's lede")[1]);
    const source = example(plan);
    const facts = describe(source);
    const rows = facts.rooms.map(
      (r) => `| ${r.label} | ${r.uses.join(", ") || "—"} | ${r.area_m2} m² | ${r.adjacent.length} |`,
    );
    const t = facts.totals;
    return (
      [
        `## ${title}`,
        `*${eyebrow}*`,
        lede,
        `The room schedule below is \`describe()\` on [\`examples/${plan}.arch\`](${playgroundLink(source)}), the plan drawn at \`/examples/${plan}.svg\`:`,
        [
          "| Room | Use | Area | Adj. |",
          "|---|---|---:|---:|",
          ...rows,
          `| Total | ${t.rooms} rooms | ${t.floor_area_m2} m² | ${t.doors + t.windows} |`,
        ].join("\n"),
        `${t.doors} doors · ${t.windows} windows · ${facts.access.hasEntrance ? "entrance verified" : "no entrance"} · every room reachable`,
      ].join("\n\n") + "\n\n"
    );
  });
  if (src === "docs-site/index.md") {
    const vue = read(theme, "CompileSeam.vue");
    const hero = pull(vue, /const HERO = "([^"]+)"/, "CompileSeam's HERO")[1];
    const h1 = pull(vue, /<h1 class="headline">([\s\S]*?)<\/h1>/, "CompileSeam's headline")[1];
    const sub = plain(pull(h1, /<span class="headline__sub">([\s\S]*?)<\/span>/, "CompileSeam's sub-headline")[1]);
    const title = plain(h1.replace(/<span class="headline__sub">[\s\S]*?<\/span>/, ""));
    const tagline = plain(pull(vue, /<p class="tagline">([\s\S]*?)<\/p>/, "CompileSeam's tagline")[1]);
    const actions = [...vue.matchAll(/<a class="btn[^>]*\shref="(\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
      (m) => `- [${plain(m[2])}](${m[1]})`,
    );
    if (actions.length === 0) throw new Error("site-markdown: no static hero actions found in CompileSeam.vue");
    const source = example(hero);
    text = [
      `# ${title}`,
      sub,
      tagline,
      [...actions, `- [Open this plan in the Playground](${playgroundLink(source)})`].join("\n"),
      `The hero plan, \`examples/${hero}.arch\` (drawn at \`/examples/${hero}.svg\`):`,
      fence(source),
      text.replace(/^\n+/, ""),
    ].join("\n\n");
  }

  // The home page's agents band (a hand-written <section>).
  text = text.replace(
    /^<section[\s\S]*?^<\/section>\n?/gm,
    (block) =>
      `${block
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, "`$1`")
        .replace(/<br \/>/g, "\n")
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/, "## $1\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&rarr;/g, "->")
        .split("\n")
        .map((l) => l.trim())
        .filter((l, i, a) => l || (a[i - 1] && a[i - 1] !== ""))
        .join("\n")}\n`,
  );

  // Whatever markup is left outside fences and inline code is a hole: fail the build.
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, ""); // a code span may wrap lines
  const left = /<\/?[A-Za-z][\w-]*(?:\s[^<>]*)?\/?>/.exec(prose);
  if (left) throw new Error(`${src}: markup left in the raw markdown copy: ${left[0]}`);
  if (!/^# /m.test(text)) text = `# ArchLang\n\n${text}`;
  return `${text
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}
