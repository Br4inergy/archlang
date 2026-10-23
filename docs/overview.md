<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../brand/archlang-wordmark.svg" />
  <img src="../brand/archlang-wordmark-black.svg" alt="ArchLang" width="440" />
</picture>

### Floor plans as code — text in, a precise architectural drawing out.

**A deterministic DSL and compiler for floor plans: write (or have an LLM write) `.arch` source and
it compiles to SVG/DXF/PDF with linting and geometric validation — diffable, version-controllable,
reproducible.** Open source (MIT). Zero-dependency, and built so an
**AI agent can verify its own plan without ever looking at an image**.


**[▶ Live Playground](https://playground.archlang.uk)** · **[📖 Docs](https://archlang.uk)** · **[⌨ CLI reference](https://archlang.uk/cli)** · **[📦 npm](https://www.npmjs.com/package/@chanmeng666/archlang)** · **[🧩 VS Code](https://marketplace.visualstudio.com/items?itemName=ChanMeng.archlang)**

</div>

## Use it from your coding agent

```bash
npx skills add ChanMeng666/archlang                      # the ArchLang skills, for any agent that reads skills
claude mcp add archlang -- npx -y @chanmeng666/archlang-mcp   # or the MCP server (Claude Code shown)
/plugin marketplace add ChanMeng666/archlang                # or, inside Claude Code: the skills + MCP server as one plugin (plugins/archlang)
/plugin install archlang@archlang
```

Claude Desktop: each [GitHub Release](https://github.com/ChanMeng666/archlang/releases) carries the MCP server as a one-click `.mcpb` extension (`archlang-mcp-<version>.mcpb`), built by `npm run build:mcpb`.

Then ask in plain language; the agent writes the `.arch`, compiles it, and checks it with `lint` and `describe`:

- *"Design a one-bedroom flat of about 54 m²: a 32 m² living/kitchen, a 10 m² bedroom and a 10 m² bathroom, with the front door on the north wall."*
- *"Draw a two-storey, two-bedroom house, 8 m × 6 m, with a stair linking the floors, and give me one SVG per storey."*
- *"Export that plan as DXF."*

See [floor plans agents wrote from one-paragraph briefs](https://archlang.uk/gallery), each with its brief and source.

<!-- AGENT-FIRST NOTICE -->
> [!IMPORTANT]
> ### 🤖 Read this with your AI agent — don't read it by hand.
> This repo is written agent-first. Point Claude Code, GitHub Copilot, Cursor, or any agent at it:
> *"Read the README and AGENTS.md, then help me run / extend this."*
> Structure + [`AGENTS.md`](../AGENTS.md) are optimized for agent comprehension.
<!-- /AGENT-FIRST NOTICE -->

## 👀 See it

Here is a **whole program**, and below it **the actual drawing it compiles to** — not a mock-up.
Not one coordinate in it places a door, a window or a piece of furniture: every opening is pinned to
a distance along a *named wall*, every fixture resolves against a room or a wall, and the bath and
bedroom are laid out by a `strip`. `site { street north }` names the two facades the plan turns
on — the front door faces the lane, the glazing faces the garden.

```arch
# A one-bedroom laneway cottage — 49 m² that reads as one program.
#
# Nothing here is positioned by hand. Every opening is pinned to a run distance along a
# named wall (`on <wall> at <pos>`), every fixture resolves against a room or a wall
# (`in <room> anchor …`, `against wall …`), and the bath/bedroom pair is laid out by
# `strip`. `site { street north }` names the two facades the plan turns on: the door
# faces the lane, the glass faces the garden.
plan "Laneway House" {
  units mm
  grid 50            # partitions are 100 thick, so a `flush` fixture lands on a …50
  north up
  dims auto all
  site { street north }

  wall id=w_lane   exterior  thickness 200 { (0,0) (7500,0) }
  wall id=w_east   exterior  thickness 200 { (7500,0) (7500,6500) }
  wall id=w_garden exterior  thickness 200 { (0,6500) (7500,6500) }
  wall id=w_west   exterior  thickness 200 { (0,0) (0,6500) }
  wall id=w_hall   partition thickness 100 { (4200,0) (4200,6500) }
  wall id=w_bath   partition thickness 100 { (4200,2500) (7500,2500) }

  room id=r_live at (0,0) size 4200x6500 label "Living / Kitchen" uses living kitchen
  strip down at (4200,0) gap 0 width 3300 {
    room id=r_bath size 2500 label "Bath"    uses bath
    room id=r_bed  size 4000 label "Bedroom" uses bedroom
  }

  door id=d_front  on w_lane at 2100 width 900 hinge near start swing into r_live
  door id=d_garden sliding on w_garden at 2700 width 1800 slide left
  door id=d_bed    on w_hall at 5600 width 800 hinge left swing into r_bed
  # `w_hall` is walked lane→garden, so `slide right` sends the panel down the solid wall
  # below the jamb; `slide left` would aim it at 500 mm and trip `W_POCKET_RUN`.
  door id=d_bath   pocket on w_hall at 900 width 800 slide right

  window on w_west   at 2400 width 1200
  window on w_garden at 700  width 1000
  window on w_garden at 5850 width 1600
  window on w_east   at 1500 width 600

  furniture fridge       against wall w_west offset 400  in r_live
  furniture stove        against wall w_west offset 1200 in r_live
  furniture kitchen_sink against wall w_west offset 2000 in r_live
  furniture counter      against wall w_west offset 2800 in r_live
  furniture table  in r_live centered size 1300x900 label "Table"
  furniture sofa   in r_live anchor bottom-left flush inset 250 size 900x2000  label "Sofa"
  furniture bed    in r_bed  anchor bottom-right flush inset 250 size 1500x2000 label "Bed"
  furniture robe   in r_bed  anchor top-left     flush inset 200 size 1800x600  label "Wardrobe"
  furniture shower in r_bath anchor top-right    flush size 900x900
  furniture wc     in r_bath anchor bottom-left  flush size 400x700
  furniture basin  in r_bath anchor bottom-right flush size 600x450

  title { project "Laneway House" drawn_by "ArchLang" date "2026-08-16" }
}
```

<div align="center">

<a href="https://playground.archlang.uk/#z=jVZdbhs3EH7fU3yQXhxAdmjZcuw2CZC2AQrESIs0QdAn70gcaRmvSIGkvHICA3nqAYqeoQfoEXqUnKQYciWtHNupnihq5ptvvvkR-3gBZ3l_zNo7N0dNlhu6xsTFSDPGl89_4fgM83__QawowjPpAArihIV3M0_zg6Jf9PHaxcrYGSr2DBOwcMFE4yxrjK9RkdUHeHnF_hpuwVYsxchYMYgOBL-00CZEshMG1c7OQEUfluas0VBdY690Fk_l-BwU8XThwvPy0QCcYKdmFZee4Tm4-ooDaEbGhijQkprzoIRT9LFXGouncv0cZCeV8_jy-e9ygHLtlALK3aMByGrEijGmWD1eK7Ug4yWFmoyGW0aMr4s-yhC9WZQHKIOJjE8I0TNHWOdjhZsypRMSWmwcpjQh3X5f1GQRl96KuN-lK-2cL_pi1dpIeQbpNKsphM4vM_Ka7UGRUHrnbRl_dsvAPXwqgKU1MWA-L4CZNxojhc6njwX5mAoWQJ5xqBRiZSaXAwSpTjmtl6EqNyrXZLUQBYlKI1WgzXG5KABt5gG0lLrWdQHcKUZRIMts9LPmQlIDwKvI3jiPHN1yCBgqhU_YUwP1CHtPRiodbna8mUJ82Hvtlw8nI_UVRpbwYQbZ736Mhr_FI5O427uSE7al6HgfZu_jYZtFOtyFIU36PzCGnUSGLUyBPClGP_MXtblimbJMOJiPDHFcSUzUNOYavXNzJYP8GK9MnFRse1gGDqjz9WW-lPLLUEC7xibEdRIzWkChMTpWODoScoX04pZDyiWFHnai_kCx6olhCiY2t91Yo2WsOm55cFuO7RgXyHnLpImzvph6ZyOks9uepIihKJd5nikF2XMMy-QRIvmI0KR9ZqNDFm4Hse2rUBstZgm5vRPsJxvsw1Olkhmj5mncAUk5tbRSm1DE6GTjerqhJZ67hMasC5nwMnuWsrUaqi9Zp33y5Y8_M5s06WWO782siiUCy5Sn7USW61xC-RpcbfJWTtBjrl2TfvhA8_H3axThUqJxy1qDzBwmJtpKYT7PW1X6onx_8esvP756-fbizbvX5cFu2m03u8klx93sz3aS79BOe8VY7Zrs0M6kaH281Xqo1C27bU2kJGs79YDd6HS0wTv5yq7dSRRxONrEFbMCmC69NWmRTr3RM27X8M6_T8vcTaeBo7QyYOy2wbYQIbqrNcJDEJLzPRDtrF4EYy8fghiqeyEmbmkj-2-yGJ7egujjbcXwy_QiIIt3r396-eb8xe8DaE-NxZinznPuQsP5D4-ijJ7VorSJ0ri5K6ckfZVAI41rln8eXJlgxvW12Ea3gKdYsRcQiyrPpInppZOfAvlBIniyIQaozWWmmd4Z-ZXDdeD01BnAyjUIE-e8NpYiH-zoIol1Krd-b4xdjG6-n8bV2HWF87I7VWp1dJwaaouT8-kATVj0Zp2dDo-UWp1t191bMe_t9onI8w0q6W--JTQctYTOlFqlyq_Bf3NT2sVu91PCTudd7DSYd4PLcGT07aLexfZuzHdhR7fIpOWzg71WUjbq6qRD_D15LXC3hKlcw74NIBunEyAz3wTY6HF2qzzNBFsBOhhdcbsYx0qtntzCGFMw9n6MrogJ40Sp1fEoLZRoYi1PrIV3H3gSv3oCplG6GF-j98JPqnOysx40RUZvqIYn--p0__Ckh5vipvgP">
<img src="../examples/laneway-house.svg" alt="The floor plan the program above compiles to — click to open it in the live playground" width="620" />
</a>

**↑ `archlang compile laneway-house.arch` — that program, rendered.** The walls join and hatch
themselves, the hinged doors draw their own swing arcs, the sliding and pocket leaves draw panels
instead (a pocket door has no arc, because it has no swing), and `dims auto all` measures the
building it was given.

**▶ [Click the drawing](https://playground.archlang.uk/#z=jVZdbhs3EH7fU3yQXhxAdmjZcuw2CZC2AQrESIs0QdAn70gcaRmvSIGkvHICA3nqAYqeoQfoEXqUnKQYciWtHNupnihq5ptvvvkR-3gBZ3l_zNo7N0dNlhu6xsTFSDPGl89_4fgM83__QawowjPpAArihIV3M0_zg6Jf9PHaxcrYGSr2DBOwcMFE4yxrjK9RkdUHeHnF_hpuwVYsxchYMYgOBL-00CZEshMG1c7OQEUfluas0VBdY690Fk_l-BwU8XThwvPy0QCcYKdmFZee4Tm4-ooDaEbGhijQkprzoIRT9LFXGouncv0cZCeV8_jy-e9ygHLtlALK3aMByGrEijGmWD1eK7Ug4yWFmoyGW0aMr4s-yhC9WZQHKIOJjE8I0TNHWOdjhZsypRMSWmwcpjQh3X5f1GQRl96KuN-lK-2cL_pi1dpIeQbpNKsphM4vM_Ka7UGRUHrnbRl_dsvAPXwqgKU1MWA-L4CZNxojhc6njwX5mAoWQJ5xqBRiZSaXAwSpTjmtl6EqNyrXZLUQBYlKI1WgzXG5KABt5gG0lLrWdQHcKUZRIMts9LPmQlIDwKvI3jiPHN1yCBgqhU_YUwP1CHtPRiodbna8mUJ82Hvtlw8nI_UVRpbwYQbZ736Mhr_FI5O427uSE7al6HgfZu_jYZtFOtyFIU36PzCGnUSGLUyBPClGP_MXtblimbJMOJiPDHFcSUzUNOYavXNzJYP8GK9MnFRse1gGDqjz9WW-lPLLUEC7xibEdRIzWkChMTpWODoScoX04pZDyiWFHnai_kCx6olhCiY2t91Yo2WsOm55cFuO7RgXyHnLpImzvph6ZyOks9uepIihKJd5nikF2XMMy-QRIvmI0KR9ZqNDFm4Hse2rUBstZgm5vRPsJxvsw1Olkhmj5mncAUk5tbRSm1DE6GTjerqhJZ67hMasC5nwMnuWsrUaqi9Zp33y5Y8_M5s06WWO782siiUCy5Sn7USW61xC-RpcbfJWTtBjrl2TfvhA8_H3axThUqJxy1qDzBwmJtpKYT7PW1X6onx_8esvP756-fbizbvX5cFu2m03u8klx93sz3aS79BOe8VY7Zrs0M6kaH281Xqo1C27bU2kJGs79YDd6HS0wTv5yq7dSRRxONrEFbMCmC69NWmRTr3RM27X8M6_T8vcTaeBo7QyYOy2wbYQIbqrNcJDEJLzPRDtrF4EYy8fghiqeyEmbmkj-2-yGJ7egujjbcXwy_QiIIt3r396-eb8xe8DaE-NxZinznPuQsP5D4-ijJ7VorSJ0ri5K6ckfZVAI41rln8eXJlgxvW12Ea3gKdYsRcQiyrPpInppZOfAvlBIniyIQaozWWmmd4Z-ZXDdeD01BnAyjUIE-e8NpYiH-zoIol1Krd-b4xdjG6-n8bV2HWF87I7VWp1dJwaaouT8-kATVj0Zp2dDo-UWp1t191bMe_t9onI8w0q6W--JTQctYTOlFqlyq_Bf3NT2sVu91PCTudd7DSYd4PLcGT07aLexfZuzHdhR7fIpOWzg71WUjbq6qRD_D15LXC3hKlcw74NIBunEyAz3wTY6HF2qzzNBFsBOhhdcbsYx0qtntzCGFMw9n6MrogJ40Sp1fEoLZRoYi1PrIV3H3gSv3oCplG6GF-j98JPqnOysx40RUZvqIYn--p0__Ckh5vipvgP)** — it opens the
live playground with **this exact plan already loaded**. Change a number and watch it redraw;
the compiler runs in your browser, nothing is sent to a server.

</div>

> **Why a link and not a live embed?** ArchLang *does* ship an embeddable viewer — but
> **GitHub's markdown sanitizer strips `<iframe>`** (it comes back as escaped text, exactly like
> `<script>`), so no README on GitHub can host one. The embed works everywhere GitHub isn't:
> see [Embed a plan anywhere](#embed-a-plan-anywhere). Source:
> [`examples/laneway-house.arch`](../examples/laneway-house.arch).

## 🌟 Introduction

**ArchLang** is a small declarative language for floor plans. You *declare* a plan — walls, rooms,
doors, windows, furniture — and the compiler renders a clean, professional **SVG** (also DXF, PDF,
PNG, and a zero-dependency ASCII plan). It works the way Typst and LaTeX work for documents: the
source is the thing you keep, and the drawing is what the compiler makes of it.

Coordinates are integer **millimetres**, so output is **deterministic**: the same source always
produces byte-identical bytes, and changing one number changes exactly one thing. *"Make the bedroom
1 m wider"* is a one-number diff — not a re-roll of a raster image that silently redraws the kitchen
too.

The compiler is **pure TypeScript with zero runtime dependencies** and is isomorphic — the same code
runs in Node and in the browser, which is why the [playground](https://playground.archlang.uk)
is fully client-side.

> ArchLang is the floor-plan engine behind [ArchCanvas](https://github.com/archcanvas/archcanvas),
> an AI design agent — but it stands alone and is useful in any app or script.

## 💡 Why it is different

Most "AI floor plan" tools generate a **picture**. A picture cannot be checked, diffed, or reasoned
about — and neither the model nor you can tell whether the bathroom is actually reachable.

ArchLang generates a **program**, and then lets you interrogate it as **facts**:

| | Raster image generation | **ArchLang** |
|---|---|---|
| Output | pixels | a `.arch` program → SVG / DXF / PDF / PNG / TXT |
| Edit "widen the bedroom" | re-roll the whole image | change one number |
| Same input twice | different image | **byte-identical** output |
| "Is the bath reachable?" | look at it and guess | `archlang describe --json` → access graph |
| "Does it match the brief?" | eyeball it | `archlang validate --intent` → exit code |
| Wrong syntax | — | **errors returned as data, each carrying its own `fix`** |

That last row is the whole design: **`compile()` never throws.** It *returns* `diagnostics` with byte
spans and a machine-applicable fix, which is what makes a tight self-correction loop possible.

## 🤖 The agent loop

An agent can author a plan, correct itself, and **confirm the plan matches the brief without
rendering an image at all** — which is what makes ArchLang cheap to drive from a text-only model.

```mermaid
flowchart TD
    B([Brief]) --> S["<b>archlang context</b> — the whole language, one call"]
    S --> W["Write <b>.arch</b>"]
    W --> C{"<b>archlang compile --json</b>"}
    C -->|"ok: false"| F["<b>archlang fix</b><br/><i>each diagnostic carries its own fix</i>"]
    F --> C
    C -->|"ok: true"| D["<b>archlang describe --json</b><br/><i>rooms · areas · adjacency · access graph</i>"]
    D --> V{"<b>archlang validate --intent</b><br/><i>does it meet the brief?</i>"}
    V -->|"no"| G["<b>archlang suggest</b><br/><i>candidate door / window statements</i>"]
    G --> W
    V -->|"yes"| O([SVG · DXF · PDF · PNG])

    style B fill:#ede7f6,stroke:#6b3ae0,color:#1a1a1a
    style O fill:#e8f5e9,stroke:#2e7d32,color:#1a1a1a
    style C fill:#fff8e1,stroke:#7a6000,color:#1a1a1a
    style V fill:#fff8e1,stroke:#7a6000,color:#1a1a1a
    style D fill:#e8f5e9,stroke:#2e7d32,color:#1a1a1a
    style F fill:#fdecea,stroke:#b3261e,color:#1a1a1a
    style G fill:#fdecea,stroke:#b3261e,color:#1a1a1a
```

**Cold start in one command.** `archlang context` prints the entire agent context — language spec,
workflow skill, CLI reference and every diagnostic code — as one system-prompt-ready document (the
same [`llms-full.txt`](https://archlang.uk/llms-full.txt) the docs site serves). After
`npm i -g @chanmeng666/archlang` the command is `archlang <cmd>`; never a bare `arch`, which is the
coreutils command on Linux, macOS and Git Bash.

```bash
npx -y @chanmeng666/archlang context                       # EVERYTHING: spec + skill + CLI + error catalog
npx -y @chanmeng666/archlang context --section errors      # …or one section of it (about 130 KB in all; the catalog alone is about 50 KB)
npx -y @chanmeng666/archlang spec                          # just the language, one page
npx -y @chanmeng666/archlang help describe                 # one command, with worked examples
npx -y @chanmeng666/archlang compile plan.arch --json      # render → { ok, diagnostics, summary }
npx -y @chanmeng666/archlang fix plan.arch --dry-run       # the exact unified diff it would write, applying nothing
npx -y @chanmeng666/archlang describe plan.arch --json     # VERIFY, without an image
npx -y @chanmeng666/archlang validate plan.arch --strict   # the ship gate
```

Every command takes `--json` (result on stdout, messages on stderr) with deterministic exit codes
(`0` ok · `2` user-source error · `1` IO · `3` usage) — and a typo *earns* that `3`: `archlang lint
--jsn` exits 3 with `did you mean --json?` rather than quietly reading `--jsn` as a filename, and
`archlang comple` suggests `compile`.

**One manifest, no drift.** The per-command help (`archlang <cmd> --help`), the flag parser, and the
generated **[CLI reference](https://archlang.uk/cli)** are all rendered from the same
manifest — which is why they cannot advertise a flag a command doesn't take. `archlang manifest --json`
is that manifest as data, and `archlang <cmd> --help` is the cheap way to read one row of it.

Reads are bounded, so a big plan can't flood a context window: `describe --select`/`--room`,
`lint|validate --code`/`--severity`, `context --section`. Filtering what you *read* never changes
what *gates* — the exit code always weighs every diagnostic. And because `archlang fix` rewrites your
source, it prints the unified diff first and takes `--backup`.

See [`skills/archlang/SKILL.md`](../skills/archlang/SKILL.md).

<details>
<summary><b>Machine-native artifacts</b> — Plan JSON, a GBNF grammar, an intent schema, and an optional MCP server</summary>

<br/>

| Artifact | Use |
|---|---|
| [`/plan.schema.json`](https://archlang.uk/plan.schema.json) | Emit structured JSON, compile it with `archlang compile --from-json` |
| [`/archlang.gbnf`](https://archlang.uk/archlang.gbnf) | Constrain a local model to parseable output |
| [`/intent.schema.json`](https://archlang.uk/intent.schema.json) | Write the brief down as a contract; gate on it with `validate --intent` |
| [`/llms-full.txt`](https://archlang.uk/llms-full.txt) | The whole context bundle (`archlang context`) |

**MCP server (optional).** [`@chanmeng666/archlang-mcp`](../packages/mcp) is a stdio Model Context
Protocol shim over the library, listed on the official registry as `io.github.ChanMeng666/archlang-mcp`:

```bash
claude mcp add archlang -- npx -y @chanmeng666/archlang-mcp
```

Prefer the **CLI** when your agent has a shell — a CLI costs nothing in the context window until it
is called, whereas an MCP tool schema sits there permanently. The server exists so MCP-native hosts
can *discover* ArchLang. The core stays zero-dependency; the SDK lives only in that package
([ADR 0012](../docs/adr/0012-mcp-shim-discoverability.md)).

**In CI:** [`.github/actions/arch-render`](../.github/actions/arch-render) renders every ` ```arch `
fence in your Markdown to images in one step.

</details>

## ✨ Features

<details open>
<summary><b>It draws like an architect, not like a plotter</b></summary>

<br/>

Poché-hatched walls (by material), door **swing arcs**, window glazing, computed room areas,
dimension lines, layers, line weights, a north arrow, a scale bar and a title block. **Real drawn
symbols for every catalogued furniture kind** — 129 words across 83 families, the bathroom and
kitchen fixtures, the room furniture and the garden beside them, each with the detail that makes it
readable at plan scale (see [Furniture & Fixtures](../docs/furniture.md), or the
[`furnished-flat`](../examples/furnished-flat.arch) and
[`garden-house`](../examples/garden-house.arch) examples) — plus the two **drawing-only**
annotations a plan needs above and below the cut: `roof overhang 600` puts a dashed eaves line
around the building (an exact mitred offset of the wall ring, at any angle), and `void` puts a stair
well or an atrium on the floor plate. And `dims auto` synthesizes the dimension strings for you.

</details>

<details>
<summary><b>It checks architectural soundness, not just syntax</b></summary>

<br/>

`archlang lint` encodes tacit professional knowledge: a bathroom reachable only *through* a bedroom, a
wet room that isn't fully walled in, a door whose swing hits furniture or another door, a windowless
bedroom, an unenterable room, a too-narrow door, a bath/kitchen with no fixtures, and a room whose use
was merely *inferred* from an indirect label (`W_ALIAS_MATCH` — with a fix that pins the explicit
`uses`). All tunable via the ruleset.

</details>

<details>
<summary><b>It models how a person actually walks the plan</b></summary>

<br/>

`archlang describe` runs a clearance-eroded nav grid: per-room walk distance, the **narrowest pinch on
the way in**, and how circuitous the route is — with advisory lint for a too-tight
(`W_PATH_TOO_NARROW`) or roundabout (`W_CIRCUITOUS_PATH`) walk, and an opt-in
`archlang compile --overlay circulation` that draws the routes on top of the plan.

**Facts and advice — never an invisible auto-arranger** ([ADR 0005](../docs/adr/0005-no-invisible-architect.md)).
`archlang repair` is the one *explicit* corrector: it pushes furniture out of walls, doorways and swing
arcs, and emits a change log you review. `archlang finish` is the explicit completion step: it
furnishes the rooms that hold no furniture
([ADR 0025](../docs/adr/0025-furnish-as-explicit-transform.md)), then adds the `paper`, `scale`,
`dims auto`, `title`, `schedule rooms` and `legend` a plan lacks
([ADR 0024](../docs/adr/0024-finish-as-explicit-transform.md)). It deletes nothing.

</details>

<details>
<summary><b>Errors are data, and many carry a machine-applicable fix</b></summary>

<br/>

`compile()` **never throws** on bad source — it *returns* `diagnostics` with byte spans, a catalogued
`E_*`/`W_*` code, and a `fix`. Where the edit is mechanical, the diagnostic also carries applicable
`fixes` that `archlang fix` applies for you. `--error-svg` even turns a plan that *won't* compile into a
self-describing error card an agent can look at.

</details>

<details>
<summary><b>Parametric, scriptable, and still deterministic</b></summary>

<br/>

Values, arithmetic, arrays, `for`/`if`/`while` and pure functions — plus **relational placement**
(`right-of` / `below` / …) and room **strips**, resolved by deterministic topological arithmetic, not
an optimizer. All of it expands at compile time: no runtime, no clock, no I/O. Optional metric unit
suffixes (`4m` / `40cm` / `20mm`) fold exactly to millimetres at lex time.

</details>

<details>
<summary><b>Five output formats · accessible SVG · IDE-grade tooling</b></summary>

<br/>

**SVG**, **DXF** and a **TXT** ASCII plan with zero dependencies; **PDF** (vector, selectable text)
and **PNG** (deterministic raster) via optional, lazily-loaded add-ons the default install never
pulls. `archlang compile --accessible` stamps the SVG with `<title>`/`<desc>` + `role="img"`
(`--acc-id-prefix` renames those ids, so several plans can share one page). Add the
library's `annotate` beside it — `compile(src, { annotate: true, accessible: true })`, an
option the CLI does not expose — and every room, opening and fixture becomes a named,
focusable control (`data-arch-primary`, `role="button"`, `aria-label`). What the embedder
still owns — the roving tab stop, selection state, and taking the controls back off for a
read-only render — is in
[the language reference](../docs/language-reference.md#keyboard-and-screen-reader-operability-annotate--accessible),
with the known screen-reader limitations beside it.

A full **LSP** (hover, completion, go-to-definition, rename, signature help), an `archlang fmt`
formatter, an `archlang explain <CODE>` catalog, a self-documenting CLI (`archlang <cmd> --help`, rendered
from the manifest, worked examples included), and a
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=ChanMeng.archlang).

</details>

## 🚀 Quick start

```bash
npx -y @chanmeng666/archlang new -o plan.arch          # scaffold a starter plan
npx -y @chanmeng666/archlang compile plan.arch -o plan.svg
```

Or install it:

```bash
npm install @chanmeng666/archlang
```

**As a library** (zero dependencies, runs in Node *and* the browser):

```ts
import { compile } from "@chanmeng666/archlang";

const { svg, diagnostics } = compile(`
plan "Tiny" {
  units mm
  grid 50
  wall exterior thickness 200 { (0,0) (4000,0) (4000,3000) (0,3000) close }
  room id=r at (0,0) size 4000x3000 label "Studio"
  door at (2000,3000) width 900 wall exterior hinge left swing in
  window at (0,1500) width 1200 wall exterior
}`);

// compile() never throws — errors come back as data, each with a span and a fix.
if (diagnostics.some((d) => d.severity === "error")) console.error(diagnostics);
else writeFileSync("tiny.svg", svg);
```

**Also exported, all pure:** `describe()` (facts), `lint()` (soundness), `validateIntent()` +
`projectSubscores()` (does it match the brief?), `repair()`, `applyFixes()`, `suggestTopology()`,
`renderAscii()`, `toDxf()`, and the LSP core (`completion`, `hover`, …).

<details>
<summary><b>Develop this repo</b></summary>

<br/>

```bash
npm install          # one install bootstraps every workspace
npm run build        # build the library + CLI into dist/
npm run check        # typecheck + lint + the full test suite
npm run check:drift  # every generated artifact must match its source
npm run playground:dev   # build the core, then open the playground
```

</details>

## 🖼️ Gallery

Every one of these is a real, compiled example from [`examples/`](../examples) — and every drawing on
this page is **generated from its source by `npm run gen:example-svgs`**, so a picture here can
never drift from the compiler that made it. Click a drawing to open it in the playground, or the
name for the source.

**The showpiece** — the whole language on one sheet: `site` orientation, a polygon reading
nook and an L-shaped master suite, a bowed arc bay, all five door kinds, a shared stair shaft, a
void over the double-height living room, a roof overhang, and a mirrored pair of ensuite bathrooms
composed from one `component`. Every room is reachable, every doorway clears, and the three
warnings `archlang lint` still raises are left in on purpose and explained in the source.

<div align="center">

<a href="https://playground.archlang.uk/#z=vVzpbiQ3kv6vpwhIPyytS1LWpcsHIE_L3Y1pt7wt2V5gMKhkZbIqOcpK1pJMlWTDi3mIfYZ9hf2_jzJPsogIMq86Wjba1o_urBL5ZTAYjJs6gPtMwt2b25--f3vzlxuY5WJuM7WEf_3zv0GAW-lj67SRz5CpPLcqlfCo8lzASrkMRAHCOZFkMoW5MGIue-AyCcscf7N3ADNlrDt2aoHTrHLagNM0JBfFvBRzCTbTZZ6ClfIEbh6leXaZKuYgcytBFSCfxGKZS3sKyoIu5N4B8IBUFxJWMs-_wC_odzgEsVeZzhtv0AX90mZSuhO4K81MJNKCciCfpEmUlfZq7wBiq5yM4XCmHiWk0qhHmUKiF0thLRRiIe0R_N__QrwUS2niz2ObiFzGn8fiSVr6mMm0pG9yOZdFGsOhACNFvnfA7_Y8A6dcLmGa6-SBEX_WBb44V4-qmJ9aaR5VIk9tLuUSV7pSxdz2wOg8lymUS2SLy5AT4Z1gy6nTTuSeRKP1ApY6f57rgshIMrGYSSNTKLR-AD2bEaOsK9PnHogipY_vjm0mljLdO4CFsE4asKVykjGFSWJYiTwHmc4lgk71SqYwFc8VHq8A8PU0CUffvf0PSLU28KCK1KJc0RZKID67TDjIBD5pmEricwqHNlcp8mKpkwfpTqdqpvP0dCpMccpydtSDZV7ydscoDzKN9w4glTNR5g63HH9jpHU9kCLJYJVJI0HAtFR5Kg2sSOpE4kqR58-wLB0od0KnIUZyY8hVIS2K54oE-VH2YCoTUdr6jShwhXxEOKOck8UXxKcMUmkTo6YSjo__YXEPjFxq45heZAToYu8AcOozcwdZvFJFqldI_JfI6K9BOPhyqe3XMS9WQDwjyrRe4gZYZ6R0xzORENfVdIqiPkPBwI0FxvMykctHmUM_PvVPg5i-tk4oE8OhFQsJKoWpdhnQCNvzx0bMHEM8akVcPhSQ6nKay-NMqnnmYC6WoJENm4QApXFGv85EMY_hEAdJ8ShtD1IjVkXYrXK5lIaIR4XDc_H86UIWLobPIV7mIpHwr3_-DyyUMdrAE0k3f5ApLIUyoGcgCxJcmAqXIR3Mgv8aRriTpSmUK42EmVioXEkLIjHaWnhQLslkcerP4VSmOPeUeOnF7tRJY5AGpC1VCwuidBrlHPnCErnSsBBFKXLAASd7B3sHJFbLXDuYGV14MeDdC4t_f_vh_k3PH20otHGZNAVkcqHskmQXNbLVEE9F8hDjmUWdJf-zFE6bCWrmGISRNP3u-rsbIGV9aHXpsqMerDKVZCivq-y5u02stIVJ6DAzMoum50Egci5MKguYksIQD_wyegPMRCJSWesSzy-vzGgKba1IHiyIXBfzBhNOgvJFebBQaFLxX6CK1kX-zNoXUmVk4pQu7MkeWZj9N8Em_Yg2aR9-2QMoC-UsLBZ7AHOjUuhH0R4AKW24HqBVSG0ilnIPgDQ49K_GOIJYDuVyD6C1sTTOq1mSpT0AVvB7-CsUs1_CXjJGY8_4i19x5AFc14L6_fXbDxsFtYfvzWiMLhJ5EmTeDzw8AmHhS-QHageCPXzqPR_B38KJ-HsMqrBOFE4Jx2ZOWLLUaWqktWKKxkc_wSHySa8KVuqf0-Lgc3CZkZKAV9LBTD3hWbFHX7BhF0YWDpLSWVarRNVnjEN6bPoMqB2ckykYiTanSNCQs9knXCYvwWn06sNYFoMTfIx7EMtiyM9HJPEkJKibSBNYhfsPiS6cEQmujBDjyktYlFaWi2MymSeoiuMTeK-ZNGW9vnn7_u7tqxuCrvQLiviyNEtt5RUfFkIOBwAlcSkLyyvxfgZz4zMLqUyUVbroobuSuPwZcuVPB1LymYUMF4pUnOxB46X1tqLoAvNDpV_R_0thHK_XZSp5KKS1KM3wCxxGvegIDvsXUeNhcBbhc3hIcm0l_EqwvIT0K_pfOD_fqp8l4NQnnAG5mMoc9m-YpH0orbQkmARxALEqrHTQH0dxD48oxLO8tFncC9oBNR-psUpqrrwaIRle4IKndP7J6qMb4aE1MlXA_Zu3f_nrzQfItHVBNGwm8zyGwTiCxQJm2oAsBqeyGPYgXk3ywQQ1SwyDqPH7yeLIA5uyKFDLNRQOyhKadjwV5DhWu-HFuM9Q9H6UQL9MdOVS64UYsQspjDSo-CRpvUTnuUqlZTePPBxh0ISyV4GOhDQw19KC08vjD29fv7n3DPKIjYMR5I4El3RW4PK7m2_vvQsWCwfn4yiKYSpzvTpi7SvCq9CCBGLZ3cnR7KIsFxrsKqj_ExpT20U_XRUsN6JIMvLbl8eGrD1AJQksQ5dR9HRJarYJMxVWFbAJJpczROnCnEXR02jchVklwGNbMFPtnF4wEu0PDSKYURQ9nRM1Xu9-9Uf8EPK7mx9v3kGfxEQWzjyz53RVBUPewfYeRapQGE-9n9ED70z8oUR6tw_2XxtdFinMcq3Nvlc3B3B8fHwMdMbo8VP8eOTbQrIOSsGgpOHRRPldCFXAo87LheyFiKiOJHLpKmPhPYtD9jrCkaZzOZWZ8o5Gw4_xQWtSGgzd0J-5efX6hpWVACuXwggnfXiUKJPkMu7VsA8yRf9sAYejURT1-tEA9ajTcNg_qz8TyXGyitEZUw6mZT6XFm5_uP_p-sOrk5YaZ8bKJyeNouUHNY7qjLcAKmU-ZG0evuXP_NLwXYMu_xUuskWeEakqLerDCJJV_YrWLNoXeqYjguu_r3220qlcOQof5lfsD5AzadkZI79hpkv0bMj58taQNpZWzIo0MFZaR0qyhwzzrl1ti91KJfKozbbVBF89KWrOdVkHh8fjsTd-9O-vmwBWLwPgJ8-_jUD240B--uFWIOQqwGaj3gQ6CzhnHsbz8VuMHI7J9a4wLBx6zxM3Yo2LejZTiZzIba9lX2IUeT7Qw2gj8Uu9SqWZrHYjXQQkehjsQvoITf0oQPHTZiwOph6Tif0oVQzgD9VmNFLgE_uYwEvRLpoMa27TKbo5HCbZpSraYVEqi-42djcu75NbM1ltpGQQfMDRBjI2A8ldQI35nkFbwNTjJEWTvkuIR_V8ft5yHFJVTB6Ue4FANVd5sRULbelOwhrz-XkLYQ_KebCNZz5aA2OWXbTFgOyqj-jmRpdLmbJdo8gEoySf9futhvVnysn4qHr_zj8g6n5lUSp3f8IaHcjnrxRecJTw8xNqmeD6v6bR-8CuP89dgwzWoYZkRVVDoh4JkD_waB9N-LlrmKwUmMygRCoy0ZQ9DRpkfk-jA5mrZB1OkC9GcJUmCXDDiy4cjQ5wmHwKy_a7SSz3bsb-O_6_zXA2n-TsXQEmfRMninku2VlAe3l3A4k2hTSNVKziqAfjCoTEzCwqigrz-v3rdzeveF2PSnTTuuTsFBxxos8uKVEgjBQ9vzThOMZFzaZVerLGKDYQAdL_uvJI2oZhOCJpHw7qI-kfqnmeoXfIB7_j_Ia1F7OzzDs06mwQfn4aDZoRKe9P-CFgRsg4QdMG91vlA12mtQLH3T9rCCjv534bnBHWgNl_91TXeo7FatABfkWDO8CMsAbsI4Ja_hvA44vOkforD95vAXuENeSQr6yQLzrIgwbyPQ_eryTwG3az-cCd8kHpocBSxYd8ZdocFk9dm1CWzrl6lOQbKkOBrAVRQWNhBJq5RY3hqk9aCo57KS0wFUb2aORxjhqYAhifdTdyrrBOgWmZCplymUmCY-dGLLMextj4Dl3O8TBi-vyBUk8PlAvz76cSzdH6GQm6tuLgYAcHgz5-I_LcnwDK_GCwUeYCLVPb7SY7Qby5omw71QaWxAhX0nj4fQEYZ7zSr1L2kioxxGWc-RO3UqnLoI9HjewfhytU2wCKrDlHQHrKn9kOtlcgDWw6zciSAH8Z0Bv-6LZXNLRF_Y5gw_jHfyLrMzgfN9YxjOo3cfywEWiimBusHTZS2uQDpzxeSmXw8rlghaLlHX_hAKkNLB9HUYXZAfI2ciKfnKeS11mFnx2m-gBlnVpdug50MLP8w7U1prHhSQuH3leg9AIJxbQWQ3cBvaHlHyzPbYIbXlZwl9vXjX5Xoo0nj2Bq7xXZV6OQxG7dnqYqrOFrf7OCD18heL1iWvwLAYN2bXgul5t3qXJRt4l-nQvqMqV-ia-KMvWVn4ocrskfjKodw5d08NiwTXwdxxPdFq1-9BF1gHJFsJgQpxWkX-kqOOCN8x_anEUq1yfWYRdNrT-2BRFzHNsme7vckpkVzifntuZLS-n64ugVF4pD7bRdOcU0Ravo-hGlizkuhanK6ORkWHmHdVmXOYpsP48i-BwU_Bv0-zXvz_0afUyyPq-P6fqGdHV-DoBP5Nbpl1H7EK3ND57IoRQ-B3-0DWzQ_5RgDRHujzaBhWPwArD-ebSLS3CAvrhRqTbb0Cor2T4aF-2jUcGxAPZ8wnIVnNINpA1Hly0r0BLJOun9CTOxNWgq7UPXD-gNzsk95lrQGafOKdneNHM1hjfhSYaVdsTAjeuhbj6qk_hYTQKjHSZbL3ehTdETy2Q-CxRhcDHsUjTsUNQBMeUc1pY1jmqQIQWQo4DScO4bNQ89E5O8iXKOKGc1CgI8keHejpLo2UzKiSO_ksNPZM957THimXlCkB0owiyYvxUtFHSNz8cBBQsuF-OayYPzXVRhrbztACJRo1G9tmrTdoAoUWjookS9i_N6bQhDmuBFZLnHCdbqQcwFFr6CpawMyWyG1SHSC02QrlDT0fMsR6pwz3pnFxVVlD7oVyg-AlvbuLJwtWvUIonPrpVzKmD2A2Ej8mWqPT0LL2h6C_UL_LcTq4qHF74Ag4tdkNbpR9nYkRdAno13Q6bKZithM8-Jl0Ce93dDzoxKa-_9ZZDnuyGpT2iSiKkqpIM1-amcxrBRH1m0slhfbUn2JZ23UdQqkl_uhpkKY53WeQPm4hJFcVzBjDiSh98Iczn-JDD9qL8ZpwXTrb6yNHR47KsrQaoqQW3m9xpSZZ4pubcL43zUxdhYBqYRPozZWgnuVIHXa9IbUJrV7QZKKEl31YVg43dMWaDztpyMKlXQyKBumEuW82Nzu2e-LCa5Lou5ZJDLWgV7lMumCW8GFdtB-qizW4p8IwiHEmpRpc9Rko6_rgqVJFhBJKIIHEawIacE45MLeILBSQSL_RoJ510wzJBBLxoow-AfUZMiFVRd8DtQ_XrnhdX8IKj5VBlu4_qTyv8D7swL3bq-AwCbYaxMdJEK88xtUrbn66R1a23o2JiLPOc-kIO6kbLdY9moc_8JDQMD2P8B1eyf0C9QdQy81yG7Q-0s3J0z09otDeZskFOF5hbFqaY-Fky2L3OsO4dOg5B573F13obepU4PKr-AojursHMMFspR0x1LHuXtQ63a9xNgmC5npZW_pcbfre636_qNcnFo12ryuVHn_ZScrmtdU5kOJhZ2d5r5vjJO7J1tLgwW6Nrsghk3OtQutiNNZTr8CEGXDSRfzt1MFLeGvaiCuqvq6Y_m7hLq9qpno2gXNMT-XbOzf1PZDvelSlH6WlijONJs1_vGN4oNQsMef95QFClkwZDji1BwqTVnE_IdDt2vawvNkliHymFwUdqQW6kcbqRyQ4urLAbN4tCugcMWBaENdq9Vmmvq3Cusmr07vntz_f3Nq25RbWXEkrYmNMf6l4UGaht0Cvfr-WZtl2Tc1u4yZdIelEXdkl61PupZp5kVew6xYYcKHy5rVP6mkvSOIL1DZZag5yoFt16o8GtcK-Y1ZRMtfecDh0r-CLQ-BB01WmtEqkp93_E777hj1IfNUe-cfIGX7vSEe1IbtDVrJA0RFgWlP33m_qz2V6im22-KMA_dVoJp9TzR8b7CwhC2FaOPSvuElx02Xmpg4-ENDDxIubRBWjzurMxzX6fCcmyr_iRgeBLBE4xOBrAAuqikp9aZMvHXAhYqTfHLGd5H2euW84nYVmVzc1nzNY_8CAPq6tMntOZrBSjWZpSdDQYnJIY_XhZgJRMmD3_bZFZ6PiXNNoqSqPXk82pyKJccwPdUGOG2Qb7oc8XN7qFbX1lOBWKXMCbaQxejTHuwEiY1eip9x48KHggStULXBXdCL5bSNZsiSSlUHceCSWJvUswgE3gngm8wOQ1JLoU56SwVFWazphNa6old5-POirdWdFCdtmGGvw9mwVUWPN0MsGn-ljoVazKuBvHmeVtOJYHxjlINz1yvE4SDs4bWALuos7FkfYqUjUtuNYH5-yf5M9el_SVG0kiHXONGe3F3-8P9G9rKHuQ6EXndiX6cy2LuMhgPo-iI9AdJFfeVC_JFM2FkejovsWcSW-_x6xWljukKhxfAE7wlMVnEQbRkrqYSW1vz54Y-un1_Qzzt1Q213kTUt3pyVnxo1cKtQm-B8JocX13ALnbfu-LdYpZUvIdRq5QQyfhXhKMSegXwVXuhPm98JZ4tbHXFwvobGcWjLBBS5JAIK0P_bipnMnG-7SX1F-1yhVfDUi3DOcOxeIkVl3UY_zT55vr-zeTHt9eTb25efbi9_S4-qq_xtbbZNG7hcE-Asv4q2l7VssBrCbcd_e4jV3TpAC-KKrpmYLyq90s7aRFrhKIGlurYYPOxKagvDGtmeX4F8U8TJHby_vZ-cvPvP1zf336YfHv9l7fvX8dIm8e1wPQP0TvB8IH6c0PtahYi_wO-hvQFjbXqCdG_R7bc395O3l9_-HD7U1ytmMyWvzPJ11fpqC78VYTDs1HEl6uojIKa6OgEvsWrnILSRfmDZY-F3CG9rNwejNy9Hp3K9DPLk_G6AyRoZm0jXPPra9wrouPSXXb1ytBMFTjPx9HLoCXRDCe7ocfp_tEz8txfH2ZSrWyu2PrbG-rJZUFEm17PZ4Fmo0tH6hnluvIaA0Ux6cSYb1EhyeEedBMLp2IxRNlAgQgSgqCFMEav6EorO6MLKSunoVCLckFconqmP1B4EuboQ5KdEc5TiXk4KdINNqRSupX9EI4U1gvUtiyGjenDj0_fUI799H7IpvrgoLZDvthY3_Qa9PytvV1lvD45m1sQhtsQqDjV8KybJftWWfGgkyTaXFdkL_A8ikKE2KCnA-ftX4-78Qnojyw8big-TmXazEUPsKNlXKctx6GRilKO6CZ25heoLvF6VFpV5xrzR2OfEt86v_LLfKER04fDZt_qE7l0jfm7F4B-CFOwZQHD3QvoD86iJkC1gm3zOwvoD_utFYzWVjDcUSglSaT8c13kwAbPRpm04Uo1UvmUkkR03gWk4fysncOuubARosMHrEc0ITo7-RKIS9yK3wjR4eY4qiqi9ULqiuhGiEaZliCQF5dRtFajXYPAm8DNpt-QR6AOyJWy8hh7HoE6E7zj5Y3ou6AK_OfgD36s0E_6pnfer9c3aGb4Ny5vrdJPnnfvfHupv3_RxluPstH3ySmsoRbMFK175ZxuTXf7bC1HRv6PEISgStJtcTAyLRPJHkzDc6Do-zDe-tcYlIOywCoQodq__T32DaAU_Kv0q8dWyI06Y1wzcRgalZsrpT9scFX9_RByhe7fvL3zrqQnzKerSUH3qtxz6VAsaaHK8V14j8y57_ovo_RgSn-wgjkwN5QtxwzlXFY5gzrfTWa3tgi_s6aScoKD0jL4N0983vIJp0Y9yvn1gHK7wE33nJehQc9-ECk9QJ7hoEF9S5P_JgojLo3-B3r63ev97G7grbHJ9Bn2r02SvRPF3H-PErg_iAZnx9HF8eB8n5B_3ft_">
<img src="../examples/hillside-villa.svg" alt="Hillside Villa — a two-storey villa with an attached garage, ground floor shown" width="620" />
</a>

<b><a href="../examples/hillside-villa.arch">hillside-villa</a></b>

</div>

**The site plan** — the same language pointed at everything OUTSIDE the wall line: a surveyed lot
boundary, nine `outdoor` ground materials from lawn to swimming pool, a posted `fence` round the
water, a `garage` with the sixth door kind, and fourteen outdoor fixture families from the bins to
the trampoline. The ground is drawn and measured but is emphatically not floor area.

<div align="center">

<a href="https://playground.archlang.uk/#z=rVtdchtHkn7HKTLIB1MRINz4IwE59EBbkMQYDeGl6NFuTEygC90FdJmNLriqmiDH4Yg5xJ5hD7BH2KPMSTYys6q70QApy2E9iPjp_CorKyv_cQp3mYT5T3dv5_NbWOVibTO1hX__679BgNvpc-u0kU-wEhuVP0GmSytBFyBgMIBH_G8DtlyWZikKyLXrQmrErgBhQXRO4dP13Qy2uSheg8skLEuVp6pYg7KQiXwFegXKdUEUKX2vXSYNf6MsrI0ui7TXOe2cwuxBmieXIa3MrQRVgHwUm20u7be0pIVdJhySqcKqVBLeTuQ55KqQPbjLlAVdSHwCv0KmiEXekrIgEleKPH8CZW0pUxC2C7tMJVkg2WU6l7DVqnDIOH700O8N-2BLsxKJtK8htspJ-Pe__qdzCkvkXpinGLalY4RcO2IHJYjvbSal60KBH8W6dKnWJvb7ho1w0iiRW7DiiXcnUQqdU7C_lMJI2EhnJOjS7W3YwvWnLsQrWSQyhq22fvGt1jnIIsm1LY2sZG6dkdJ1TmFldOHEWvJx9Edhj4M-eNZgpR4d0pI2KGlhVZpC2YyeWwuTysKz8YR_O6dwr1ySySJQ1hQifMXnezu7egt3H2afZnD34XY2g3dXP9x9gu9n7-a3M_r2-uY9PgBvb68-X9-878FVEJQXPx7TzfwOBBitN69BoTZ0TkEsrSwcbm8DcSptYtRSwvn5z1YX8TcWYnzc_v0fcdc_47QTue2tcq3NQhgpFptBTEKh73GDpOSdU4htksm0zCWtaWNwYpl7CSpnAakhF0WKalkhe3HW2KqwToq0B9d4EHppnSkTR9v5gPvG61gdoSqSvExlSp9aDYkySZkLp3SB539v8UiFWmcORGK09cqL2vRd5xScvyYCrBNOpvDQB6s221ytVEIo9X0MSsRyrjmwlRDwQlrxpIp155R1FL_Z6FTmkGppodCuB1ckDnh_O__8iQ7xx6v3s9f7V0JZtiaVjFkxu2A1QiuX6dJBvBVbaWK-CUy4k7RXxarH13mnyzyFpQSbiFym4HRDRXvwAbflNZTuICshcvb-6vbq_Qyumc_53YfZLXy4-vgO5u_ok9vZx9nVp1mP1QavOpRWWoQWaxmzZJGFe1WkyHxYplIUKVILJ-_p-RMSdfx5wcsu7ubzxc3V7e38cwwbKSxdGeVew7g3ho0_zy6ItUCV8dCD3iVsyLZthbmXKcSJMDEUUqYWVcoCXV5lIaYXntUuS1k9uoyY9UbfygSVQOSdU8ilWLHCOHEvUR8hyQXuTjgQed6FpUzovXK0uIX532a3H_AyG0HG3GWiAIt6gqqiDYoiV-gEajVLhc1kCkYmThTrXDZNODPLKicc6AdpMilS2Br9M3Pag89opREYiZAT_s7isSsLb2e313-bve2iLsLOKOek90dGWp0_SIMUS8n-gXyGy1RyX0hrQa9WnVOQIsmAjAzxTMIgh4UEymVAxqJHzjQ16kGiBQyGGQUfLGj4Mqbdd07ZSoHcbDPhVEL-B9kkvKA-IAq7kybcOxYJq-z89np2c3d1dz2_4dW3eKHIlNvGLQoO52Z-e_ehG-5KoQ2eUQGZ3Ci7zaSR_rrF8pdSOG0WuAFSaqtLl1WGKFykO29MdtkT32b1gMeMV4PVyxv5b1NVsI0g-e10cC4uM1LCUqZkP0myzDYttxKJSBuuSpoHlUhY4gfWieTegsg14dZ79YK5mcHb2cfr72e3V3cz-Hx1e3N9874LuVyRrdAFbEuz1Va-pucBPi9u5_O_Lm7md4vZf_x0dTe_Xby7-gHN72OfNv49cwkDOMvlg8xh8CocCepBJpaKzD9tn9Wi0ATNu9mpItW7HswLH1vRPigQQXovBMgEKW4tCj5BYbcyqWMlwkVBsuC2Um9zCTaXcovbQ6lI62AtXevAJBg0Q2inChDpg7LaPKEtXzk-IYBMlkZZpxK-MgJS8ZSTkfU2aSOLihOMuFgIiUDLi1oU3MPKSUOIeG1xWTRmPYiFSTJ4ELlKhWP1SnIpiu9a38D5uXVGJS4GI7fakEpzGNfrkNzQjGLQ8QGt_gn82gEoC3S8m00HYG1UCv0o6gCQ24CrATvjRGxlB9g5QP81P0K3AcptByBVGwuidJoYF3lODzc9fQcgl2tZpJ0OwCmJNXiyHsR8ZPG3cX2xYnKXKE8KYlF2usDLLjYSUmXYltnvIK7iRkJuKNhWGAo8KciM2R5SaKmK-3DBt2gszwSZ1PNUky3cSuOeQtxJoD-c_3g7__EVcSHS1DJkL9eujklQ40eTEWz-73-BLcPyCWPuxIHNtMxFInsoFgx4Ue4QFJXkSB_Uu298GLYHZ1E3egVng0EUNV_R_6_wW37VAfiNhfwpk3kOiSyckbgby-rcTCpEAR9fg4B-vzeGR5jCJgQEeBsFudFHuICNN6KEqwuK1Zj9czLZq1wU9z06ZAd38AaGUQTh3ynIRwzNtan9RIeeRaPQh5P3HC-RDT_xwiG3otI3ljZxCAB3_kGAs8E4irqjMYmhPz1404_8u1F0-G7I7wjCv8GIXxL2b3us7BZZH0irFAWPNS_9KIJf4exiUi9Nrz3gAczgRZjpoIah18_A7F7mhrY0jWpu-HUbRfa_zMwkaohschRmLcxRmAHDMOnoyEGQsgL7AJW-MYsMMQEwZGpKFKz6p4TBKIoecSMAuVjKHE4-iDw_gfofRZeEgYr_1Az3WwtZV6ZPfqGGCvFCo2EUPeIH1UKf8PGT1kJ6tVKJbAF7r14Ds-SfA_5Ij5_sAzNGC7h0qhJNQ0s88CSKHodN4J-cypWreSbgkj-EXdICD6lnBT6JWuDjJvhffKTyliKVEwYPGD582V_Ah6a0QFMfaAHEfrxoHmyI-Pe492aow3YFzRnFbhSxd6syARtWjoYwevPpjN2iuyFajvDTN-mC6XUBbGmEI1Zgp1KX4SWIAB2Q5ECIAnMGZEWtOKlTIawM9eBGQ0yEMQYFEGMQX71GFP9ab2XBzoNTNHRcHOttMB1n9NkCQRd_ub55u_jh49VPn2YcTVCYbeSqtIKyTDTLGqtJZl1izOFTRspKjHiQuYWffqSQlXEd-RqFWSf8LDZLjKN4t5jVFtoH95pSEMmxIy1caBSCNBuZKgw8ttr6ix-g0Xv7-P4gW6nc8NGsBZ1yIfOQnIUMpuuBcXkPqXx8k4tiXYq1_IYzkkQXD7IgdlbagCh8IUws9QMvl5SO4sgDZfB8-D9NpeiPBuOgFcMoijotSm9MsKaAbkI4tHyBYBpF-6pDT7cQvNVoIFyMn0do2IdTuIKtTu6lo6PmQw_XnHOvQkOijVEp3pKQHrCY6Witj-YIvN8bwsYj6xUs0bfz3WF9OFOOk2WYjCNS3aB3kyiCbV5iSk_qJPJc70SRyFdtQZMl80zzjgck5Um1Y3zFaoc3z7PjjQ6qpD-jkGFtyvScTA2twXdJOCcwCg3PZsIeOXBeH18IB6PL8bMi98bNs8JWm4RZWU7DgafdUuZbF5MahgfvO2Gmb3RlchsSuKgl0L8IasaWDrMXXzTEDdgu3__qigsO7aTx5Zxt6fiGY-0vXqqVztOYGCCuPHIjBQUdLOUW_eV3INhuobWCrVCmJoaadU-SyuS-BzdS4ZIe2-6k3Nr6BuJhUU3lE8r17BWlMkWZ53RR-dCotLLE0hVZojQOdbuQCuiitl7gpDEobJ8ELiXcy62j9Mig8goSTfvUaXvAEoG9az7q13cOL3CLEDcJoSCzRzgcDeqDq3XXYBrIh8jpLEVLqqiCj73Fp5f7h39IFiKAJtkUQ7VaaY9QhYBkj-HpaM_NHSFrqGdNNmiQDYKCWofageG647htGkXd8aDy7lMMTVBAqTKYMvoTPD8_P4drdgP4mj6mijeVzVNp79n3qyIYTRBFkmEioLfn5JKRIi9txguh2B4v_W5qpKXW97iF1RGkpXZObxisieTDqRZSkuFOQxA2HEZR9yKqoxiMkqIIjMZaMWI0Fuy0oKxeCQLy1UkyrixoK9fov2GMAaaVDgZ4xhwBDzgCZuCGG6iBTbmuOaQEIhpVLBI9iukFAPewwLIAAYwpgB3UoSCe-iMqwR5AC2GHHtq8uLco7O1yGJhB7W7rgHlCnN8FNOm_ALQUVhW_E2g6fQFol7BO_h6gfrSP1ILyF2xhsSKxh0d5mQe5qGTd9EANPXIY18ARrpoo9ZEfR1kZla7ll1AwnXkJJdElxoVfQCFT8AIKpw8Lrg5SuhCxGk8qNaaLPm3DtLlhp37WH4_QHk1rajRIo0rvquLGnsKo5CkJ60_ootcGDVfvX7bom1YNHbbvt1WW7dQ_cIOhVGiCdrGlUDcvMXPg7o7wZeGCUoKqxxWcaSMD0IVsRN3UqsJK3bnYYUSSCYfPYNlegFMhK9gK57CW7WNui3U12tr8hrKZTx9mszsQIfKiqh-2qZWru0UYsb0eR3Vbg114qjaysBh_KywVgXUYBejVqtkG-yYkN0aupKEGU03XbIYg3UbluaL2raWQ1JewfEjlewUqfbNeUMMA6qYCJ5tjLpmRq_J2upWEv_UEJ4eQW-EywCIJO1GCRJsVEL1KjTzkIQClmDnk2OivKhvsOBo8XWBhYDhq8PSOUlMkO3kGdElpjKNA1MHZZNpA5Y2OPOgzAHIfoI8RSEDgbV0GgKOCURrA__H1jgsqWF22Ch7DYWNfPyLBkS3laAZbgqZIYg9vEPCOHD6FZ-D_NOok-wyhZx9Mm4cvk_tjB4_NW-BWcIDrjxmvtiVYyXgcNisXP2qdH9sen_-eGoypTHg5arjXIdoW_K-qDx1XgCdhUsCiPSb2e9Jvwg0jj3YIsJTpwsK-AhDAoN9v8IMZyeOzALsWQPP4Gxo0iZ4DkNBWwUkNURvrSbSfDLWmM7gXG1NKGwO14RvTKNRoF0yzFMYoag5iWkRP-kmIUGDAogKNBuSvMXGuaplUEdnqJMOakoOMJkUKXaV0PMQAP2tV0OciSbDSzahrI7YZNSgPZiqqZo1yUBaYv_EcAc5YcLUFzWr4ikZW_v6PuAdXARpDTWUhRUNqZIqNB2qTNK3oStzzN7l0LGtOa3AXnMQpx-bUiyR9s-ILwGUCquE2atpn_enF4Ts0i6-qJ_kdldN9vZjPLtTnqgEa31_lcSbrnnKJfXgMbLYWOKPkZrXvgpJFDo294PnUQ_PIM73DE1dUYeAtbaQk_0mFYaxKHOzXM-apfoUzDBvoMp1d9sPL3w79PCflB37-nS6Nk5hA-ebtThbu6Zz8eZgQ8pNB6PY5vQ0ludjIX0plpP0s8jx-HShsI_nl6jv7b_mYyG09jSKq2SPrRMHtHhbyRqVpLn1ujKZINasBhTYbkYMwRhRr6lvuaZHAJo1wnPwG-VURU5jTqeO2AbqT_mh0ELa1KMvN0sg8F1AZxtG0RTk9Srhc_tKo_XsDtG-fL735akfNZbHIdVmsJceIrMCj_h5d_3DFNl0_epawTYmlqAanA9ritCak5kb_SPaqir0tDvh2XexFoxdfJBte_C6yJMd7aKn_Wa82aWSQY04AW3TyYZFkwqwp7atK_IOo6SgfhwdkG6HypX6szw-5bPqPQNbOUY3YbHXF5ZSO_bJOEIbBLR_QSdlUlz7tLmq1mAajLxGSl-32J43jQ3kOjghUF2pVRxAokaiLdabqUqBA--MDwkxWGVnDNw_avvmQ0GamXNaE03o9eOkyHSO7HPwhsunoa8kGUb-lnl9DNv1jZMNalr9vb6Oa6ivI-j4qPrbab3UrfAAn75Sx7k_qhB9puX5tt_vPaXb_Ob3uP6XV_Yc63d43noSBpv4JzjuSMxWqqAaRQiuiGnKjEW6RJ7p4ongGi91iI1OqdisXXHlRbpbS7PlZbKgYarvoxtgXjkLSpDhY6eeJ_PecKaxU1VXz0KExQwoVZvgwjqSxcYpSV5hjYmqtEtvlGRtqkaFapOcrbTYgrVMbCjJD6T128tGde6qeszyeByd_bcjjhCJvldaxw6g3gQ13Gqhy0I-iXrt17oOVVvO_1fuvEiN6-CQ0h5uTvRlPITWxlzIdwGG_v9WV99jV8JrvbPtNHUIO9yCn0Zchhy9DcrWh3eNvtfgDpHAZy9pDCj81tMdifw9vEu3jjY-w2G-xGApXurY_FL7yPcJZIPrVA3VqJPdYsWcrDXZtZM9H_Vg5X8pc77AwZ5RsBp5Uf1LVBDDYTKxclbtxThWavaQhYUS5MTvUbvPQgR_vyE7azT189pB8-Ew79hj5sE2OB_lCb3OPPJzb3ur9ZxqDx1bvNycRvr_6-MP85r8aE8OaPIZwcE8dOYWt4rXIcdS8Hrb1tioGI1RufTEPYxAP7Uc02aKilatt6FJmitNf1IFqppHt1gr_Q6tku5BKTNRS3BHWLj0yLvINm6qNSvknI5TS87S338_iZk6DEDGsFFUC0ah4pivmfDbeYFnhYwdjyjRZSb9yCe08aqJWg9MMQ3Zb5Fbj4J6lKmojAWsqH_4yAgtP8WHdIbBY2vCDmQNN9U8c6ywOhuOv6iyymdubXbisG4TP9BXZ6jSJJuMvdRXZ-O2xSo2Tlxcic7RH1Gi51h3F_TqRF0_4S7Zs2CoTjaixNWkaR3r65A-0KFO9K8KFop9SoSWENf5AI252NWKe-I19KxF_3UAtxPh19VzsVZ7TdPwhkqt1qDQFvLud_7VK5yv7h-ZzqbHEJ_HXMOUW_G9F8Cm6trwmFnVkytc6FNSx-Yg-MCIFpOIRZRI8O78tKRF1uqGo8efFu-v_vPvpdrb4_uqHvyzu5jTcHbcz_GXIYF9oftV9q3HoWVLWP6i6c2Su2v1Ck-JvCuoHGo3egwbvYY5V4G2gUkcj4J42POeYe5b1-n9gZ8NqZ5fVzihZjBrIgy_tbPDczkbHCxVfxRkWx5_jbPhce7164Gs5Ey5z5dLTc02uas6TfWp35y-Pd-d9a_YAp9mab-JccGT1TGP2ORjmqAEz8tw0SpNSPEhbDRKiHHxoQ4ExR_gYhGC-hhafjiFu_kgyDKFR_NxpzT8bb9zvPlx_otnzLk-2cFk3Dr8WwkRBylSmvVBf9NNxVuEEXQiZmDPU-RBPFZp34KfXVyEBqMLsFc_TiWIN4zr9dMrlYSrd_xio9VMB9lf4K77F8glOrkySfRTF2n-OucHJIBpcnEeT88HkhHB_6_w_">
<img src="../examples/garden-house.svg" alt="Garden House — a two-storey family house on a 22 x 22 m suburban lot, ground floor shown" width="620" />
</a>

<b><a href="../examples/garden-house.arch">garden-house</a></b>

</div>

<table>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=jVfbjts4En33Vxy4H9pG3B3Z7UvSQRbIJD2YwQZYIJnZeUxoqWRxmyYFkmq7dxBgn_YL5l_2fT5lvmRQRcmW3VlM-qVpieewLqeKpQu8Qe62tcojQmwK7aBq5eOWbMQf__kNsSLkyjqrc2XwxufVe2U3oL3a1oauBxeDC3mqI-Wx8cqYRwTX2AKjWoVAAZ-VzysYbePn8S3ogfwjvHNbuJpsgCtLKORko1cGlTJmMrhAcHLyWsUKOsAyDJ5UXlGBWHnXbKq0gwome3WyvWzYDLK5cYEKKFsMLlDqGKnATseKmQxKvY-Np_CKN8A6FM55GFIlwo6oDnA2OpSNt5o3XuMjmfIqdzYqbYk5R9ZBb2vnYxizzTpKNLWhgNK7LRSCthtDKDVHqzbKYvgxBXr63Ychfh0AjdUxYLsdABuvCyyyARByZQjTW_lhnY8VmnowAC5wt4_ktfMIFRmDZ-CM6aidDdf4qSLsX8-zLEOhH3TBcWtskPh8__P796hIb6rYj7CQ6oCdMoYKyYgYz--NftB2g1CrnFKQvcBzZ5qtRagN2645UG0q8FyyiOfCfT2A8II6oxErnd9bCgGzLMOvGGWTbIzRKst6i2WW8bpbSCbxpSM7ONwjmyayeUczP9J8M-4mnbo6rr8ZOp8foWn9hbMlEdHFa_-pjaSKrcPpL-h_E5hgz6bCqDUZDN-nvc_xdx3ziuwQDZdSS3GfHp6wr6lgOmbvItCxsyP7mx77dylRQxz_hL5N4AmvpLLHm6Jy5J3Oj7w_KGP6pC0tU5zaymXa40zh6nEue7aqWH2FU2SbioEbh80pafDrkhUnjLb3gSu03dbJlYu_q4RroWyj_8d_f0tIHbhDKW4l3LP43SjXPm-MEkFYoiKcNJDxq_4RQsrHiOPcxLChCJXakIC45jpL2Qh5CHC8ik9bpW0br5ujqHe6iBVLMDsvsErbDcFQGYGwY3M1i6WzXRevXV-NKa-rI-fLLDsX_blJPbkt5wdZJPiLp_DWpNQ6kkmuiU9Ie7pYHnTxV6R9P5mUC1bbwu3aUpuJaUAXsMV5wE4BUsC86RDh2TcAFrMjYHUw9QAQBbS1zO0Yyji7kYyn1s7bb_muuMfv_0PuGhvJ8zJE90C8KL0uNoRR4dXOQgWEx-3amTBmuRzuqK43fBKqVjGT2YIjIAX2InWaE0x3HLqUsssJJJjlVzDJLvQwLxd_hWldOGJmq6fnLLJBvwifHer0wDPBPdURuSHFhSNRFB2JBsJpPIIrVYrDIpvMbw6NhlWxF6G3jeajK9XwBCoaFzHeJIW3UBbHfnbaT4fJaO5Wydh2tvh_tl4G8MTziJo1PzpzgXUs_UxIu74wvkWo3I48tJWHpfLInbfkJ1iroC3URmkborw91MkEv7yFS5Dgmva-F4F2E57UUKy0LzojxYsQ1WOQvsHjwqNreBSEymOT5rxINbQNuqDUOHn2-OWt9EubV87zrOYOdJchHQ8qNjRJ41KAdzF10dH0RSYG5TpE8raFCnHCscljZn939-HHf969e4XPpWlC9RlbUoHD3c0tKsrmS55MLHmUKid4FSvy_NYeiMVNT3lUPKVdBhlEyRtt6WgmOzDLsu02DVyXcqWVV8c54DChWrWl4kyAKWXSKaVTHC_Ql50E-XroZe4Oz_BRHAgYpQSPT5UpyRZObjyT-fykhuaLxLlW-X2XgOq8nR_ZdrkUpLZor-aUPKxdjCxlDvFhTtmvsrZA3-kt2cCZC9Gzam9TNKUJBqi1e6AJ3AP5rhXaGKA8fxykMdVTSZ5snlIx2unI0Ryjdpq3Bh072a4bbQptN5cB__j5p7sPktCA0f711TTLnq-mWTbBY_qx5KmslC59cZ66cZdOMUeM51QHVrqPHFB-KaUhkuFL25MquCB3yhcTIU25rt09NygJ8mH26AwVIe8qbSiVXa0sH6KN6bTaV1pb6L0ncilz279p_6_a_3L3y4Sgt-3VzV6Pr_42alecS1eWgSJmiwyR9hFD3jjsUKs-6kjxFHXTR2WTZQtJA_rZWXytJtTq5KxpN7AwcHqYTJ-gloIaAFFHQ_JdBNTe_YvyePhketN9mw7ltdyFn9aPGPIn6FtlH1Ro36hIGM6y2fIqW17NVvz0y-DL4E8"><img src="../examples/studio.svg" width="270" alt="Studio one-bedroom flat" /></a><br/>
<b><a href="../examples/studio.arch">studio</a></b><br/>
<sub>The flagship: fitted kitchen and bath,<br/>an enclosed bath off a central hall.<br/><b>Lint-clean, and import-free.</b></sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=lVfbbttGEH3XVxwoD7EBWaVoy1GcC5AULQq0RR-a92hEjshNqF1hd2naDQL0Iwr0g_on_ZJiZkldbMdNnmyRM2fnds4On-ANYufOVlx65zagLfm4YRvRmViDULCNnhoUzntTOj9B502MbCH2AWvjQ7waPQEwmyLWnJ5P9N_BCbRxtpJHG5zQ_rEJILU_faEI-RTLjpomYO3dJiEtJ-hqU9Qo2ZtrDgocam4aOCs_jIdrY2Msg2wJgqRgonEWziosAL5mf4tQk-cSXFY8QXCwDnIcCrKoHDYmBGOrFMt5ysZt2RpbhQmYihq1C5FLrG73qcJEfHDGBpwsS-c8Vhw7ZrucYOksXorR6-lLOfT1sk_0IoGvW29NbD1PR0_wg4aoXZBDA9x6rVY1Nc0Qrr42AV6i4RKx9q6tpFFDB51XpxXFejraNmQxfte5s7f96x8bimN8GgGtNTFgsxkBlTclZlk2AkJBDWN2lX5Z52MNb6o6jkboTy9f-feNuTa2AkWcZJPsNBUZwfzBuMiy7GaRZRkaWnGD8c8mFjVbfIdf1GuMNnDAx_5xgjpCX3E5AxRd0PoDFP1S0M8v9-i_Uojs0ec3PsKRyh3iiN_pAc7sYo_zEzXNsbeU8NB7nu288wuJ4iDHtySduHv-isscSPU7c2v0mNSYyiK6bQKTqI7B-l7lYyn6E7zrhwC-tQHGRqct7nsQtlRwoqt10AlsmNZXIDtML6jwLiTqdLVrWGGP2RBJBttTrFkmiCwaXkeQULSi7XQE3KUm-CayN87jPMsOaDfLMnzSswcuoO-FEHQ3PJ_32a29szHFTnE39E8DmEIE2_JFz2Cn4aVBP6DHFG-Sd6DboKhdzZ6FmiGSLYWbFCWwLMUfIvm4vIJQQCWOJ-mF0rq1TwM6TkefSuoKbspX5fsUqhtSmmpzJWqBYY_OlLHG8yxDbWzFsEw-HYfQSdrav-Q8AD9YJSXB_aAPDjjCE_PH8XT0voS3uIdHsf6_-PJviy-XhnfGlq5LBUyDMBUmJK88U9l5wCYNY8R8_tBps_k9P6mHIlNU2OTEthyOunjIJZ-uXIxuM-CKkc7TWy5DIlm6cmqmMogbKS1eYLlu2lAvsWEKreewH6cujbKxlj3WVLAM1E76RbiTehq767otatFxtz3TvBUaxgaOSjWVjdkiy27y2ZFsjI-QO_Kldyt-GDkNboJOgHmW3VxqVR6JLh8wUqGOYO5GKCqZZ98S4V30g_QH2b6ROOGdCBbyZ31_hkvGtxbU9NtG4rBe8SdKbGOrpwGBK11xzofVQnVV-3WSTRYq8-0W0SmyXnCnExSNMNkl0Ulj8-JQh2tq1sNrFahIH1nUM7g19atJpFVzp_1rb8qK-wuUKjJ2CHmnrrt4RfOkws-EBGbPjiPAEN31gPe1gJeLRwD7i_p9MPbjVwPOHgEsXKtS-S0Rzs8fS1kqrBd1vphnk_nF7qJezI8n8He3pjG-CKT9UaCFXPgLwTkgx2IP9E4sx0dAxyHVrmPfz7Uq76Nz_TzLbp7foV5XHBDvHsSht_Ds2V3iUjD2Ae97tL-YJ9bvLmOmaw5XOsdp5y77fdukDUKWyqeifYyicUFWiKFtQrBpWoHWcNfsa7IV5gP6b9fshzbbGCayuAdTsqoiojv6fYWl_AlLbNtQc0gLONty64zcwG1UTDesQzpAJu6XJN2ZNWBvrCw3YUt2SCL6ljHLZKr--RsL-RvrtBetWtOUwuidlP_751_qJFddss9Ugtwmrc7bpg2J_2Kl-qcFo7gLeqrQP9xQEZv08UDexHrD0RQg1GTLs-HLahn5Ji5RcQzovEslLc1GyxJ2GnX2-kQD6hVr0AadgyNrNX3AbAREExvWzwFg690HLuID3wv6uvTU2ferW4zf-KL-nuw1hf6NKPE4z_LLs-zyLJ_L08-jz6P_AA"><img src="../examples/two-bed.svg" width="270" alt="Two-bedroom flat" /></a><br/>
<b><a href="../examples/two-bed.arch">two-bed</a></b><br/>
<sub>A larger dwelling: every room off a central<br/>corridor, its walls derived from the rooms.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=hVXbaiNHEH2frzjIhJWIJUZeLSHBNnhDAoE8JXm3StMlTZOZrqG7xuNcDH7aDwj5gjzsh_lLQnePbibBTx7aVadOnao6usAdxPF8w8aLtNg2pKBea_FsMFitoTXjYblYvkfXUMUtO0Xod-Tx8vw3nKAmZ-aVtF2vbIoLVCLeWEfKAVvxkI6ddbsA8dj23lntPS_wg4If2Vc2cLiEyo61Zv9NcQHg5fkfrIN6261TFYKXAbJFJBnQkDWQXsHOQCX-OaQdqpEqVTWnAMJATYPNb-gkWLXiMF0bEf_nYJ2RAS_PnyEO1zHsFqS47iTcrmcHWEIMh9akqUSAykDegOCoZZOYYboOg3U7WKeynqG2bscmwo0ETokepMi6GnhuSO0DZ8IjnnW4jp-3IFfVEkX_nGh9K21nGw6oGiYHcgYdhcABa_JVjcY6XS-KriGHyd1ei-XHnyb4owB6ZzWgbQtg563BsiwLwInXGn1XFMAFfrQPsZkvsd-OpHvDW52rzL3d1RolJaRJXSLU5GMCYYUWhjutFwXyf5HDSTEtL8sZdtShRM3pdVWWZWKF3LY1N_6-ydWD_Z1zQEMbbjDJrCZAH5vNUa9SN2ziQ0p9f5L6MfcxyaljVwXwlPv97lHZW_EINTcNKK5v7yN_SjTjCAOmTFUNGnUPSl5fPv01bmJeOohTmSXMrulDOqGOvObN27AOzC696iB5p6NQaUWsuRnu8xx4zwda2-pXxyHgKio1ajj9qizTx9NZcpD-reSo5z4_f59DDBwUb9f_72SmN5L3tP-_fhQLJ5IdIZYZYrWHWJ1C5Ck69eQqjtVKtC2oEbdLamdlYpnLk9tMNx0f34U8zmQr5EyCG_0knXQCGfcyTm2BX2o-XEcyCHGvpp3NwrpoFnHIKcqaG3PfknUxfj8x0kx5sEbr2GiZScIx-ZHZ0V6wv5AzzLT5CTNLeI75dVniHGLDJqt2h9EJK3YavV8c0qLH1t6F4zijUGlZc3iqldaFFB_KL_bsV8lPToPSWpwHXZVlrv79ay-MtpL9zrpgDR-5YOr4gT1ku41HePitmUVSR08NsiVYd1BpD6fSzaODRVzW6A7ZJqJKj0mf0St-li1NziCTtgly9JcTyOxurzCXH8ry8ercfybFU_Ev"><img src="../examples/attached.svg" width="270" alt="Attached one-bedroom flat" /></a><br/>
<b><a href="../examples/attached.arch">attached</a></b><br/>
<sub>No hand-computed coordinates at all:<br/>strips, on-wall openings, anchors.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVrNchs3Er7zKbqkQ6RaUktSkSIr5QMt0TYrDpmVqNWRBGdADiIQYACMKCaVqjxEnmEfLE-y1d3AzJCOY-_GB5c4HHxo9O_XDR7DALwyKy07Plgnd-DLRekWwsCiNCuh7Rb--O13CIWEyd1oOJ4OpqPJuDMY33YmPwzHo_G7e5AvYr3REk6ee2f9i9Oz1nHrGKaFhI22AZbOmuAJwQcnZQBr6NP95GH6HoTJ6dNKuFya9N14cjd93wbFn7wtQyGdaR1DIdfKbwrp5BlMC4FgEpYiC5DLTOWSN9oWVkvQYmfL0AZv6eFGCwM-iCA9qHBNUgJ4FST8kkSjnRqbxAe_0stzfHcOuRNbD8aGQpnVGYwCGLGWHpbqWUKunMyCssbjUebCZQXk0mdOLSR0Oj96a6DT8VLLLNDe82tCpu3ncHJ_2ob5QmRPczgZV6pn5eBX8qdSBOtmXuUSX2nDQmai9ElSu6QF8bXWcfMTaCVRcBeKrXA5wvnSOOVlghuekj3wsZchPX08PYP3qIwomDA5yrwvinCSrTr4fgj4qA3bQmUFKI8OkgW9g22xo3cKiwKH0hkPYit26CNr_KZ1DM6K_Jre0upZmRU4a9ck1cKGAhYyxwcegnjiDek86AIC90zu5KV7VpmEBT7447ffW8cgTXC7NhRC6zYsRCjaoEVpcnz4pEJWSEMKVx69JHuSOQhtzarhumcwMRJE_qy8dTvQygQUudQSnBQ5-lUb5o-zu8nk-9l4Mp0N__UwmE7uZm8HN6Pxu_m3oKV4liDSOWCrQpF8CRZlABU8SOERd6tMbrd0JBVgq7QGL3bgbRVhXpLeb-8Gb6ej8Tt4P3y4G91PRzf38HZyB4MxDO5_GN5M27gFCMjFTqtVEWAthS-dXEsTzmDgsuKDMCsohG8dg7HgSwNrm0uNC0GLoEKZS5LEWMhFkBRVBy7gxc5Ho6NRRTqAtvYJgXk5H3VbiCCfpQOxsGWAwm5hXWYFsHiZXVMkO1uuClChTikWEwHacJlcncJacdzn1jr4bjS-vT-DAep6id_Q2fUWpcO9ZV65CcWHk-hEppPLpSh1gCdlcg8U_ahcKfA8_BEWpdK5dLC1pc5BZKEUWu9gU1IiqnKKVjkespnYSLQUz8tS604h6az4snRgTeA0lcvsiVA2NnuSARiF_dUulyCgd9HtwnoNmXVO5dZdk5HosJwv2cUNpsb4BJcT6EItrc4jaOX--AwFVigEeqDdGrAbaSgABek8FMKAfaa_JKxFVigjPZ14QPpj3bIgfivlpkqS7CyogfutMquT0zk4yeFvSq1haR0IraMtYnp5nN0_jsbvZpM399O7h5vp8HYOmTBkzM1G74D1tSalWqM5tYStrWILN_QpDaV80TqGZOg5SzyHxQ62TgU8rLFkfxDoMroNmXAOXdmj4CBcdtYihzt6E8vjEfzSAigNam29bgEcw3zlVA4X3XmVm9HTd7ARLiisDexcykOv24VQqOypylvJmz3WSUwHhiDR4TtrGZz0VHFKL3NUwAKd8nFy993gbvIwvgXhYSu1vgYBS_USSkeImcxhvtSlL-YgVkIZH0AQLgpQi6UFer41IHhDEs1I7-Hkj9_-c9E9hcxalytDCSCJ7KS3Gv0iCkXAqIKON2KDfhPgdng3-vfwtrEetHpCW4MoQ2GdzDGA2FFIfb1udw7OliaXlP6w9BDyaDydcJFHl0EhnFC48_xx9vbhbjyaPtwNZ4-DDx9mN5MPH0b3o8l4zofCgMG6i0rGBJFLp55lTrANyShlAKZ-6QDPsMGUEVkECac8LMlVUZkpqr0EU64X0nnMGwRamqwQdcbxlqohOcNiF9AfEUlpyaTirAUQfacFsBEb6WBwzmbJxAYxfSa0hN51r4uvcO0rNy2AXK096tKi39KLhcypMGG5bLW-mOmQ4J1OpwO-kFrDP3BFmZEvdf6PfxwS25nfKCPn4ErjqxwIW5WHgnSTq-eKvsWUSbWbqAGpLNZIWSgqiN9WwFzq55DbuN6LtaSk0iCdCHYGb5BDYFZHypZX8Zlqh4eF1HZLyKIRO9bMOdcsdnD3MIbb0f10ML4ZVsSFnPErtKXzATZWmcAmjzuwrI-zHyY33w2ns7uH8TzVYBZ5I4xEgEw8q7CLxAMTOAvq5YpqdQvY7VX-mq2D_-RLkE5ZB1AHbL_bhV_gpNvunsJJr9_tNv-6uujih_RHpq2X8GsDeztbyLyH2HVyqLF7jH2ZQOmPr68Q6iOQ_mdAXiWQV58CIb_5a5C0MB7vz1ASwfsLlPN6Lf_N2jmQJvLKz-FcnjcE4g8HuhGh-IxuLq5qIPr7zwSKNfyvcK4aAl01D1aHOnPqzt_8R3jvGsF7QgnqlPk877GRFntFrwKnRC3lBpRpx7SILs_Ebh17QQKNRLOzFBkmAWb7Z3BfxzacUALb24tKT26JABpJdQQjiMiByl-7WWwxsNpzqPA_r36WgF79gu4AWiykhqMP_PI_4VYhLzrCeudTl5LTsz3wFEIInmIlgZ8fgr-JnKV3FGUg8MhkDmH7CfbVl8L2PwubAoRVwWGwB3v-TQ37Hb-cQCNshNiDRSqapG0EGMGi9C9EZiPse6F1jZlgCSJTLiuxEbH7-CmMKnz2c8LvX3W7L_1-QxsiFB_jEzfe84oYUojZiEHG7B9gfuCXD1RRBqVV2O3BUv8ZRb06EPXr7gHsEF8-OhSVIBphSzXrmoKGWCsSBq9CSXqC_ylssbmiUQ13KsqnUUysn80GW4XUcBHvrupPowPAOGOg_HU-Y2A8eK9bJyAu_viE8xlXNAIBLZchkm5lWpWEjWYKCVzsnZSnfhIbXJk9VY1L1Z4p35Q7TiEIszljyAT3PJGVCRc7jMiysFNHRi64w5GC-gViMhrF4RJPEpH0DapDxZ0YLASLo5cmZfBBuBCbmLiht1rlsFHSEehChq1MclWHi-ybe-zY4GfO-kihtPB-3whRd6k5RWtgMLYrS_QPLFGfhQ3wJs1enjBnc69KndR13UolU-xsCStMzZ9urbDPQ1imzti4pRkSeRXzsdi_UltEs5JGK4b2sQtmp_tHpdRrDST2IAJ8g3kmHhQTZMPNaj87wOgfYPS6CHKI4biN_8hXMa-gkzb7YmLahcAGg0cKK2upkVvZa-z3yDmw29E2e_J1rx9bFO73cS6aXlzaUvvY4ntFXU2cG9BJhPFbbEhwdtaOsz1Nwxqei0Rcv5ZBZSwdemKTVaNFhcZp2Fb6gLLieIo7NfYQUgDORdVzk80Stko-Tcltvcbizu5Njrbn2j-K9aLy65SEOdSbcUW4cQCj1qgEEWhJZp3BbGB8kCJvx6EN0YGSmuo4N0ktMH5zdcGPuM2-4hc4XpExxMRxwNx5cyc31uHADs4ZxBfWHToilqdoEPalyB9FwPLX8KWGKmsXqgY0mOEpSS1LR9OYxmQSmx1UJto-jnfwP783zSHImDvIdiq6rAcjFUFWpkp-honv44nP_gGTmeLGh2c83zskH-xGYLceZfHXzdLOOk_jLNwppTuVv7Z7HAUDI9GUmL6-Tukrhuzh8ibb-_qj5b3PLd8ILuAV1bi4uKiXv6L0wstrIrQH0CQAXAeZAcT9-439WYONSs9p_u9SdMIb88AcO9XryLoLsVBBLOK0ABO3b14cJNot_EZmoTHYp1SP1cCnBvdTk2_4qVQ4P58WkjO6NBhcIX1MUwmVS2pyeXKs8tcmmS3y3YqlH1qNatbB0kjBcSnm_7Q2Lr38zNJ-Zat67eeXyr2l1P-hZ35s5tTAH0O8haHTpxEeiHhVcwAeCXUNzl546IQ1OE_UD0L7K-SS-R70duaVeYLUDF1edve19edy-2i0dp0oEGYP2SeWTpFzWfG_iHy5L3TD6eMI8296fXT6aiBKVYGv7HD8uPBWl0E2B4DVjJTEaseLCyOJyuAy9nZn8TJxTk5d3SBhqXHVJItO9JXn0hmHOFw67XLp8cZPYZXPlQ_CZMxJBx8m43fcu8YVcBJnRXEchjl9b9KURjmn9UUZlWHrVeyYjqvC-lMpXJCug_N3YlxxCro_y_o2mvJnGS9jqm8zEYS2q1KeVWXKC6OCcLvaYIgrTMaDXfY95WIvtF-e01w6TcMItNoMOTNdFzFXVgYL_NvBzZCUaOzhnBpzklMhUI-wNUg_Cxz8tQArp1HkANFU7O_J1k3eG7V-Dmwk6GFcKQN1l0yz3Tw6PHv63hY-2GeZWrcv2qJ3sMUe3NKpfCX_Bzgiu5-Ey2xpgnRfDte_PJRuD4-oZ9yPQp1NH9k1kIVjn3vRfbmk0XW9epuRHB-tXtgQkPE0Vne7L98crPaF3RJ5OVjNrLy5-lW3-_KKScjHqqD1VeP_KQGw2pD8-yLYpajGPO0-J856WkBJObb193YpjvYWc9mtMmOvHo_QZs3FU3x1f_VC5mnC1Me9662RH71QR1ePgj619tUXra3zMtVv8fw3EzMnu_p3JsrD2nr8nYCzdslZl--ibOCfktRzB7pF5xRZiJRsU7k8xu7358OrS2F2sSumS3yNPR3_lEMFHhraMtBT5av7qgXe7fqCR3vY3mN8zL_y4BAexwGUYfSScnKdhza69FjY2rBWAXOgCHyRzD1KYuBr-xwznlpWqdfjyDJma5duo7zMLI5LsY9YNmqVx-z6xDNU8EFuzpKQoHxqr7mhpjF_DvM0rplzyOMmSZ6KfhuxxgNiL0g1LxU8u6Q6j5dasM-B5ngEkeS0rEa-4c9zvACL1zHUySPBZMghMsa3s8H3b0bvHiYP9_N9m8GqlDzHOObLvxBt1vwtwdo6SXfg8_RLG7xhfpI7_vWCMoF-okGfGtdi2zN4LAS3wCrw7RFf1yUv-2Hwbljd2eO-uBuqzwRs4EGZTJfJ-yggqmtCX0gZ4k0o8vZgocAGCQfbcQa9r0oMr6CClnSfDLBx9ke8qzy6Tz_Iqm6c6XsUx8wWOzjCn2_cCPMsfPwGKcxRv9u_7HSvOr1zfPpr69fWfwE"><img src="../examples/bungalow.svg" width="270" alt="Bungalow with sliding, pocket and bifold doors" /></a><br/>
<b><a href="../examples/bungalow.arch">bungalow</a></b><br/>
<sub>The door vocabulary: sliding, pocket<br/>and bifold leaves — panels, not arcs.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVrvcttGkv_Op-iSKmX7jmRIUbRk7TlVdETb2tNKLkk5J19OGgJNYlbDGezMQCCzlao8xD7DPlie5Kp7ZgBQkp29LD_YItDof9N_f-A-zKDAjVgZLRSshM1RQykepJJGn4CTG_BWlPizkTkTKIVWogMr9UrqFQjIpM0qJSxY4yudi2Fvv7cP8we0WzC-QAu4EetSIUid_nTfgnSwqKTysLRmDRYzL_RKoevDAjNROQRfCE9kNf0vevuwVMZYKJXQULlKKLUF6YZwU0gHRiPRauMTL9ZpdvHT54_zq3kfhM5BesCNdN6BN-AKU_f2gxRfIPjagDZ6QI9LJTWySWYNS2PXDjKzLo1DqKUvyOrKPmAOtVDqhA2GQPzbr_-E0qjtymh4uelvX_GVzkeQE0olM-nZifDbr_8gt2SeNEIlMgRhUfRBiQUqEJ6Z__6HbMhQe2tk3gdtYGEqnZOEhdmA0Nu6QMuHQJRCuxrtrt50kgpBeHiZbfrZ9hVYkcvKkdZgiVs4gj4rCGsUrrKYg3DBALWFUl797wFzFTaLDohMrh4r3Djx8-z8HOanH-Z9yK2oNTEU4G2FcP0_H749_fE9cWMv33ycw8f5j7MPlxdwdg0XlzdwNf_ww_nsqg-zi1O4-Ti7oRtE9-ny7OJmCDOwGIIhBjqYZQjaddKstw-ZsBzXS1NZIpDewQNaLzN05JEtvIX__HYAV__h_mb9y8mrbw_45IQGaa3wkhNIV-sFWnL-ysocMqF7-3TcFp1jcmeYs1OmxByWIhM5OtD4gDb5s_G10FtfSL06AYeeA9xUnnS5grdwNB2NevtgNAiYjmC9DhIpylFkBWizlqQR0QHmK6QARgcLkd3TxUNyDHmbAoRzIBNKOf6ztx8ekw7UVupVSB5SoEMoPbMBZcy9AyXvSfG1dF7c4xCuDXhKS1egUk2uJ4Ung8PBFLyVnPIgtfMo8mEsGjvOAeexdHBI-ojMGudYmdej0QhyU-s-1IXMit4-CUlRSNoHpZE50kHiBpTQOVUKTgByV8pcgJdj4tg_Go1Gr-DleEwMxuHLtPP3uEMUrk92nuBvzPQ9xVE6X7OMKlGNMUvWvg_0yAg2MD6g_80DWqFUDKqkeQyoqLMrEH0wVUBdGIWwlkrJNXqOG3JyjpbiLsRM5VO98qLEUJln4DAzOm_SQfjGcYVQS3CZUAiO4lRqJ3ME6anKIreDtgUISwGBVENTi3Dwbn7zeT6_SBX1JCRUaaT2jiMzOqHyaDsJpvOmBkut2WJ0vX1YYCHDvTV7huPS2HD-0SvBy_2gPEdovBG078OEgwWxHMK13HA9Eqq3D64099TKKg1CGc4DhL8aqV0IHgFr4Yy2W8httYalDAlCTs9zFd1JfuHbMtwrhfVQG-sLsCi4_vpaZjiEs9DNrPQeucZdXsy5gVBIkOUO1zJ1094-3Amb3XHuOnjpQ_GmDgeZMg4HQg-oxlJ3OqFaShfzUFKTLsS0EOoBOV2le9UHQxVJhEaB1OVIeKyD7CcynCKS8je7H4aLsbMKWFpEyAojMzwJPKOnNTeTGFIvHJxdXM1Oz3647lPJ89FHL1xXcHw2dh2pXWblAvPQoYRPzPoUYKbKCh43lOIoJI9REqdgfBHDhr1FwdoZHRT6ICkOKLCgmL3jtheFU_frOOGOY40zTqyxo3OsNkl1Y3Ophd3CzGbFudAraiRGP6CmfhCsENxfX7jQjolYOu4BdPI7Duk3aWCR4i4U8mDiljlXlETCwez0z7Pv5xc3NMZ0DbOC5y1fCE12UFdwhbE-NLSQwyHzljRmcD2kcPAweU0VqRTOt-fZOc3MWI2WG-FkMj3cOVRwZImp3aMToTrVnEmq8aSJQvEQR0eLjuynq5UmNhhHjJT40rNX6LxyuYZcijWS_tHiu9iMuDHGtlkWkstDW7IyQZlhStRSr0LdKo2TdEbIrI0OlggP_1Vm_ru7dM61UPfBLs7TxRZmV9_D-fziw83H1M-Ph5PJ5Bs61QlVmZVFGmLd3yphkRtePKRQNMhUkQ41VRBKKm71VNdTWfZ0_FQbF2Td7OLi8mZ2c3Z5MYxNazxknzgQlTepfdw1oanVNtxZmxxjQSqC46mUcPauJJUGIufOITmA-UPNvpkfs0JI3edrV3R61GJKtJBL56XOPM96aUQg99PNzlpg1sPE94aj1ayZnH3KzB2phlTbxEbydK4kxqIcRpzJILi2qfYhAhPfMLyTjann0innco3a8THDu5_g4-zidAhznXM7gsur0_lVUyXKKjYooFxs_FD50EPapYSOcEnd1VbadRrH-fz9DemwFlzQaa0ZfOcNhwkVfQSUlJ6JdSmk5XGsFjZvW2AqjWES9oU11arYOSN4eff59vTsL7dnF9dnp3MKVu7xifFaUK3EgShpzRALaua1KF8NYRZlXL5_fz2_gUKwqxcIC7lapcIhfZjpTkJpqVTjjDigupj6pB9p-8JRbAefihWdpt_R94XjIx_gxiMVsHeXP_LxcSuKm4Arldi2Q1-mUFgZHcthEjsQanYH-XR8HBqT85Luh0mlExLNStlvehglUtx_1sKupIawE4k2UmCBdKIuROzBEC7CqUFBB0Q1KG0KAu48bvwdp57lICESHek1Ig-beNIZUlrd4vYa50IO5k7LSg4mFzixjdpMaGZPyyVnEa-I3E5QLal8UWOhznB1eXYa9GEDu7thqhC1sa7ZLcuwdz4IqThgeAplvw1ocGonPBo7XVPMWN8kgEvoolI0r1AnSbylDzlQSBUIqURQ3R7weaRQvwxDYyrx_WYobSXEqv_CNelZa9DUomtTqRxWhjePMDqzg0qqLeQUplpswzFyvtyF_Xrvt1__ucc7Ly2rd_1O5qc5Mk4GfEIL6TDzgSdJr6m79ckftdjCAn2NqFt3cJ-NqZ04h1Boh5RQrjGeAcendDRtYsd0UfnCWLjX1GidWSP3iy7b5nxzg5ws7XxaCoXeh7KCVtLOzaiLACd5A8uMojE9-IWGbQwEe_sHy9fLQ9wLExFpWeAGHoSqkKfzsFRyOPE6wlvHklO2D6XJCuzHhs4DtdbG864MUt-7YY-xnL2PseN9irjTHvy9B1Bp8vF63YOw2k5HPYi7yfiEv4SCX5U9gCeNsNdjROSJIXR9HwaDwSDspiE7w1CUOu_g__Nhfp-Fuk9OJX5Ig1TcOjNlsvtaOkzhVIpV0794Pkkty1aauY0GvOaweQNi1ecyMRhPmst94C-DA9pII2WNRMlXBgfHROpMla4zY746mBw29_rAXwaHvIIGchIYR8U0MVFNrB_NTSFQjUPm3K6hbmcKLdFSXIpVF9gTXSSGOjdPiAr1yheOu5I2zDVGZ8sk5OAahXaw93ioCm7cG_Ygtoz8bYAfqPFYaWxYaTRhMTQdU5Dtbv7xQrv9hwvTR9_Hjx7oIAE7HNorvJz1AH7phF-qESecVsuKZiHeRvrdHZFyoLPGPRd-yVguOLR-yrh9JGN5nft7V7VWeYbpps217hbU3u889IjgsUEUznGtHvyxD_Ob0xzG81WoU3p3I0mpRTU6TtctoIAbWODWxOUhjonEtLMs8qwQNutYnF2YMxpUI2x-ZA6NOG4nqMi-W4Rnfc2uhpfjg4NpCyd1sKVfnjDS-FVGI3r28Cku9Qyj-muMjlo-O5jWUz71Vy07PGoM28HDnvJxv68PW_cIS3uG0b_gocSpm3o70UnjwB8Oym508lwh87dp6e6g5sfPpkkE8veuwgN7LenxhEgrh1T1Qs9K3FccF-lFwpfRyd34aKOOkzcJDjhUEBxoqOBHyUrSUrgrGjqiv4SFHnUFt1p0BV_7KpemY_BBa7BZLmWGu2LrVuyXUNdO-HU06Aq9QQFXxqyDWKbvWJtL_dha1xH7RYB3J1xbJXatNRY7Ut8cN1KdN1asdq118NjaZ7Dkx-HdUaMreq69FTqL0o8IzBmPjxrxNBlud4XjkxOePC1Wj8rY6HnhHwKY0Q2vjukxvNpELI31QrmT56CZOCEFEPP3EjE-RQaVlC0dFCdiMlDL3BcwPuRetUsPXfqD6Tc8Q3-Fvu7SH46Hr18fffMVerdDP40KfYV-R5-j39XH7dj75qk-rcMxBge3upUSPxOTP9aXaSps2DklcwJbZ4QJLUkdWknQxWXM1bQ4ChgPD2ENBId5tINcuiy9yEmNuR3i0irEgRpA4IBROC-2ARX4Ey3eJFrq1V2QzJJ45QkYsSeYOEy8jmAhcLxIE5QBDIog85S-AV0am-6ZU1rueHOh1p_TBkMj1u1aSA1RPJkcJkzCRSmLOgcQ3AMKl57OopY6NzXxqKWO0do-ezQdpcM-CIf9iB526MejVtbz9PUu_dHB9Kv0bpf-gOrXV-kf6X_8iH8bfA2w8m_13rDhPYF_4-VuzRp8t9OxIlQXp1UmbjsL0bbFDnaIWwuUIcBjWVktPb2e_TfG2k8d7MaBxWVCFIXOaLsPvzR4Ob_9dD77fn776fL8p4jEaAL0IsQWaAO-JJhvA3W94oE34B_0qmbgvAgYbikxQ0gvkYQGsXBGVR7hTvi7sO_RnhFADpHdM2MGr1u0gdS9SxAfzWgNUE756UDhisBPAmx3YKq0-Ekf8j3hiM2-zL8AYPTM-PZqQI4B9vmpmWZweCCUXNH-GSySJIxBmASqd2DN9A40qSzg-vzy0_w04hP0YoE4U7ovhY1vORoQzkYAnl3CE-lSWhfALNKTHiPBQ3hnfAEL1EwelmUngq1j3tv5VUyEKEXg5YySOVTaSwV3n2_f_3B1cXbzw9X8lnxx-_3l-fnZ9dnlBZc4S_YSlJ9-IcCsmU2CDfn1XMc9f2rKYSHCy2TICszuMR_CfzOiR69UCRpgvCbhTNvAmV8QLG_ZpFB2A8gTX823QEEDxy9vHdJvAwJtmtvp9NrMkfnb5W2O7h7Cuyy00A2mWE8crtb0TmjczUdw8mfkvzbTdqL-bOx98PseBcLqVj-VR0yXX5AX150oJ1RtkkML8-Z1K-e6QNq-oxBXP5VCr3oBPGOnPAZRO-hPp1MqLMzzzWi0eTMatWMq0Sa18SlHjwK6HCfHLcMvcESxR3Arc3xGx3Ca4d8wqr2ZjvrHh62O5IHN4bSx-13Hte4ZHfnIOxzfHE5Hff45w7_EkTE66RVGcKK05q-Y-WcAQb7NMPHtYgt76XVrvC48wt7B6OD1YHQ8GL_eY1zil97_AQ"><img src="../examples/hexagon-pavilion.svg" width="270" alt="Hexagonal pavilion of six wedge-shaped galleries" /></a><br/>
<b><a href="../examples/hexagon-pavilion.arch">hexagon-pavilion</a></b><br/>
<sub>Six polygon rooms round a circular rotunda:<br/><code>room … polygon</code> meets <code>room circle</code>.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVnbbhs5En3XVxTsh8SIpGnJlzieOIA2UWJjEjmwtbAHg0FEdVerOaFIDcl2WxsEyEfsN-TD8iW7VWS3LvEkmV09WDLVPKwqVp26aBcGYE0FJofclBY8WitShKxCpaSeOZihRis8ZpBbM4eL0RBSM18Yjdq3YaFEihkIncFcWmssZt3WbmsXBg2UdOALBCfmSI_reJCco2uDMyA9uMKUKoMpQmWl96jB6BS7MGlOmsCj1i5M-LgJQRamgoFNi9dCz8CJJR0ifJsl8YV0kEu1OnsulELnWXKFHgHvBH0Ck7d2-ZGF8B6tPmHhYaUilFr6h1UbsjbMxFThHnyAL58-w0eIL6NX5mqDKH1BVgjWepi0kz2QGqR3jPvDr4vrEaTG2Exq4clSC2HFHD1a6TCD6RIqmfmCQdkqQdDrXhteDN-Oz9rQ2wPhoOyB8PDwy6fPewQrNIgss-gc6QLno6vxYPR8CF8-_RvwFu0SZAZSO5nh35N3iqmZo4NJ2es-ldmzCZvCdGTmwKLzwnpYoP17oFI7L3SK7Cd0S-w6wiIYm6HtSJ3hAnWG2jMw3Qvp3F_pHLwS7r4GF2BRKLCYK0y9NPoEMmMsuIr8vg2F1DN05FB_T2iSsyqMQsil75iSvQ6BPgRhOnIuZsiONi4sIvkrRZqY0jO0nSKStKyM9QWJmUk9g1QZh2oZ4uvN-eXlxeX56BW8HZxfXsH4bAj_HJ2Pr7owqXWe1MqtY9dX_sCBqTQYK2dSs4FFa7cJYvYmCp86wD25MLwcXMIdYDZD9piyT48cHiQJeSNy8K029JLjJGlDVciU_HRRekfBbjTv-PLpMz_QhYGiyBOedCQJo_jSQVUID3Pxnq6h4ZPm0wk7N19P2Yc5ogdlUqE6d6cVeLP6p3YfaWEqfGGNmfO9wnvp0wI12FI7mIr0PRjtDUe0K4RFgl4I65dQCaUCuZBz0dv-5onJ-olJF8YFQmq0wz9L1CnSt9p4WfOh8JF3rKkeOPCVgZeXw2GgGMeXPzW-4EcYFegIkoINzzYNFlrChDcxK_YgNxbKXms3CHnAbwmvEhSdI3W0cpYpDDoRCq1NZD6J0c__r1iQL09A5IVK6oyShmZNgliEo01VoEVA5TC4KbnlxcuXV8PxFQwuhzC4PB-fvRmOz5-3YXQxhvGvb89Hr7owYTZzrARxlLViyZA3_Z9u9n-6OWCTCLopLfWstQuunFPWkr7bpIVUaG08zEytg4BJbuwEHrJywsFTLeb4LJxCnkrMTOwhc4m2TTfElgOpPdqFUYJ4YW-TfpTU8YZKbY1S_2VjupIpBXoh9IyOZW1Y_kCqFE2EnHu0FANzc4uO7EdBZSq9MtbVePDq1fASzq841T6_uLh8cT4ajIerOAlU78BJD0dJAnlpfYE2ZBxOd94i-hh5YDS7mnTgCvLYOQrtGjcOhl0F7RJOIQlf9WpHj8tXw_E_Bs9_Cb7NYUGuIJRy4LxUClIjdUp2N7dog-ZMbWwb9pQjIgRnAEVawB-lZt6FzIoqJurCWDIU3lGiMxYs-tJq8jxRecMRUdNA6kuh1BIK4YL5rs9-ZRO-fT0Ykf3GZ-dX_E93q8iRjo-kKoONzHZpLpmZj6V1pb2Vt0iZOxYSxAxVYRzFLZOIxai7wpmkjCo8CPizFJZu2uQhG7A3bMStYAmCJxNNeCsk1VPkv-z_aSE9pr60QtGpIU4DJYesMEWybGE01TUsrvSQWXPLodvaBSWWpvRdeEkqs7gBPpe3eAJK3tL-dRbkvKqR_Eh73gGVjBw0owJqSeHX2g1xjxvMyGpSyMJh9wDmAUPMmO2am5qWUvkujAQVCiYP1jQ268LIsKO0dkELa02FRFdCQ697DPPgcJ70lI5V2MkMci4hgpIKd9jDwmoIOJY-3IwTy1h-Ub4jAqjpIQZf8OEdviBnYELGhwxdauUUodP5wxlNqXRhLOeovDEoVTRNbHPhifB29IrcmO4WnLzziBpKbabO2zKlMlqJKargOk1dnBaYvm-TeZmiK7F03VAckNj5inw02y7utZgbi_D2fDQavgh3NWF02Pny6fMOF0F37eXepN3U1YH8W7vw_OLN24vRcDSOdcBarXlC3Ci1rmWNbGmk9qDke0rzSzB0PsfMin2tlSFYyCGtKWfBd3IqXNuNgUjBjTKDegy_lvkxg4VxkqmBElduEbvwCuuUyVdo5azwpA45EYfsKkCa78hkgRsmvsA5wlSVuLCS-glWajR4M3wB8TvhQlUjYvmWLoU2frkgT1foPQaGrb22zRYnlzU1fOwMJjBVJn1POX9OYS2k7ra49dkZR_a6NNUOfGhBNMB83gLYhcMkhGgvSU6aEGNDhDvvJQkxefq-MWZdYnLaTEPnMclV6YoJeMOgofCh-7SQi5R6iUBDSuiMk1AhVN5hXI3OrbtCtwUwszKDw6QFoJl4ykULIJPEfiUVS7dohVKtFsCWjWlJoQ_9CACcwpMkSdZL5d219LjRJ2a48MXPYLRarjHorWAHC6gxG8Ep58BN1IATEsYJiO286XERqr2tjBmRQylC8v5GhWobwt-jpP78e63ZdQ9O4-O_Jb_Xi_3VYq9Z3F8t9pvFg9XiPoPuwmUocOryplHesWtyOYi5DyW4yUMiDebTobveuj0654bETOp_SLybHjyC6169RMLd9GmpXy-RaDf7tLQfBOt0Op2NXpdX_qdX6zv9dYtukaTgC4ZTOPjKb_jSFOKCywuhszaxHa2GMj5YbqGMb8DOBq9fv4BT6B3fB5Za4xxFgoIp-opYuyYrgndrMo3PruEU-v0kWS0OX1yToBV0wgPNNy8vL0ZjOIWMv3n-C3SCIC1-gitnmZ26ApWihabwgVU89g8T-BBHCQ-r-Dfbo5VsL3SF8HEDrnpHfQ5NBmr-WIMjEvkAD0lkxuIPJNreVyhkjnf6WyhJ3Pmw-haE-z4EPAp2aaBWCx-DrTily-x0ihm37z6aZO3l5L8w3MVd9J2YDv-B2U69qUfRfJysdpYOHUwxowM2TwpGpE21tTZPYleIR9UnCV_srG2CR9DrJUm736MTw1EEW3qppF9unMfeV2sWzLlxXgV30Yuh0exMKLVTK8EAqbRpGTqXDfS64vNfm7xBD966Qn_Ne0IlUcFP0G8fPaktxydG0FhChovahZdcQfI0xeT5GsNSYxVbqabI_DkWmDZDHfZwanZKZrHC0CbiKhQ5uApxEXJFvDTIlTG2yw8FgOw04PN9P044UEIOeXIY2-gQcjzsCVIFVTZALArLgtSG6_UT9rmA1ePBxxoYicz83FrB0BgrO83esdsaDU1UCQ_9_TA58QUQKa0JM8Us6jwxGp7SIc9ox9OFcc8m4ONMRElP2bepl5omhojaLJBTSWhYMhlmaRE2DM5cXctzCrk-fzE-4w4jVotiVfjF5zg7kzQPHKSovUVqh7v3qEtOHtymw4aKDr3Slg3XWGNdd-ELBqwVkNmp4efW7OcI_Eljvl6SJJFSw2yCyEfqd0rehoA6OmQniK-VFGv3d__2fqPFk6SGWJ357e185w0TdLj9TfZ--PQNGz5OarYL2w-3tsd7vahLJspcod7hxkBwGR1SLNfbYZhTn1gXF1zW895C3CKIiLpq9ULfEap50chLHfraM7FNq78P7iHzePrpKfRikt_WODwQKCowZjR1_2tTf2zYJtbA02WsgU9iWbmQGOZtcxSubIbyZBOijQdh5schQtAvB8-HEfJhrKH3Iv-EMQbPtig2OPZWhRYYC2Krig4656XV0pcWmZKCP8T8RdNt_hxkpnGfN_MOV3d8OHWpyL1A4GcKorseufxaUrvvlErYDOiPNVPcOiW0RvEVjmHwI8Lu1zG0BUjtLFqIbwTIjhkQvVkEobcQnyTJ3ZNYIm2bQTipAeLbPXiNlFsSHhzei1elwZXSxqxreNGuAXINj6z5-K8UNrkACH-lXs1K_uKiGO-YLHi8up0rk4ud2kXHGyMUsDJDtzVDOYGJmAn6xWMCGVqaO63ROjdEddcXQeOUqcMTsqaVWU2quTdIhRfKzEpyfnnHKk4t_9xQTz9yYzz3a_e6rJP6PUCd4MO_Uc6N1IezOVXzPUr45LZHlNoa292L7GlWBfEt_ibzA8iP-99Dzq2k9ii-_Tjyce97yKkpaTIM9ftXzuHNYttpjzgIPq51UfVPPJ3_68V4g9XMpP6x7Fu_2jCdlX1IqWt3cNP_8unzTf_RdTMMDl8w9M0BfXnw6Pqg28yCD3jKs4wVG3F1rsTs57VpMlUmG_33A9fUepwIfuDHypteu27v97Z29Jsdyd7aT32xeeXV-tevrZ372zv3w879vzzrYFu6g7DjgM462DyLph_SK4x5bWHNH5h62KHhaydMlMPkJzA2j5_fTZewU_-GHdcpm-z0k_5RJznu9I522HM-tv4D"><img src="../examples/terrace-row.svg" width="270" alt="A terrace of four mirrored houses" /></a><br/>
<b><a href="../examples/terrace-row.arch">terrace-row</a></b><br/>
<sub>One <code>component</code>, <code>place</code>d four times —<br/>mirrored in pairs, widths from a <code>let</code> array.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVrrbhs5sv7vpyg4WIy9I2lbkiXbmdkAHluYGCc32M7kLA4OLKq7Ws011dSQ7EjK7CzOQ-wT7pMcVJF9k3zLZPMjlmzyq2Ldq8gXcAb_HEWwhuEAFrAsZkrGoOTMCLMBYXSRJyAgliYulDBgUCQyn4PRegH__r9_gcsQrl9PJjfds3cX3Zuzn95MrgHXYrFU2Nt7sfcC-j04_3j1y-QCfp68fzu5ufpbD24ybENJCwISUyxegoAp_4poKpxCqg1TSZXWBgTxs_cCAGC6EkpNQacwFSaeAiZztNVyzGOlbWGww1-XQhqYBsbsX8SvhTCyWPSEibMpyNwZnRQx2p7HJgaJHWLs8t31-dXlT5MLkDlj9cewpv8WEGPujFAwE5sOWA3S0QYn8jnmDpwGoRSkujC0wiMT05aPgZ_RbKrFSy1z5-XgMoM20yr5wR-c9sfa5GjALkWeGFSWSCkUn9F62IN_9o9gMQAUcXYIM1Q6nxMDufYCJoKxMGZDv7FxhkmhEIxeeWV4YRP5lZHOYQ4iAE8uf359A8LEFoxwGZJ0hZeDW2mwuJB-s-Xf2UwsEXLExHYgQSVnaIRDtXnJfxa5UBsrA_bcyARmmMk8gWmCNjZyhtDt_t3qfPqdhWmwOyd1PgUjrEMjLZKMSIwwQ7dCzEE6C79Mrm4uzyfXHQ9t9Q57SmxAwDITuSPzyrRJwDoj5DxzIGKjrT9CJS-DS20c_24l1B047bGlA-FgtGa6zhQICvO5y3owYaw7xKUN6vVkZG5lgl6bIkZCsE7kCZtrh4h5ZFpwcXX26fLdz6QLmWDuZCwUoGTRr8SGvc5jeyi2GGJCmLhDjIl8A1-0Xnj3G_Tg5vXE-2gPpkuxRANnA1BEPhZLnML3MLWxUAj9l4MomkIq11jyL_JcO1YAQ4OVXxDevwteUgLTAR2KhJxRQGpEzDv42yiCBcwKqcjb-axErjJAvbDMgcI55snUA6dSKRbGQpi5zHvwk3YZODEjPQqDkBZKbSBBIz9j0oFcu0x6g491nsp5YdAbnIcFJa0LRqdztntYsjyVgky4OIO3ZzeTq8uzN1BYTOBgGus8NugaAchmqJSPJgmmolDktDE7qKnVtxTGSTq9PeSzEjkitVQixoRk6wqDcH52M_n5_dXfyJscZIK0uFQiB7tZzLRiLa_iDsyElXmw6Tvp4gzzWyvzuw7Eusgdmg6kRiZz7IB1-jP24KMl__P2Qgywp5LkINYLtKALB7hYuo23j6G3j8l_f3hzeX5542M1nJ-9edN9__HmmrTug5B2pE_-LBX2YJrIBRiRyMLCjyTIy-QVWJwvKJr9mL8KqmR909JEigU6NPAjKf0yeTUFJ-4Qfnp_8xrmqBfo2N4ScLh2kBq98IFcIUO6DDeQiwWdNDji1UkURdUhORgjm0dOxgsG3WaJiWfVgiicnoJQlHg2YDe5y5DM2bKOrkhLHvbi8vrm8t05Rz04SDAplkrGwmECs00g870_OUd9l0kLSK7fpR0hllpHRjxHx_iHtTTYIjLJVlEnVq0XHUow3u0WOkGYFc4nOTtle2BSaEPgdcKxYNghQm7JgrZshuhgpQuVBD587F9Jl7WkYVdsU-S4aaeU5AZibV3pVCW0VBjymy4dkkT9BY3u6jS16Fg6mjJi7Dq0I85oOa5F7NQGVtmmMsyYUoiRy5DJP91eXL69vXx3fXkxmYI25W_e_zK5enP2YUpVQZMQ2ZOl6Pv-nT-0dLBAQeneerO-QHLESj4w_aJznFqWY4KxEobjBtuJzFM0hpyTbG6pLftvp86ZFFqI_N6L0lBlTKlFUHS2PtBc_8Ihe7Zx2K3jNgmcHM5luOjBmY9qGxBJQouZKfs__zsFne-92E2BlWnbYua0EwrmRhdLYieUIpyrymja2-MIsn8VKqsr-uMbX8vtw297AEVOQlss9gBewJTT7yiacvyEfhS93IpgLLlBFJGFx3c1NxQIYRhFbP2ijGkMGsLcNFWFzaYg5oJSQ2Mb5x2gdAK9Xm8UQay1SWQuHMLBcEAO3YX-KDrswZkvEHTKyP2I1pJFE7e4XhrkhC2cT4TEXbD4XCxDoPLBdibiO6rxdJnLVW8vVB-jaA9gNynuATRS4h5Aro3LoFjuAVTuQ9UdL2wmsz0IOWePue52u12qMorYcU7yQpA5TBeCqhmhoMo0nabog4LbmabL__Z8FQky-auHwzVBcZqS8V1OchlGEexQgN_gIOpEh3AwiqKo-YkFf0h_DZ-oeEb43R_ipiz2ljL38rMvYYXWwYrs7B_NOhj-ASjCX3oNTle3vKE6YYNXsrDf4KB_XPLkPwVOfm-BMPYjIMNhCeI_VSDVQWZi850FX-7xUaq4Fyr-3DthUpWXZRHfPo7B9NbC0wc68ZL17Jzcc6RMKHWbPw00OGoihW_hYBPOGp_ROFxz9b_iwjD3wZdNvTuKQpMhXMicHO8OBmQCnf6Y8Sg-Hp1E0V_GR1EE0jK6gGH3qDviiE2ZjTwjaaQkn_x8k-ANJ5SkPhX24JNQd2V8pfWTs-sbHy6YoaahT-N4NQVT5NbbUfdV8L3uK29y3VdgdeGyMsMsC-fr9qptCkw7GIz-BAe8-7ADo-hPcEAIvi47pr8x0GFZ15BKvrNw9fHdDyQ6zuWUzuSscEgdVwA2cSj44erPLkMngCOLcMR2lVSc9cV_22rYxB5U9R63cl7BXiH8G65DBqcnUdQ5HZOWyrqLtNhYMapN7IEV0eAJDG9qwRgewRiQ_R0-xkcw0PtX8Fkew2jKYGtFMHmuQCjK2FDcCBjCAoS0CkHnlUOTs_vKUMmci0dukmGBVJr5Xk6UbfhWxGKwx30z6vSPRlEdtcK33-8Dsk8AHbeAjkeVg9dIsUjxFuHRuHN0VMZA_-lelvAZZwtKCOfzmeIxMPsMsOMW2PE9YNaJ9KnQ2oqBAayKiE0wpWezzfPAjltgx_eAreIVy_5RsNMmmP92byZbxYsnwY5GTTD_rZ3RuL4Qayyr0JurMx7YlCUH14xUROVq8wNN8grzGb-zpUtJDmtU0mBuiYVQXxBiCEdrcpCoA94qwQsLvGUBC4uXbcplxCWt5h8Dv2wQ9g5aHsy8c9HU8YWtb7CSqnQP9c4z_u0BfOG-yg8w9z_wz_1wBD9iTP5qONcCBxm3lVZ5sMHxZs25EZSYoYL9CVU2eYzwWii1z3tpRGCBYsoGMl8DNmmUg82yESRSrRzbCGcllWbJvt_ccTygHUzwHlJxJlVikGczdQDh-Rcfhw64Zo2UhM7Dju9s3RkwupKfqdlr4_u4FcRV-f4W_rAprk-Uos9oV5BVKa7GKG_7ECLFSidV_VYT6e8eQqQN-AaRROa7h8DmIVoh7aFDTMRXH4LjTPsQLcO6R1Ln8IY27W8f4mEiq_h2tSWpEBuYCBvviGk0iHzSC8x3iKziXexFjX36POy3beQmNvs4-6R1Ir6zsH_NP3d9Mvzdm9gT5vt-iTmUQLTjhMJM3xcSTNw6bcQcd3wybXv9Ix5_hSkaJJcvCW0Bt46WpnyyNL33YGnatrvjbbsbjxqUGQc-aXNnOA4wXZ2mMt4-TxgFMnSV7ivBjWu5NV0G_svv2i8VFVC2sGmI4ALbrQTE2KNdQ_jAG3zoqoygcFJJt9mK9nWN_vzYfm-0f9G6omncuHBtR30oZ1rh_LiN2owwrahYoIRpkGevTsMMIS4cI7vM6GKe-ckkzRZsddVFtWk1BinvDnxOJ-pFnIXFYWbs23bfXzC2xViHGaAfzIV7gLLd19qsxKYHEzoGX1pV3ZyfG24sD5b0EvPQYYePpDzN_QWVOzqH0GywIqnbAVjJxGU0Goi2t4Ue1G8LX-iOI3p8G1PLd6gNnqAWWme_LXx5LrXVDrXmNgoE29uo57vtj_02biF5G3t-c1tlVYbWhJ4wFBRGFw5J2KQggk1uF0LmjUwdyrIaz5uFH9DYlZ_ZOQ2-BrlX_lU2rzklYZ7UfD6ouir98FZunFkPo_qI4wf04KNvubWkesQe_rBQ_bbbkFr91rKjCDp5mOXyoLdVs9ZokZ7eTS1QmdPLAzdIjx4Vl-8uyu3N3Uz6ZHSPUfi4TH5v0XyWsfdTG65OKbKW8dhf_Qny-zuaU5O16NSbkqdp-U5WofBTTes7WDYN38DG2hiZhGtBrs71Km8RBl2OMlnRG-GHDLVpltwELnZE1D-qTYqqK7CKricNRbMWEIu6RGOY0H-2lOQhmiZeJ5YaqzwBuUzo_oYNl-kP7nMZXbQZ8trz1s78lM0iW_vWoZoc8ZYWlC-mGKRsEkk0o9rud1FozzbIYhfk-CmQRQvEJ9wdToa1kk4JrwXCexqJda7EF_pz95v-UYMq80SvWEvjRl0RGPGGU2mpvZ5UWG14xvpBf2f98NH1p1-3fsjF4fP5iTq-P3suftXQ1esHj68PLcEz-QleEo0aXjJ-cv2guf5R_seNvPV8_bYS3eP6jXbWP66vr10_3lm_FUXa648GT66vHYpm6VxpNdqxDvAzjtnG_ww1G88UHqtUz8DKfK6wSy0EbsI9P1d_iRErCzMaZfqLf_sD3X1e35xdXt1-fPf27Ob89eRi6l95LArlZABh4F8LtP5pRp6EsXMqDY0K0HC1Yh1VkHRP5Br1CrvFYNxoRY6iaM3tQiKNv-RChZ-F8xFKybSxfRjx9pO6JRgMomhN_zXEl0rXpYvPb45HL6CcjYTnH6Z8SVMOd_mFDc12bYefRPHa-j3AjK9xFQpTveRYZpKRY6EUc1mW9Fz9VA0CSTAtTC75EtG_ofBxiyRAI-zD0HCFRnV3nsOb9h_CiXzzOqgkefotOCdH34rD5xpEJxXOU-ciILIRcoWo1xuFFrgGJ69Kq2DQ8en1e5DwZ2gcm1PdelyTCY03N49tEkePkOif1Ojk5R1273qA4dvW7S7_PirDHSoNKdVEwqjztPYkOuV60CBzUwr8mWCD4deCtUXcBjupwYahb6-adhn7u3Gt75f0rjITtHc-BBw1BO312qBEOYomKiWlC7R3-8-HGgyiJ6G-Rl_3UNjitT9-tr52wcbPAeMRSENlOhXlOGrgByyjOphQkbA-bTqDNhuYYR5n-w_C9E84t0WNqLwNg8LJfP4whC_HvhoivEOrnnpwNq2GCOHBDtcJjEmf1sc15iT_tZBGot0nXVbdcY3fHEf1feo6jZoRitHu3_sAb6GJCbwNH-TtGg3dqwfOaJfPcOfCCaXnRf2ez_KTV-rspoQ0fVk9mlsaHj35K-6ly6p2kHmpXq6U8yF6l-zQdF1h_MMDerRXX5z7oVb54K1k46FEFaZ3jSAwbiv0g8Hl_qObj8Zfsbn5QLEt89DThdeB_VL0HLFYuHXHuKs9P5Z-Bhxx-DCcfycJz4cbDR6D4-eW8BVw45NtuBbeKn4CaFAC9TmLMlJoSP8QyjD6T6AcPcwLv13d9j0eWZTqP4m-YfNpm_IfPMCoibL4gyDH0X8A5ORhTu4Vhr-NLvUQfcPmQZtyc1yP9NJOyVg6f3Vc1cwWDiz6QjwLL7_Lt8GHsFPFN94Kh9Ftefwo_LV6HlxdoBIfTjqFIbkvjf47xu6B9428hNqp_Ha2gf0zE2dvhM9VAAm9LtwfRINxNzrp9sc-J_--9_8"><img src="../examples/library.svg" width="270" alt="Public library on an A2 sheet at 1:200" /></a><br/>
<b><a href="../examples/library.arch">library</a></b><br/>
<sub>A public building on a real sheet:<br/>A2 at 1:200, axes, schedule and legend.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVprchu5Ef7PU3RRP1ZKSO7wTSlrV8mysquK1nHZclypVIoEZ0ANVhhgFsCI5CauyiFyhhwsJ0m6geEMH6KsTfSHGhL9daMb_cScwCWcR7CCQQQZZNwZDbFWsS6M5WBzKRzM1yCchXvmOEihOPz7H_8El3J4c_N9-_2nN7c3V-03n25u3968-x74imW55J3GSeME_qg4LFjsQJt7poTlluiWqZYccsnUBTBwhikrHKRMShAW3FLDvBAyEeoe1zMHNmWGAwOj9aIDdylvnMCnd-8vb96CFQlHKusM564FTCXA1ForDhlbg3X4hVDw332g2DbVuW3B5yvbAifiB-4gY3EqFLcEDAjaONnA5pK5hTaZB0bhtZJrWLI1sNhoa0nilFfa6cBHTd8khi2FuscFDKxQ9xLF7kcRZBnkzDjhhFYtmC2nSDxrgSmUQgqkXhRSomUyWIrEpS1YCpeCQvXPdM5x3cxCXqg45bjBxgl4UzGYLbSZgdQ6vwAu7lMHE88U2VjaCKqn2_PfLnGrTFjJO_BOuxQl4NJy-EkLRZtrnJBRUiYfud1Y33DHhETFi3yjHcvNo4g50M7n2qVgnc4h4SwB5rw1l0xKfz7uUsM5EEtkJGx5fEqt2lQvY2Y5LLS5IBKA2S9a8RnQH67JmUjgWyhU-KcUwR9eYeHt9dXt5Yfrty1Q_JEbEGrBjeEJLIzOCLL-l2tLhunAjSMbWlBBK6fI7uOfvkfQ-drxtki4ciJmkqyjCwfCnbVgXrigtu0_o3UGFg1WSA73Rhe59d7lrcvAFnOnHZOQcwO4T3_uZgm3sRFzDu32T1ar2T40z7Vx1ivH_uWvM3_aNTRTvYSsiNNSQQuptQn6Nbzpj6fhLGnhPkmGrOMVTaadbRS90IUprV4oDAnolXiU5lLHD56eFqVMJe1cspgntGnbgWtGIgj3jd0TXi8WlrvS5qUX2CIDvQg-999zN-cLbTgI18J9xSlT97iMkU9_YyHhuUv3sDONZxbtvib2MOdSL1HlqFhVO-9-09zGTDKnjQWYbR7g3__4FyTCQJH_PdFLNfNm4ZI_4s-zjSZsyhYOOIvTFh0e5S176DTEKX80WtmN73x6_-3bd8CM0csO_FFtokbbOm34mgImLsSoJqQkfCTeQ_Y_67l1pogdxMLEhWR4qH8Hs8_Tj3eXNx-mn979eHl39cP125k_AlkhnShZ_Vxwi-v3oElp5EULYbgFPEMdeIOOrkhy4CqxaDemKl2SerhyRnBbej6HWMsiU-UpIhV0e5CBF7swTMK9EV43M7bidgbzYj6X3IJiGW-BxPM8X4eAhwdeK9SzdczxjCtHbmT00h9NioWcK4i1NolQGA07DdJq8y4koR-YlE34WwPCCc-yBsAJzEiQYTS7qCK3FxyDqEtF_FCFwJRLCYMoonPKYCFWrjCU79Af2D0TyjpgBLxgMQfJSGdo8U6nM4xqAgKDbhR5PcS6kInfySo33NpOAyAI1gDIGe72sufhYpbzBgBagEP3ohfhEqWNS6HIGwCJyCywwmlgUtLCEJbIXxsNAMkdvLn8M7yiTBGR-U_qxpmzdZUW2UpYEiZQfn95d42kg0B6AuvSmzepskEqaLfb7aC0EqwqNdov-msAJRcQySsPyFeOG6GNN5Hi1qJhIGP4NZNU6hjuOPwNTqNWdAan51EU1f9D-fFp818steXwpcbK5-_qYNSYYbYnaFTHBtM_fKltP8RmrDouthPr6ZJbd3Y4v55yhr8d2v5y6lGmh-XqebnIsKVs_iHscnt_pnsMJWr1oiEpyUOEpx2I3jMQ46gOMT4kRf84RL9flyI8kZYrDNTbdHkMZzyq6cQ_HNQJIR3V7qRm7PBwGCleTi08j9TrehWd1592obKvg5psQU0OQrGvgur36lDhaRvKOrZYTO1XYI22sEbRxoIY_iksA6ywkIxaPiq1oDegD1rcgsGEPkYEAGO_hOCIdl3SeiI6Zi0YhN_rHklh8IXh52BAOoHf79VNlLg4urSmDywpfGfErQOe3PML32fwqmqCt9fv734AYQlzaYRzXG2XQr4A0flLip5NlYdFAEG_v7181769_tP1ra_rKLEKBzFTmHsUiigUNUisLMZPr6cf7z7cvJ--u_54d1bWnrijB6Htg0-VWAQhAxSTil8f0crEI4V1lAVRQ3qpWsAWjhta5KhRQF4J1nnMOEzvlAB9mCQNMleF2nuWQ-R7p5C__OmhGlwkr8wUNdUFK37hMBpGEUg25xKaf0CBoduEAttVvViImB-g7D1F2XuOsv8UZf85ysFTlINdSjrJqC7fHTXfM5E09zRAv3mlRWcem1xl5bN2YIG0cFXOBAInatZrheUWz5DNmp_oc59v-B051zOQ3xyyXvVGNQE8zPMi7HCRej4nf98K6cRkn8ctLm5uylxisL29OvQyni6BoOsxnqC7pMBxDfrzFXzWGVfNGvQy3kfM6oghuj8N-eMG8GlEtoU42UWsG_kyjrm1Yi45fL5q1iArq5alR_MNix-wlkt1gcbY8yuM9lBnHZLCE6w_0voPWmfNcjMHPSDWyhkt67ijY7hXYb1HPuAfIdL_LwXnTqSfaQXfYd57jVJ-l2v7egaOPeDUBW5v7q4_XN5uBgyhPbjnihvmsFMuFKrVT2mKMCwjXDa3WhaOxiAZBl_HWXLhpx9aKGqdQwdFO0ERvrEQY8vFaVvzNda6vnj35_kETtfwiur0szBloIwdplHUYvmGPNXWdeCaJkk0T2Mm8VK28PeQuaopUgNQThA4dos6nUk4IWFqRfbro7XgtyDgN5TAW16OEK9xXFWThexV0Yvklabvp8RTq7AMgQfnWE9UUX_HzAZzV-hCjEaF_gozJzQ_SV4l04wJn3QGw1px57nTSaRN-E7E-lmgchrKANjY3ZTPSLShTfXOHPR7wwgCLCrrEFlvn-x8_DxZf5-sO0J2x8kG-2S93nibbJeOwvFUecpQhqPFqD_0dP1on50ns7tkPUrp2-wqw1B8rii8FocVIwwW2xZBil2IbBeii43NMYhsF4LtQYwqubvdAxDMH9mtGBtCSK5pXo0MLA7OB5CBT3I0wPm54EWYFyoucLoHkrOFH4MvOc8JmDgJh3WfFAmfYdSxwKQOc-cQOpxhj9xYJuHUDw2cBqsLl9LE54xiFxWnOVNcEnJiBFadxIAKOy2FD2pz7pY8xAkcJNMOwDCS0aWMnIhBrI3iprOlwzKZhL3vaLMXVdo8R2XilsBgpNpCKVPHEyiDQyiSL9y-KFMMqb6qCE3KZFg5PY3U95xeF64Wh-4l-wW__T80FleFcUyoNnGcs_UmCfhy2V-J4IiJJRirQ88AzIYFZPqaGQjU8keuaEy2GaPh-JZ6CZ9QatmGtnk00-xmg0HIBkuhEr30NeCwlgx847bR6GgnjIYpFIbPNrUg_nT6Pe4CY6M3rrBHNUv1D-GG3gTHaNS2tHw_tgH_srOX_oG9TCp-51Vz-fR2ToJbeSaBY0hRqFSm4r19DQf_IxOcGx1gQl17XX3j6EmNbS_1vvDC5d3x065zaH1v8LL1_UFNnu5we33lkI_c-DucWr0fOnIfyMo7wKPjgEbt6gDjBbfxdNOUDrokT61aHUTRCqWkSwVcd4i-yEMZPRgcpaeBbnkXAUgtxcJNUW5_XjBv1ckx4q3KtFlOYMNgl0YPfGeG7kf1OEqHZ-NS3UNGwUMCPQqDI2V_dN9c_rkF40qqSRStJmEQsw0z3IfpeYA6VO8JrNoemRKOmXU5k_91Ax5f6pdzfDpT34nkdXmN9V2WvZ5BXjhfPeeCx_wbC1fX7-4-XG8uQROBpXTMq9Tr5zpMyt_562O8zkJMf_fGYk7VNvxcMOO4abvCKEr2p6gpBjFzTOr7Au81_e7ONqgLrV1usFGge3S8O-KYrRPK40pvXTjQhAi760W7GtMJu0kfdOXzRFRfFEYJuu1YxrCloXLMGZRE7uhtR_8KVRVhz8Fkz8Nk5SHaAM2ZxWJ9G4vahhJrQqmiLsiLqCfDl1FvqWOLdfZC4snwSeJlTJd2u8RsR4MlMfsazjXi_jZx5WjVKyQL4dp4Mf6rHe1u-y0NmFNlXBaZm3a3rEhqNyk0hpx5UWfl7XLpd76v3ip7N_F-y2NDb4xRZUZ3dGrj-zO_lG7PbQ1w5Z23Vc5AR5DBnKkHsDlTFrrjdq8PGeFSP22p7Ky7emfLELEuFE5CD52_YAlfCfsJWuRzQzkH2VFg0xsstKAvZDP61Wz8lS-ztox7CbcPYHHW-1OBQ-9aSUJ9PbJtQSw5M_i9H2b7Pj_PjWZxuq0kwgv5ckhTxa4v-KqJH9UM5cBrI0nTN1wc36Sx_nUVm2pTFUhlWv4Ws2qYiZ-u4PUroLxenrzNuTt7PjrOkdveJMRfYYSypUrU40pqkrL5JFi9-vRgQ8J6BuzLviJpyNarVVGE0N-x-VtuH4KhqTs6ijP5KpzQqtViiaTBk9NFnF5U76GU9wrhXvTzVWiFlxzfJsCWZiksxjAThjxbsmENuPAq8ydlENUm4Kt-bTqZcvko1H25TRzRbEHh-wMuQPUIa7zBGkXRalSGyH3SHSl6vfMXSNE7KkUPZ65PSdE7KsX5S3TRPy7F-RFd9I9J0R--RBeDo1L0R0d0MWg0DvvSeDypeg4fQ4YhhBAxHbcn-I4nk-oenGiHUbSiAVSNtgHghJM8RIfc6J947KD5I72FeYOxmK72fCKrUqrkj1z6IECvGE3na2hemji9Zeo-fI9xstmLeqN2NGl3R97LvzT-Aw"><img src="../examples/transit-hall.svg" width="270" alt="Station concourse on an A2 sheet at 1:200" /></a><br/>
<b><a href="../examples/transit-hall.arch">transit-hall</a></b><br/>
<sub>A concourse: paid and unpaid sides,<br/>a generated run of gates and kiosks.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVprcuNIcv7PU2RIMTGUg2KDICGKvZ6O0HSrexSekRxs9Y4dG2uxCCSFaoFV2KqCSK49jjnEnsG_HT7CHmVO4siswoN6zfTu6kc3QVR9qHx_meAhnMF_n0SwhUkEayirZSFTEH-qhJHVGn75-S_gcoS3n-a_P393_OH86ofz6_m_w6oQtzaXJfTvR8N4cjTsHfYO4fwezc7lUt0CFhZBKsCtWJcF2lcgLRhMnSykQmEGsMRUVBahUk4WwDD8qEKo20rcImyEHcKZ6h22x5GWlywrWWT0FLcrEVwuHN25vLp-DdJZSFE5g6XEFOl7AemukCozMhUFOKHuYKer3iFsRHEHwuhKZQMQKuPNQQMro5WjUyz1xg7hOpcWykKQQGhSadHCUrsc0srcI6y0WVuC6B2C0h0N1GdTuHnNKgIQJoX-drA7AiMyWVmYwx_SzX-l6eaP8Ie1-KzNH2lVUDn8ePb993D-7sP5gM60ZvlLg_dSVxbu0TjcgtOM_Nv-HImiFYIotLol7UiTFgh61RxoCO9wJaqCjv5FyAhrqbRhGV1lFOlhkaabBQgLmREbNWQ8o_W6fq5w0E-3g7SrEP8n4O3F_O2n78_m8P77q6v5EC6cBWFQkErXKGxlMCMXS12x-4KD9ks5_4_4aAAK79G0enVoLRaFcFIr_uLWyOwLcMmHRPZZpKjSHRRih8ZCZdFHx_VGA7uGBafBoMhAr1b8HFKNVLdD6I-O4DpH71YZrESKLDFczz-dk1oth-TH33-AxdmidwipXq-FyuwA3v3be1iczd8uAJWTTqJfajU_wWhXqUwEiQut7yyjO8zIAkLt4M9ar8k8_fgIFpkkh66cXkAqlNIO0lxIRe5CRxsQrnSQyTUqK7Wy4SmVyhohc4rhHXz49tV17xCSaBRNINNoX4NQsJgvoECRoYESDWTSOqlSx67DeoRFmUt6elEc68qBSI22HpU8pyqE6R2yJw1gk8sCffbg7OIPa8E6sYNgS-uMkLe5I7FFhhY2ORretIMlUix4M11YW2FGu85iUs3odRxFA_9cre5JuVqJgsWiSLSonPeYFXl-nUDaHJVzEFn5ZxzARrrch7C2kjbRCrFF--iU1pkqdZURBXshaFXshj1OQQffCbPUlYGzkBcP4D97AJWi_LVe98DvGEVRD6AUpN6zmPJqZlNRYg_ApqJAL1kPQGnjcqjKHkBjdhBFwQtzzKoCWc-21wM4hOPj42OwORbFa3C5wSdUSwakFBPcmD4eP_VHeIxJPm915fJjFNZBqo1Cw-m-MopclNI4SevQdBLWfBRHUQRGuBwNJVsFa-koKfzy818Y2LXB9DCzr0Tq7YOQe4UOYUG5qqxc8DMuJLVp5hcfvrsGvfK4RtxjAX3v5EVBZ6V6ghn0T6IoigbxaRRFR3D8BvoT-jiY0NdHA8hRsGN4eTdo3RF7cJozcqhxUlmZsZDdijeo49lrmqsTXH26_vFs_m4IHzeipKh0us66HI3IuFasEdxGA6qs1FI5C7fyHmvHTsU9NnpX1qHIhj0IsmXfsL0Btw6N1KRqmd4ptBbGUcTeB9CPBtGR_-Q1sH_l9cHfcAnsKqXO_N6c6abG83f5Ki20JUF-6jghH_1BbX_N3raqiqL2E5_eNxosrmWdOnwufeSEhhmDIv3R8xbHQh3TaanAkx-UlSm1xdeUB2lBFggAWd9I51CRq3It2WgGzUVxj5asIm0wM9whlhYoE-8As1v82tYKuJdWLgtmTs6HhElxCN8S1RA-WzFqFuozm7lxigeOyKF0_MY7Gn0gX6P_fcAfv-EVgz0vWVDuxsWrhaWCtCD_E5BpbUh66bhsWRC3lF4dXH93dg2ZZF6nFTtrJy6cULeoHOMK5wud1mYjdkeDumqTuqSDja4KzrmiTSamUsO9BBHsSQHikcnRa_fVlbFMJigJeonZy6E_9u4Xs6OxrLoRl_Kp83QkbPW62dt64uPW6loVwgFKTjmcVP25DYqCMRltSZVQmB0_MNVKYUpJhbywpKLeja26NpfCOBm4Rx1ecRteYw6Y0WQ_jFiu8G3tRbSwXdHd92BFN5geVZ5ncvbLfx2xGqvcqOdFoygPpunHo46hfnoaKX4JajzrANRp5yU4-_LBxlEXKVw1SC9s9ZI8L9OvykBb96T57U898Wf2u08eCb_SOzQ3mxdxuuKGq0n0DBK-hDTZQ5rsI7Wux-Tib_G2R2Rij7g2dbzMZcsjry59JpJijQ4NMTujq9u8W_GJOPtULQNPZHCmfBtBpVM6juyGQ_qoV1RjQy6j_LCRFmGJQ_hB39dc4_Lsh_NQ5H1mrFyuzdcWPuulz5upXpeyQBPIusFCp8IRrWr5NiWxtbgLz_XMsxBLLDhRBeoTGj1qXaViGrXUdcX3ghJd9qR0wbvhl5__B4RbUHpi5DY93Zhux-Yz4-Ok4g8BB1cpCgVzv_WguyVKaEtFHXTuSWbzIMRVaKScZxNNZ0XsGdi_txwQ9WPmtOWDKAo0uwNayLiFJG13kO-wKFvkJsReQv4X2vJeG7SOgZ9B9gWkRm7ivkEekVK2FIZQI7-XhTPcMXhgj1zRZMTtmmJHpcLHRV1smQfqDWZPMOWVLgq9adluO14RviZhSjXTN0mm9tG0EHINq4Jq2tWn648X78732OZrDyhWxFDCFl2Fik4hvv7r_3nfW1JkjU5mQziDBeum1MXuVqumfXTkrNT3CZMumPWEHtLW_Jz4bs2ABVV_4hM04ZDUBIewFSYdBOY0HSZ__d8BWCXKEjOQaiNMXdyp-YH1mhshJhFwoWxq5JIXdvXkQVHQObnJAjQUTCsjPKmpFPWo_dHJ6ZAFrscGjKrv0Qw9OWk4CIOkhSxtfeKvLayksQ5iWLPUFJVhdkMNMUgXDulAFETmxB363d44dV-NgeKykQT1rW6DqMIMoVrXVI5ztCWX3Hrf9plGZcC-TxrWJapH_Klu66Vtv_NTFzJY5xj8sE4S4-YimIzt0hiuNVBoU3xecnLdPM2nOVSOxiXtGMHwPKKOB06t1M83ySzYcUliUQO_aU42CHlZEpnRmm6vdMjTpLbPWirMujmutV7w22d5yX6VjU9nnYspX8Q1P-vHJ_zFib9LqwbTsDQZ0UW4MxlH0eB07C_GJ1E0mI3ChU-ZUQtJMINRNPP36VCD0ai-4tXx3tUk6l4lo-6-k9FD3Onec0-jzpFGp7POaUezaUeQOJp0ZGQN7akgHk06GooJuFFerdc9mt4fj0bdq3jU7AtkeDzq4I4n7XPpatY50ziZds47Ppl0ZBlPWzkD7nTS0cN4etroqSHSyd5V0G-4imfdfWyXPdxo77mBF_kzBZP74wZn8JIEN_FCTqMHOgju5VXEzldr7wkm-AJFftyrQz-ZnXb4W_2JV4Zi9rYOnG6Nj5NZU-NDw02ptBNvzB3bstmlib4g0-ctK6h-0rlyRqgU4T3tPQhlk2jMrgNsc112OUQAbSv9Y-CPuS4PumNcBtarlUyxmyLEqpMd9pntvp6SGdlzPPKGSU753jjcOyXLjCeTRuPJlL9JvH8mJ3x14iMkmfDeabgaJ3R1GnDZ4OOZt3gS8T32co87YUuPZ97j9qYte0x8z5pihQde_kzSbLJD0qlg8Fz37ybpjMkjjbrzpa7agpUNO-fiPISFVs0a4eCfy9S9WfB4w7YDj-UO5p8uGbRAdetypu9CcfebauWMXFaOq6zl78Kq-T-5HJ0Y0Bsbz0NybbJ6aB4nXzERYdx68himcTTV9jWqeXVAJ_maB87G1cOO87OP136S4CnC3tDG07JK2WZM00xl6jEN07xB5zAEujef8BNjsVr5uYRUzlP_lmL6icc0-aqeJ7mc2QdvDRNRP94JryKagD6i-uhhs2-yG6PdDRGkrj3oWBuZuZwHd4-W2wfLp-3y0yjqNaV9TS8WsA5v2czCwxswP-oc8Cw--aq2AQ8kaXBWqfZVEJnDU0hX26Jt5ZpZzf6cnVVC5vud7xWFZDuHkfAxT2E3UmV6YxnaUw3y1QBFLiWdxWLFbFIaKIWibo3fr3UGYTU7kwY-i_XSD_1Esa9nVkabSkPEerXFkyjyPu_HsTyjA0mJ1Z-QIDY3wqQjOpxfJBxMprXiY88FH6yO91Yn0YPVh3Cp64GzfwtEXNnJ9I6iLOQFPwRrXw4tCqncAgyW2hB_FCk7HsP1f7y5-tfzy4vLDzeXV9c37y5-OL_8eHF1ef7uKLwO9hy06XYxoyjPhco4kixTdv9CMWQMz8ZDihqwfond8v99vVpZdEBDPDKBdcJ5MujFbA3FL5-aUe7QvxChhM6pltR_dPymn1CWHYx9I1tjg8OtgwNS2UGzL_HpOw776MNgnJy-sC9YhhxgFIbo4ZTkDx3j769NvmBtQ1p-w9qTbpv_9PoeNC4gs2_0DVfgTlVPnnTgMIZ6uJmLLG2e_PpmfLjZk4o2dsbd2Jk0x-6M_x4i8ATC6z5padJDuTvjyIcAPGjg889-G0DcqbAr6XhC9Q8ZhH2LKs3RgqnnTp1EzI0lvUD8UyUyw_OstKDXpiG3psJkkt5xcl32IRsnX72iBM7151VdSJqW64g6f0oJ6CBDe0cJ0tYtGhtm_z0DG_oWqSLDCjfgxLKgZvEOS-cLYH2WMBxoRx4hE9UtnvU9MqMqYQz9XqMHsKKfH_AUe0ma8G4xmSTRYJYkxAj9eCaOou0kieikzZzrmd1xkvzdu0enk6TmuF-y25_813fvbWc7BIbN7V8goc1ganvasuDr1nYHhMk224Oj1G8C3IQz2Thu4JIo2iY05DKas-ssehokzMtYJm6CxnF7pmkUbacE0mzd28s-4qNr_HArpagt_dPIQ4tZEnK153Cm_yAcf54k-ZtwvE4Yh2cL49MW58RPDwGanW2-ePgbAj8X-ng9P-M31U_9ggCeyRZn4T1mLvjtZyZctebhcD2jSYUx9JMSpRX-jqMuDH2l59VNqabY4x80-LdWW5Iraj_W06hwye1oe8nlhi937T7-GMd7d8b7CydR_T7rp97_Aw"><img src="../examples/aquarium.svg" width="270" alt="Aquarium with a curved drum on an A2 sheet" /></a><br/>
<b><a href="../examples/aquarium.arch">aquarium</a></b><br/>
<sub>True arcs, a circular room, and exact<br/>πR² areas — never faceted at any zoom.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVltbxs3Ev6uXzGwgUPcWM7qXTaaAxw3lwZIk0PjIuinmtodaXnmkguSa8ktcrgfcb_wfslhhlxp15Jlq6k-CPsy88wLh8OZ2WO4hH_3kgRWME6gACf1QmFX4R0qKCqHVQH_-89_wecIHy5_fve2--aX9x9-eP_xHcyVWLhclmed484xfMmFB59LB7gSRakQpIO5sReAd2jvfS71AlA5BKlrEveKiARkS1RK6sUpLHO0yMKMyjrHcMTM4OTvGEjnVqReGg1mzmSZFUupF0dgK4WQi7JE7cAbUMbcgpWL3J_BpQcysQDpITPoOsegjWe7rDEFKDFD5SA1BYKpPBToLTrwQqkz-GyCWaUSGjJMlaB3Aj7_-Pbt9QXbDlCKEi1c9kAJnblUlAjQ1I-Ul85VmIHRIMCiUDAd9mAFo_MhFAW4HNEzlkuFQuhd9JME1r9lLtMcCnGLLjgUhNbGC_aFgLlcYRbc9OkjXP94eR30Y8CdvxeDsxHJbTjgFJLwbCmUAiU1ulPo8ZNC2IXU7oTNveyB8FFB6djM1Og71KSMUPDuzatrKC061FHBubEgoKxmSqYwq6TKyCe8hNKx2hedYwZqhOLcGF9aqX1wKskc8dsBrWVB7FLfwlL6PFhBUgjD5xaxcwyZLFA7kp_mQmoHQmeBQHqFMFMmvT2DH6wp-ekNO_6GDV-T8rKAqLzpzqV3Ucs5-caTBr2LUQKvoHdBir-KTnnFjxPwtCeIjUONQvs0gIoiLvBZh8Pq6Er6e_iJt9sR_NEBqDSxFUUHYGFlRn7p7AqzTiteOgDaWJ9DVXaA7HesOgilOh2AY-h2u12ySSl4Cc7bKvWVRX586K8DIU5k9joA4sqjlbwGMr3V6Byv1B_wIjlNTuBFL6Ff83JM_yf0Pl6lyjiEr0HXa_JUKTVegNEIYyggNdbKLC7zvFIKljLzeZ0M6sg6DUGxSTyMZ0rUIezmIP0ZvPcO_NLAXKS0oeu8o9U9GxYCeyGUQivRgUbMzppGk2q_aSiF9ZKjfGN3v7a7Pw4WRoPj7dctGLcfZtBvwcTb6KePvOLWLCGTdzJD6-DFWm0OOB2iDu2dTBE4H3GyRkDhPKDOTtaW7dGDtef1C1cPrdnDOurXrOHqANbJtGYNVwez9oYt58Xb6LzPptrnPNTeCp3SyaJU2LxfrsB5kd6uU0Qq5vgs_w2aixfvYuA_x5rhtMke7g5gn7SkT3ZKl9nrZfrbknLbPqRxC2l8oCLTFvt0_Kgiy_3bIggetnCG_R04xXNwRi2cUWuHcdbU623W_YZfB8JZJbPXCz5GQ3Lkk5sje8X_4USGo3ccivfQO2oy9plxvR2fYu63mAfMvN6QTzEPmszOG4vMv96VgZ_QVryzav7PRHoElUMHxCYW2AAy8zmlog1S3JVNtH4D7RPTu4gXuBtr4-uj4q9amwAWlicmHFYt5JBV01FXRqemsq42NpU2rVSoe_IHB-862fxVITSMOsbdxDpyYln1pzsWc9hcTFKO2Vt5KZg53YJ4W2fCH4VS0VTKjvfByIZOIwZtZavGsu7Ua9TUS1FVx5Gxpdd4C-GDmc3utz3fgFumy4A23rKSHcX_NdyXK_hiCtQRcZm2gIoG0PBJoJ92w1DB5xtAoy2gpn3_JOoIU3mppL9vYNHRw1DTbeOGW766EvM6SDNJpVAjNGNx5C54L8VK3ZrKH7SlGO8nQR1eHS4vQtDPRSoyPAGpvWER6wOV2pelzELZ7nKjMogkvAnpYM0M9Q8UqeeNwyKUfpwlHNc0pvIdWJd5G_rolkBPbgl2v1uXdhZFxmXhJo_43JpqkUMqHPVs0Tun3DeSOu7sgajeoFGcBFH0ZKdCT1GNR8-h6o22jNtBNTp_DtVk8Byq88Eed35ulJcXMUW7tldj98OHSO1grrkD8SmXVNT3mKVmzHVLUdeuHAkm1LPhQA6B1YqS6baTe6E5ekASD519JK3XjThbdyjrcvAlhJ3Ne5O8trZdUY5qaRhz0WSP-JhlniYZbdm52dULJX4njbvdbzxwllJnZtkI9HYAtAgG508QhPDeQ5CcspAHkdgiGI73EtT9VvIcquHoYUC3qUZbSWebaHS-m6hx-Nfd9kVsKu8hNaoqNMzEvYNDMuw_TGUjswOaCIStEGFP6w0yE_dU7dqsWxqpPXU2VmZdp2lKFlo-hR7eXP4Kr2E6YZNohiJpRJecnQ14EhGIVgm8BgnfhVKRH0ftyfpVAi8J55RhNoc1FUo7afvw3UH0TNubDA8D383wdb13qfvPEMtYmG16_VRYS75DaSkX8QqdPfBOP3qnIT1UAC_ZT3x9CsNe8pTOO7hGT3ONhg2u_nNl7eDaLavZ-TihpRf2nqaMFMDuz86LjuFGLGgS50N39r3M_n5DaZNOChRpDqXEFOHNr3D16ePn659_ubp-_-njRX1IOPRgKxrkKaMXPF5j1OW6Oc-w9DkPcl2c8zie74S3th6YSgcZWnmHGcytKeJ01VEVIuO4MYyMNLy4kRq-p6ROqsr0NsyFiPYkHFgCUuGFMgua7kYX8bTIgTZwQ4694TGyoNI_4M7hy5ULw1OLtW1hTKgNpMbYTGrhkSsOqpXm3U3fKqz0eYFepkEBbRi0Fp0KKr8yqEqYKyM8H1mW3MCD6HC8ss84pCurJfMtU2itTmjAo9spCVLgL9Pl85kocR7MNH1E0kw4qdt89ewsck7Okz_LOh00WJ_QtdjlleL5TBuvHMA0fUTSDtNa3hwkf45v0uDbZALuN-bSd-krybfUExtFUlNpj3bv6pxzhtx0gNPGmAEtTXmPSFfSroXtxUxho5iLB33ojyjX0V-NdE3ET-GECvgQnI3zLKZYcvr5xmJso1iG7hZC0RVK82m7h2966ue1eOJiBWPn3liMXMjYaQ0HhHfeX-ONkmRFQchJlOGfggi-SkZbELv4Nm3xcMhlbcPHkyRZTRp8jQI3VlIOQ577W8A5tOZlwE8aYYY6zTmp0ieHoBMVWLUcStCuFNZhFxUuhPahJcSi9OHtLZYeUoXCgpkzbl2K1QWbmJk7bKfeKJaKgfNG3bpZx-i1Re8Rn_UHNdsJtH22g20jbTjaK63_2Aqd75XWf0TapLdX2uARaZPRXmmDR6T1Qxg9Jm34mCdDa7Yj-nawbaRx5d8K2pa00V5PPiptRKEevlb-AaU1_8LUP_hYSB-Y9W-zezi6tGn-QdC38Iw26FE_6Y-7yaTbHx_B187Xzv8B"><img src="../examples/museum.svg" width="270" alt="City Museum" /></a><br/>
<b><a href="../examples/museum.arch">museum</a></b><br/>
<sub>The largest sheet in the corpus:<br/>A1 at 1:200, galleries, reception and cafe.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVbNbhs3EL7vU3yQUVhCJYGS7URJkQJGYwQGFNloAxQ9WdTuSMuYIjck1yslCJCHKNA36Lnopff0TfIkxZArRWnqIkV9MQnNfPPD75vZI1xbvV1ZIzWctWuP7t1oOD7pPYbEUlvr0JTWE3wlc_KQjmBsgKM8SLPS5IfZUXaEOTujSljobvrbHj68-3WOlbpjtwgOaUCbSqtchT7UOp30dpBr66mAU2YFZXwgWcAuGVaGOb7G3KvXNB_iRWPhS1klxF0KyKXhnGhTOfIpx8LJxqAkR49jfsD7P7CSWpPb4sO7nzmVaR-Nk1XFUUNJIBOcNDmhlFrDGgQOpwryQ1yGiCvRHZ2MsX7_ew_Ks1fEBmgj8wBfWtIyp2RqlxGWq-rHpqngMRrjz18wOsUaC1ubgoMv7Ga4y1HbxWILpBwRnKzotVVFH95GtEWtdHQqpeciYgcKeFuHctCQD1jKXBY0xIuS8NIqE9oUG-4GQil3JlgThVhEckfDdSuPU_H-tz6aUuUlXxt2Yav4u62DVoaOfQu7VsHxE1RtQxxhaV1ixcUduW0oOV3SntjCukIZ6baP94i-H4-FtY4rKjAv1NpD1sHOYUgxJm6NbWCsy46Qy10ZLauU3xFP6mFWaWnQedY-9bSDNxlQG-79ep0BK6cKjITIgEpW5HB-Ai1N4XNZUQYOEkrUVQZOa01gUpEJMihrMmCfHKTWbKSCJrxB5exLygM6raCSnDqJiTeLLTrnLi-n0qw6eJtlSN2kTSCnrEMoVX5rmL4nQsScga7oix66o7EQh6dHQvDlAZ9Hp-myP0UpZcDbXQRVPPGVMoRKuqC4iINYozOBNy3U5HPYQ5DYl5sls_sLkVK2kxYpQ_taxZOdDvfj4p_rPExo8i81x15puSC9f_fOQbSkqH2s-zK8t7mH8FPG6kAGdCdjthBjNq89-Tg-tlzmUZTefpp4pl7sFeF89mx68fRztUZ5qwBbkfFQJiSx7-UfUVMhaTCwWhhUpveJclA-Thm5UX4gtVoZKvoorQ9URLSd9NDI7ZCZzBiqeBITZ7A9GWXA2egrNKoIJb-sgG_SbN6X146QvJTKeKxJ-toRpLZmhU2U8TYWZayJAxpB5bcHiXNC7exiTn0TgedamTCHo8q64Lkh3R9vrq4vZpezZzezqxc3Ty-fX8x-uLyaXTztoTZBaTZSnlVJxitrqMBii1Kagieg8hGXc2CjuBSuZqkbFZk4mV_K9QLBpv9du1x6ChC9YdI6upNTfmgmR2_wbffRA76NIkt2tgi0CehwozoHfVXGUKw16Y-bKvZNHQsBHowETctw2N9GmcI2HyWn1aoMf3-e8R7pRAiRWDcYDAZYqjCwdYiX__MXET8ZZXC0rD21L5eX1vGg5y-Gi5vr6fl3FzfXV9OfWn4aZWhQ8fZpbSOeISo-Wd29yBG6i9NAEe9eXiAqrbaFt7oOFL8C-rilKiDXJF27WSPk9Nhjrbzn9r2qZeGkCehuwAIeJElji0m8sZzbLZXEdOzTYt6BtYPp2Pcig9sFzp8BcTsdt8_0qpYukBsUyueeebKsnVGBBbAgk5dxPsTQkTUA-PsFo4kQGxaTMrtI9_hO_rMvb70QfUfiTIj-g7PoHH0fCrF5KAS-xDdSffLlvgX5W3ystxXGQc4TIXbD83vKqYprg70690HySIkc757GETs6KOWs7QKcDTIQHn3SkLfZXw"><img src="../examples/gallery-l.svg" width="270" alt="Gallery L" /></a><br/>
<b><a href="../examples/gallery-l.arch">gallery-l</a></b><br/>
<sub>The polygon-room flagship, furnished<br/>and tried against `theme presentation`.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVptbxs3Ev6uXzGwPiTFSapebNlxmwJKqjbBJXZgB2ccisKidme1PHHJLcn1Wk0C3I-4X3i_5G6G3JXkl-TanD5E1op8OK_PzFDpwgxGU7iFEyigEGu0fVeKBKHOjUOohVIOhEXwOT9T4Vm_EB6tFApKodB77IHRCCVacDLFQafb6cI7k-QI0oE2HlJMjBVeGj2Acw0CLAoFqRW11CtGz4VPcpCaAEDwMfD6kr9yJSYykwnvP-10QXpwYuMgMTqx6BFytNiDpZXJujZ2TbvogdAEWCnhMQWFIgOpwefCQyYSkWIPvFQkgDWVTjvdoCZ6sMYUtD0FAZkVBSp0DlZK_I4puMQiaqjpjHBS0DLILDwIpQYws0n-RuhVp0vykx35YOHYVKYkXYSCRInKIRgNC9q-OGXbAWwtTGb82Gj6kXX8GLWSRn_0UuFHTZi_uEQohO_1D7_CL0Kv6O8UVz_8ypAzpcDJWxBlicLCEpWpe4AiyelwUhwVFqg9CFhWUqVooTaVSkEkvhJKbSBFL6QKetRiwwbqdFuM6DRl9ApQm2qVgzfk6BT-_c9_gYgu3pgKEqEpKhyy6cS-h3lFLm6w0-XYqa30HnVjmdbpAJPhEIBl97UJBwfHOj6RY8fbKvGVFQpcjkoFr_KWXCZrdJ7-YDc98JLBMmwPipMlJuwuNoF0UNN7IqyV6HilNSZjKPZTABlPGilROA8rsVTYg0Xw1mhwBMFXz4aLU44N3toXOu2L_lJ6Mm2phO49LGItfc7giamsIzEqqzFl01caZm_Oz34OcU3Okdp5cojJQCTWOAfSM-42omDcWrUm8wSLPnF3UqnH2aspoKV3YGodTnAmWMfn-LDAnIfkHvItnSKcw2KpNpTWFJZ65Uh6WvKQiTmKGJpCP4KO9iLh6iWUwnpJ6rgePzZabSKf3XUqi7tCz3gpI3M-3UU2WSYTjOl_GtmgRwoTH3lTOnDEIxxhHN5ylfsQcNK7h61RNiyZopJLtMKj2sD87bv3fwcriF1IPg0pZqJSPsr31BSUE-k3AKOjXc0d2hsSclf9OpdJDl6sA41HpHhytGanC-9fzeHy1Xz-nmj36tXsPbyd_XV-Ce9fvb6Ei_nsx9mLN_NGG5KY0wsTw_kUDCkdZOQUejd20OnCohRUFmYTUEKnLhElLuAvbfSfHg0XTAEaTEnayxsSXtpTwBu0G2CiCHG5xMQU6EB0upDJW0xBV8USLQVzIZWSBXqLDs7PWJd3s3fzC3g6GRxBUYASS1SuB8P4UWp034CXRYwqlqfThRS1KaQW3tiga0MkpZHac6GJbEaBURRbS7MTOSXG9LzmOsYVZMIrSWpOJZhCUQzglVA3kUm8gdEp4TWHicqbfib9E7KMq0lH4ldXCKWoyOaIPogRyGzT6UbzwIgOp8cTKIrTNvMdOC-Znc0a7DYw75Ven2NBqqyMpkIOs20pcqIo6Xim7G3tFh5ywSm7JM-7ClOugsGm2zoZIo7qYWVv5A26XiCLaHxO9kD1kBKd7Ia_wozNtGuc0GYsFK5Qp4uWK6iNiT6N8ipcyaVCyKwpwhdsP6GMxkC5rmYTUKQ22na628JXOQxZ3XQ5mbz1lUVIhMeVoTBtlpZKJMQKRIUpWnmDbQhxnxBqWkgXQ7UskytCipzRfLFGLImonMcSlhvIhU4HMEvTpspKjge8Qe2JDFsftdWNqgysrKnJWdbUFEGRqAeUfjmmleKCVbgFLJGdHxK7kTtQuBMFhdDmlLefnQ--PZu9nX87u5jPIMAHfgNvPAkQnc3ATZvRhGnzbQMbEtjBQtgkhxRdYuUSod__hzN6ARZLY72DSlM30gr9y6-L4Pvzszn8OH_z-sX8YvZ-Dlezi7PXZz_3QrRIzZWzsqVx2DQPV9eXL2dv5tfnf5tf_PTm_ApuR20eBeXF0lShLr2dXfz8-qzX1qlSrHAA79v4aemOkbEgG0gHeCsSrzZ7lAdPD8dDuIXxs2Moih7cSKxfmFsYj4ZDej46PDkaUtIQIX4T-ypoA0I6SJQsS0y_CzFO4mTSg2UXRivJUImXVbpC34PRdMLYJ4F-oGlMmrInVoK6ARgdT4-P4BaOJ8OjsK7NbWFRgNFJ8Ggh7Eo29TSVBWonjQ6gpGj4wkuvEJbKJOttMNYm7g5xGWcKsUYNpvIDeO1jX4opyAB5MxqMjwdDKl-oYVE52vhOCf22WIDzwlIjYpELXhwhlk0kEnu00bJozdlShUmSqtxEHve2ImpykmtP7F0skl0VCuqothZxkP-3m11S-_9bJdGrDQO7EjXZdBCj7D0bSKy0cV4mTxxYLDDdBOJMjLCOSJxIL6aGWLObfey4U8yw9bLCAcxCkxaKBHXxzAFN0vPwQX0T2tBucy4vN_zeJJ90kKNI0T4J9nGoPeokBK9sppM_3KPvdugDuDR7xRTIUTp1bSDsVJBYKLh9JZ8F34Cn0tQwfYiZQaSHG6FkKjwuGpEThUJ_d-db6PedtzLxW_pg5bmcUR8NB1fGrl1uygP40AGoNB1fFB2ALoyGId-PhqcguHMPjTzbm6qcgNHoCHKhsj4PEBqd21bSq5dNaQghHqoBIy8yVbl80aYdI_40ezm_5DiMlXBlZbpTTZnEvQG8LS1NoOLOyZTUBB56pTB_tsVpKZI16e1ND4wN9teihLJyeayQpcQEQepo71BZiAYZ1VUlcSfPEk76RvRBB4Kco2EH4H5_1wHYdncdYjHrc6jKDhBrOK7fVB953W4Z6kCMgg595TfxtgE-0BRn1ngKB91RNhbjwwP41C6hrfCBEkXRgmyaHWJGC1iHfr_fD5PfKWSmsqEZ6oW_90La8drHXx2I9kmf19dBJ7ylBGTbNg5hsm2KcTuqfoCnw97wG3g6mg6H_NenPThnqj8MdzIcbhHDh31QnjYfAqWwbkFDfN8fRumQVtrPnMIz4oOn7Iq-M162ttjibT0VZooww1Aal19wyqOu6sJPYZTYHQOJ1fd9Tlm-f60TUyEMe5Q4qdTCbhiSq1q4YIpE543d3iLFh1cvBzsWKq8j8HZQ2NpotGsjHjrJ6uNodRr0wofJPcOX166UNKQ-CMsz4e7rwz5S8-no5D5unVzXAF8Wl6fvD_tI8cPJA-KaLLt2f17c6WNmqJNr_efFne5aYRuGoXntf-WrA4GcZPrcXlPBAaAe72njXHo5-TsCy3RLVgtz6m6JqqgDqSjC_GYPMF5HEOBuxDDgIeGRtaABPOfVBwABMGzeF5BiGXbwgrW3eOOTHbxLWk1wAY82i9U-YJ2whlvAYOcdwPEO4NXLg2gSBqyTHXeYEjV3X1_rjm5s300JqTEWnJIpMgmMB4dQhLspo4G6bhKCuzFX0zAm4LeKmk6-buAxVLqmfxOhXCrJjTWD8CbXdvDhVpgHXm3AcXfNzbsoS8U3W3SLRLzBcsn0eRoipgE1GpoyITywa2uZ-hzGh9QSkh489uwhlJiSQff3TqftXp4-gjDcA4Qo3YOIUUaTVENkNKYctRjP7kK0obWjSQitABJoi0AOHwfhHXsYMZoYI1IUYYxajJO7GCGEaqlTU3Otkvpaj4I1Qv0WnqrUriXvbxjf2TD90obJnQ1k5M_uqKOHQiUVnpOj8dDJAxtM3BAK_L47iNHun5Dc2TB91m6g9dtMy6Tv0_zb__pMm3NPmggvlFlRq3-_L20uM5Yb6m3CVT39xNNUYEc_xVTabW-xGVmLgiYHTqhwo1n6HMLloMkyHicykeC2L4-p26e78d0bjuZGKOQv5dBCavieOOyHBZQyWbsBnMUc5hscGnUwjHGhNfBIzTVdsYRrSsrhrLJasq4yfZ5dO6nXzMz8tj8BNIEStT0i10u9zcQ7UEvUST6iu35NVHQHKkRQhOLIZrIltrg93haXFwRy8MVjxv_TMdNxc8z46E8dM3nsmD3DPDv6Sm0OHzsmEOP_4RgrkvUIgN4i5XN_0TuatmVvPB0Ob6db0Iuw9mD7c9Nj4OE-L17rEfTkkEr0ZB96NNliz5qfVXjPZyV3guh0B_yY5T7cgpMxRsM71gAn6oMvSp6io7APb2yUyclw2DtuwclIt7u9xY_o1gf7v8LtlJU78CbJhbSxobkOH_iUQ9JhtD2GopO8m4mE3BMF-yy2rVZ0fngLosfGqLHLM2pjDpucfRSHGW8_MsaTff-RPx8PjWBfLor34UNpDP_ywjoBoZPcWFga703R5wt_4BuItv-i4H4gV4STGsK_d7C8KSMQwC4Wue_wiKtIuPyjWxWA0pp_YOLh4O3u_yto-lpewj-XXC83cND8Wh6fE6sejIfjaX940h9N6emnzqfOfwA"><img src="../examples/materials.svg" width="270" alt="Workshop (materials)" /></a><br/>
<b><a href="../examples/materials.arch">materials</a></b><br/>
<sub>Per-element `style` overrides — wall<br/>materials and hatch fills, furnished.</sub>
</td>
</tr>
</table>

**And one that is here for its furniture** — the drawn symbol catalogue in a single plan,
from the WC's seat ring to the wardrobe's hanging rail. Twenty-six kinds; not one of them
carries a `label`, and most carry no `size` either:

<div align="center">

<a href="https://playground.archlang.uk/#z=rVrbbhtHEn3nVxSkh9gAKQ9JURcjCaCN6bWxjhXQ8gbZF7I4U-T0qtnN7e4RxQ0C5CP2G_bD8iW7VT03SiKVG19CjqZP1-XU1TmGm5zg7efJx_c3nydjWGhc-lyt4Zef_wMIYWN7c8qctSv-U-jConBG-Zwy2KiQQ8gJNrnVBH67mlsNKQbUdlnQSee4cwzjO3JbsCEnB3SPq7UmyBxuPCAs1H0oHIF1fA8oA2v0XpnlCdzkyoM1BMpDTo5gwS_l8azpHJe3eX628qTvyL-GkCsXtj1SyzyAXcj78mPbC7kjamTL4FaZzHcBU2e9B9QaFuqOOsegTGatg8yuUBkPL-YY8i7cqpDmZF4VQWkVtl0ojdIFre6UWb7KlFFm2QW7WKiUXq2UT1-ewPvACmDn-JEhwaHYJORoAMHndhPxvBW5U1JamSVYw68EMMVqTo7R-K9vP1xfTzrHcDUZX3XB2BDPVOq9BhKzrxWlFO2nPHi7oo38QHCEWuy7sYXOYGm7gCZjlM4xaGVCvGvDV3vc8mHo9cDYEnOhLQbP2oIKHjaodRfmmN6y10JUIeoz15afsg3YsF0gPoiQakKHJhX3p1ZrlZGPnEKzDbnQYIYuzeEOtcowEPR6PjiVhhk4WlsXfOeYSZUGvYXrj2PYoIteMLiiLCruLSjxAltppXzAWzJCJ2fDa5h9P_3u6ubd9Ob6evrxajK5_n4GlgkmxEZ9C6rSp-RAFza5SiPzDd7B0qkMVoS-cOQBA5wmCaxWEHJni2V8rz-QZ51jsGsyotr7ALheEzqOpJxKN7uCIymgC5SVSjILEL4dX336PBm_gQ1uOVKU8YEwY5qzaRc4dypFPsUXRW9GvTUtAkOajJHatDNFtqQMkCF7PVjZu3hXdHGwHGZKE_sIKw1XZAQ1txt-U6MBH-zaw5z4MN2pjA_E4H9rC75KmaWHYJl0mVCGTeJt4VLakYcfr1XKOeG1nAfon8DHa_hw9Zfxh08ncBXDv0o1amks23ymcU56JilL3GYdGw_TnP-YkU-dmtOLlzO2isACMB1ykVh7kpNl4FmjtxDoPrCVA6chvpPfTO2KPCycXdX09icCNziBb68_3cB378ffjD_BN1eTyQ8s96f3_xgziZecSoJECXypsq_hl5__y_BfMsbXM2BO-t0QruVcWBvWTpkALxAWTmVLCeazJAHU1iwromqYb-FslEBGtH4p_s_IqbsS2NmAQQmzI2ylRgxdbyUfhyCpseQ5-5fTTgacBCV1MSxy8ouRqiQE5ZMTZnOLLospi8BJGhbJ0BFsHKMbOWeLwDlPmaUmyNFkvdSu1gVfHvPcSYU6s4uFpzCLyYjjOZKEUvrCwzfjjzeTMWg0mX9oDVeYUq1SH35SwTJaKQ9yMvL0r0J4bheQkgmOfEyr6CG1zpDztUjXQpCcYOGIenVgiUy-5uCHnrcL7AK6VZqjcl1I7WJBBAHnmroQ60X5qxGLVelCRv62KiVQHudQC11wxbILa4XGii-0LcySnFybUapRsvvMq3_TrIadU4qFp-gyY6N9QlUWqkDgLEdaw0wMOYsMmWW0DvksKj88gZt3Y5h8_iu8_wRXH-HzxzfjyYerH6pCx_mShADtsHa2YKXK-CrtVNmtktEaTlcOlScW0d6R07iuMnpVnCBVLi20MJlrkM16C6U1SBUnDyqcwKRY-lp11oUAVxU1yrahK5SMyaQwDPF_krMNa2PktN2hLS64JKZoGqNCrrKMDMcddyHRRqdso8l4XOWCq8kYrv8-nrwbX72pa2ydUqrSGsseZCiNlS2CVoZel-VYPg7NkiC3NgPPFZcNFDUK9o647MgPXDGHOWS68mClnLOueXuOXhnAUME-OlRJKBxJca4MhXicb9VkliGveysskxpnZrFbbfY5CyUOK4JQl8rUEc07J2037PAUDYdZWf9LklhPsEblfM2HmiUPaMEumxcBCqPVbbzQFS3v-cDssHMfMNUkRQiFpd06KLB2qM220l-h1k1jJnYojApfeChMRs6rjLg_xVA1Y7H9zdRiQU6SyJzChsi0bcz9rbTW7cq8ybexwkgZTdEIL1oZK5S3YBoK1HpbZuiTjhw4elu34m81hiP4sQMiqudWA2JjMko6AGtck4OrIXA_4VCFDoBPURP0X8sLxrqQQ7HuAGRq5QGLEGMQtZZ3c8q4M5Ga1-lANIvKvtpM41Gg-0BOWcfqqvTWkPfATc-P8CLpJi_hxcVpIl9-2jktFDp4ujoXv_STi-QRiLfFsyKUBw-gbOg5UaIcreM7528VH4c1uqAkPzXn-_H8KClVkS-js8cy8HjxKzCGLV2GT6iSo9ZTcwimuj5iPCWKYPjDGGctOc6ekIP7hMPqDM_qo_H7k67h9uMwzlkjQvze9pF0Lir7yk21uiPJT6H0ZvxwuQS27D1bAqSdhKMPMtnBK3gjtfoICi4xcd7bQa3ClVErH1eow9MkuWcfVah_iy8fQfUR1BJiB7YkQwMbXd3A9luwn-NgerSDwD5s1I1ergS7EIRBg_AOtW6kqgTLYwZoMOeU9RvMaPJa2bMkuT9NGsy_lBNv_6iNWc7BD2EHFWyLFAI7uNgDO3geNjJHYFscibDJQ1gM-WMLMASzSNYCKvsqmy6cNYE7ljp_YYAzNuVGZSGHyyQBLnMEhtDFcQ68FHwZJqNjdiAjMQWyDF4MgvOrIRlhBzLS5wHk6LyW8uJZSEbYgYy-byBl3D1vpHwekhEeQg4eQY5Of4OUjLALKT5_LOVvgGSXQzWr13QQyDLNY4D-WQ3JcSTVgLdHm_hiLIwYYDhs3jtNkn2vnfHw1oLbfS1WJ7714hBa_drpMDmAFismBhicHUKrXzs9He281gE4hl6vBw9yJD_7XR8BvCnbN-54TD1cvI59ZGt6qpvUOGTFWSJOEGUHiaFqFQW4bNTQSRctK4zd9Zv0n15Z0zTAremCG0aeWBzGzWLshk8Eutzw6fb2oFxPyIAVZ4xq8mK4an9UNoBNE5yrTFpYwRXFyjaxPYLwrbKClc0pW6v-cI4bcIqLKTnmuPMkuR9wOCnTJIkGINxNuWMsAdp7ioqZcTDgOrsPg0Wd6pYQQ66_Q5EiCiGlZpQkcQtBzOE9WNHN09LNAV5cJkn3vKVQX6r0XlmqcbuRRYTp10n_MknuL0a1JJd7lSrMtBquBah_OUq6_VGtFMfB_XnyPJIM7m0fcWh2W-bhonn2QKNjuCqn_BSdU-R5ndRaXzdbIWtgXbi19XF6aug0r4dXwdvZQlW7Mgy8CV2VW-C4L-LtcLks2t0SSWgsMG1IekvbuPKRvMnD93caU94XbWWtw9vxWyppbE21dy6n310qR23bVB4l3eEg2TV4fz-V40alRR3mfnc4bOp9n2NhP48dZgqDdU_FguTVMhQktTYQdS4sO7vXzSbNFaa1UWptqGJoCfbTybAdEYVs458P0REXkGiqQZtSTW_ZoJbPpl6Z28OoUpb24sTtA_wK6c6Hh3AkMU9lvfGHcDLl8w1vUdyzOJeHcMpF69N6xabvUWJ8CqdYr8lNqz3KQZyLQzgrlTq7wdLWh3AGB_0eN4ztMBtdJEmXo6KMEu5q7i8fYtQkL-eM313on-R447E9ylWRV0d_2Zq2HO-2NcIhiFGyF0JjYTK3jTHxAEKa6cpTw70QGwzkpjnxfw5BcAFrQdTWrecl-BOtm9lirkmG8aeyWs2cy34tVdmmNxiGO5_YZx3EOL8cjP4oRj8ZnI_2YGzQZc7O6bGTy1a_HQV7MO7QMIOfIEq5r6gFOd8Pkjny_sks8wBkOBjtgDzy9eDP9HV1-ZPaYZP9BpdtqQa7qpG_3YvB-O3M19Sb8yoqHgHGf8iYxsZMOqDTUdK9aHJO1QE9aKUeAc2tvfU56cUzkg3rGiEQjcnZAr0__tktgbndSJP4hLWblFELFEfLlk6ykT-c08_r2vDoeLng_73HN-nzFe5ykOwXPuShmD88HufG6vbT_bqrjMIzt1-Mdm7vAAQVNMGPsHb2n5SGx3twmbmm8y0cXbk0_4C8u5P_f-BokAzOeslFb3B2BD91fur8Dw">
<img src="../examples/furnished-flat.svg" alt="A furnished two-bedroom flat — twenty-nine drawn furniture symbols across five room domains" width="440" />
</a>

<b><a href="../examples/furnished-flat.arch">furnished-flat</a></b>

</div>

**Two more, drawn on a smaller sheet** — the same language, laid out to a fixed scale inside a
titled A3 border rather than sized to its own drawing:

<table>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVtdchs5kn7nKTKoB0sRJLdIibYsr3dDbau7FeOxOiR5vTsvIliVZKEFFqoBlGhOR0fMIeYMe7A5yW5mon5IUbK9s34xWQS-yj_kH1IHcA7jl6Nj-ALj8egUVuB1sTQ49ME63EBuK4-wzq1HcNauPDhdLEEVYEssILWVCxvlslHvoHcAtzm2j0B7CDlvNgil1UUAu-BHpVHFAFSR8beFdj5AyAk4WKiKDJ0P9Kua2yr0DkAHAVMBLm_h8gY-Xt3COVxfXf15BB-tbNUeMkyNcpiBCnA4TZJkcDxNkqPh4XhMX14lSXJ0Jmi9A34300Yf5pU2WYRZO1WWhOJsVWQDYTVYXufvN0J5qozh9QEUzEg2M1jrkPcO6Hvl0c9gbSuTQVkFmIxhNSH216hCjg50EQEXxloHPs0xqwyO4DNxiUVqrEcfOVe9g6gXCLlDHHpcrrAIUCoXdNC2GMBsfceinwl5-IBuE2VKiA5V5hvhwz_-9nf6QrjxzQOYZehTp-d4eDQKNijjZwPekWqXVkbRe5jcbLjQxjCG16vSbMAjeihsZIYYxGgRP1_Aj-fvLj_-BNefPlyM4PyxgfhclShUzh2qe3laKP2AsFYbkpoq_BrJ8noH0F_nOs35l8wiLSaV6SKzazDW3v97fwS36h4bidytIx9xkS2Eq5qOF2QMny9ubmGtjBnBLVFCH9kW0Ddm2-wYgLegwFUm0p3aVcmG13lNNAZ6stJZZrCGaUxNzCPlNwV-03ChUl0sR3DJei9sOOMtS2UMus0LHyXM9hv5YAq9ziJ-TXt9uth4laY99Q5UPjALHWpJcgR6cX5zO4Jzl-YfFB90Ejzb4XwDpbNzItwWKC8JuU7vC_Qe7GIBqNIcFiptOBVslq9dF5BbojSaLtOn7sVAURgoLDsZsGlalRr9AETX2gN-UWkgBlSrBjpqRSYPvbF0ZBcqVRmCMvoeR3CNKmPSVXrP-jhjowRQLs2hNnfCXpUG_b80yEP2eyNeNhz-6m0Bw6FHg2mITHlGotd3zAwcltYFD7O-KLJ_Bn2Sdn_WHtA73L-O9Nif0anqHYgoSSckn_N311c3N7sm2IhmTTr3doWkFnac7KLJpeKKj6acxb9cfby4GcHsr7TO6Ada9Tv842__DX8Qefy4dPpBBWyeC4f8k0f3oNPOT0tnqzJ6EVabDyogKdeLe1vrYunpyPP-XHn4y8X1FSzRrjC4zZk4qXYb6ILNwKG35gHJbFjtZgPKg442xc7ZwRodQoYGA9J5VCsSjnWZLlQgy-EnOvMDmG8CDnWGRdCpMr0DyJxa8yn7M67m6HyuS5Lj-4t3H86vL94PoCDCQBcLdHSoF86uYE1OjQ49cZoTDYWnoOD_175EZx2FbMSmo2uFORq7hlQVkCrnNmSu1ZxdLDArjZcuLKiVrThS9g4aAxBd1nSTEZgMcvVAAnD6AbMRzLZNetdoSQN-Bs4aU4c-5VB5qMo3MBsOu8qfxWDBp1yOO-jg6Qi3YT56JPEqCL9cffivn64-snQG5LckUIHDNCgKXP4MFHwS7dVnvo0EtiD5obilKuQSwpQPI_jsdAjkwnwNyWkIOUwWQ4HsdukXcnVkcjDHsEYkzFJjir72R9FKnNOZdW0C0uhJEI32gd2MrIvgQa_Qk2Mm-aVYBGc1-RtjyNp3-KHQSOxuRTjJotQDOrWsEyISXxXY6hs7io7ZqDlyCCqNSjEj_5sTxfFlUU5uJTo5N94CmegZzAwuwtAu4uFVc_uAMQKGtQWHEsqVgUyTfrQtOHhbTkyiMwTKYN70DmDmjSaHMoPMWue3z4HlU2DrXKYVwKECgyrGI8-OAF4nCaxW7Bo4SRpP5UHHlOKuyOJabY7eRBePMCtteo9B6ICF5BmiUrJkW4x6nNr03zVU_ExevA-_9wCqgkx4teoBHMBs6XQG02R21mZQng4EjJNEgloM8bOFqXw-g4X-EipHSin4ZICC0Wg0TTjcjXoAEbEHUCo60-fHsjZVJfYAfKoMwvhsnNCSwrqQQ1X2ADK98qCqYEEZwwujLbKZ9wAMLrHIekz3LadvNpBHIi_LAggOMdShndKYEcy8pmNM_oKTCEoD35CBFWqFHhb6ARmvo39btPnfI-8hcJzvydsOPx8NJKoeXhwNAH-rVLDujuyYgQ9vBpHJePLiiqMB-Kpw2iOvld2-KjyG-ODzESVguGFtKHh_ff7j7eXHnxj154tP15c3t5fvWPuKfEKJaThr0xWKMYUlRFjZDA1RAWTuoaKsoMjoe6YCq4y4gt9rljiNynGlfckWLuT_IYIfDodD8DkaQ2yTCdS-ozV5ToiGX_3Xg5hbZm8ZEPBLQKfZnOtk6jhJ4Hc4TAbJERyOX1Lt0n4a07k5ol_jJy4Vakpv1xYWlTHDtc5C3jXvzMLKtsns2rr7Mz5Yc8x15EaYnvORW4gJDhiW1ulC7K7xpuyB6sVzzHj9CC6UhEFV1yzM7xxTRbUkuzZdiJ1oD6ktgi4qW3lKB8iKbbXMJanRlC6WylFEhzRXxRI9KGO57Bp1JLm-IzLuipbfjjQntTSPRXAiRvnyx2MQ_zzIaRfkNII0p7NT3ASPZnHW5MqDGEdi_usHsNIh1qpzG3KKNwU6v80W4z1HUFvlxs9c5EK34q2_HHeJHU8TidPjJKHQLM5VfCuFVFLfzmsBC1YNJT1EoV1zWlCqAs021Utl7tawl-zxlMkmWmqy-fPpHnUQDD4BI9yPJx0c-bIPiKL15lkgpqEhZp9tZJpyi-cwXtfn9PVT9nWvQ5p_A0MtN_utNOTwDSgvk46lypcdIMzGzwNNW4nK5-hyHuFMvkLQuD0t8UuD1DpY8TdSV2DWqSEo9-EiZPZtDrZb4fQ_yP8EJKkASO6is7fuLi6iflFtAl7_FYGY_UJPYhoWUfrAeVHEZqyDTr7FmZqEZTE5tVS68CE6PX4VvftF7CtwrSxJmtFL6jGVswhKLpKRtIteGTPyflXJcZiCHKaW-lBN0SOtK86WJbdd2YeYajegDQn04xapVB5Hr9oVUDw6kUVoJVYTLPI63pXXBe3ri7QEI5cEpwsezxRJvz48-9He88IIJ7t6kadOMSIlhnTttoMz5-1t1q6blL3ujtTtkFpQ_NomRV9qikz4pTQ61VSOHnKuvNYeYfb5jvqQdx_Of7j4cHf16fbm8v3F7GhXjnWSW1qzWdqCf4VtP_i9rrzGeNIJdjxrXBvF-ZMQ02fJnzL6q2lyJOLtdvuizviQbvUH-r_ED_uPFXsWAq9JoX-dg5W0qv1B8gYYR-3GPOIx4ES6ui17XwGcfA3wmAG7rkkAkycAj_cAHtT1VV3qSRFV4LpNrs9inl5lG8o5ffzFbDhpt2Une4LxIMLGghsyLLlUkCaEtHLFg7ReYSDeRBwEH0zMdu1PXs-0Qq0fPsJ0sjunbtph_Ib2RKbtYqFT3LKFuiHUv4kf9tsCBz06ZaET3mpzeHTS_ySr-xA9bdy9qz0JgR3M41aBjDnpYP6gQk57a-9Nu3cAq6DNNqAEzP2An4I2OmwaIiv5XksnhjOpl4f_5D8pWLmEBl3MYhET2kfBQnTTM3KAbXlvNsPYOhA-6X7E6DlSOm02jEv3KKoLNYOg3BLDoMnXyRCbLo60ya4v_-PifX2FwL1vbbiNZQyRxsixh8dVWhVyS5luahixDoqUdHpJGLS00KtA3TbrYGOrEVwVtLsujxg1Np2x8cVUxjQXCaVRuuCEWxWbtdqcwYwk1jRh0JgX5PnXlJ_XhTtnvDp7m91JcSNea8z-UGoochDyZinYqJrGeG6i4ETrV4_6INT8pP4JuqZRq6Q8y1Ev8wBL5TIs6s4VqDRUpDjQnkM4wyp5Yya9ES5OpVHl14gloGaX07kmgNgbaYsRKj18bk22zbH0ow3EFg_5o6aSUgFeUvYWZXCaJMIJM74HZbmNIoULo0wblEnSoDhiv62b2D0N-BZBtWwUZgPj4yl3ida0Kzb2WHncWY5lyz1i6aWMojaCZ9zUoHJvpIEVX0g9EV3nPVy4xCqWj9FkLA0p8sdGFfei9EPqm1BFxKCn04Qtv_bPJJfSVFQu_apW86NBbJDNWmHV94BKr_i2METlULm3rQ9x0pEnFqNUUirApJXi6WMhthDiGZu9yCp4NU0Auru7riN6wxZCfOEOxAmp7ikI2rEFIYUOQ8SaRwUYMxkC8XoXovXzHV64PmmN0jMh0-RpFNqxCzF5BHGaPA8x2YU4fgQxZmaehjgW036nPGZNX1oSgbKaG53Wt-l8Q0XbxG1J-sC5OHWu6MCTzzBcYNdeQmdvbZ2YN5WLeKz6uE5rlxWL393du5n39u6X7e6YbO9sjwU-bT-ZTOvoW28ft9vFmezbjjHY0pvj_ie3tzE1Xr6dUdccXbzu83GE4Htiarz21Nnboi5pmJ662cb_Ol6r9f87m6MkhZmEmIm7d2W5b_NWbsSS3N588vRm3N788pEWX7ORP7V5K4PizSfdzS-f3byVLfHmV5Nv3OzrrgNvnpC8YifgGwTm61aDFC6T79983JB93GlnfH3zOvpmiPmBZIffqKp4Bu9M3Dw5nW5vPt0RWGvvo9Eo5FjsaTV_T2ZZh1kf50e4uc7DJ3z7DBmubOGD48RxtHWjrT1f22O2b2yCYJvBCc5MOTDzEMGbrQtvGT6goEm3ervrCeONXHHW7uagLnPqRvt2-6QjC_EIzFIkkVvSW6-Am6tPtz9LK7u5pm2uj-LlhMwgMEDsZdOAAtaVF275nNGOhutUqqmot13iZI9LfLx93Q4uTbsHqrudV-7djZ16VrZ_z-4serCW9sfB4JE7XlSu0Hwx9k-WOC2QtwsF1J5pW01FmlNGa0vg2zgpyiYnSfLldadYtQvV30IKam5wC4kaQEiVCCMQZ12EW1rf7z2FER398xjSqJJt_Ta9rV21qwpwlKBuVSRSyceLgTcws4uFp4vOaKOZpqEOmaqhuRBG5YvtFx7eXXy8vb5oLkXEWPnmqDNgZ20onaYbw9SuOgadqqCMXVZszS3Tkdo7r4v7plrrFED1CE8CQimMjylms5TaPK6j0kBdh_jv2_BOn8NLaUIC3XfgnZw8h7dwOlvi99DHXZItvC1ACq6hmssKjrStDQ85aac3dYx5_CpJvrziu-EWZZ0KRY9Q5jYEuxpyBdpFOdkDMldeF8-ACDUdEDLok2nS2ytxRuHov_9QUpn45SWTcMAJyBdOBuyCaqTVnG67ytJotua52gzi3lg2N6Ghnn-jC-yCcdb1zXLdllDtfISsuvxIjdemLmtsvjkFDmmwFF19SUwzSDqVIEZXWrkjc5ehl5CfcZZ_JvMAKG2G_mflc3R9eunpZEqlIh-7GHZo-mAk7RpnaaYJXiczmv6UY7xSaa4LOrM_nL_7ExeRUioSyb4qaY5SApcPyJ6ClnRG9toOCN2LBrmGFmulmM20sdNojnVGUzOK9wwd_lZpHt6tZxkUdfUY9GE8mpxyC9ygeqinWqnTyGwkcSCIwIqOBmudSv1CnXSeTpQJgM93P17-5-2n64s7Yvfu9orb5HK739GO9uB_q5TDofZ5oyv2bnKHzE2d2FKKXSimtKjHfout2Si-1th2ZyKZmPadvJ4mg1fHTW_vtRhs7b9rDTcK3GlRdOZxuo02pogvQ2XeiPMGNffWVCGO-nhwKjZqlPAjR8g3jbSY2pD1bjXc4oyX-HO6BGclNuxJzyQuYmBqBMeeQ04pjWQ88daeRoB4_Iu7cm3HaYWqCNuCy9DfxwqTkoJXjdA46r3qRD3099uxd27tfap8TEm4Z9_2U9lLnHT6s3FxI_bx6Y4TwyJtqxWqF5P2AoDSmy00WrwTxslKO76Uu9_P-9Ix93w7zfD3tuKYvm1ZLnN2LlyeyK1mh80T6W23tiWrn2Fzh8rJ15z1N1H5CPb4_wzbHAa-C-JDWvcqZrqAfyUT_rdZbFmwYXfGPhzKTLO0o4PlaaQRnEs-YxRHmGZ-9dFMnfYdnh5d3zUz7-1UtvhLab35-3gKpBUeeCSTbpZ5gpNn2HmYnDrril1xsPE2tH1pTSNpmwreWDK3Iht37gh-kcX9PbMhLzzfcRfZCD5zJScTPJp7fnEmVmfi5ki8tgo8Muq4lGkmH-fYRARqm8fRe7XFWzP8NbNVoJ7WDLza1H9X0IqP-WbhcKNJ1kJJDm7njymaLEHubTrFgMQp6q7-v9x4UOo167T2ixcyasrCytqxqXVtajFWtM5ztC32ZuKo4mF2RTnD7cX15dX1E39HwT49DgNz1h__2CBmgWLlbySB4BcVKc3k1u1rmcV3qmz-jEOsL14B10KX4SCeAnCWpgio7S1-nF7c_uEGM0oRnFRES8E-oKOAQOogRQQdDMYLuNLZX2l279E4JP_KOdPdfAP9enYuPufL3UkyeTlMTofjl32-0_qj9z8"><img src="../examples/courtyard-house.svg" width="270" alt="Courtyard house wrapped round an open court" /></a><br/>
<b><a href="../examples/courtyard-house.arch">courtyard-house</a></b><br/>
<sub>A ring of rooms round an open court —<br/>the case where a window's outward face is<br/><i>not</i> the side its bounding box suggests.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=7VpfTxtLsn_3pyiZh4BkfMcmkIQjHghhD-wmcBS8F62urnB7puzpw7h7trsH4z1aaT_EfsL9JFdV1fPHhpBkT3SflgcEnp5fV1f9qurX3d6BUzgcHsIjjEawhJA7xH0frMM1BHROpQi5rTzCv_7xT7AGIXNqpc0CSnQgAwcwd3YJ0wIfsJjCrLDpvR_2dno7cLoFoj2EHGFW6SIjkLAuEUKuAlhTrGGp7tGDR0NDDXhMg7ZmAMpkDbz2vR3I7QoUlIUy4NXag7dDOFdpLpPTNMqAdZk2yq1l3MxmawaaYWqX6EEHD3ZloFQLPO7twFS5NIfULktd4BRWTgf0EOzKsO3Dj6Ohf1gMup-Mn3xyIJ8okxFihj51eoawv_-rt2YKC2dXHlRcjP-f_50O4fwB3Trk5A5bBa8zFB-xG9nt08ro4KcDmC6czqYDgi5ViY4-8qkqkP7I9NKDqoKd8kvagw8qYAbWpMgrV2VZaF4TIE3axG-GqaLwWIO9nTY62oP2vmIIjr3PEQNwtBB4Ygnz5OIcbianl5_h8gaur87h-v0fz88mcPv5cjI5v4LJxefzc5hcfjq_GcJl5kE5hMrov1YIt5eTi8srUMAuGYC3vHyvlmTLVGcnPkzJAFUUws9oNhkHxgZQkBbK57LqUHMsw7RQThGBhGEhR488syzT52oehjChZ16bRYEwVym_v6LPhIwEVZVE9nlhrfNQ4EIVx_T5GnL1gGAs8d8EyKx1vR2wc3qoHZGrpq42YQo-6KIAhyoT2Ll2PuwzLBTKsMuVpwFpjpkkVWQEhbwOUsOq3b3hA7qgU1VMIbXGYBqI1hRfdqGk8QwLuxrCWa7MAiVy_OCVB00sJQvXtoIFBpje3nEc7_589el0cnZx_mEKToUcHfnQgAKvCzShWEOmfZyTbKVFCBemmXaUpTEAmHUqBc8Vo5ZhaiU8x-KNQi_yAK4yHlRhiX7Bw9zaUDptwitK-4_XVz-DetQ--jXTDqqSZ0MTkCbjQKvAo155KJRboNtPrRSDgIAmG8IFOskymoh88Mhch3XDv4WzlclidKJtnWk4OJymKr2PIYecKEqGpYVezsjgYFfKZTEaDjH81JC7XRowQxGCLcWRkCrnKFF5gZldmemgs0DCzRFsWVqv6xUxjanuFd4Kf2mMUQ9ANSOyjjJEUVkgds58cBUxJtUurQoORW9HKsMqJwfhY4pl4DigCW4NmC1wAKtcp7mkybobOh9s6WE0HB3CEnxuXagdQ07q7cBKFUWdcMHpsk5Vrv3OVgFbv7YpVdP5Xoc0x5hSRGOZtrcDBZpFyGFeOWaqt1XIKQ-WqHxFPjs4TGC5JGuothH3yiD14iBJavfXvhqAWihtfADV24E3SQJLbfSyWjI3Yi47nFceJbLcXlY65JQ-v5xOLu4m19d3V6efP1_fTofwyT5wq2sdxS1MKsDjgJNhpTM0nP-85GP6UDqC2CbOofCCUUvMAAtcouFU53cl924v_sK1-JfTz5PLyeX11Q18uL56NYFP1_99Tp5H8KU2yJGgVHk8ORgnyYDnWGHYd9Yum4frk9dHSRJ7GY1InfW-8_hNkiTEJo7Hc_XZtGwvC5Vik123ZzwnVTUVcp6VUHh0blfogD_zWlqNmtkHyVfLEbZSibhm-6DS-5b_xhIjUluu90vlAx6TFaqRIaFxQZ1jEhcu7bUJmVPaUHDi4xUGtsdTGa7TS9U1TXuY06qDhVRqrPZCaR5H2cMvc-tJVVFQEpssPq29tIyddGWF9PfaZB5QORO7CTtwoxjroqh8cFTUCMBj8YBeorxRvW7PqCuVaDzY-RyU1KnR8A3lKbFHyFsXBm1AB44UmV6gmgvxpqVN7zFMj7nFcHM0ln3tnM6s40UZClfM-jfDN7AcQ1pYdU8eiEXbFzRlgfMwhczph-jkUhkswFhHuWsCIY-HR2QipW2hzH2Xu7s6gEHMPLw9TGLnFzn3NkmgLCqy-Fe1nO1FhyiXoRHXcvopMUSbxZTXuFHWOLwlVUR5Q6WhUkVBsR7CKVBmotQgT1qYtZKBla0KShVJEyaS5qQOalbgT-BXlWg8ciAPBr9CLOPyuUpwha5pqJdoPOmXNCdCqlqbUXo0KoIbEBb4IFKHCugQrixFYj8ayjHkqYjjojWPYUpLuyH7d_emvR1wGCpnPJiqKGBuXdSIRESYVQGmgjaVMnh7d3N7efXz3fX7m8nnP59NSCmkylAxwwc0rDXXwGHUgZzWujsGgXcShhSPgvd_-eX05gZK4h-5IKwsWU3coAq4shCcIjmsTS2Q2eIHVEWkaqSDsZEsTJNgoVTungtG4ApVO1hoOJVE5T2ExF-4SwVvZev-RJWAw30MU0cVnBVH011ErbAAsD7wxK88GfyAzpN9bWlDesRFhFqUqwzzTRX3VNKVl3qOPjSFkv5BZ5o0FFNqQHqFnhITeb7CD3vcjvqTek_Sh996ALyDgOWyB7Aj2wg4TKbHnXpYKhc0U0h7GEvd36r6HkbULHy9fZjOi8rnU8ac68dQOWQh66VAD4fDwwSsoz-ShMS17CJbMUbu1V4USqoM4GPp0HvAR5WGYj3sAURTewC844HTAyitC07p0APZg8DomAdI7ajKHkCzF6KY99jA6yqQiFcpejg8TBLe8iZJ8hO8fpckkBaoHMwwrBBNzEgX1rLuYWcjqz3MCs0tj3FnlqQHUc53XLPSJrOrugM2m9_YzkXckLSpE5j80hQgIiBBd3clLGp9rsq6XBYqCueMSshSZ1nBlZd2D1FGhmYHI5U9RpSx657WspMIjxQ8ei2qDmpbJdqS-ixtrQyFpMAAt3ACh8SS-LMj5IaUZWqhDfo48gOcwCh5kyTx_wmcsOpq38THgE6zN3R6b9DXr978cnl1TsPjRDtRsqtshspRuWTqDqI_gyU37JNnaivPJwBwAqxjGoBNocPlplYpZPizWiYCvj89-xMBsvJpADu6SJs6uK3yZT_2GOEBCxhB_2duzxIlyU-Ir2cn4kdovdK6BWg1v8FuMkj2YPc2_v6wR5982KNG6xH-vonGuQ2d7G7RyKu_wS57mbHkL1rj3hbM6o748jzMSGCSwe35pAHhv7cx2BkvY8jku7eNFQzB0dLZibtj6QJA1bw1HLz-G9JykkcOTKFmWED_QhVFH9qfyqMX7SO7me6-Z3OWQnMz5lnY2fzDsxAXH5lPcZaPPLa_OYsAbKGuUhkhqOyhDdTx6xb1rBZN_Q7qKt1CjFuiiCgui4iUnI8Hb1rEP8nY__rAmqQviDWACBVxtrTn7CS7EyYz-mvaJiR7JBdDTuFKJK7CVlYGLOlEELGAA4nWFmZ0rTWx7agAYyoHAkyVeAOh48gdFnIiQoebMpIPDVoRyTzrbr1ppldeDlygtNqEQYTcPYgLozLADWQgU3tb6KytEKRrpGl3cFPrDDpWnMslqJXijtVd7SqNBm8s-PBts2D6q11Jd52sPvmRO-baPFuXyvtaFmnp-qPhGJaNEKp3jX6FZWj-jagkhOQoj4sg78WjF1tRQ3oDaPP_RQWyIYi218uej0Kv5c2HhjfjTd50Zhfu0S6Fo5-d2A12M44QfBtK6oq8X7fd7MRsJPHoaIO-RxtmbL3pNyYevZYFfOFVfndeOaNZ_Swx04pi09QQZdKczzDKfc4PlkySoiMuJW2GfqKX-1uI3s4VPIc4syHYJQ9uIbkG0o4oQt7YuepvGyl1iCFX6Sac2NhFfC1FdQtipjxtE5-F4HB2IY5omYdJr8Pu2sOkgJ3OapUi-hhuz28m4HHBJxy72mT4CAeDWifzEdFuMmBRsRdBOXUpMfdke2Lnc49CaUVHlUHxIXhU6iSlIjzfCJCE4_JBB2rUmejMo-3vf62UC-j2aX9EFwSdYyqigpzpNcd5fmtIqoIq7KKKydI6MTrhzmtz35w5dbMjmngAshrhPDs9vrrNlUDHJPHnWwDHo5cB505nC_wewHcvA6a2In347YCHL-PxznpjQFSgmMUcI_6-a3NsQi_EjIjHHXTBIDVmdJgMxkdJsifvvqMOSi6XY-YeiBwRFTeG_h-4nbwk4n6ohvsxEu4HKLjfJeCai45vEHAfZWy_1j8dwQaNtGihZ5iNWn31smp7jxm_OIpCaCb_byOqkH-rYnsfDzL70Vh696mB4xbuZblWGzjeMjCWpSvbkovbr0TDx5sYOeplfvP1z8ZpJ-906Jw7dniVprLnIuCFU2Ue76Di9rwOGa2vWuSxVNPl2Xb3pwA0QoeWOdpSOl1pR6OfyIeQbwLwHvNLALWHNywYE0BkqgrwevyiBeOnuqFLo-_RDWaD21uCefyy4ugygypQV3G8fVFxzDATnnMRZNu_0tG5JI47afbBVlwUt1SCcpmzM_wi8JM-z3qGd9oR-DZC9LutX7bVpUY6iFlYkK1waJ7IQRMfbMRzQtLe9C2ASFcWovE4m86JBXpGp-tM_mNOPahMhp0DFoIdwO0ZzJBPEHVz7RbPEETSzORGS2IzfKJ6Qh6qWfQITfI1V795Vj3VG8Ev4Tzx7Esi7BmYRmxuqcMNIfYChcbPrau7rMN_j0Hj5wzcZubzBNqSETltU2K-vD48TAbvxk3bJuNGHePOaHC_NeIHNP8D6N9gar9yhPOf7v-juv83CgAfqmz9jQLghsb2Nw5t7HyuU_wdEuCmvbp8QQUs-dD-21TAJ7r3ia3_OSHQdr649m_uvjz-ufYLv6sBx8V9qQU_Od-R8U-bcDeU_19NuBuY72vCGfr7toKK7V8pdUfC9qaCor_frnIza-9T5fEZ1C8V5rebJwrvI8JGA2b51-21qr5IjDfxrBjlXkDV1_HyhZB6GHXleG4egfnKXL5H8FBvq5sezn4Lat1BiXfnTZNeQlmFeA--takVA765576TDd_zLffHdNwf23Aj7b4SWYLi7fp3tNxN5C8x8e2_3XTfHj5tuvBc2-1m-Xc1XvruU5e7fPY56H5hKhKJr3H5u5LO2jmf-5To9qVdF_oe5V5Ojkex8DVv5ahT2EpbHRr_ysOU03xan3fSldIrzweu3KKztre7eJo9ubi8aQ5aF3J8aixMKcWm9AXFeANIt9SYDeueMAf7gI6-NkKUq1VG0KHAKCpKZ3_FNEB_0v1u7kRuIyVGfJF-N1tD_9Sl-UdlFvFz-mpIf5yMj_aTt_ujoz7j_733fw"><img src="../examples/townhouse.svg" width="270" alt="Three-storey townhouse, ground floor" /></a><br/>
<b><a href="../examples/townhouse.arch">townhouse</a></b><br/>
<sub>Three storeys in one file (ground floor<br/>shown) — <code>level</code> blocks, one stair<br/>shaft, one drawing per page.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=zVjNbhvJEb7zKQriwRJC0iNa8loKfJAtxRIi24FFxwGCwFOcKXJ61eyedPeQ4i4WyEPkGfJgeZKgqnuGP5J3HeQSHYThTNfX9f_Xhwso7KLGIkBY2aEP1tEaKtt4gn__459gDUHpcKXMHGpyEA8MYObsAnJNS9I5TLUt7v2o1-_14Y5CUGbuAU0JoSKoNZrhXNspaiYIuQetlgQfP0_ubi6v5IzgRBKsa72GYIGW5NZyv531-nxscS4_p43SJfOjPCjvGyrBGvniK6IAGOKPAjWN4AqLKuI_8zC15ZrJ0IB1pTLo1r2-cCifBsKBKj2gI2iM-ntD8OVmcn3zATCCiFK8Fa5zH1C5HKak7QroQfngmZWpDRXMtLXO9_rMDh_2uCAobLw2kB8kBWEAX6EjvpdZW_GbkgqNjnySCmfhHPKSfOHUlGA4_NFbk_f64Ki2LnhQARpTkoN8SS6oAvWosMZQEZQ1Pk9yhYi_Fn5myvkQuQRDVHowlq1qQq8PJb-1M1As0MqwObQyAQpNaKKdJ9dXcH118-56cgeXny6-wIePrKd3A7j4cAmT64sJ3NzJqT99vPkwGcFF1DNrHyrr1E_WBNRQNGGQFNrrQ16Rmleh1enCLkkYm64D-wGQChW5ziPZGDk94KLW5J9vHHjkl_Ocr2o13-vDTGliHazQw5Rm1hF_9QSFxsaTjwakcgRfqmSzEkOzgJloR_lHFuj1YTj0pKkIEPn2uWg6R1dUEld853C4VLQCfLAmH8FNtIJTIZABZSBUjgiCIucHYNA5y6KdR5cXnT3zrV5g_EOWiWAxOqK0z3y04zDYoTwMhLSpOWDz1m3_lXiEF1mWsfPYJTmnShL3mVmXnDFmANTWUPQbhNwrrfPneUVY5uzhCCtlSruCqW1M6SMl-2qtqGBl2xnMNf6kzHzU8u5HpGmJ7JE5XLx9-_n959uLydVdtJHc6pPZHYqVQ4UGFo0OqtZrZebsJ0kt297r2Usx6kY8gg_MHXMWTzzzrej81VhJEWN4EE2M4L31IcnD8VqRI7EP8dGK3UwiFe_FYeAsy56Pj7MMSppho4P_vbwOKxvVUNpEjdHD5AtyUCWnLdAwD4G0hrVtAKe2CaOeRMfBZC8JH8DPPeBUFDwsFj2AuVMlnGY9gC2XgPavv-cJYtdtX2l5lLAKnQ-ACj2AGtljLl6ARlP6AmvqARjrQgVN3QMo1cIDNsECat3rAWgK8AVew6tsw0MfbBPIwUqVoYLDFWoNBZlATitD_iiRXcJr-OEJspLqUKUzE3gN4x3p6CGQU9aBwIZKFfeGvE_nry9ub5mkpekn30LloGKC5yIZG8E1JmaHWaN1vJQdOxajWYjCceAcw8G7LV-K9oB4vypf-4rN2LHVcQQT-BkOs0F2BIdf0v_LI35zeQSFtp7glx0g5u_rCmp0QXGMbEGxs_0MhyydIMnD5dEewL0KRUXmOzBevMwiQ_Hhl57gOGsXLSMcIJF5r34iUeiDGEvjlDQcXKPWByBZk4_v0Gu1lJgJcMh0Hcjpqyx74BtbkFs5mGAi1Q5QEmiDFNndAjvZgP0xHk5oiTQKJsVMla-luLGRo804BxyfZVly1GMWz0uAKhPsRq6WvPyaJLMGkrEwwPGrDuFsF2BLog1EK9MOxumLb2HsyNGHCwhsnJR7LZ-QXIeuJHPO6QzsbBbdWqKfE1dTc_ken2TZAJTxHOyhUj5BdhWE08gIJhW1l3YpnnxMEDGteTCpCLdZ0XcpcRQdMtKp8vVqS2Wd0k-zjc5ZeVxbhHWuLsLnI5QtrXUwxy82WjseZ1nU0axxRoXGEXg7Qy6vrTuaouL4tDXMdOMrVgVJLUwunmXZw6vTzp_u7AwP9iDbCPPK3APOURkuHGyRTezZ2YxxmSO-vTXgHm_BLuk3EMa_ilDYhjPqb2GcPcaI2ZAzlzxwcB1n2eD4tIutsyx7GHOclsrFvC8ZonU_cjvVV4r0puKeb1o4ZTa9PVxfXVxefdrqOTbNjWBLFYtNiPJtrbJGr-EQH0FKG7-yjS5hSnD19fbqz1e3X9_f_OVo1OXtMRz8YcPmwXbz83-bwqcYql8HyAYnZ1kHEJ_3MKj8n0tAWySfqAJ8ZZfA47GUcwvlikZLf7cDxkIlpMjvBkzaqAT2BkOVkJhiF4LK4-8oKG-oFIrjFif-3ocaf19FadHGe2gpcX6wG5eR_N7U0jqePzEaFuicos00wqMe-q2o6W31bs98Ow8BFgUbbu6wrsARlpGmM4_nl0VFZRzHbRMkVS8Vyji1neEjJyM4fBNHn3ZO3DabjEYLW5LWVMZA3MyHVAImxAWWNGxqmKIurFlH8XdHxKO9uicW_M7CyWcfk493yU_Gp98mH--TY-zuUnzx7cfd7a_2yNn5HlWglv8nq9jpEyWr5fjb9aot6XyhOFoi58RdqXkl2bB2aonF-jyNYO1YlvxDKqYPSjrYOIxAsAlZgosHHjTcs1eWdwwyr6WpLpHI-oTa5lfc09ZkeHR7LFVS5KaDOhl3Ur1si7koZK9gTXnBYSBGcleLh06S8pMVmVEexltN56VtppoOvgk8boGnNgS7-AZqtod6p8z8MeqqEFBJXdugQx4OErLgncTOeJ8p9Mp8A2FbZIF4yWn1dB_CV3ZF7mmMbWqu1meJgf-ytpd21bWWk628oq299_I1hoS4GpeXmM24hgNy9Dc-OCxjynPEawneIXHKSKj8uvNWGXA9rj14y-ugfGlVKcsMnowNHJboOZc5KgKyUeB3cZVWKpxbg9ofJdi0zfr45m7y6fPbyd1OEmOX57E6jdkr1PeAhbM-Lp503GuuVKiEK_6OU91mywq1Bd_UtSPv42Yxjs9UzmkAUyp4WdRewBrnWIrrIodKy8bjJk3YHz5OEmxhOaxSb570_EzWjHgeR3LTLKZs75jiOSG0ax05tbPBw9DbGm-5ADSa4uZpf0kYNRj3hGIJ30yDw4J3tFF-juS48-CGKgFrwmXcXrRbi3adG1hZUCqPc0cUFzyPLtWyCm23kglT7O3_-rd8o_xYlQPMUGsPygxgVamiilIyTwiGAszUPDa9C_JS6mJmYjz29rl0pevO38c77s6pftvLWTI_aPMdDwTb3WbcHynfrYxzyXXdMjHt46xpHUYawXLTC7g070yub-6gxnn0f2Mh5w4tT9tGiRWpqqO2PZlJYFVo5hBnIGnKggqaUsNaO_sj7xofL4liveMo-jpdw8GFK6pbNPP0HgPBwTgbvxxmPwzHLw8E-5fefwA"><img src="../examples/two-storey.svg" width="270" alt="Two-storey house" /></a><br/>
<b><a href="../examples/two-storey.arch">two-storey</a></b><br/>
<sub>A void over the ground-floor gallery,<br/>and eaves on the storey above.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVpdcuPIkX7nKTKk2GjJJjnQb3erPePQtOgZxbalDbUcCj8JBSBJ1BCogqsKImnHRPgQe4Y9mE-yzswCCKhnvGuP9UQRhazKvy-_zOIhXMPb-Sls4WyeQA21zp2dlbZGsAasQajwBSv421__G0KJcHN__zD7z9u7m8-z67ub2cdPi-uH67uPC8CtqpsK55PDySFcQ9BmB6VtPYL2_GbW6qrQZgWbEh0CvqDbQa2rStcYHC9TbtViAfYF3RS8BR26l51elWFyCE2lDAQLvrQbfhBKhwiVMqtWrRCW1tX0hgqgHILKbBvgV0sdfgVOhRIdPTPgS9XgFR8VoLDWQaacAYC__fV_wDZoIJlfAoCCCtVS5JXKrDwZhbb93fXHBdglf96oqgJtfEBV0HfagA4DyXppq4Ilb3QRSji5TBIIG0uyXzCeltdoEyyJ1A7sxvBBtFmJKF1DXqFyAHCkjmffHGXHAHzEQtdovLYGmraqkMSAyOFdbu_uFg9yyKXK0bPWT-UOlCjNh1SmAGMDKCi1WZEPDP4WHkk7DOCsrckTJ_OLC6hJDZzDdbeUTDQ5BL_RZkX-1QaWtq3EcU8fP-yfkDN0AL9BbOSxNdWOzrbeqB2fu0SJGpJPx5scigviO8YG2hXIv5VEZUoKfKYtjo5TcBhaZzyYlvS1LsaZsWYWj7vWpqDomhxC-vT8-en27rvn-28_Pz784ePj4iaFXBmyBL6gAdU01Y6MqQPvRWZqlFv3cSC-D5CrGmHpbD0nsb7SRYzZFDyawtOaYDfKFf1rbzwslQM0BRzRd55EVLgMX_GLkFvzgiZoSzZI-fAptB79FBxFmqqsWQ2lUcgEp17QeVVBoR3m9PbxFDalzkvgtOuSsVJmTU6zbShnqDzt5wy6Lqgr_UJ2Zs8PMydT-ZoTVFbZZYBKFQU6Sfy0S56Udrp5uCbzzu7vPv1xDnfRdzUq3zosWA2yzBVbkPILPVBik1169SaHYmXar1EGK5JcOLUxXdSyVKwoaG4ZMTZOh4BGNM4wVwRDw3Dn10n9suUXtCm0D9qsWu1LlVXiy1E2kMcb1RAy0bZ8GqtN6AxGIjn6_eSwRyiBOrYUBfHKoqfvTEQ2MpbYjTNNucLZTJCQ4TLMtAGHOXo_jenJDuFQDHAyfw9bMjYlpUgky7WmEPdMDuEc6lNYVqRzWmkTUsBtg3nwdGyRJvrkqqr4-IGV3dj275iVkdWWmsMo2paMpmvOio2lXAiannoWoiAVtEvZzFcDlJsCKopBVYm5GAQjwE0nh4x_HUT0uLobwmqPIu-SBOpawFLBSlUV7gREGaLe9RAVLcuW4m8pNOjftEdTAozGuuDncG3AukIb5Xa8IO0C1UOGYYNoOkilOkSu97CzLWycDfgB0iiPMNiLsmgKCRFNlTRCsjaUZV_UD3FX3LFGE8C1xouS5O4-kKK-BOV7ATFwls6a0Ien7EQLJ4fdUmNdKMGXGMHTy6FMW2fohpU6xGrDJWsKBTr9gsUUDHLu7xosCOoe1RrhUhxil7Cxbh1s03lRy2FOTi_6BR3Ue4a6DprYMbtohKXTxQr3dWmkYqyZOUGRDSWFKEOOorjNo8_v7xZws_h0--3i4fpxAU_XD3e3d99NeUtxBjSta6zvOcDT839dP37__Hh__3x3_fBw_wTbk57z0KG7ivoUy-EcUuXyEgr0udMZwmz2g7emj6eOAkgyprl2eVspTqSssvkaixQ2OpSg4PeL689_eFjcQEpR68OT2t2a39cp2es8SUCtFKVBtA7AWzF3rY2u23rO2BFzYo9wmmulwJQ2eflBaJQU8is4ISFbOJX3WGwZM1AxdDHOwdPHmNeZ8tqMvEUVeEAODKgRj-QiznJz6ym9IsIZ3qJpUDlhKi8n87OzeTIVXORDthWCD7ZpsICVpRe8riglrImYxYKpaDBMkaKOM448luHScq4oUl974YziFixeMYhOpY3yFLzxyFzp5A1aes5GYgD0QVE1H1VEpDWmLahQqI3aXUFtX8SSjcYcIViWykrkBKnDNNdS8pQck9T2USS-6IJe6ELtRVW6UAG5tFJ2mg8sd_wUZjMfnM7DPhTZCtbgfMJ7HDwSN_-eHHQAf5lQjOrgKQwADiFdOV3ARZJKxTlJkqvIoXqw75nECRHZUudrZutUKrahdUiq5FhAuqxaX6Ystgti7ijYhuxMqgczFmHQeziaz-cXyTHkVqA44DQGIG3FJ5PK5I1qWO7fiRlTktu7x_seTecTgKjGBCLmtc2EX5jNZrMIgL_uOTL7iWviD1YbUlZaiDyA8uCDa3NWbDb-Y4FvTzmVzhIqaB0xsm2I2Os_wOU7STbCSW08s2dKBzmF-AbyynosWKJtQ6UNSgfkIzHzUOvgoj1i4WQjaml1Os6TqgBH2-nuWOoK7yEuEAJLjVoeIEcTHPI2XKO6RCBgNRZqy8wJ7HI5i_VJGUit4T5GBfhNY_03TJbJ2EKDi69FI9wGdNo62DuWbPQXOEqmyTEcvU2SwQfCoGN6JB_YDvCjOGvYgBDDpW6hD8M53KmaalLH8Lh2DRGwbIlRsImyHRVUFkpUT1EiMscjCy-186Gzw9HFGR9vqNfmmU6xT4C9YieiWHwnfhBNhjrE8nVFSdIXaRW7lTksKMEEl0KJO0AjZtAUfLqqIh2fMfaRUKF0SgifkrLNyU3QQIXQGSzE468IpG8UlcmRbtSWwD9SL5meJuylU_ZYIuq9lvGM_0jG4NX4eWglTktSz79Osn_6j-Xdm1jtCuLcYr4p-AqxYWgmymvtmr8dV7WUeqyu_1nrkJdoJIG82vmrSLRV94ibTDJ_B35Uvjo6POyi-mZ00K9MIJbP4mv3XCvNPEayhAvGnxEooLZcpyuVYQUHn0TmV_CZlDmAnzjuSCxFLovtYpTFEgEYie2IzQHIH4vNVCgH_qG8-jf5h7JCMqFL1n4cMBgrjEYC-8aLl3GbIgyKWwMpMy4nprZGbITAXsH7np3-qVUuoJsV2ucjTt-zS8nHfp8MTV6Sk-SMxdfFc8zeAEenb_sYlrkObbTHXFFDKKeXztB8CWpzSPlhKuVw0KFS2FLG1qgMq0gqRUYq1deQBegbHViuUTX6_XSq7zq7wZXYL9Um7cwdBwe_NtbVqgKqTFeD7p-lSovYN7Kx8O8pP08S4ngpZoJ06YHbwzVYrhCj0QD1yn6w9DL5j2HT17X-ROBonlGNXUC2Y0NZAwLM1OFdkPXZDxTUncVhMIrpB3tf4jJPm7hzfeOHozmeyg3mNp2zuPsi0_NEK7Z2LFXas1FN6rwleZ9hqSW8ajJRP_d7pSPtGCeHoiZ9oZiPJcM5oihq2zBI0402hd380kQleGdBdCLzHPtOivy3SYdQg8gfhj6TmI4KeW3Wr2RlWPDoMsDR2V5Y1Op0nEYjWRkzpL2ozfOKpzURNk_Ok6GoV8cavemfObnlzfOzV6n86hCjN1EQFTpTJFOKve7Ny1d77r0iBryi2aiDXAVVWZ52x7rBBXpAfH_GfTGVlkuPoc_jntHEJGI6-8bDx8Xd48Mi5pOY0-OK246k726ZHkuqt9TiqWpNpyJuJJWoG3xykbM2NI5nH7mNI09-0CvErYCxcXAghAubUIJ1-yH0cEhX8Nxyo_PIirsZgsxxWXacTA7zbIM-iLyjTqWzLw7PLj2exppBpdkIIGdIWNeH5xUoFnoeO2tbtJUoIhMXCrEYAGseQxNp9HmJtA6CWkmtoRRets5o5gGxFj_TBn37MwjsvSfEm0AIRpAlTGAkywf7grEw_79kcQD_tKw4XvknZL37WVm5bQ01Ov-XrLNeFuUkE5DzJNlejgQPAKwbK_xynnFt8tLSqCHOb1gs10FpTtnLPDuQXr2f-fWRTe0lX1txsZSms5-sjSYB3cx43NN6W6OMVB3FJlWMbEdFuRjHi0xdxB5c1PjkEGwz45gFAD6ymO99kmzfJ8lIwiZnP7yWkNkQbC1CBhLIAW-TZF8MecazZ2L4up3Pdl_05Vzd4rhF3olXZZ6GHsyZA80kKF8ozTsGJl1P6iw_TXjUajwccCsfPcW4dMD-6Ra-T2i-GsQJPNXgM7_x8VrC8EaL68-PgBTjjFz76ZkE5bQjlV_efXTgEl3Rc7Cg1sj3F6JngXnF46uUDMkorKqN2u3bsJna0jC-A8ureGAEv6szW0Vsk1kA6CAIRfc1yqwq7DceB4j4h6rO5flFMj09SToyf34hudSbqY-BQVJVXd_QN0H_YlINTiR1XEohjTemfCY5FPV4W6rIXYfxLRaxufhpMIkFOfKC82SkItVY1nEvzeTlwc9L6zk9STshYWcX_dkI0rZnF3tpT3H1QWfDk3djzJMUGdx3vfFQqpCX05hTMWo3GLhLH44pLoWyDa-ieFvBku4y6_bu8-3Nok-VffDAwSfe8WAfkEsa-sCZjNUzu-2zUeo40tAZHechDXOQBoJebqUclSMdpHWS7qGbqcm9DhVJnt93pKubqO1tKxaInjq_vBj5_VJwBXrbdqeHn8T6_vb6F_FVlvc9d_Ul5fsIl-k2x4Nqg02vpM-SnxEQgPi6u1uk57UKOofvvv3qETxKVyW2sW2YkZtGv2SYw6K74bl_uFk8QKPztY-sosCeYfGUjcZ8XAOlT-0vbz8tfvcIsQGzS64hs2_ipU9XmoTW-RFtiiDWX_NGiOGhtyP2Tzd5g-4EauVW2gjHkrsdvgVTzmmOKkgDbkMqDeCmtFWcDHZRyrJP3l0k9E9_h2uXy36Kuv-NgQyb-JaIDprtOguXllnS_tcMNAqaJvR7htN-PBS5wiWXN1rKMntCN_tmODjck6fx4v2Sbv148T4C6WjS7v0b5hqpDFy7MkqB9mY44N0PR51MpJgsp2S6FPJKxR_MGMSCSUs3sVR1plet1FLqVge_09mgckJJnbVL2ecqctlpfwtEIKTAt1nrMiXRkrVmpSq7oZ_DFCgiVpX6M7MdHco4nloyFNAUgYSS4YIOFfLVAUDj7A-Yh9GtAj9gVHvOdnBw7fLykzKr-D0pcXCanF7Oknezk0v69sfJj5P_BQ"><img src="../examples/tiny-house.svg" width="270" alt="Tiny House" /></a><br/>
<b><a href="../examples/tiny-house.arch">tiny-house</a></b><br/>
<sub>Barn and bifold doors on a 7.2 x 3 m<br/>shell, now with eaves — <code>roof overhang</code>.</sub>
</td>
</tr>
</table>

**Also in [`examples/`](../examples)** — the whole corpus, by what it is there to show:

- **Showpiece** — [`hillside-villa`](../examples/hillside-villa.arch) (the whole language on one sheet).
- **Start here** — [`one-room`](../examples/one-room.arch) (the smallest plan that draws anything),
  [`studio`](../examples/studio.arch) (the lint-clean flagship),
  [`attached`](../examples/attached.arch) (nothing positioned by hand).
- **Homes** — [`laneway-house`](../examples/laneway-house.arch),
  [`tiny-house`](../examples/tiny-house.arch), [`garden-loft`](../examples/garden-loft.arch),
  [`two-bed`](../examples/two-bed.arch), [`bungalow`](../examples/bungalow.arch),
  [`furnished-flat`](../examples/furnished-flat.arch) (the furniture flagship),
  [`courtyard-house`](../examples/courtyard-house.arch),
  [`townhouse`](../examples/townhouse.arch) (three storeys),
  [`terrace-row`](../examples/terrace-row.arch) (one component, placed four times),
  [`two-storey`](../examples/two-storey.arch), [`accessible`](../examples/accessible.arch)
  (`accTitle`/`accDescr`).
- **Public buildings** — [`library`](../examples/library.arch),
  [`transit-hall`](../examples/transit-hall.arch), [`clinic`](../examples/clinic.arch),
  [`museum`](../examples/museum.arch) (A1 at 1:200),
  [`hexagon-pavilion`](../examples/hexagon-pavilion.arch).
- **Geometry & experiments** — [`gallery-l`](../examples/gallery-l.arch) (polygon rooms),
  [`aquarium`](../examples/aquarium.arch) (arcs and circles).
- **Scripting & composition** — [`parametric`](../examples/parametric.arch) (a `for` loop that
  generates units), [`relational`](../examples/relational.arch) (`right-of` / `below`),
  [`imports`](../examples/imports.arch), [`museum-wing`](../examples/museum-wing.arch) +
  [`museum-wings`](../examples/museum-wings.arch) (one wing, imported and placed twice).
- **Style** — [`themed`](../examples/themed.arch) (a custom theme + brick hatch),
  [`materials`](../examples/materials.arch) (per-element `style` overrides and wall materials).

The [docs gallery](https://archlang.uk/examples) renders all of them **live and
editable** in the browser.

## 🎬 Showcase

The examples above teach the language. The **[Showcase](https://archlang.uk/showcase)** is what
happens when you point it at real buildings and famous fictional ones — the West Wing (whose Oval
Office is a true `arc`, not a faceted polygon), Palladio's Villa La Rotonda (one quarter, `place`d
four times), Bag End, de_dust2, The Skeld, 742 Evergreen Terrace, the Dunder Mifflin annex. Every one
is a few dozen lines of source you can open in the playground and recompile.

They are worth a look for what the compiler *says* about them as much as for the drawings:
`archlang lint` reports a real `W_NO_ENTRANCE` on de_dust2 — a quarter century of continuous occupancy,
achieved entirely by spawning — and it reviews a $2,950-a-month railroad apartment in twelve
warnings across nine codes.

<table>
<tr>
<td width="33%" align="center" valign="top">
<img src="https://raw.githubusercontent.com/ChanMeng666/archlang-showcase/main/plans/west-wing/plan.png" width="270" alt="The West Wing, first floor" />
</td>
<td width="33%" align="center" valign="top">
<img src="https://raw.githubusercontent.com/ChanMeng666/archlang-showcase/main/plans/villa-rotonda/plan.png" width="270" alt="Villa La Rotonda, piano nobile" />
</td>
<td width="33%" align="center" valign="top">
<img src="https://raw.githubusercontent.com/ChanMeng666/archlang-showcase/main/plans/dust2/plan.png" width="270" alt="de_dust2 drawn as a building" />
</td>
</tr>
</table>

**[archlang.uk/showcase](https://archlang.uk/showcase)** for the curated set ·
**[ChanMeng666/archlang-showcase](https://github.com/ChanMeng666/archlang-showcase)** for every
plan's source and the story behind it.

## 🏗️ How it works

ArchLang is a compiler pipeline. Source text becomes a backend-neutral **Scene IR**, and every
backend is a pure serializer of that scene — which is why adding a format never touches the language.

```mermaid
flowchart TD
    SRC["<b>.arch</b> source"] --> LEX["<b>lexer</b><br/><i>hand-written → tokens with byte spans</i>"]
    LEX --> PAR["<b>parser</b><br/><i>recursive descent → AST · recovers, never throws</i>"]
    PAR --> IR["<b>resolve()</b><br/><i>expand scripting · grid-snap<br/>relational placement · host openings</i>"]

    IR -->|"render"| SCN["<b>toScene()</b><br/><i>wall union · hatches · page</i>"]
    IR -->|"read back"| DESC["<b>describe() · lint() · validateIntent()</b><br/><i>the SAME resolved plan, as FACTS —<br/>no rendering required</i>"]

    SCN --> SVG["<b>SVG</b><br/><sub>zero-dep</sub>"]
    SCN --> DXF["<b>DXF</b><br/><sub>zero-dep</sub>"]
    SCN --> TXT["<b>TXT</b><br/><sub>zero-dep</sub>"]
    SCN --> PDF["<b>PDF</b><br/><sub>optional</sub>"]
    SCN --> PNG["<b>PNG</b><br/><sub>optional</sub>"]

    DESC --> FACTS(["rooms · areas · adjacency<br/>access graph · intent score"])

    style SRC fill:#ede7f6,stroke:#6b3ae0,color:#1a1a1a
    style IR fill:#eceef2,stroke:#464d59,color:#1a1a1a
    style SCN fill:#eceef2,stroke:#464d59,color:#1a1a1a
    style DESC fill:#e8f5e9,stroke:#2e7d32,color:#1a1a1a
    style FACTS fill:#e8f5e9,stroke:#2e7d32,color:#1a1a1a
    style SVG fill:#fbfbfc,stroke:#464d59,color:#1a1a1a
    style DXF fill:#fbfbfc,stroke:#464d59,color:#1a1a1a
    style TXT fill:#fbfbfc,stroke:#464d59,color:#1a1a1a
    style PDF fill:#fbfbfc,stroke:#8a8f98,color:#1a1a1a
    style PNG fill:#fbfbfc,stroke:#8a8f98,color:#1a1a1a
```

The dotted branch is the point: **`describe`, `lint` and the intent check read the same resolved
plan the renderer does** — so what an agent verifies is exactly what gets drawn, and it costs no
pixels to check.

`compile()` is **pure, synchronous and deterministic** — no I/O, no `Date.now()`, no `Math.random()`.
The only place Node APIs are allowed is the CLI; everything else gets its environment through a
`World` seam. See [AGENTS.md](../AGENTS.md) and the [ADRs](../docs/adr).

## 📦 Ecosystem

| Package / surface | What it is |
|---|---|
| **[`@chanmeng666/archlang`](https://www.npmjs.com/package/@chanmeng666/archlang)** | The core: compiler, CLI, analysis. Zero runtime deps, isomorphic. |
| **[`@chanmeng666/archlang-mcp`](../packages/mcp)** | Optional stdio MCP server (the SDK is quarantined here). |
| **[VS Code extension](https://marketplace.visualstudio.com/items?itemName=ChanMeng.archlang)** | Syntax + live diagnostics, hover, completion, rename. |
| **[Playground](https://playground.archlang.uk)** | Client-side editor: preview, describe, lint, **intent scoring**, apply-fix, embed. |
| **[Docs site](https://archlang.uk)** | Guide, reference, [CLI reference](https://archlang.uk/cli), ADRs, live examples. |
| **[🤗 Dataset](https://huggingface.co/datasets/ChanMeng666/archlang-repair-trajectories)** | Synthetic, self-verifying **repair trajectories** + authoring pairs. CC0. |
| **[GitHub Action](../.github/actions/arch-render)** | Render ` ```arch ` fences in any repo's Markdown. |

### Embed a plan anywhere

A **live, editable** plan in any blog, wiki or docs page — one `<iframe>`, no build step, nothing
sent to a server (the source rides in the compressed `#z=` hash, so the page is self-contained):

```html
<iframe src="https://playground.archlang.uk/embed.html#z=…" width="720" height="480"></iframe>
```

The playground's **Embed** button generates the snippet. Optional params: `editable=1` (show a
compact editor that re-renders as you type) and `theme=blueprint|dark|mono|presentation`.

> **Not on GitHub, though.** GitHub's markdown sanitizer strips `<iframe>` — it renders as escaped
> text, the same way `<script>` does — so a README (here or anywhere on github.com) *cannot* host a
> live embed, no matter how it's written. The honest substitutes GitHub does allow are what this
> README uses: a **static SVG the compiler really produced**, linked to a **playground permalink
> that opens the same plan live**. On the [docs site](https://archlang.uk/examples),
> where the sanitizer doesn't apply, every plan *is* live and editable in place.

## 📚 Documentation

- **[📖 Docs site](https://archlang.uk)** — guide, reference, error catalog, ADRs, and a **live, editable** examples gallery. Every ` ```arch ` fence on a docs page is itself an editable plan.
- **[⌨ CLI reference](https://archlang.uk/cli)** — every command, flag and exit code (generated from the manifest, so it can't fall behind).
- **[spec.llm.md](../spec.llm.md)** — the **whole language in one page** for AI agents; also `archlang spec`.
- **[SKILL.md](../skills/archlang/SKILL.md)** — the agent Skill: the `spec → compile → fix → describe → validate` loop.
- **[Language Reference](../docs/language-reference.md)** · **[Error catalog](../docs/error-codes.md)** · **[The intent contract](../docs/intent.md)** · **[ADRs](../docs/adr)**
- **[AGENTS.md](../AGENTS.md)** — orientation for AI agents working *in* this repo.
- **[Release notes](https://github.com/ChanMeng666/archlang/blob/main/CHANGELOG.md)** — every version, including what changes for code that embeds or parses the output. Installed, they are at `node_modules/@chanmeng666/archlang/CHANGELOG.md`; each tag's section is also its [GitHub Release](https://github.com/ChanMeng666/archlang/releases).

## 🤝 Contributing

Contributions are welcome! Please read the [Contributing Guide](../CONTRIBUTING.md) and our
[Code of Conduct](../CODE_OF_CONDUCT.md). Use the issue and pull-request templates when you open one.

## ❤️ Support & Sponsor

- Questions? Open a [Discussion](https://github.com/chanmeng666/archlang/discussions) or see [SUPPORT.md](../SUPPORT.md).
- Found a security issue? Follow [SECURITY.md](../SECURITY.md).
- If this project helps you, consider [sponsoring](https://github.com/sponsors/ChanMeng666) ☕.

## 📄 License

Released under the [MIT](../LICENSE) license.

---

<!-- CHAN MENG PERSONAL BRAND -->
<div align="center">
  <a href="https://github.com/ChanMeng666" target="_blank">
    <img src="../.github/brand/chan-meng-logo.svg" alt="Chan Meng" width="160" />
  </a>

  <p><strong>Chan Meng</strong><br/>Need a custom app like this one? I build them — let's talk.</p>

</div>
<!-- /CHAN MENG PERSONAL BRAND -->
