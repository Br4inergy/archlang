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

<a href="https://playground.archlang.uk/#z=jVZdbhs3EH7fU3yQXhxAdmjZUuw2CZC2AQrESIs0QdAn70gcaVmvSIGkvHIDA3nqAYqeoQfoEXqUnKQYciWtHMepnijuzMdvvvkh-3gBZ_lwwto7t0BNlhu6wdTFSHPGp49_4fQci3__QawowjPpAArihKV3c0-Lo6Jf9PHaxcrYOSr2DBOwdMFE4yxrTG5QkdVHeHnN_gZuyVYsxchYMYgOBL-y0CZEslMG1c7OQUUflhas0VBd46B0Fk9l-RwU8XTpwvPy0QCcYGdmHVee4Tm4-poDaE7GhijQEprzoIRT9HFQGounsv0cZKeV8_j08e9ygHLjlA6UvUcDkNWIFWNCsXq8UWpJxksINRkNt4qY3BR9lCF6syyPUAYTGR8QomeOsM7HCrdlCicktNg4zGhKuv2_rMkirrwVcb9JW9o5X_TFqrWR9AzSal5TCJ0vc_Ka7VGRUHoXbRp_dKvAPXwogJU1MWCxKIC5Nxojhc6vjyX5mBIWQJ5xrBRiZaZXAwTJTjmrV6EqtyrXZLUQBYlKI1WgjXG1LABtFgG0krzWdQHcK0ZRIMts9LPmUkIDwOvI3jiPfLrlEDBUCh9woAbqEQ6ejFRa3O55M4X4sPfGLy_GI_UZRpbwYQbZ78sYDX-NRyZxv3clK-xS0fE-zt6nwzaKtLgPQ4r0f2AMO4EMW5gCuVOMfuYva3PN0mWZcDC_M8RxLWeipgnX6F2Ya2nkx3hl4rRi28MqcECdt6_ypqRfmgLaNTYhboKY0xIKjdGxwsmJkCukFnccUizp6GHn1O8oVj0xTIeJzV031mgZq45bbtyWY9vGBXLc0mnirC9n3tkIqey2JiliKMplnudKQeYcwzJ5hEg-IjRpntnokIXbQ2zrKtRGi1lCbvcE-8kW-_hMqWTGqHkW90BSTC2tVCYUMRpvXc-2tMRzn9CEdSEdXmbPUqZWQ_UV6zRPPv3xZ2aTOr3M53szr2KJwNLlaTqR5TqnUP4GV5s8lRP0hGvXpA-_0WLy7QZFuJRo3KrWILOAiYm2Ulgs8lSVuijfX_780_evXr69fPPudXm0H3ZbzW56xXE_-vO94Du001wxVrsmO7Q9KVqf7rQeKnXHbpcTScnGTj1gNzobbfHGn9m1M4kijkfbc8WsAGYrb00apDNv9JzbMbx3-7TM3WwWOEopA8buCmwHEaK73iA8BCExfwGi7dXLYOzVQxBDdQeij7cVw6_SdU4W717_8PLNxYtfB9CeGosJz5znXEKG821FUfrGapHJRKm6XFIzkqJIoJEmNcu1gWsTzKS-EdvolvAUK_YCYlHlhjIxPVPyPZ5fE4In7T1Aba4yzfRIyE8UrgOnd8oAVrZBmDrntbEU-WhPFwmsI_vmsTBxMbrFYeo1YzfpyZPqTKn1yWmqhh1OjqcDNGUbWdgmp-MTpdbnu1n1Vsx7-0kWeb5CJd3RLaHhqCV0rtQ6pW0D_oub0T52O1wSdlrvY6euuh9cKjuj76bsPrZ3E74PO7plJi2_PeyNkjIO1-MO8ffktcDdEaZyDfv2ABkXnQMy8-0BWz3O76SnmWInQAejK24X41Sp9ZM7GBMKxn4ZoytiwhgrtT4dpWkQTazlfbT07jeexs_eb6mVLic36L3w0-qC7LwHTZHRG6rh-FCdHR6Pe7gtbov_AA">
<img src="../examples/laneway-house.svg" alt="The floor plan the program above compiles to — click to open it in the live playground" width="620" />
</a>

**↑ `archlang compile laneway-house.arch` — that program, rendered.** The walls join and hatch
themselves, the hinged doors draw their own swing arcs, the sliding and pocket leaves draw panels
instead (a pocket door has no arc, because it has no swing), and `dims auto all` measures the
building it was given.

**▶ [Click the drawing](https://playground.archlang.uk/#z=jVZdbhs3EH7fU3yQXhxAdmjZUuw2CZC2AQrESIs0QdAn70gcaVmvSIGkvHIDA3nqAYqeoQfoEXqUnKQYciWtHMepnijuzMdvvvkh-3gBZ_lwwto7t0BNlhu6wdTFSHPGp49_4fQci3__QawowjPpAArihKV3c0-Lo6Jf9PHaxcrYOSr2DBOwdMFE4yxrTG5QkdVHeHnN_gZuyVYsxchYMYgOBL-y0CZEslMG1c7OQUUflhas0VBd46B0Fk9l-RwU8XTpwvPy0QCcYGdmHVee4Tm4-poDaE7GhijQEprzoIRT9HFQGounsv0cZKeV8_j08e9ygHLjlA6UvUcDkNWIFWNCsXq8UWpJxksINRkNt4qY3BR9lCF6syyPUAYTGR8QomeOsM7HCrdlCicktNg4zGhKuv2_rMkirrwVcb9JW9o5X_TFqrWR9AzSal5TCJ0vc_Ka7VGRUHoXbRp_dKvAPXwogJU1MWCxKIC5Nxojhc6vjyX5mBIWQJ5xrBRiZaZXAwTJTjmrV6EqtyrXZLUQBYlKI1WgjXG1LABtFgG0krzWdQHcK0ZRIMts9LPmUkIDwOvI3jiPfLrlEDBUCh9woAbqEQ6ejFRa3O55M4X4sPfGLy_GI_UZRpbwYQbZ78sYDX-NRyZxv3clK-xS0fE-zt6nwzaKtLgPQ4r0f2AMO4EMW5gCuVOMfuYva3PN0mWZcDC_M8RxLWeipgnX6F2Ya2nkx3hl4rRi28MqcECdt6_ypqRfmgLaNTYhboKY0xIKjdGxwsmJkCukFnccUizp6GHn1O8oVj0xTIeJzV031mgZq45bbtyWY9vGBXLc0mnirC9n3tkIqey2JiliKMplnudKQeYcwzJ5hEg-IjRpntnokIXbQ2zrKtRGi1lCbvcE-8kW-_hMqWTGqHkW90BSTC2tVCYUMRpvXc-2tMRzn9CEdSEdXmbPUqZWQ_UV6zRPPv3xZ2aTOr3M53szr2KJwNLlaTqR5TqnUP4GV5s8lRP0hGvXpA-_0WLy7QZFuJRo3KrWILOAiYm2Ulgs8lSVuijfX_780_evXr69fPPudXm0H3ZbzW56xXE_-vO94Du001wxVrsmO7Q9KVqf7rQeKnXHbpcTScnGTj1gNzobbfHGn9m1M4kijkfbc8WsAGYrb00apDNv9JzbMbx3-7TM3WwWOEopA8buCmwHEaK73iA8BCExfwGi7dXLYOzVQxBDdQeij7cVw6_SdU4W717_8PLNxYtfB9CeGosJz5znXEKG821FUfrGapHJRKm6XFIzkqJIoJEmNcu1gWsTzKS-EdvolvAUK_YCYlHlhjIxPVPyPZ5fE4In7T1Aba4yzfRIyE8UrgOnd8oAVrZBmDrntbEU-WhPFwmsI_vmsTBxMbrFYeo1YzfpyZPqTKn1yWmqhh1OjqcDNGUbWdgmp-MTpdbnu1n1Vsx7-0kWeb5CJd3RLaHhqCV0rtQ6pW0D_oub0T52O1wSdlrvY6euuh9cKjuj76bsPrZ3E74PO7plJi2_PeyNkjIO1-MO8ffktcDdEaZyDfv2ABkXnQMy8-0BWz3O76SnmWInQAejK24X41Sp9ZM7GBMKxn4ZoytiwhgrtT4dpWkQTazlfbT07jeexs_eb6mVLic36L3w0-qC7LwHTZHRG6rh-FCdHR6Pe7gtbov_AA)** — it opens the
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
npx -y @chanmeng666/archlang context --section errors      # …or one section of it (about 115 KB in all; the catalog alone is about 37 KB)
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

<a href="https://playground.archlang.uk/#z=vVxdciM3kn7XKTKkB0triir-6c8_EbJb7u6Ydsvbku2NmJggwSqQhVGxwAVQomSHN-YQe4a9wr7vUeYkG5kJVIFFUi072qOH7ioS-JBIJDITmQkewF0u4fbNzc8_vL3-9hpmhZjbXC3hn__4bxDgVvrYOm3kE-SqKKzKJDyoohCwUi4HUYJwTqS5zGAujJjLDrhcwrLAb_YOYKaMdcdOLbCbVU4bcJqaFKKcV2Iuwea6KjKwUnbh-kGaJ5ercg6ysBJUCfJRLJaFtCegLOhS7h0AN8h0KWEli-IL_IC-wyaIvcp1EY2gS_rS5lK6LtxWZiZSaUE5kI_SpMpKe7l3ABOrnJzA4Uw9SMikUQ8yg1QvlsJaKMVC2iP4v_-FyVIspZl8PrGpKOTk84l4lJZec5lV9Ekh57LMJnAowEhR7B3w2J5n4JQrJEwLnd4z4i-6xIEL9aDK-YmV5kGl8sQWUi5xpitVzm0HjC4KmUG1RLa4HDkRxgRbTZ12ovAkGq0XsNTF01yXREaai8VMGplBqfU96NmMGGVdlT11QJQZvb47trlYymzvABbCOmnAVspJxhQmncBKFAXIbC4RdKpXMoOpeKrxeAaAw1MnbH379j8g09rAvSozi3JFSyiB-Oxy4SAX-KRhKonPGRzaQmXIi6VO76U7maqZLrKTqTDlCcvZUQeWRcXLPUF5kNlk7wAyORNV4XDJ8RsjreuAFGkOq1waCQKmlSoyaWBFUidSV4mieIJl5UC5Lnyrq9Jh30WYFEoG0j-BQpXSErOedAVz6WgKHZjKVFS2oSOIIU6YmpbyAUc0yslLEPYeIYVJc8ikTY2aSjg-_rvFpVKldVJkHVjlKs3ByKU2LkLTJSDWE3MUl2Wlykyv9g7wqy9xeb4G4eDLpbZfT5hFAiYzIl_rJS6bdUZKdzwTKa2Vmk5xg8xYGIDxSI6QzEI-yAJ6kxP_1J_QqNYJZSZwaMVCgspgql0O1MJ2_GYTM8eC86AV74VMV9NCHudSzXO3dwBzsQSNnNkmOijDM_o6F-V8AofYSIoHaTuQGbEqwxpXyyUKKimpQDXuWl3K0k3gc5gsC5FK-Oc__gcWyhht4JHI4ReZwVIogwyQJYk7TIXLkQ7eTP81SGBWmVK5yqAwzMRCFQoFITXaWrhXLs1leeJ371Rm2PeEuOmF9cRJY5AGnFemFhZE5TTuDr9ErNcWoqxEAZladPcO9g5IMy8L7WBmdOmlgBcvzP39zYe7Nx2vD6DUxuXSlJDLhbJLEnhU41bDZCrS-wnKLrJH_mclnDZjVOcTEEZS99ur76-BNPyh1ZXLj4IUKgur_Km9SqzphUlJAzAyy6ZnQSByLkwmS5iSlhH3PBiNADORikw2Csizy2tA6oJazon03oIodDmPmNANGhvFwUKpyS58gXpdl8UTq2zIlJGpU7q03T0yS_tvgiH7CQ3ZPvy6B1CVyllYLPYA5kZl0EuSPQDS9HDVR1OS2VQs5R4AqX3oXY6wBbEcquUewNq6Ujuvm0mU9gDYKuzhVyhlv4a1ZIxozfiD37DlAVw1cvrD1dsPW-W0g-Pm1EaXqewGkfcND49AWPgS-YHKgWAPHztPR_DXsCH-xqpHlE4Jx7ZRWDLvWWaktWKKFks_wiHySa9KtgSf0-Tgc3C5kZKAV6QWH3Gz2KMv2BsQRpYO0spZ1sVE1WeMQ4ps-gSoHpyTGRiJhqpM0fqzr0C4TF6K3Wjow4ks-118nHRgIssBPx-RxJOQoGoiRWAVrj-kunRGpDgzQpzUrsWisrJaHJOd7aJinnThvWbSlPXq5u3727evrgm6Vi8o4svKLLWVl7xZCDlsAJTEpSwtz8RbBebGZxYymSqrdNlBHyd1xRMUyu8OpOQzCzlOFKno7kE0aLOsKLrA_FDZV_T_UhjH83W5Su9LaS1KM_wKh0knOYLD3nkSPfRPE3wOD2mhrYTfCJankH1F_wvn-1v1iwTs-og9oBBTWcD-NZO0D5WVlgSTIA5gokorHfRGyaSDWxQms6Ky-aQTtINbaVZjtdRcejVCMrzACU9p_5OrgL6Hh9bIVAF3b95--5frD5Br64Jo2Fyibu2PElgsYKYNyLJ_IstBByarcdEfo2aZQD-Jvh8vjjywqcoStVykcFCW0PzjriBvs14NL8Y9hqLxUQL9NNH_y6wXYsQupTDSoOKTpPVSXRQqk5Z9Q3KLhEF70CX1b3O9kgbmWlpwenn84e3rN3eeQR4x2hhB7khwSWcFLr-7_u7O-20T4eBslCQTmMpCr45Y-4owFFqQQCz7SAVaXZTlUoNdBfXfpTa1YQzdVclyI8o0J2d_eWzQ3ANALQksQxdJ8nhBajaGmQqrStgGU8gZorRhTpPkcThqw6xS4LZrMFPtnF4wEq0PNSKYYZI8nhE1Xu9-9Wf8EfK765-u30GPxESWzjyx43RZn6C8V-4dikyhMJ54N6MD3pf4U4n0Xh_svza6KjOYFVqbfa9uDuD4-PgYaI_R46f488g3pWQdlIFBScOtifK7EKqEB11UC9kJx6jm-FFIVxsL71kcstcRtjTty6nMlXc0Ij_Gn3TTyuB5D_2Z61evr1lZCbByKYxw0p-pUmXSQk46Dey9zNA_W8DhcJgknV7SRz3qNBz2Tpt3InmSribojCkH06qYSws3P979fPXhVXdNjTNj5aOTRtH0gxpHdcZLALUyH7A2D5_yOw8aPovo8h_hJNfIMyJTlUV9mEC6aoZY60XrQs-0RXD-d43PVjlVKEfnh_kl-wPkTFp2xshvmOkKPRtyvrw1pIWlGbMiDYyV1pGS7CDDvGvX2GK3Uqk8WmfbaoxDj8uGc23WweHxaOSNH_372zaA1csA-MnzbyuQ_TiQ7364Ewi5CrDdqMdApwHn1MN4Pn6HJ4djcr1rDAuH3vPEhdjgop7NVCrHctew7EsME88HehhuJX6pV5k049XzSOcBiR76zyF9hKZeEqD4aTsWH6Ye0rH9KFUM4DfVdjRS4GP7kMJL0c5jhsXLdIJuDh-T7FKV68eiTJbtZWwvXNEjt2a82kpJP_iAwy1kbAeSzwFF_T2DdoCph3GGJv05IR42_fl5x3bIVDm-V-4FAhXP8nwnFtrSZwmL-vPzDsLulfNgW_d8sgHGLDtfFwOyq_5ENze6WsqM7RqdTPCU5EOFv9ew_kIhGX-q3r_1D4i6X1uU2t0fs0YH8vlrhRccJXx_RC0TXP_X1Hof2PXnvhuQwTo0kKyoGkjUIwHyR27tTxO-7wYmKwUmMyiRmkw0ZY_9iMwfqHUgc5VuwgnyxQiu1iQBbnDehqPWAQ6jT2HafjWJ5d7N2H_H_68znM0nOXuXgJHi1IlyXkh2FtBe3l5Dqk0pTRS_VXzqwXMFQmI4FxVFjXn1_vW761c8rwcl2rFgcnZKPnGizy4pUCCMFB0_NeH4jIuaTausu8EoNhAB0n9deyTrhmEwJGkf9Jst6R_qfp6ht8gHv-I8wsbA7CzzCg1bC4Tvj8N-fCLl9Ql_BMwIOQdo1sH9UvmDLtNag-Pqn0YCyuu5vw7OCBvA7L97qhs9x2LVbwG_osYtYEbYAPYngkb-I-DReWtL_YUb768Be4QN5BCurJHPW8j9CPmOG-_XEvgNu9m84U54o3RQYClNRL4yLQ6Lp25MKEvnXD1I8g2VoYOsBVFDYzYF4tiixuOqD1oKPvdSWGAqjOxQy-MCNTAdYHwc3si5wuQGhmVqZIplpim2nRuxzDt4xsYxdDXHzYjR83sKPd1TLMyPT3mdo809EnRtzcH-MxwM-viNKAq_Ayjyg4eNqhBomdbdbrITxJtLCrZTaoCi4MpV1B7-2AGMI17ZVxl7SbUY4jRO_Y5bqczl0MOtRvaPjyuU-gA6WXOMgPSU37MtbK9AImzazciSAH8R0CN_dNcQkbZoxgg2jP_8G1mf_tkomscgaUbi88NWoLFibrB22EppzAcOebyUyuDlc5YLRcs7_sIBUhtYPkqSGrMF5G3kWD46TyXPsz5-tpjqDyib1OrKtaCDmeU_TsgxjZEnLRx6X4HScyQUw1oM3Qb0hpb_MKe3DW5wUcNd7J43-l2pNp48gmm8V2Rfg0ISu3N5YlXYwDf-Zg0fPkLwZsY0-RcCBu0aeS4X21epdlF3iX4TC2ozpRnEp1KZ-tpPRQ435PeH9YrhIC08Nmxjn8fxRK-LVi_5iDpAuSJYDIjTDLKvdH044IXzL-ucRSo3OzbHLuravK4LIsY4dnX2dnlNZlbYn5zbhi9rStdnRy85u7w9dYphirWc60eULsa4FIYqk253UHuHDIbkMUeR7WdJAp-Dgn-DXq_h_Zmfoz-TbPbrYbg-kq7W3wHwjtzZ_SJZ30Qb_YMnciiFj8Ef7QLr9z4lWCTCveE2sLANXgDWO0ue4xIcoC9uVKbNLrTaSq5vjfP1rVHDsQB2fMASW6yJWhPM_oQR1gY0k_a-bd87_TNyeznHc8ohcQqix-arwfCmOc0xgY4YuCAd1LlHTXAes0TPYEzRr8plMQt04FFh0KZj0KKjBWKqOWxMZpQ0IAM6Dg4DSuSqRxkMPRPjIkY5Q5TTBgUBHskM70ZJ9Wwm5diRl8iHSWTKWeP_4Q54HNVc2YoizIK5WtNCR6jR2SigYPrkfJSg0-kwPt0_e44qzHyvu3NI1HDYzG19qbaDKFFqaKMknfOzZm4IQ_v6RWS5hzFm3kHMBaaxgt2rzcJshrke2uUxSFuUaSN5liNVuGad0_OaKgoG9GoUf57aWLiqdI2js0YS71wr55SO7AXChuSZ1Gt6GgaIbX8zgP90bFV5_8IB8KjwHKR1-kFGK_ICyNPR85CZsvlK2Nxz4iWQZ73nIWdGZY0v_jLIs-chqehnnIqpKqWDDfmpXcCwUB-ZtLKYLV2T7Avab8NkLeV98TzMVBjrtC4imPMLFMVRDTPkczn8TpiL0SeB6SW97ThrMO1cKktDi8c-VxKkqhbUOFoXSZV5olDdcxhnwzbG1qQutfCHkp153VZOdzPDvAUlzlVHKCHB3FYXgk3eMcV0ztblZFirgigeuqUv2cuP9W3v-aocF7oq55JBLhoV7FEuYsMdHxF2g_RQZ68p8q0gfDBQizoYjpJ0_HWddiTBCiKRJODwPBoiRDDqnsMj9LsJLPYZisoIKefpgguBOtX7Iay7-0F3Z8pwpdW_KEPf5-K5UIXrk_RYr2JlqstMmCeuZLIdn8psSmZDUcVcFAWXahw0pY5rdZBxKvpfkNPvw_6PVDD556f066T-ex0CMFRxwgU0M63d0mBYBTlVaq4inGoqNcF4-LLA1HAoBgjB8Q4n0G0oL2pVifIAdACzCou7YKEc1cWxUFJoPaSTfcofT9JyVln5e9Lw7QT8euo9yuiGiqqYz1Eq9lNyuklHTWXWH1t4vhjMl35x7O10e-6uRH_lOZhRVER2vhtpKrPBRwi6iJB8xnU7UVy99aIk53OJSb81n89y7k5MRnm1oCH2b-OK_W2ZNVyXOoro01VR_iKuqPvG13L1Q00dv2_JW5SyZMjReciJNJozhnyHTfeb8H-ctWpROQh-xzrkTioHW6ncUoUqy36cv3mu4WCNglCpureWPYt17iUmtt4d3765-uH6VTvvtTJiSUsT6lf9YKHG2QadwiV1vp7apTkXnrtcmawDVdkUjdfViXrWqjfFskCsqaHchMuj5NxUkt4RpHcoExL0XK3gNnMJfo4b-bZYNtF8t174_OO3wNpL0FHDjVqhOhv3PY95y0Wd_iycdM7IwL90pcdcNhrRFqcxIhEWJUUofXD9tHFCKO3ai0WYm-7KkqyVJdH2vsTcDVb-ouNJ64TXEbZeO2Dj4Q0M3Eu5tEFaPO6sKgqfSsKM6VqKSMCgm8AjDLt9WABdQNJT60yV-sr9hcoy_HCG90z22hl3InYt-bg98_iaW36EAU2C6BNa840cEWszCqAGgxNitx-P3LOSCZ0Hv68zKz0fNWYbRXHOpvNZ3TlkNA7gB8pdcGUfX9W55Hr0UFCvLEfrsJAXY-Gh0FDihRxhMqOn0hflqOCBIFErdF1wJfRiKV1ct0hKoS4KFkwSe5NiBrnAawt8M8lpSAspTLc1VVSYcdolVL0Tu85GrRnvTLqgOl2HGfwxmAUnQnB3M8C2_jtSSazJOGHDi-dtOUXtR89kU7jnZig_bJwNtAjsvInhk_UpMzYuhdUE5q-IFE-cOvaXE0kjHXIaGu3F7c2Pd29oKTtQ6FQUTbH4cSHLucthNEiSI9IfJFVc-i3IF82FkdnJvMKyRqyOx49XFHimWxZeALt4kWG8mATRkoWaSqw-LZ4ifXTz_pp42mlqXr2JaC7eFKz40KqF24LeAuH1N75dgIXmvrzEu8UsqXhVolEp4STjhwhbJaTzcai9kEI3PlnOFra-BWH9pYnyQZYIKQpIhZWhxDaTM5k6X5mS-ZtxhcLLW5mWYZ9hW7ycitM6nPw8_ubq7s34p7dX42-uX324ufl-ctRcxFtbZhNdlOG0vbL-utheXVXAcwm3GP3qI1d05QAvgCq6CWC8qvdT664Ra4SiGpN622B9sCmpdAvTWkVxCZOfx0js-P3N3fj633-8urv5MP7u6tu3719PkDaPa4HpH6B3gscHKqEN6aVZOM4f8E2hL6itVY-I_gOy5e7mZvz-6sOHm58n9YzJbPm7kHwtlbbqwt8WODwdJnz_iTIdqImOuvAdXtEUFAMq7i17LOQO6WXt9uDJ3evRqcw-s9wZbyRAimbWRsc1P7_o6g9tl_a06yFDvVPgPG9HL4OWRDPs7EiP0xWhJ-S5vxbMpFoZz9j6Cxbq0eVBRGOv57NAs9GVI_WMcl17jYGiCenECV90QpLD_eYYC7tihkPZQIEIEoKgpTBGr-iqKjujCylrp6FUi2pBXKKUo99QuBPm6EOSnRHOU-mvj26xIbXSre2HcKSwXqC2ZTmIug8-3n1LxvTT-yHbUnj9xg75fGBzGavf8RfrVqH8a2uq9LSdUWwQBrsQKOMUedZxVn0t83fQChJFqb8WHIUFwwkxoqcF5-1fhwvm__Qc4pY84lRmcYC5j0UnoyYWOQq1ThRHRDex1b9EdYk3mLI65Rb1H458nHtn_9ov89lDDB8O4tLSR3Lpov7PTwD9EKZgxwQGz0-g1z9NYoB6Brv6tybQG_TWZjDcmMHgmewnSSIFlZvMBdZgRrnPyJWK4vMUkkR0XgWk4ex0PTDdcGErRIsPmGSIIVor-RKIC1yK3wnR4uYoqdOczUSaNOdWiCj3ShDIi4sk2Ui8bkDgZd24LjfEEahIcaWsPMayRKDiAe94eSP6LqgC_x78wY_l7EnfdM56zfz6cdh-6_Q2kvbkeXfOdmXtPcjm0RodnoLOMlQamaFJrz3SnTFuH6Ll4xD_NkB9kpJ0ixuMzKpUstsSuQt05D6cbPxmQviRBOWgKjGfQ6j2r3-b-MJMOvGr7KuHtXM2KopRw7lBKCCOZ0q_N3BZ_xgI-T93b97eev_RE-Zj1KSVO3XAuXIoizRR5fiOukfmgHfzMycdmNKvTzAH5oZC5BiWnMs6UNAEucnWNmbgDyZSMo5qUCwGf8DEBysfsWvSoUBfByigC1wMz8EYavTkG5GmA-QZNuo3tyf5B04YcWn039G9b1-7Zx8Db3ONp0-wf2XS_J0o5_5zLB3Y7yf90-Pk_Lh_tk_Iv-39Pw">
<img src="../examples/hillside-villa.svg" alt="Hillside Villa — a two-storey villa with an attached garage, ground floor shown" width="620" />
</a>

<b><a href="../examples/hillside-villa.arch">hillside-villa</a></b>

</div>

**The site plan** — the same language pointed at everything OUTSIDE the wall line: a surveyed lot
boundary, nine `outdoor` ground materials from lawn to swimming pool, a posted `fence` round the
water, a `garage` with the sixth door kind, and fourteen outdoor fixture families from the bins to
the trampoline. The ground is drawn and measured but is emphatically not floor area.

<div align="center">

<a href="https://playground.archlang.uk/#z=rVtdchtHkn7HKTLIB1MRINz4IwE59EBbkMSwTGgperQbExPoQncBXWajC66qJshxOGIOsWfYA-wR9ihzko3MrOpuNEDJclgPIn46v8rKysp_nMJdJmH-893r-fwWVrlY20xt4d__-m8Q4Hb63Dpt5BOsxEblT5Dp0krQBQgYDOAR_9uALZelWYoCcu26kBqxK0BYEJ1T-Hh9N4NtLoqX4DIJy1LlqSrWoCxkIl-BXoFyXRBFSt9rl0nD3ygLa6PLIu11TjunMHuQ5sllSCtzK0EVIB_FZptL-y0taWGXCYdkqrAqlYS3E3kOuSpkD-4yZUEXEp_Ar5ApYpG3pCyIxJUiz59AWVvKFITtwi5TSRZIdpnOJWy1Khwyjh899HvDPtjSrEQi7UuIrXIS_v2v_-mcwhK5F-Yphm3pGCHXjthBCeJ7m0npulDgR7EuXaq1if2-YSOcNErkFqx44t1JlELnFOyvpTASNtIZCbp0exu2cP2xC_FKFomMYautX3yrdQ6ySHJtSyMrmVtnpHSdU1gZXTixlnwc_VHY46APnjVYqUeHtKQNSlpYlaZQNqPn1sKksvBsPOHfzincK5dksgiUNYUIX_H53s6uXsPdu9nHGdy9u53N4M3VD3cf4fvZm_ntjL69vnmLD8Dr26tP1zdve3AVBOXFj8d0M78DAUbrzUtQqA2dUxBLKwuH29tAnEqbGLWUcH7-i9VF_I2FGB-3f_9H3PXPOO1EbnurXGuzEEaKxWYQk1Doe9wgKXnnFGKbZDItc0lr2hicWOZegspZQGrIRZGiWlbIXpw1tiqskyLtwTUehF5aZ8rE0Xbe4b7xOlZHqIokL1OZ0qdWQ6JMUubCKV3g-d9bPFKh1pkDkRhtvfKiNn3XOQXnr4kA64STKTz0warNNlcrlRBKfR-DErGcaw5sJQS8kFY8qWLdOWUdxW82OpU5pFpaKLTrwRWJA97ezj99pEP8cPV29nL_SijL1qSSMStmF6xGaOUyXTqIt2IrTcw3gQl3kvaqWPX4Ou90maewlGATkcsUnG6oaA_e4ba8htIdZCVEzt5e3V69ncE18zm_eze7hXdX79_A_A19cjt7P7v6OOux2uBVh9JKi9BiLWOWLLJwr4oUmQ_LVIoiRWrh5C09f0Kijj8teNnF3Xy-uLm6vZ1_imEjhaUro9xLGPfGsPHn2QWxFqgyHnrQu4QN2batMPcyhTgRJoZCytSiSlmgy6ssxPTCs9plKatHlxGz3uhbmaASiLxzCrkUK1YYJ-4l6iMkucDdCQciz7uwlAm9V44WtzD_2-z2HV5mI8iYu0wUYFFPUFW0QVHkCp1ArWapsJlMwcjEiWKdy6YJZ2ZZ5YQD_SBNJkUKW6N_YU578AmtNAIjEXLC31k8dmXh9ez2-m-z113URdgZ5Zz0_shIq_MHaZBiKdk_kM9wmUruC2kt6NWqcwpSJBmQkSGeSRjksJBAuQzIWPTImaZGPUi0gMEwo-CDBQ1fxrT7zilbKZCbbSacSsj_IJuEF9QHRGF30oR7xyJhlZ3fXs9u7q7uruc3vPoWLxSZctu4RcHh3Mxv7951w10ptMEzKiCTG2W3mTTSX7dY_loKp80CN0BKbXXpssoQhYt0543JLnvi26we8JjxarB6eSP_baoKthEkv50OzsVlRkpYypTsJ0mW2ablViIRacNVSfOgEglL_MA6kdxbELkm3HqvXjA3M3g9e3_9_ez26m4Gn65ub65v3nYhlyuyFbqAbWm22sqX9DzAp8XtfP7T4mZ-t5j9x89Xd_PbxZurH9D8PvZp498zlzCAs1w-yBwGL8KRoB5kYqnI_NP2WS0KTdC8m50qUr3rwbzwsRXtgwIRpPdCgEyQ4tai4BMUdiuTOlYiXBQkC24r9TaXYHMpt7g9lIq0DtbStQ5MgkEzhHaqAJE-KKvNE9ryleMTAshkaZR1KuErIyAVTzkZWW-TNrKoOMGIi4WQCLS8qEXBPaycNISI1xaXRWPWg1iYJIMHkatUOFavJJei-K71DZyfW2dU4mIwcqsNqTSHcb0OyQ3NKAYd79Dqn8BvHYCyQMe72XQA1kal0I-iDgC5DbgasDNOxFZ2gJ0D9F_yI3QboNx2AFK1sSBKp4lxkef0cNPTdwByuZZF2ukAnJJYgyfrQcxHFn8b1xcrJneJ8qQgFmWnC7zsYiMhVYZtmf0O4ipuJOSGgm2FocCTgsyY7SGFlqq4Dxd8i8byTJBJPU812cKtNO4pxJ0E-sP5h9v5hxfEhUhTy5C9XLs6JkGNH01GsPm__wW2DMsnjLkTBzbTMheJ7KFYMOBFuUNQVJIjfVDvvvFh2B6cRd3oBZwNBlHUfEX_v8Bv-VUH4HcW8sdM5jkksnBG4m4sq3MzqRAFvH8JAvr93hgeYQqbEBDgbRTkRh_hAjbeiBKuLihWY_bPyWSvclHc9-iQHdzBKxhGEYR_pyAfMTTXpvYTHXoWjUIfTt5yvEQ2_MQLh9yKSl9Z2sQhANz5BwHOBuMo6o7GJIb-9OBNP_LvRtHhuyG_Iwj_BiN-Sdi_77GyW2R9IK1SFDzWvPSjCH6Ds4tJvTS99oAHMIPPwkwHNQy9fgZm93luaEvTqOaGX7dRZP_LzEyihsgmR2HWwhyFGTAMk46OHAQpK7APUOkrs8gQEwBDpqZEwap_ShiMougRNwKQi6XM4eSdyPMTqP9RdEkYqPhPzXC_tZB1ZfrkF2qoEC80GkbRI35QLfQRHz9pLaRXK5XIFrD36jUwS_454Pf0-Mk-MGO0gEunKtE0tMQDT6LocdgE_tmpXLmaZwIu-UPYJS3wkHpW4JOoBT5ugv_oI5XXFKmcMHjA8OHL_gI-NKUFmvpACyD240XzYEPEv8e9N0Mdtitozih2o4i9W5UJ2LByNITRm09n7BbdDdFyhJ--ShdMrwtgSyMcsQI7lboML0EE6IAkB0IUmDMgK2rFSZ0KYWWoBzcaYiKMMSiAGIP46jWi-Nd6Kwt2HpyioePiWG-D6TijzxYIuvjx-ub14of3Vz9_nHE0QWG2kavSCsoy0SxrrCaZdYkxh08ZKSsx4kHmFn7-QCEr4zryNQqzTvhFbJYYR_FuMasttA_uNaUgkmNHWrjQKARpNjJVGHhstfUXP0Cj9_bx_UG2Urnho1kLOuVC5iE5CxlM1wPj8h5S-fgmF8W6FGv5DWckiS4eZEHsrLQBUfhCmFjqB14uKR3FkQfK4Pnwf5pK0R8NxkErhlEUdVqU3phgTQHdhHBo-QLBNIr2VYeebiF4q9FAuBg_j9CwD6dwBVud3EtHR82HHq45516FhkQbo1K8JSE9YDHT0VofzRF4vzeEjUfWK1iib-e7w_pwphwnyzAZR6S6Qe8mUQTbvMSUntRJ5LneiSKRL9qCJkvmmeYdD0jKk2rH-IrVDm-eZ8cbHVRJf0Yhw9qU6TmZGlqD75JwTmAUGp7NhD1y4Lw-vthn4EDkyLPng002SbIym4ajTrultLeuJDWsDl52Akxf6creNrZ_Ua_evwg6xmYOUxdfMUTubZcvf3W_Bcd10vhazrZ0fL2x8Bcv1UrnaUwMEFceuZF_gg5mcovO8jsQbLTQVMFWKFMTQ826J0llct-DG6lwSY9td1JubX398KSooPIRhXr2gvKYosxzuqV8YlRXWWLdisxQGoeiXcgDvBPn_NVJY1DYPgNcSriXW0e5kUHNFSSa9pHT9oAlAnt3fNSvLxze3hYhbhJCNWaPcDga1AdXK67BHJAPkXNZCpVUUUUee4tPL_cP_5AsuP8m2RTjtFpjj1CFaGSP4eloz8cdIWuoZ002aJANgoJah9qBsbrjoG0aRd3xoHLtU4xLUECpMpgv-hM8Pz8_h2v2AfiaPqZyN9XMU2nv2fGrIlhMEEWSYRagt-fkj5EiL23GC6HYHi_9bmqkpdb3uIXVEaSldk5vGKyJ5GOpFlKS4U5DBDYcRlH3IqpDGAyRogiMxkIxYjQW7LSgrF4JAvKlSbKsLGgr1-i8YYzRpZUOBnjGHP4OOPxl4IYPqIFNua45pOwhGlUsEj2K6TMA7mGBNQECGFP0OqjjQDz1R1SCPYAWwg7ds_ns3qKwt8thYKYyrw0dME-I84eAJv3PAC2FVcUfBJpOPwO0S1gn_whQP9pHakH5C7awWI7Yw6OkzINcVLL2z7f1yGFQA0e4aqLUR34cZWVUupZfQsFc5nMoHPUvuKhHUX7ECjipFJCu6LQN075m7IvP-uMRWpJpTY2mZFRpTFWT2DtqlTwlYf0JXdHaFOHq_csWfdMeoav1bbLKJp36B24wAgq9yy52AuqeIwb83JQRvppbUCRftaaCG2wE7rqQjWCZOkxYYDsXO4wlMuHwGay2C3AqBPNb4RyWoH2obLEcRlub31AS8vHdbHYHIgRMVKzD7rJydZMH45yX46juRrDzTdVGFhbDZoUVHrAO_bderZrdq29CTmLkShrqC9V0zR4G0m1UnivqulqKJH3lyQdDvsSv0lfrBdX5oe4FcI445koXORlvYVu582tPcHIIuRUuA6xtsPsjSLQ2AdGr1MhDHgJQZphDjv35qiDBJr_B0wXm88NRg6c3lFEi2ckzoEvKPhyFkA7OJtMGKm905EGfAZD7AH2MHQICb-syABwVjNIA_o8vU1xQnemyVacYDhv7-oAER7aUowFrCZpigD28QcA7cvgUWIH_0yhv7DOEPnkwbR6-TO6PHTz2XIE7uAGuP2a82pZgAeJx2Cw4fNA6P7Y9Pv89NRhTde9y1HCMQ7Qt-F9V1jmuAE_CpIC1dszH96TfhBtGHu0QYCnThYV9BSCAQb_f4AdzicdnAXYtgObxNzRoEj0HIKGtgpMaojbWk2g_jWkNVXALNaZMNAbqnjeGSKg_LphmKYxR1NPDhIae9AMMoS6AtQDq6OcvMd-tSpBUyNjqJMNSkIOMBjwKXSVjPHsAv2hV0OciSbBAzahrI7YZ9RUPRiGqHotyUBaYeXH7H0cjuEiCZjV8RZMmf_9H3IOrAI1BorKQoiE1MsV-AXU3mlZ0Je75m1w6ljUnJLgLTr-UY3PqRZK-WvEF4OyeSq-NUvRZf3px-A7N4ovqSX5HVXBf5uWzC2W1au7Ft0V5Csm6p1xi-xxDkq0FzgW5x-ybl2SRQz8ueD710DzyTO_wxBUVBnhLGynJf1I9F4sJB_v1jHmq3-AMwwa6TGeX_fDy90M_z-n0gZ9_o0vjJKY-vue6k4V7Oid_HgZ7_EAPun1OTEMlLTby11IZaT-JPI9fBgrbSFu5aM7-Wz4mclsPkYhqZMg6UXCXhoW8UWmaS5_VoilSzTy-0GYjchDGiGJN7cY9LRLYWxGO09YgvypiCuM1ddw2QHfSH40OwrYWZblZGpnnAirDOJq2KKdHCZfLXxsle2-A9u3zpTdf7Xi3LBa5Lou15BiRFXjU36PrH67YputHzxK2KbGC1OB0QFuc1oTUk-gfyTtVsbfFAd-ui71o9OKLZMOLP0SW5HgPLbUt69UmjdxvzKlbi04-LJJMmDUlbFVlfhA1HeXj8IBsI1S-1I_1-SGXTf8RyNrZpRGbra64nNKxX9YJwjC45QM6KZvq0qfdRa3O0GD0JULyst3-pHF8KM_BEYHqQq3qCAIlEnWxQlRdChRof3xAmMkql2r45kHbNx8S2syUy5pwWq8Hn7tMx8guB3-KbDr6WrJB1G-p59eQTf8c2bCW5R_b26im-gqyvo-Kj632e93BHsDJG2Ws-4sa2Ec6pV_bpP5retR_TYv6L-lQ_6kGtfeNJ2EOqX-CY4rkTIUqqvmh0EGoZtNo8lrkiS6eKJ7BMrXYyJTq1MoFV16Um6U0e34W-yCGuiW6Ma2FE4w04A1W-jEg_z1nCitVNcM8dOinkEKF0TuMI2nam6LUFeaYmFqrxHZ5NIY6W6gW6flKmw1I69SGgsxQNI-dfHTnnqrnLE_VwclPDXmcUOSt0jp2GPUmsOEeAVUO-lHUa3e8fbDS6tm3WvZVYkQPn4SebnMgN-PhoSb2UqYDOGzTt5rpHruaOfMNab-pQ8jhHuQ0-jLk8POQXG1ot-ZbnfkAKVzGsvaQwg_77LHY38ObRPt44yMs9lsshsKVru0Pha98j3CEh36sQD0Wya1RbLVKg_0W2fNRP9a8lzLXOyzMGSWbgSfVn1Q1uAs2EytX5W6cU4UeLWlImCxujPy0GzR04McbqZN2Tw6fPSQfPtNFPUY-bJPjQX6mJblHHs5tb_X-My29Y6v3mwME31-9_2F-81-NQV9NHkM4uKdemsIO71rkOCFez8h6WxWDESq3vpiHMYiH9pOVbFHRytU2dCkzxekv6kA1ish2a4X_oVWyXUglJmop7ghrlx4ZF_mGTdVGpfxLD0rpeUjb72dxM6f5hRhWiiqBaFQ80xVzPhtvsKzwsYPpYhqIpB-nhEYctT-reWeGIbstcqtx3s5SFbWRgDWVD3_QgIWn-LDuEFgsbfidy4Gm-ieO9QQHw_FX9QTZzO2NHFzWrb1nOoJsdZpEk_GX-oFs_PZYpZbH5xcic7RH1GiW1r3A_TqRF0_4S7Zs2CoTjaglNWkaR3r65E80F1O9K8KFol9AoSWENf6uIm52NWIe1I19ExB_lEDNv_hl9VzsVZ7TdPz9kKt1qDQFvLmd_1Sl85X9Q_O51Fjik_gjlnIL_ice-BRdW14Tizoy5WsdCurYNkQfGJECUvGIMgkeed-WlIg63VDU-NPizfV_3v18O1t8f_XDj4u7Oc1kx-0Mfxky2M-0reqO0zh0GynrH1R9NTJX7U6fSfGnAPUDjRbtQWv2MMcq8DZQqaMRcE8bnnPM3cZ6_T-xs2G1s8tqZ5QsRg3kwZd2NnhuZ6PjhYqv4gyL489xNnyuMV498LWcCZe5cunpuSZXtdXJPrX76pfH--q-qXqA02yqN3EuOLJ6pqX6HAxz1IAZeW4apUkpHqSt5v9QDj60ocCYI3wMQjBfQ4tPxxA3f9sYZscofu60xpaNN-53764_0sh4l2dSuKwbhx_5YKIgZSrTXqgv-qE2q3DwLYRMzBnqfIinCs078EPnq5AAVGH2isfgRLGGcZ1-OuXyMEzuf8PTmvBnf4U_vlssn-DkyiTZe1Gs_eeYG5wMosHFeTQ5H0xOCPf3zv8D">
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
<a href="https://playground.archlang.uk/#z=lZfbbuM2EIbv_RQD78UmgJ3S8iHuFltgW7Qo0Ba96N7HI3EkspFJgxxFyS4C9CEK9IH6Jn2SgqSkWDl4U99Yljmf5viTegMfgFs7z0k6a_eAB3S8J8PQalaAUJBhhzUU1jktrbuYHGo0MP3Y2vl3ndGPNfIUPk8AGqPZw34_AaiclrAQYgLgC6wJFu_SL2MdK3C6UjyZALRY16Dl-_bKK6prAKBbJqetA2Cli2tD3kO2FvAZzsRMnMPZQghxfLUVIvzoL4raeoL7Efs6h_gJ4WnW1hyxFyKyVz00XqwjagzJ1esgybZz7jnQdZ59CTRQXvYGWV21r_Zm9ZCpMUdhzPopzuUR5_KYMwGIHaDle3d1rblQZAC5K1T38foTQXj8bUBAjTnVMP25W_0V_KJvtKmmI1ZOchFsA6svzMDaPGb9ip7JQdePT0hZT-qDGHu1PCL1LZ09giCrkTsdJ0KWTyDI6qkjfZ4D4_KLjJ-wrqchv9JaFwDyqnTWcDTfrocatFqyCnUSqaT9GCltKoKaSgbfalOBNmwhedFTh2iydfQksb4WomuPh454hjZyLSbZGkitjQxZdGjgJfs482N3guGxO-v1Q2KS-fb_uTNkd_O6mMY-RUHSRto2grKjzkugbEh0r1Jji-1Ti9VpCzFbDj3ZFXN92iLpyvK4_CcsklaE-gwRjTpn9ahzQgrewEdFsE9TlZN860ERStAesHaE8g6iTFAn5tH-zFlGJhDnFzCM0VsPXqEjD8ZGcHpU2FuCeb-rzMBbCFtHfExlyQPbuMLbpn-ANp4J5cUEoGyc0dw4Ct6lxulycp7mabEV4jZbjAZ7-qzhMjTc9sFwFQzHijCFLrTFVowYLTrpbE6gDXSahaZQ1gHbwzy1Vlk3XnXsTIjbjXiBgRWGCPtidPJuy9ITpwr3T8lSjXoFdY0BrK2pYsJa6hgzKGpCB7ZM95-03Dfxfh3VFxTWJdgygsPtWD7Ga_KA4G2JgEaGy31wjzGvaVyI0mlZUSf5j2JJkuSpiieLZR_U5RBUt3WMgJ7tTc97JXCzPQXs7l15ba5fC1yc9DCkJY3Vdi1mm6GJtutY576FfrclTuFlTsxmP56zZTZwLtM-13M-hnXTMWfskLItudOdFHs7dRKyGrdi8eVcZz1ntX6Rk6PX5rWc5WrEGdSH8Ib8O9h1hrsgPqExw_HzrQdrKB305MN50WlTRSUxFnbhqTsoamw8gfaRa4gkySAtUnvc57pqwlhrvkg7dQn2hpxCU8FaiOTLbzfkemU17GdgG_ZaEpRYUEAd_34Hu_Dld3BovCIPhIUCMvJgteGwNDKt6dQt6RqHEfZxS4zuxzCdNkwS_AFNHzq7hmAhlkLAP3_DNnyzokjMG13LMMd7Qt8Evf33z7-iUdwt4vrwHcc6Hs0PdePT1EeZjcVBHhyeRWyYeWOZjtZoHw4r4W48lCuKWlrENO_6Q_8OvMFD53V_mryIyB9useD6Lv6FTrPaE-sCEBQaOW-dZiYDO6Zb3kFF7KF1QdvONEPjU_U83qW4zgNT6n1Mvh9eAebfjt4MermJyjtaHZc-s2wCwJprii81AAdn_6CCn3nriX9Lh625yu9g-sEV6ns0N-i7f0J7TTORbeZiM8_W4e795H7yHw"><img src="../examples/two-bed.svg" width="270" alt="Two-bedroom flat" /></a><br/>
<b><a href="../examples/two-bed.arch">two-bed</a></b><br/>
<sub>A larger dwelling: central corridor,<br/>five rooms, windows on three exterior walls.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=hVXbaiNHEH2frzjIhJWIJUZeLSHBNnhDAoE8JXm3StMlTZOZrqG7xuNcDH7aDwj5gjzsh_lLQnePbibBTx7aVadOnao6usAdxPF8w8aLtNg2pKBea_FsMFitoTXjYblYvkfXUMUtO0Xod-Tx8vw3nKAmZ-aVtF2vbIoLVCLeWEfKAVvxkI6ddbsA8dj23lntPS_wg4If2Vc2cLiEyo61Zv9NcQHg5fkfrIN6261TFYKXAbJFJBnQkDWQXsHOQCX-OaQdqpEqVTWnAMJATYPNb-gkWLXiMF0bEf_nYJ2RAS_PnyEO1zHsFqS47iTcrmcHWEIMh9akqUSAykDegOCoZZOYYboOg3U7WKeynqG2bscmwo0ETokepMi6GnhuSO0DZ8IjnnW4jp-3IFfVEkX_nGh9K21nGw6oGiYHcgYdhcABa_JVjcY6XS-KriGHyd1ei-XHnyb4owB6ZzWgbQtg563BsiwLwInXGn1XFMAFfrQPsZkvsd-OpHvDW52rzL3d1RolJaRJXSLU5GMCYYUWhjutFwXyf5HDSTEtL8sZdtShRM3pdVWWZWKF3LY1N_6-ydWD_Z1zQEMbbjDJrCZAH5vNUa9SN2ziQ0p9f5L6MfcxyaljVwXwlPv97lHZW_EINTcNKK5v7yN_SjTjCAOmTFUNGnUPSl5fPv01bmJeOohTmSXMrulDOqGOvObN27AOzC696iB5p6NQaUWsuRnu8xx4zwda2-pXxyHgKio1ajj9qizTx9NZcpD-reSo5z4_f59DDBwUb9f_72SmN5L3tP-_fhQLJ5IdIZYZYrWHWJ1C5Ck69eQqjtVKtC2oEbdLamdlYpnLk9tMNx0f34U8zmQr5EyCG_0knXQCGfcyTm2BX2o-XEcyCHGvpp3NwrpoFnHIKcqaG3PfknUxfj8x0kx5sEbr2GiZScIx-ZHZ0V6wv5AzzLT5CTNLeI75dVniHGLDJqt2h9EJK3YavV8c0qLH1t6F4zijUGlZc3iqldaFFB_KL_bsV8lPToPSWpwHXZVlrv79ay-MtpL9zrpgDR-5YOr4gT1ku41HePitmUVSR08NsiVYd1BpD6fSzaODRVzW6A7ZJqJKj0mf0St-li1NziCTtgly9JcTyOxurzCXH8ry8ercfybFU_Ev"><img src="../examples/attached.svg" width="270" alt="Attached one-bedroom flat" /></a><br/>
<b><a href="../examples/attached.arch">attached</a></b><br/>
<sub>No hand-computed coordinates at all:<br/>strips, on-wall openings, anchors.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVrNchs3Er7zKbqkQ6RaUktSkSIr5QMt0TbLDpmVqNWRBGdADiIQYACMKCaVqjxEnmEfLE-y1d3AzJCO4-zGB5c4HHxo9O_XDR7DALwyKy07Plgnd-DLRekWwsCiNCuh7RZ-__U3CIWEyd1oOJ4OpqPJuDMY33Ym3w_Ho_G7e5AvYr3REk6ee2f9i9Oz1nHrGKaFhI22AZbOmuAJwQcnZQBr6NP95GH6HoTJ6dNKuFya9N14cjd93wbFn7wtQyGdaR1DIdfKbwrp5BlMC4FgEpYiC5DLTOWSN9oWVkvQYmfL0AZv6eFGCwM-iCA9qHBNUgJ4FST8nESjnRqbxAe_0MtzfHcOuRNbD8aGQpnVGYwCGLGWHpbqWUKunMyCssbjUebCZQXk0mdOLSR0Oj94a6DT8VLLLNDe82tCpu3ncHJ_2ob5QmRPczgZV6pn5eBX8sdSBOtmXuUSX2nDQmai9ElSu6QF8bXWcfMTaCVRcBeKrXA5wvnSOOVlghuekj3wsZchPX08PYP3qIwomDA5yrwvinCSrTr4bgj4qA3bQmUFKI8OkgW9g22xo3cKiwKH0hkPYit26CNr_KZ1DM6K_Jre0upZmRU4a9ck1cKGAhYyxwcegnjiDek86AIC90zu5KV7VpmEBT74_dffWscgTXC7NhRC6zYsRCjaoEVpcnz4pEJWSEMKVx69JHuSOQhtzarhumcwMRJE_qy8dTvQygQUudQSnBQ5-lUb5o-zu8nku9l4Mp0N__UwmE7uZm8HN6Pxu_m3oKV4liDSOWCrQpF8CRZlABU8SOERd6tMbrd0JBVgq7QGL3bgbRVhXpLeb-8Gb6ej8Tt4P3y4G91PRzf38HZyB4MxDO6_H95M27gFCMjFTqtVEWAthS-dXEsTzmDgsuKjMCsohG8dg7HgSwNrm0uNC0GLoEKZS5LEWMhFkBRVBy7gxc5Ho6NRRTqAtvYJgXk5H3VbiCCfpQOxsGWAwm5hXWYFsHiZXVMkO1uuClChTikWEwHacJlcncJacdzn1jr4MBrf3p_BAHW9xG_o7HqL0uHeMq_chOLDSXQi08nlUpQ6wJMyuQeKflSuFHge_giLUulcOtjaUucgslAKrXewKSkRVTlFqxwP2UxsJFqK52WpdaeQdFZ8WTqwJnCaymX2RCgbmz3JAIzC_mqXSxDQu-h2Yb2GzDqncuuuyUh0WM6X7OIGU2N8gssJdKGWVucRtHJ_fIYCKxQCPdBuDdiNNBSAgnQeCmHAPtNfEtYiK5SRnk48IP2xblkQv5VyUyVJdhbUwP1WmdXJ6Ryc5PA3pdawtA6E1tEWMb08zu4fR-N3s8mb--ndw810eDuHTBgy5majd8D6WpNSrdGcWsLWVrGFG_qUhlK-aB1DMvScJZ7DYgdbpwIe1liyPwh0Gd2GTDiHruxRcBAuO2uRwx29ieXxCH5uAZQGtbZetwCOYb5yKoeL7rzKzejpO9gIFxTWBnYu5aHX7UIoVPZU5a3kzR7rJKYDQ5Do8J21DE56qjillzkqYIFO-Ti5-zC4mzyMb0F42Eqtr0HAUr2E0hFiJnOYL3XpizmIlVDGBxCEiwLUYmmBnm8NCN6QRDPSezj5_df_XHRPIbPW5cpQAkgiO-mtRr-IQhEwqqDjjdig3wS4Hd6N_j28bawHrZ7Q1iDKUFgncwwgdhRSX6_bnYOzpcklpT8sPYQ8Gk8nXOTRZVAIJxTuPH-cvX24G4-mD3fD2ePg48fZzeTjx9H9aDKe86EwYLDuopIxQeTSqWeZE2xDMkoZgKlfOsAzbDBlRBZBwikPS3JVVGaKai_BlOuFdB7zBoGWJitEnXG8pWpIzrDYBfRHRFJaMqk4awFE32kBbMRGOhics1kysUFMnwktoXfd6-IrXPvKTQsgV2uPurTot_RiIXMqTFguW62_zHRI8E6n0wFfSK3hH7iizMiXOv_HPw6J7cxvlJFzcKXxVQ6ErcpDQbrJ1XNF32LKpNpN1IBUFmukLBQVxG8rYC71c8htXO_FWlJSaZBOBDuDN8ghMKsjZcur-Ey1w8NCarslZNGIHWvmnGsWO7h7GMPt6H46GN8MK-JCzvgV2tL5ABurTGCTxx1Y1sfZ95ObD8Pp7O5hPE81mEXeCCMRIBPPKuwi8cAEzoJ6uaJa3QJ2e5W_ZuvgP_kSpFPWAdQB2-924Wc46ba7p3DS63e7zb-uLrr4If2Raesl_NLA3s4WMu8hdp0cauweY18mUPrj6yuE-gSk_wWQVwnk1edAyG_-HCQtjMf7I5RE8P4E5bxey3-zdg6kibzySziX5w2B-MOBbkQovqCbi6saiP7-I4FiDf8znKuGQFfNg9Whzpy68zf_Ed67RvCeUII6ZT7Pe2ykxV7Rq8ApUUu5AWXaMS2iyzOxW8dekEAj0ewsRYZJgNn-GdzXsQ0nlMD29qLSk1sigEZSHcEIInKg8tduFlsMrPYcKvzPq58koFe_oDuAFgup4egjv_xPuFXIi46w3vnUpeT0bA88hRCCp1hJ4OeH4G8iZ-kdRRkIPDKZQ9h-gn31V2H7X4RNAcKq4DDYgz3_pob9wC8n0AgbIfZgkYomaRsBRrAo_QuR2Qj7XmhdYyZYgsiUy0psROw-fgqjCp_9nPD7V93uS7_f0IYIxaf4xI33vCKGFGI2YpAx-weYH_nlA1WUQWkVdnuw1H9GUa8ORP26ewA7xJePDkUliEbYUs26pqAh1oqEwatQkp7gfwpbbK5oVMOdivJpFBPrZ7PBViE1XMS7q_rT6AAwzhgof53PGBgP3uvWCYiLPz7hfMYVjUBAy2WIpFuZViVho5lCAhd7J-Wpn8QGV2ZPVeNStWfKN-WOUwjCbM4YMsE9T2RlwsUOI7Is7NSRkQvucKSgfoGYjEZxuMSTRCR9g-pQcScGC8Hi6KVJGXwQLsQmJm7orVY5bJR0BLqQYSuTXNXhIvvmHjs2-JmzPlIoLbzfN0LUXWpO0RoYjO3KEv0DS9RnYQO8SbOXJ8zZ3KtSJ3Vdt1LJFDtbwgpT8-dbK-zzEJapMzZuaYZEXsV8LPav1BbRrKTRiqF97ILZ6f5RKfVaA4k9iADfYJ6JB8UE2XCz2s8OMPoHGL0ughxiOG7jP_FVzCvopM2-mJh2IbDB4JHCylpq5Fb2Gvs9cg7sdrTNnnzd68cWhft9nIumF5e21D62-F5RVxPnBnQSYfwWGxKcnbXjbE_TsIbnIhHXr2VQGUuHnthk1WhRoXEatpU-oKw4nuJOjT2EFIBzUfXcZLOErZJPU3Jbr7G4s3uTo-259g9ivaj8OiVhDvVmXBFuHMCoNSpBBFqSWWcwGxgfpMjbcWhDdKCkpjrOTVILjN9cXfAjbrOv-AWOV2QMMXEcMHfe3MmNdTiwg3MG8YV1h46I5SkahH0p8kcRsPw1fKmhytqFqgENZnhKUsvS0TSmMZnEZgeVibaP4x38z-9Ncwgy5g6ynYou68FIRZCVqZKfYeL7dOKzf8Bkprjx4RnP9w7JB7sR2K1HWfx1s7SzztM4C3dK6U7lr-0eR8HASDQlpq-vU_qKIXu4vMn2vv5kee9LyzeCC3hFNS4uLurlryi98PKaCO0BNAkA10FmAHH_fmN_1mCj0nOa_7sUnfDGPDDHTvU6su5CLFQQizgtwMTtmxcHiXYLv5FZaAz2KdVjNfCpwf3c5Bt-LBXOz6eF5IwuDQZXSB_TVELlkppcnhyr_LVJZot8t2Lph1ajmnWwNFJwXIr5P62NSy-_sLRf2ape--Wlcm8p9X_omZ-aOTXwxxBvYej0aYQHIl7VHIBHQl2DsxceOmENzhP1g9D-Crlkvge9nXllniA1Q5eX3X1t_bHcPhqtXScKhNlD9omlU-RcVvwvIl_uC91w-jjC_JteH52-GohSVeArOxw_LrzVZZDNAWA1IyWx2vHiwkiiMriMvd1ZvEyck1NXN0hYalw1yaITfeW5dMYhDpdOu1x6vPFTWOVz5YMwGXPSwcfJ-B33rnEFnMRZURyHYU7fmzSlUc5pfVFGZdh6FTum46qw_lgKF6Tr4PydGFecgu7Psr6NpvxJxsuY6ttMBKHtqpRnVZnywqgg3K42GOIKk_Fgl31PudgL7ZfnNJdO0zACrTZDzkzXRcyVlcEC_3ZwMyQlGns4p8ac5FQI1CNsDdLPAgd_LcDKaRQ5QDQV-3uydZP3Rq2fAxsJehhXykDdJdNsN48Oz56-t4UP9lmm1u0vbdE72GIPbulUvpL_AxyR3T24PTziivEFik22VaTDQCaJjelF9-WSZs316m1GcnyyemFDQIrSWN3tvnxzsNoXdkts42A10-jm6lfd7ssrZg318syWJqT1Vaf-OQGwPJD8-yLYpajmMu0-Z7q6vacsGvvwe7sUR3uLuU5WqaxXzzNos-biKb66v3oh8zQS6uPe9dZIaF6oBatnN59b--ovra0TKRVc8fw3Mylnp_qHIcrD2nq82HfWLjlN8uWRDfzbj3pQQNfenNMKkbJjqm_H2K7-dHjXKMwutrF0666xCePfXqjAUz5bBnqqfHXBtMDLWF_wLA77cYyP-VceHMJj_04pQS8pidaJY6NLj5WoDWsVMGmJwDe_3FQkyry2zzFFqWWVKz3OGGN6den6yMvM4nwTif-yUVw8psMnHnqCD3JzloQE5VM_zB0wzeVzmKf5ypxDHjdJ8lR82Yg1HhCbNypSqULZJRVmvIWCfdIyxyOIJKdlNfKVfJ7jjVW8P6HWGxkhQw6R4r2dDb57M3r3MHm4n-_bDFal5MHDMd_WhWiz5uX_2jpJl9bz9NMYvBJ-kjv-uYEygX5TQZ8a91jbM3gsBPesKvB1D9-vJS_7fvBuWF2y4764G6rPBOy4QZlMl8n7KCCqez1fSBni1SUS7WChwI4GJ9FxaLyvSgyvoIKWdAEMsHH2B7xcPLpPv6CqrojpexTHzBY7OMLfW9wI8yx8_AY5x1G_27_sdK86vXN8-kvrl9Z_AQ"><img src="../examples/bungalow.svg" width="270" alt="Bungalow with sliding, pocket and bifold doors" /></a><br/>
<b><a href="../examples/bungalow.arch">bungalow</a></b><br/>
<sub>The door vocabulary: sliding, pocket<br/>and bifold leaves — panels, not arcs.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVrvcttGkv_Op-iSKmX7jmRIUbRk7TlVdETb2tNKLkk5J19OGgJNYlbDGezMQCCzlao8xD7DPlie5Kp7ZgBQkp29LD_YItDof9N_f-A-zKDAjVgZLRSshM1RQykepJJGn4CTG_BWlPizkTkTKIVWogMr9UrqFQjIpM0qJSxY4yudi2Fvv7cP8we0WzC-QAu4EetSIUid_nTfgnSwqKTysLRmDRYzL_RKoevDAjNROQRfCE9kNf0vevuwVMZYKJXQULlKKLUF6YZwU0gHRiPRauMTL9ZpdvHT54_zq3kfhM5BesCNdN6BN-AKU_f2gxRfIPjagDZ6QI9LJTWySWYNS2PXDjKzLo1DqKUvyOrKPmAOtVDqhA2GQPzbr_-E0qjtymh4uelvX_GVzkeQE0olM-nZifDbr_8gt2SeNEIlMgRhUfRBiQUqEJ6Z__6HbMhQe2tk3gdtYGEqnZOEhdmA0Nu6QMuHQJRCuxrtrt50kgpBeHiZbfrZ9hVYkcvKkdZgiVs4gj4rCGsUrrKYg3DBALWFUl797wFzFTaLDohMrh4r3Djx8-z8HOanH-Z9yK2oNTEU4G2FcP0_H749_fE9cWMv33ycw8f5j7MPlxdwdg0XlzdwNf_ww_nsqg-zi1O4-Ti7oRtE9-ny7OJmCDOwGIIhBjqYZQjaddKstw-ZsBzXS1NZIpDewQNaLzN05JEtvIX__HYAV__h_mb9y8mrbw_45IQGaa3wkhNIV-sFWnL-ysocMqF7-3TcFp1jcmeYs1OmxByWIhM5OtD4gDb5s_G10FtfSL06AYeeA9xUnnS5grdwNB2NevtgNAiYjmC9DhIpylFkBWizlqQR0QHmK6QARgcLkd3TxUNyDHmbAoRzIBNKOf6ztx8ekw7UVupVSB5SoEMoPbMBZcy9AyXvSfG1dF7c4xCuDXhKS1egUk2uJ4Ung8PBFLyVnPIgtfMo8mEsGjvOAeexdHBI-ojMGudYmdej0QhyU-s-1IXMit4-CUlRSNoHpZE50kHiBpTQOVUKTgByV8pcgJdj4tg_Go1Gr-DleEwMxuHLtPP3uEMUrk92nuBvzPQ9xVE6X7OMKlGNMUvWvg_0yAg2MD6g_80DWqFUDKqkeQyoqLMrEH0wVUBdGIWwlkrJNXqOG3JyjpbiLsRM5VO98qLEUJln4DAzOm_SQfjGcYVQS3CZUAiO4lRqJ3ME6anKIreDtgUISwGBVENTi3Dwbn7zeT6_SBX1JCRUaaT2jiMzOqHyaDsJpvOmBkut2WJ0vX1YYCHDvTV7huPS2HD-0SvBy_2gPEdovBG078OEgwWxHMK13HA9Eqq3D64099TKKg1CGc4DhL8aqV0IHgFr4Yy2W8httYalDAlCTs9zFd1JfuHbMtwrhfVQG-sLsCi4_vpaZjiEs9DNrPQeucZdXsy5gVBIkOUO1zJ1094-3Amb3XHuOnjpQ_GmDgeZMg4HQg-oxlJ3OqFaShfzUFKTLsS0EOoBOV2le9UHQxVJhEaB1OVIeKyD7CcynCKS8je7H4aLsbMKWFpEyAojMzwJPKOnNTeTGFIvHJxdXM1Oz3647lPJ89FHL1xXcHw2dh2pXWblAvPQoYRPzPoUYKbKCh43lOIoJI9REqdgfBHDhr1FwdoZHRT6ICkOKLCgmL3jtheFU_frOOGOY40zTqyxo3OsNkl1Y3Ophd3CzGbFudAraiRGP6CmfhCsENxfX7jQjolYOu4BdPI7Duk3aWCR4i4U8mDiljlXlETCwez0z7Pv5xc3NMZ0DbOC5y1fCE12UFdwhbE-NLSQwyHzljRmcD2kcPAweU0VqRTOt-fZOc3MWI2WG-FkMj3cOVRwZImp3aMToTrVnEmq8aSJQvEQR0eLjuynq5UmNhhHjJT40rNX6LxyuYZcijWS_tHiu9iMuDHGtlkWkstDW7IyQZlhStRSr0LdKo2TdEbIrI0OlggP_1Vm_ru7dM61UPfBLs7TxRZmV9_D-fziw83H1M-Ph5PJ5Bs61QlVmZVFGmLd3yphkRtePKRQNMhUkQ41VRBKKm71VNdTWfZ0_FQbF2Td7OLi8mZ2c3Z5MYxNazxknzgQlTepfdw1oanVNtxZmxxjQSqC46mUcPauJJUGIufOITmA-UPNvpkfs0JI3edrV3R61GJKtJBL56XOPM96aUQg99PNzlpg1sPE94aj1ayZnH3KzB2phlTbxEbydK4kxqIcRpzJILi2qfYhAhPfMLyTjann0innco3a8THDu5_g4-zidAhznXM7gsur0_lVUyXKKjYooFxs_FD50EPapYSOcEnd1VbadRrH-fz9DemwFlzQaa0ZfOcNhwkVfQSUlJ6JdSmk5XGsFjZvW2AqjWES9oU11arYOSN4eff59vTsL7dnF9dnp3MKVu7xifFaUK3EgShpzRALaua1KF8NYRZlXL5_fz2_gUKwqxcIC7lapcIhfZjpTkJpqVTjjDigupj6pB9p-8JRbAefihWdpt_R94XjIx_gxiMVsHeXP_LxcSuKm4Arldi2Q1-mUFgZHcthEjsQanYH-XR8HBqT85Luh0mlExLNStlvehglUtx_1sKupIawE4k2UmCBdKIuROzBEC7CqUFBB0Q1KG0KAu48bvwdp57lICESHek1Ig-beNIZUlrd4vYa50IO5k7LSg4mFzixjdpMaGZPyyVnEa-I3E5QLal8UWOhznB1eXYa9GEDu7thqhC1sa7ZLcuwdz4IqThgeAplvw1ocGonPBo7XVPMWN8kgEvoolI0r1AnSbylDzlQSBUIqURQ3R7weaRQvwxDYyrx_WYobSXEqv_CNelZa9DUomtTqRxWhjePMDqzg0qqLeQUplpswzFyvtyF_Xrvt1__ucc7Ly2rd_1O5qc5Mk4GfEIL6TDzgSdJr6m79ckftdjCAn2NqFt3cJ-NqZ04h1Boh5RQrjGeAcendDRtYsd0UfnCWLjX1GidWSP3iy7b5nxzg5ws7XxaCoXeh7KCVtLOzaiLACd5A8uMojE9-IWGbQwEe_sHy9fLQ9wLExFpWeAGHoSqkKfzsFRyOPE6wlvHklO2D6XJCuzHhs4DtdbG864MUt-7YY-xnL2PseN9irjTHvy9B1Bp8vF63YOw2k5HPYi7yfiEv4SCX5U9gCeNsNdjROSJIXR9HwaDwSDspiE7w1CUOu_g__Nhfp-Fuk9OJX5Ig1TcOjNlsvtaOkzhVIpV0794Pkkty1aauY0GvOaweQNi1ecyMRhPmst94C-DA9pII2WNRMlXBgfHROpMla4zY746mBw29_rAXwaHvIIGchIYR8U0MVFNrB_NTSFQjUPm3K6hbmcKLdFSXIpVF9gTXSSGOjdPiAr1yheOu5I2zDVGZ8sk5OAahXaw93ioCm7cG_Ygtoz8bYAfqPFYaWxYaTRhMTQdU5Dtbv7xQrv9hwvTR9_Hjx7oIAE7HNorvJz1AH7phF-qESecVsuKZiHeRvrdHZFyoLPGPRd-yVguOLR-yrh9JGN5nft7V7VWeYbpps217hbU3u889IjgsUEUznGtHvyxD_Ob0xzG81WoU3p3I0mpRTU6TtctoIAbWODWxOUhjonEtLMs8qwQNutYnF2YMxpUI2x-ZA6NOG4nqMi-W4Rnfc2uhpfjg4NpCyd1sKVfnjDS-FVGI3r28Cku9Qyj-muMjlo-O5jWUz71Vy07PGoM28HDnvJxv68PW_cIS3uG0b_gocSpm3o70UnjwB8Oym508lwh87dp6e6g5sfPpkkE8veuwgN7LenxhEgrh1T1Qs9K3FccF-lFwpfRyd34aKOOkzcJDjhUEBxoqOBHyUrSUrgrGjqiv4SFHnUFt1p0BV_7KpemY_BBa7BZLmWGu2LrVuyXUNdO-HU06Aq9QQFXxqyDWKbvWJtL_dha1xH7RYB3J1xbJXatNRY7Ut8cN1KdN1asdq118NjaZ7Dkx-HdUaMreq69FTqL0o8IzBmPjxrxNBlud4XjkxOePC1Wj8rY6HnhHwKY0Q2vjukxvNpELI31QrmT56CZOCEFEPP3EjE-RQaVlC0dFCdiMlDL3BcwPuRetUsPXfqD6Tc8Q3-Fvu7SH46Hr18fffMVerdDP40KfYV-R5-j39XH7dj75qk-rcMxBge3upUSPxOTP9aXaSps2DklcwJbZ4QJLUkdWknQxWXM1bQ4ChgPD2ENBId5tINcuiy9yEmNuR3i0irEgRpA4IBROC-2ARX4Ey3eJFrq1V2QzJJ45QkYsSeYOEy8jmAhcLxIE5QBDIog85S-AV0am-6ZU1rueHOh1p_TBkMj1u1aSA1RPJkcJkzCRSmLOgcQ3AMKl57OopY6NzXxqKWO0do-ezQdpcM-CIf9iB526MejVtbz9PUu_dHB9Kv0bpf-gOrXV-kf6X_8iH8bfA2w8m_13rDhPYF_4-VuzRp8t9OxIlQXp1UmbjsL0bbFDnaIWwuUIcBjWVktPb2e_TfG2k8d7MaBxWVCFIXOaLsPvzR4Ob_9dD77fn776fL8p4jEaAL0IsQWaAO-JJhvA3W94oE34B_0qmbgvAgYbikxQ0gvkYQGsXBGVR7hTvi7sO_RnhFADpHdM2MGr1u0gdS9SxAfzWgNUE756UDhisBPAmx3YKq0-Ekf8j3hiM2-zL8AYPTM-PZqQI4B9vmpmWZweCCUXNH-GSySJIxBmASqd2DN9A40qSzg-vzy0_w04hP0YoE4U7ovhY1vORoQzkYAnl3CE-lSWhfALNKTHiPBQ3hnfAEL1EwelmUngq1j3tv5VUyEKEXg5YySOVTaSwV3n2_f_3B1cXbzw9X8lnxx-_3l-fnZ9dnlBZc4S_YSlJ9-IcCsmU2CDfn1XMc9f2rKYSHCy2TICszuMR_CfzOiR69UCRpgvCbhTNvAmV8QLG_ZpFB2A8gTX823QEEDxy9vHdJvAwJtmtvp9NrMkfnb5W2O7h7Cuyy00A2mWE8crtb0TmjczUdw8mfkvzbTdqL-bOx98PseBcLqVj-VR0yXX5AX150oJ1RtkkML8-Z1K-e6QNq-oxBXP5VCr3oBPGOnPAZRO-hPp1MqLMzzzWi0eTMatWMq0Sa18SlHjwK6HCfHLcMvcESxR3Arc3xGx3Ca4d8wqr2ZjvrHh62O5IHN4bSx-13Hte4ZHfnIOxzfHE5Hff45w7_EkTE66RVGcKK05q-Y-WcAQb7NMPHtYgt76XVrvC48wt7B6OD1YHQ8GL_eY1zil97_AQ"><img src="../examples/hexagon-pavilion.svg" width="270" alt="Hexagonal pavilion of six wedge-shaped galleries" /></a><br/>
<b><a href="../examples/hexagon-pavilion.arch">hexagon-pavilion</a></b><br/>
<sub>Six polygon rooms round a circular rotunda:<br/><code>room … polygon</code> meets <code>room circle</code>.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVnbbhs5En3XVxTsh9iIpGnJl3E8cQBtosTGJHJga2EPBoOI6q5Wc0yRGpLttjYIkI_Yb8iH5Ut2q8huXZLJZHb1YMlU87CqWHXqol0YgDUVmBxyU1rwaK1IEbIKlZJ65mCGGq3wmEFuzRwuR0NIzXxhNGrfhoUSKWYgdAZzaa2xmHVbu61dGDRQ0oEvEJyYIz2u40Fyjq4NzoD04ApTqgymCJWV3qMGo1PswqQ5aQKPW7sw4eMmBFmYCgY2LV4LPQMnlnSI8G2WxBfSQS7V6uy5UAqdZ8kVegR8EPQJTN7a5UcWwnu0-pSFh5WKUGrp96o2ZG2YianCfXgPnz9-gg8QX0avzNUGUfqCrBCstZe0k32QGqR3jPvdr8ubEaTG2Exq4clSC2HFHD1a6TCD6RIqmfmCQdkqQdCbXhteDN-Oz9vQ2wfhoOyB8LD3-eOnfYIVGkSWWXSOdIGL0fV4MHo-hM8f_w14j3YJMgOpnczw78k7xdTM0cGk7HWfyuzZhE1hOjJzYNF5YT0s0P49UKmdFzpF9hO6JXYdYRGMzdB2pM5wgTpD7RmY7oV07q90Dl4JD1-CC7AoFFjMFaZeGn0KmTEWXEV-34ZC6hk6cqi_JzTJWRVGIeTSd0zJXodAH4IwHTkXM2RHGxcWkfyVIk1M6RnaThFJWlbG-oLEzKSeQaqMQ7UM8fXm4urq8upi9AreDi6urmF8PoR_ji7G112Y1DpPauXWsesrf-TAVBqMlTOp2cCitdsEMXsThU8d4J5cGF4OruABMJshe0zZp0eODpOEvBE5-FYbeslJkrShKmRKfroovaNgN5p3fP74iR_owkBR5AlPOpKEUXzpoCqEh7m4o2to-KT5dMrOzddT9mGO6EGZVKjOw1kF3qz-qd1HWpgKX1hj5nyvcCd9WqAGW2oHU5HegdHecES7Qlgk6IWwfgmVUCqQCzkXvR1snpisn5h0YVwgpEY7_KNEnSJ9q42XNR8KH3nHmuqRA18ZeHk1HAaKcXz5U-MLfoRRgY4gKdjwbNNgoSVMeBOzYg9yY6HstXaDkIf8lvAqQdE5UkcrZ5nCoBOh0NpE5pMY_fz_igX58gREXqikzihpaNYkiEU42lQFWgRUDoObkltevnx5PRxfw-BqCIOri_H5m-H44nkbRpdjGP_y9mL0qgsTZjPHShBHWSuWDHnb_-H24IfbQzaJoJvSUs9au-DKOWUt6btNWkiF1sbDzNQ6CJjkxk5gj5UTDp5qMcdn4RTyVGJmYg-ZS7RtuiG2HEjt0S6MEsQL-5v0o6SON1Rqa5T6LxvTlUwp0AuhZ3Qsa8PyB1KlaCLk3KOlGJibe3RkPwoqU-mVsa7Hg1evhldwcc2p9vnl5dWLi9FgPFzFSaB6B056OE4SyEvrC7Qh43C68xbRx8gDo9nVpANXkMfOUWjXuHEw7Cpol3AGSfiqVzt6XL4ejv8xeP5z8G0OC3IFoZQD56VSkBqpU7K7uUcbNGdqY9uwpxwTITgDKNICfi818y5kVlQxURfGkqHwgRKdsWDRl1aT54nKG46ImgZSXwqlllAIF8x3c_4Lm_Dt68GI7Dc-v7jmf7pbRY50fCRVGWxktktzycx8LK0r7b28R8rcsZAgZqgK4yhumUQsRt0VziRlVOFBwB-lsHTTJg_ZgL1hI24FSxA8mWjCWyGpniL_Zf9PC-kx9aUVik4NcRooOWSFKZJlC6OprmFxpYfMmnsO3dYuKLE0pe_CS1KZxQ3wubzHU1DynvavsyDnVY3kR9rzDqhk5KAZFVBLCr_Wboh73GBGVpNCFo66hzAPGGLGbNfc1LSUyndhJKhQMHmwprFZF0aGHaW1C1pYayokuhIaet0TmAeH86SndKzCTmaQcwkRlFS4wx4WVkPAsfThZpxYxvKL8h0RQE0PMfiCD-_wBTkDEzI-ZOhSK6cInc7vzmhKpQtjOUfljUGpomlimwtPhLejV-TGdLfg5INH1FBqM3XelimV0UpMUQXXaeritMD0rk3mZYquxNJ1Q3FAYucr8tFsu7jXYm4swtuL0Wj4ItzVhNFh5_PHTztcBD20l_uTdlNXB_Jv7cLzyzdvL0fD0TjWAWu15ilxo9S6ljWypZHag5J3lOaXYOh8jpkV-1orQ7CQQ1pTzoLv5FS4thsDkYIbZQb1GH4t82MGC-MkUwMlrtwiduEV1imTr9DKWeFJHXIiDtlVgDTfkckCN0x8gXOEqSpxYSX1E6zUaPBm-ALid8KFqkbE8i1dCm38ckGertB7DAxbe22bLU4ua2r42BlMYKpMekc5f05hLaTutrj12RlH9roy1Q68b0E0wHzeAtiFoySEaC9JTpsQY0OEO-8lCTF5etcYsy4xOW2mofOY5Kp0xQS8YdBQ-NB9WshFSr1EoCEldMZJqBAq7zCuRufWXaHbAphZmcFR0gLQTDzlogWQSWK_koqle7RCqVYLYMvGtKTQh34EAM7gSZIk66Xy7lp63OgTM1z44icwWi3XGPResIMF1JiN4Ixz4CZqwAkJ4xTEdt70uAjV3lbGjMihFCF5f6VCtQ3h73FSf_6t1uymB2fx8V-T3-rF_mqx1ywerBb7zeLhavGAQXfhKhQ4dXnTKO_YNbkcxNyHEtzkIZEG8-nQXW_dHp1zS2Im9T8k3m0PHsNNr14i4W77tNSvl0i02wNaOgiCdTqdzkavyyv_06v1F_11i26RpOALhjM4_MJv-NIU4oLLC6GzNrEdrYYyPlhuoYxvwM4Hr1-_gDPonXwNLLXGOYoEBVP0FbF2TVYE79ZkGp_fwBn0-0myWhy-uCFBK-iEB5pvXl5djsZwBhl_8_xn6ARBWvwEV84yO3MFKkULTeEDq3jsHyXwPo4S9qr4N9unlWw_dIXwYQOuekd9Dk0Gav5YgyMSeQ97JDJj8QcSbf8LFDLHO_0tlCTu3Ku-BeH-GgIeB7s0UKuFD8FWnNJldjbFjNt3H02y9nLyXxju4iH6TkyH_8Bsp97Uo2g-SVY7S4cOppjRAZsnBSPSptpamyexK8Sj6pOEL3bWNsFj6PWSpN3v0YnhKIItvVTSLzfOY--rNQvm3DivgofoxdBodi6U2qmVYIBU2rQMncsGel3x-S9N3qAHb12hv-Y9oZKo4Afot4-f1JbjEyNoJpm0YiUZ7msXXnIhyUMVk-drREv9Veyomlrzp1hn2gx12MMZ2imZxUJDm4irUOTgKsRFSBnx7iBXxtguPxQAsrOAz9f-Y8LxElLJk6PYTYfI45lPkCpotAFiUVgWpLZfr5-w6wWsHs8_1sBIZKbp1gqGplnZWfaOvddoaIJLeOgfhAGKL4C4aU2YKWZR54nR8JQOeUY7ni6MezYBH0cjSnpKwk3Z1PQyxNdmgXw5oW_JZBipRdgwP3N1Sc-Z5ObixficG41YNIpV_Ref4yRN0jxykKL2Fqkr7n5FXfL14D0dNlT065W2bLjGGuu6C18wYK2AzM4MP7dmP0fgTxrz9ZIkicwaRhTEQVK_U_I-xNXxETtBfK2kWLu_r2_vN1o8SWqI1Znf3s533hBCh7vgZP-7T9-w4VFSk17YfrS1Pd7rZV05UQILZQ_3B4Kr6ZBpuewOM536xLrG4Oqe9xbiHkFE1FXHF9qPUNSLRl5q1Neeid1a_X1wD5nH08_OoBdz_bbG4YHAVIE4o6n7X5r6Q8M2sRSeLmMpfBqry4XEMHabo3BlM5snmxBtPAqjPw4Rgn45eD6MkHuxlN6P_BOmGTziotjg2FvVW2AsiK1iOuicl1ZLX1pkSgr-ENMYDbn5c5CZpn7ezDtc5PHh1KwitwSBpimIHnrk8mu57WunVMJmQH-smeLWKaFDiq9wDIMfE3a_jqEtQOpq0UJ8I0B2zIDozSIIvYX4JEkensRKadsMwkkNEN--gtdIuSXh4dFX8ao0uFLamHUNL9o1QK7hkTV__DOFTS4Awl-pVyOTP7koxjshC56sbufa5GKndtHxxiQFrMzQbY1STmEiZoJ--JhAhpbGT2u0zn1R3fxF0Dhs6vCgrOloVgNrbhFS4YUys5KcXz6wilPLvzrUQ5DcGM9t21dd1kl9B1An-PBvlHMj9eFsTkV9jxI-ue0xpbbGdl9F9jSygvgWf5r5DuQf-3-FnFtJXVJ8-37kk94W8oe1Dqj-eabzf70Yb7Cad9Q_dH3rFxfmoLIPKXXcDm77nz9-uu0_vmkGueELhr49pC8PH98cdps57iFPaJaxzCKCzZWY_bQ2CaZyYqN3fuSaAo3Z-zt-aLzttevWfH9rR7_Zkeyv_UwXG09erX-52tp5sL3zIOw8-NOzDrelOww7Dumsw82zaHIhvcKYjBbW_I6phx0anHbCNDhMbQLN8uj43XQJO_Xvz3GdUsBOP-kfd5KTTu94hz3nQ-s_"><img src="../examples/terrace-row.svg" width="270" alt="A terrace of four mirrored houses" /></a><br/>
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
<a href="https://playground.archlang.uk/#z=rVlrchvHEf6PU3SRpRKYAqElCPDlWFW0SMmsSGQKouykXA4x2G1wRxzMrGdmCcCJUz6Ez5DfqRzBR_FJUt0z-wBF0pJt_CB3gelvp3u6v37sJhzDv_cSWMIwgTkU5VTJFMR3pbCynMMvP_4EPkd48W781enJ9qvTizenl-O_w0yJa5fLArq3O_3BcKvf2exswukt2pXPpb4GVA5BasClmBcK3TOQDiymXiqpUdgeTDEVpUMotZcKGIYfpYS-LsU1wkK4PhzrzmazHel4ybSUKqOn-FWB4HPh6Zfzi8sjkN5BitpbLCSmSN8LSFdK6szKVCjwQt_AypSdTVgIdQPCmlJnPRA6Y-FogZk12tMupmbh-nCZSweFEqQQ2lQ6dDA1Poe0tLcIM2PnjiA6m6BNywLV3jQujthEAMKm0F32VltgRSZLB2P4Jl38K00X38I3c_He2G9pVTQ5fH38-jWcnrw67dGe5qx_YfFWmtLBLVqPS_CGkT_u40kVoxGEMvqarCNtqhDMrN5QH05wJkpFW_8kZIS51Mayjr60muwwSdPFBISDzIqF7jOeNWZePVd46KbLXto2SPgIeHE2fvHu9fEYXr6-uBj34cw7EBYFmXSOwpUWM3Kx1KvVJ2y0W8jxPwZbPdB4i7axq0fnUCnhpdH8xbWV2Sfgkg-J7L1IUacrUGKF1kHpMETH5cIAu4YDb8CiyMDMZvwcMo3U133o7mzBZY7BrTKYiRRZY7gcvzslszoOybdfvYLJ8aSzCamZz4XOXA9O_vYSJsfjFxNA7aWXGJY6w0-wxpc6E1FjZcyNY3SPGZ2A0Cv43pg5HU93sAWTTJJDl95MIBVaGw9pLqQmd6Gt9QhXesjkHLWTRrv4lFJntZI5xfAKXn3x7LKzCaNkJxlCZtAdgdAwGU9AocjQQoEWMum81Kln12E7wqTIJT1dqW1TehCpNS6gkueUStjOJntSDxa5VBjYg9klbNaB82IF8Sydt0Je557UFhk6WORoWWgFU6RYCMd05lyJGUkdD8g0O0eDJOmF5xp9S8Y1WihWiyLRofbBY2bk-RWBNByVcxA5-T32YCF9HkLYOElCtEIs0X2wS-dtmfrSCsVeCEarVb_DFLTxpbBTU1o4jry4Af_sAJSa-Gs-70CQ2EmSDkAhyLzHA-LVzKWiwA6AS4XCoFkHQBvrcyiLDkB97CCU4oU5ZqVCtrPrdAA2YXt7extcjkodgc8t3mNaOkCimOjGdLl934fwGJN83pnS59sonIfUWI2W6b60mlyUaJy09WhbhDXeGSRJAlb4HC2RrYa59EQKv_z4EwP7JpjuMvtMpOF8EPJg0D5MiKuK0kc_40RSHc347NWXl2BmAdeKW1TQDU6uFO2V8glm0N1LkiTpDQ6SJNmC7efQHdJlb0hfb_UgR8GOEfRdoPNb7MFpzsgxx0ntZMZKtjNer4rnYGnOTnDx7vLr4_FJH94uREFR6U3FuhyNyLhOzBH8wgDqrDBSewfX8hYrx07FLdZ2186jyPodiLpln_N5Ay49WmnI1DK90egc7CYJex9AN-klW-EqWGD9LtiDv-EU2DZKxfzhONNFhRd-5btUGUeK_NByQt76ndx-xN42K5Wq_CTQ-8KAw7msqCNw6QdOaLli0GQ_et5kW-ht2i0lePKDorSFcXhEPEgLslgA0Olb6T1qclXOJQvDoLlQt-joVKSLxww3iIUDYuIVYHaNT11lgFvp5FRx5eRDSNgU-_AFlRoisBWjZjE_8zHXTnHHETmUtp8HR6ML8jX6HwJ--zmv6K15yYS4GyfPJo4S0oT8T0BmjCXtpee05UBcE716uPzy-BIyyXWd0eysrbjwQl-j9owrfEh0xtiFWG31qqxN5pIeFqZUzLmiIRNb6v4aQcTzpAAJyOTolfua0jouJogEg8bs5dDdDe43YEdjXU2tLvGpD-VIFA22WRPdC3HrTGUK4QElUw6Tati3RaEYk9GmlAmFXfEDU6M1pkQq5IUFJfV2bFW5uRDWy1h7VOE1aMJrlwNmZ7geRqxX_LbyIlrYrGjL3VnRDqYPMs8DnP34p6VWfSpX-mHVKMrj0XQHO62D-uF-pMFjULuHLYCKdh6Dc49vbDdpI8W7GukR0aDJwzr9qg4kuqbNxz91L-w5SO99oPzMrNBeLR7Faasb74bJA0j4GNJwDWm4jtS4HhcXv8XbPigm1grXOo8XuWzqyIvzwERSzNGjpcrOmvI6b2d8KpwDVctYJzI4l3wLQalTeo7suoYMUa8px0YuI35YSIcwxT68MbdVrXF-_OY0JvnAjKXPjX3q4L2ZBt5MzbyQCm0s1i0qkwpPZVVTbxOJzcVNfG6oPJWYomKiiqVPbPSodZWay6ipqTJ-UJTK5VCUTlgafvnxPyD8hOiJkRt6urLtji0w44ekEjYBGxcpCg3jILrRFklGJFJSB52HIrN-EOIsNlKewi84L3-oegb27-XOXusxYxJ5JZRCu9qghYyrJFm7hXyDqmiQ26HxIPJfSOSlseg8Az-AHBJIhVzHfb3nHTLKkoEr5JdSecsdQwAOyCVNRvyqTnaUKkJcVMmW60CzwOyeSnlmlDKLptptxisi5CRMKWeGJslWPpoqIecwU5TTLt5dvj07OV2rNo8CoJhRhRJFTBkzOoX4_Of_Bd-bUmTt7B324RgmbJvCqNW10XX76MlZqe8TNp1w1RN7SFfV51TvVhWwoOxP9QRNOCQ1wTFshU17sXLa749-_m8PnBZFgRlIvRC2Su7U_MB8zo0QFxFwpl1q5ZQXtu0UQFHQPrnJArQUTDMrQlFTaupRuzt7B31WuBobMKq5RdsPxUldgzBIqmThqh0_dTCT1nkYwJy1pqiMsxtqiEH6dsA1UNGI7SS5ltXWW43u6PCgRbfVFVcC0fdeVNAbwetiOUyKtjbAzN44dZvEQ7gkHC5JK1xOtbdCpwgvSXYjOjWRzKoF7HJTtCM8gjYR_iHw29wUG-0hCwOb2Uym2LaZmLXMtZ531s0yOhzSHQU73R3wb7vxt4MduhsOK7N1R_v8zWg__L7Hd3sH4W7IsvvxbndEdwcRd8ArDwfhLuHfDvdr3CFz0O7hYciM7V5oLU-uHZ6YVeeWSZoctFKoKVDz1OV3p1DG5Iajqkup5nXgZJ07OXT6MDG6XiM8_LlI_fMJNx-uaUemKxi_O2dQhfra55xchebaNDXaWzktPceA4-_iqvGffI5e9GieGlgiNzarRlqD0ROmCcat5gKxV6aZUxhE1YM92slTHgdZX7Uip8dvL0OdHwJ4raUKpFlqVzdRdc9UNVFMwr3WZgh0rXsI8xwxm4WuQWofEnOTAEI_sj96UnV7PmduYNE4rwjNVxwU1vG7RYQRYLPPsytr_BXRV_s8aFsLmfmc2-oPlrs7y_eb5QdJ0qkT0ZzGfliFt6wnVXE-HQYRPZ6UjZ5UZ8DjAmprS90Mauk4AsH76iyaQqvupNanYGwSOr7PQiUnJJ9zHNhs84xkIXVmFo6haZK3YF-NUORS0jtUM-Z6aaEQmmopnn632tSqDZYW3ov5NLTkQq3bmY3RFDMxYoPZBsMkCT4fhiXcQYMkYg07JIjFlbDpDm0uLBIehvuV4QehK7uzerC2epTcWb0J56YaB4UZLWUyL9MbirLIC6FFbUa3EyW1n4DFwlhPTp6y4zFc9-uri7-enp-dv7o6v7i8Ojl7c3r-9uzi_PRkK76s4WFGU4tiRlGeC51xJDlOqGHcHxkj5MpIUT22LyVq_t81s5lDD9Ri0xE4L3yoUYOazUHxaLgetPTDuJIInamWzL-1_bw7Ipbt7YYys8IGj0sPG2SyjVpuFOh7EOXoorc7OnhELp4MOcBOHHHFXZI_tA5_fe3oE9bWRfVHrN1rF-H3r-9A7QIy-9xccQZuZfXRvQ4cm8S7wpxkSXj468J4VzgUFU3s7LZjZ1hvu9Wc30Xg_iDYftTUQHf1bg0L7gJwG8D7P_w4gEErw86k5_7xD2lTv0Cd5ujAVl1hi4h5vEvj_e9KkVnuNlNFLzUit6bCZpLeQHBeDiE7GD15RgTO-edZlUjiu6VyvkV1OVECesjQ3RBBuqoQ5oNZnwLyQV8jZWSY4QK8mCp0PbjBwocEWO0llu5NQxKZKDTG9BRuLxhVC2vpbWoHYEYvB3nGNCVLBLcYDkdJ73A0qtsyylvL4SihndZd6APSg9Hod0vvHAxHVY37KdJh578uvSbO5xArbJ7hxSK0bhuXB00VfNmc3QZh8pmtwRH12wg3ZCbbHdRwoyRZjqgFvVc09rCsyT7vZNDsZD9Jlvtromuy7BkhpnbvihIxLelPrQUt5v2Tgz2Es_8H4YT9jEa_CSfYhHG4p989aHD2QkcPUEs2LHH3vV5ood9ejo_57dF9b_XgAY44ju8WcsFvJDLhyzkPbKqXr6mwll7zaqPxM461OIiRoZquEzRFHL9kDJPkJemVNJc8tWhueTzS3HKS4dtVI8eXg8HaL7vrC4dJNWP-ofN_"><img src="../examples/aquarium.svg" width="270" alt="Aquarium with a curved drum on an A2 sheet" /></a><br/>
<b><a href="../examples/aquarium.arch">aquarium</a></b><br/>
<sub>True arcs, a circular room, and exact<br/>πR² areas — never faceted at any zoom.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVltbxs3Ev6uXzGwgUPcSM7qXTaaAxw3lwZIk0PjIuinmtodaXnmkguSa9ktcrgfcb_wfslhhlxp15Jlq6k-CPsy88wLh8OZ2WO4gH_3kwTuYJJAAU7qpcKewltUUFQOqwL-95__gs8RPlz8_O5t780v7z_88P7jO1gosXS5LE87x51j-JILDz6XDvBOFKVCkA4Wxp4D3qK997nUS0DlEKSuSdwrIhKQrVApqZddWOVokYUZlXWO4YiZwcnfMZAurEi9NBrMgskyK1ZSL4_AVgohF2WJ2oE3oIy5ASuXuT-FCw9kYgHSQ2bQdY5BG892WWMKUGKOykFqCgRTeSjQW3TghVKn8NkEs0olNGSYKkHvBHz-8e3bq3O2HaAUJVq46IMSOnOpKBGgqR8pL52rMAOjQYBFoWA26sMdjM9GUBTgckTPWC4VCqF_PkgSWP9WuUxzKMQNuuBQEFobL9gXAhbyDrPgpk8f4erHi6ugHwPu_L0Yno5JbsMBXUjCs5VQCpTU6LrQ5yeFsEup3Qmbe9EH4aOC0rGZqdG3qEkZoeDdm1dXUFp0qKOCC2NBQFnNlUxhXkmVkU94CaVjtc87xwzUCMWFMb60UvvgVJI55rdDWsuC2KW-gZX0ebCCpBCGzy1i5xgyWaB2JD_NhdQOhM4CgfQKYa5MenMKP1hT8tNrdvw1G74m5WUBUXnTW0jvopYL8o0nDfrn4wReQf-cFH8VnfKKHyfgaU8QG4cahXY3gIoiLvBph8Pq6FL6e_iJt9sR_NEBqDSxFUUHYGllRn7p7AqzTiteOgDaWJ9DVXaA7HesOgilOh2AY-j1ej2ySSl4Cc7bKvWVRX586K8DIU5k9joA4p1HK3kNZHqj0TleqT_gRdJNTuBFP6Ff83JC_yf0Pl6lyjiEr0HXK_JUKTWeg9EIEyggNdbKLC7zolIKVjLzeZ0M6sjqhqDYJB7GMyXqEHYLkP4U3nsHfmVgIVLa0HXe0eqeDQuBvRRKoZXoQCNmp02jSbXfNJTCeslRvrF7UNs9mAQLo8Hx9usWjNsPMxy0YOJt9NNHXnFrVpDJW5mhdfBirTYHnA5Rh_ZWpgicjzhZI6BwHlBnJ2vL9ujB2vP6hauH1uxhHQ9q1nB1AOt0VrOGq4NZ-6OW8-JtdN5nU-1zHmpvhU7pZFEqbN4vl-C8SG_WKSIVC3yW_4bNxYt3MfCfY81o1mQPdwewT1vSpzuly-z1Kv1tRbltH9KkhTQ5UJFZi302eVSR1f5tEQSPWjijwQ6c4jk44xbOuLXDOGvq9TbrfcOvA-GsktnrJR-jITnyyc2Rfcf_4USGo3ccivfQP2oyDphxvR2fYh60mIfMvN6QTzEPm8zOG4vMv96VgZ_Q7nhn1fyfifQIKocOiE0ssQFkFgtKRRukuCubaIMG2iemdxEvcDfWxtdHxV-1NgEsLE9MOKxayCF3TUddGp2ayrra2FTatFKh7skfHLzrZPNXhdAo6hh3E-vIieVuMNuxmKPmYpJyzN7KS8HM2RbE2zoT_iiUiqZSdrwPRjZ0GjNoK1s1lnWnXuOmXoqqOo6MLb0mWwgfzHx-v-35BtwqXQW0yZaV7Cj-r-G-XMIXU6COiKu0BVQ0gEZPAv20G4YKPt8AGm8BNe37J1FHmMpLJf19A4uOHoaabRs32vLVpVjUQZpJKoUaoRmLI3fOeylW6tZU_qAtxXg_Cerw6nB5EYJ-IVKR4QlI7Q2LWB-o1L6sZBbKdpcblUEk4U1IB2tmqH-gSD1rHBah9OMs4bimMZXvwLrM29BHtwR6ckuw-926tLMoMi4LN3nE59ZUyxxS4ahni97pct9I6rjTB6L6w0ZxEkTRk50KPUU1GT-Hqj_eMm4H1fjsOVTT4XOozoZ73Pm5UV6exxTt2l6N3Q8fIrWDueYOxF0uqajvMSvNmOuWoq5dORJMqGfDgRwCqxUls20n90Nz9IAkHjr7SFqvG3G27lDW5eBLCDub9yZ5bW27ohzV0jDmouke8THLPE0y3rJzs6uXSvxOGvd633jgrKTOzKoR6O0AaBEMz54gCOG9hyDpspAHkdgiGE32EtT9VvIcqtH4YUC3qcZbSWebaHy2m6hx-Nfd9nlsKu8hNaoqNMzFvYNDMuw_TGUjswOaCIStEGG79QaZi3uqdm3WK43UnjobK7Oe0zQlCy2fQg9vLn6F1zCbskk0Q5E0oktOT4c8iQhEdwm8BgnfhVKRH0ftyfq7BF4STpdhNoc1FUo7aQfw3UH0TNufjg4D383wdb13qfvPEMtYmG16_VRYS75DaSkX8QqdPvDOIHqnIT1UAC_ZT3zdhVE_eUrnHVzjp7nGowbX4LmydnDtltXsfJzQ0gt7T1NGCmD3Z-dFx3AtljSJ86E7-15mf7-mtEknBYo0h1JiivDmV7j89PHz1c-_XF69__TxvD4kHHqwFQ3ylNFLHq8x6mrdnGdY-pwHuS7OeRzPd8JbWw9MpYMMrbzFDBbWFHG66qgKkXHcGEZGGl5cSw3fU1InVWV6E-ZCRHsSDiwBqfBCmSVNd6OLeFrkQBu4Jsde8xhZUOkfcBfw5dKF4anF2rYwJtQGUmNsJrXwyBUH1UqL3qZvFVb6vEAv06CANgxai04FlV8ZVCUslBGejyxLbuBBdDhe2Wcc0pXVkvlWKbRWJzTg0e2UBCnwV-nq-UyUOA9mmj0iaS6c1G2-enYWOadnyZ9lnQ0brE_oWuzySvF8po1XDmCaPSJph2ktbw6TP8c3bfBtMgH3Gwvpe_SV5FvqiY0iqam0R7t3dc44Q246wFljzICWprxHpCtp18L2Yq6wUczFgz70R5Tr6K9GuiLip3BCBXwIzsZ5FlMsOf18YzG2USxDdwOh6Aql-azdwzc99fNaPHGxgrFzbyxGLmTstKgt7Q7PBmu8cZLcxSDcxxcclIyfxbfphUcjrmUbjp0myd20wdeoamP55DAkt78FnEMLXQb8pBHmqNOcMyl9Zwg6UVVVy6Gs7EphHfZQ4VJoH_pALEof3t5g6SFVKCyYBePW9VddpYm5ucV2vo1iqQI4axSrm8WLXlv2H_HZYFiznUDbZzvYNtJG473SBo-t0NleaYNHpE37e6UNH5E2He-VNnxE2iCE0WPSRo95MvRjO6JvB9tGGpf7raBtSRvv9eSj0sYU6uET5R9QWvMvTP2DL4T0VVn_Nr-Howub5h8EfQDPhEc4GiSDSS-Z9gaTI_ja-dr5Pw"><img src="../examples/museum.svg" width="270" alt="City Museum" /></a><br/>
<b><a href="../examples/museum.arch">museum</a></b><br/>
<sub>The largest sheet in the corpus:<br/>A1 at 1:200, galleries, reception and cafe.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=pVbNbhs3EL7vU3yQUVhCJYGS7URJkQJGYwQGFNloAxQ9WdTuSMuYIjck1yslCJCHKNA36Lnopff0TfIkxZArRWnqIkV9MQnNfPPD75vZI1xbvV1ZIzWctWuP7t1oOD7pPYbEUlvr0JTWE3wlc_KQjmBsgKM8SLPS5IfZUXaEOTujSljobvrbHj68-3WOlbpjtwgOaUCbSqtchT7UOp30dpBr66mAU2YFZXwgWcAuGVaGOb7G3KvXNB_iRWPhS1klxF0KyKXhnGhTOfIpx8LJxqAkR49jfsD7P7CSWpPb4sO7nzmVaR-Nk1XFUUNJIBOcNDmhlFrDGgQOpwryQ1yGiCvRHZ2MsX7_ew_Ks1fEBmgj8wBfWtIyp2RqlxGWq-rHpqngMRrjz18wOsUaC1ubgoMv7Ga4y1HbxWILpBwRnKzotVVFH95GtEWtdHQqpeciYgcKeFuHctCQD1jKXBY0xIuS8NIqE9oUG-4GQil3JlgThVhEckfDdSuPU_H-tz6aUuUlXxt2Yav4u62DVoaOfQu7VsHxE1RtQxxhaV1ixcUduW0oOV3SntjCukIZ6baP94i-H4-FtY4rKjAv1NpD1sHOYUgxJm6NbWCsy46Qy10ZLauU3xFP6mFWaWnQedY-9bSDNxlQG-79ep0BK6cKjITIgEpW5HB-Ai1N4XNZUQYOEkrUVQZOa01gUpEJMihrMmCfHKTWbKSCJrxB5exLygM6raCSnDqJiTeLLTrnLi-n0qw6eJtlSN2kTSCnrEMoVX5rmL4nQsScga7oix66o7EQh6dHQvDlAZ9Hp-myP0UpZcDbXQRVPPGVMoRKuqC4iINYozOBNy3U5HPYQ5DYl5sls_sLkVK2kxYpQ_taxZOdDvfj4p_rPExo8i81x15puSC9f_fOQbSkqH2s-zK8t7mH8FPG6kAGdCdjthBjNq89-Tg-tlzmUZTefpp4pl7sFeF89mx68fRztUZ5qwBbkfFQJiSx7-UfUVMhaTCwWhhUpveJclA-Thm5UX4gtVoZKvoorQ9URLSd9NDI7ZCZzBiqeBITZ7A9GWXA2egrNKoIJb-sgG_SbN6X146QvJTKeKxJ-toRpLZmhU2U8TYWZayJAxpB5bcHiXNC7exiTn0TgedamTCHo8q64Lkh3R9vrq4vZpezZzezqxc3Ty-fX8x-uLyaXTztoTZBaTZSnlVJxitrqMBii1Kagieg8hGXc2CjuBSuZqkbFZk4mV_K9QLBpv9du1x6ChC9YdI6upNTfmgmR2_wbffRA76NIkt2tgi0CehwozoHfVXGUKw16Y-bKvZNHQsBHowETctw2N9GmcI2HyWn1aoMf3-e8R7pRAiRWDcYDAZYqjCwdYiX__MXET8ZZXC0rD21L5eX1vGg5y-Gi5vr6fl3FzfXV9OfWn4aZWhQ8fZpbSOeISo-Wd29yBG6i9NAEe9eXiAqrbaFt7oOFL8C-rilKiDXJF27WSPk9Nhjrbzn9r2qZeGkCehuwAIeJElji0m8sZzbLZXEdOzTYt6BtYPp2Pcig9sFzp8BcTsdt8_0qpYukBsUyueeebKsnVGBBbAgk5dxPsTQkTUA-PsFo4kQGxaTMrtI9_hO_rMvb70QfUfiTIj-g7PoHH0fCrF5KAS-xDdSffLlvgX5W3ystxXGQc4TIXbD83vKqYprg70690HySIkc757GETs6KOWs7cKh79vsLw"><img src="../examples/gallery-l.svg" width="270" alt="Gallery L" /></a><br/>
<b><a href="../examples/gallery-l.arch">gallery-l</a></b><br/>
<sub>The polygon-room flagship, furnished<br/>and tried against `theme presentation`.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVptbxs3Ev6uXzGwPiTBSaokW7LjNgWUVG2CS-zADs44FIVF7c5qeeKSW5LrtZoEuB9xv_B-yd0MuSvJL821OX2IrBX5cF6fmaHShRmMpnALJ1BAIdZo-64UCUKdG4dQC6UcCIvgc36mwrN-ITxaKRSUQqH32AOjEUq04GSKg06304X3JskRpANtPKSYGCu8NHoA5xoEWBQKUitqqVeMnguf5CA1AYDgY-DNJX_lSkxkJhPef9rpgvTgxMZBYnRi0SPkaLEHSyuTdW3smnbRA6EJsFLCYwoKRQZSg8-Fh0wkIsUeeKlIAGsqnXa6QU30YI0paHsKAjIrClToHKyU-A1TcIlF1FDTGeGkoGWQWXgQSg1gZpP8rdCrTpfkJzvywcKxqUxJuggFiRKVQzAaFrR9ccq2A9hamMz4qdH0E-v4KWoljf7kpcJPmjB_dolQCN_p73-Bn4Ve0d8prr7_hSFnSoGTtyDKEoWFJSpT9wBFktPhpDgqLFB7ELCspErRQm0qlYJIfCWU2kCKXkgV9KjFhg3U6bYY0WnK6BWgNtUqB2_I0Sn8-5__AhFdvDEVJEJTVDhk04l9D_OKXNxgp8uxU1vpPerGMq3TAQ6HQwCW3dcmHBwc6_hEjh1vq8RXVihwOSoVvMpbcpms0Xn6g930wEsGy7A9KE6WmLC72ATSQU3vibBWouOV1piModhPAWR82EiJwnlYiaXCHiyCt0aDCQRfPR8uTjk2eGtf6LQv-kvpybSlErr3sIi19DmDJ6ayjsSorMaUTV9pmL09P_spxDU5R2rnySEmA5FY4xxIz7jbiIJxa9WazBMs-sTdSaUeZ6-mgJbegal1OMGZYB2f48MCcx6Se8i3dIpwDoul2lBaU1jqlSPpaclDJuYoYmgK_Qg62ouEq1dQCuslqeN6_NhotYl8dtepLO4KPeOljMz5dBfZZJlMMKb_aWSDHilMfORN6cARj3CEcXjLVe5DwEnvHrZG2bBkikou0QqPagPzd-8__B2sIHYh-TSkmIlK-SjfU1NQTqTPAEaTXc0d2hsSclf9OpdJDl6sA41HpHhytGanCx9ez-Hy9Xz-gWj36vXsA7yb_XV-CR9ev7mEi_nsh9nLt_NGG5KY0wsTw_kUDCkdZOQUejd20OnCohRUFmaHoIROXSJKXMBf2ug_nQwXTAEaTEnayxsSXtpTwBu0G2CiCHG5xMQU6EB0upDJW0xBV8USLQVzIZWSBXqLDs7PWJf3s_fzC3h6OJhAUYASS1SuB8P4UWp0z8DLIkYVy9PpQoraFFILb2zQtSGS0kjtudBENqPAKIqtpdmJnBJjel5zHeMKcsgrSWpOJZhCUQzgtVA3kUm8gdEp4TWHicqbfib9E7KMq0lH4ldXCKWoyOaIPogRyGzT6UbzwIgOp8eHUBSnbeY7cF4yO5s12G1g3iu9PseCVFkZTYUcZttS5ERR0vFM2dvaLTzkglN2SZ53FaZcBYNNt3UyRBzVw8reyBt0vUAW0fic7IHqISU62Q1_hRmbadc4oc1YKFyhThctV1AbE30a5VW4kkuFkFlThC_YfkIZjYFyXc0moEhttO10t4WvchiyuulyMnnrK4uQCI8rQ2HaLC2VSIgViApTtPIG2xDiPiHUtJAuhmpZJleEFDmj-WKNWBJROY8lLDeQC50OYJamTZWVHA94g9oTGbY-aqsbVRlYWVOTs6ypKYIiUQ8o_XJMK8UFq3ALWCI7PyR2I3egcCcKCqHNKW8_Ox98czZ7N_9mdjGfQYAP_AbeeBIgOpuBmzajCdPm2wY2JLCDhbBJDim6xMolQr__D2f0AiyWxnoHlaZupBX6518WwffnZ3P4Yf72zcv5xezDHK5mF2dvzn7qhWiRmitnZUvjsGkerq4vX83ezq_P_za_-PHt-RXcjto8CsqLpalCXXo3u_jpzVmvrVOlWOEAPrTx09IdI2NBNpAO8FYkXm32KA-eHo2HcAvj58dQFD24kVi_NLcwHg2H9Hx0dDIZUtIQIT6LfRW0ASEdJEqWJabfhhgncTLpwbILo5VkqMTLKl2h78FoesjYJ4F-oGlMmrInVoK6ARgdT48ncAvHh8NJWNfmtrAowOgkeLQQdiWbeprKArWTRgdQUjR84aVXCEtlkvU2GGsTd4e4jDOFWKMGU_kBvPGxL8UUZIC8GQ3Gx4MhlS_UsKgcbXyvhH5XLMB5YakRscgFL44QyyYSiT3aaFm05mypwiRJVW4ij3tbETU5ybUn9i4Wya4KBXVUW4s4yP_bzS6p_f-1kujVhoFdiZpsOohR9oENJFbaOC-TJw4sFphuAnEmRlhHJE6kF1NDrNnNPnbcKWbYelnhAGahSQtFgrp45oAm6Xn4oL4JbWi3OZeXG35vkk86yFGkaJ8E-zjUHnUSglc208kf7tF3O_QBXJq9YgrkKJ26NhB2KkgsFNy-ks-Cb8BTaWqYPsTMINLDjVAyFR4XjciJQqG_vfMt9PvOW5n4LX2w8lzOqI-Ggytj1y435QF87ABUmo4vig5AF0bDkO-T4SkI7txDI8_2pionYDSaQC5U1ucBQqNz20p69aopDSHEQzVg5EWmKpcv2rRjxB9nr-aXHIexEq6sTHeqKZO4N4C3paUJVNw5mZKawEOvFObPtjgtRbImvb3pgbHB_lqUUFYujxWylJggSB3tHSoL0SCjuqok7uRZwknfiD7oQJBzNOwA3O_vOgDb7q5DLGZ9DlXZAWINx_Wb6iOv2y1DHYhR0KGv_CbeNsBHmuLMGk_hoDvKxmJ8dACf2yW0FT5SoihakE2zI8xoAevQ7_f7YfI7hcxUNjRDvfD3Xkg7Xvv4qwPRPumL-jrohLeUgGzbxiFMtk0xbkfVj_B02Bs-g6ej6XDIf33eg3Om-sNwJ8PhFjF82AflafMhUArrFjTE9_1hlA5ppf2dU3hGfPCUXdF3xsvWFlu8rafCTBFmGErj8gtOedRVXfgxjBK7YyCx-r7PKcv3r3ViKoRhjxInlVrYDUNyVQsXTJHovLHbW6T48OrVYMdC5XUE3g4KWxuNdm3EQydZfRytToNe-HB4z_DltSslDakPwvJMuPv6uI_UfJqc3Metk-sa4Mvi8vT9cR8pfjh5QFyTZdfuz4s7fcwMdXKt_7y4010rbMMwNK_9r3x1IJCTTF_Yayo4ANTjPW2cSy8nf0NgmW7JamFO3S1RFXUgFUWY3-wBxusIAtyNGAY8IjyyFjSA57z6ACAAhs37AlIsww5esPYWb3yyg3dJqwku4NFmsdoHrBPWcAsY7LwDON4BvHp1EE3CgHWy4w5Toubu62vd0Y3tuykhNcaCUzJFJoHx4AiKcDdlNFDXTUJwN-ZqGsYE_FpR08nXDTyGStf0byKUSyW5sWYQ3uTaDj7cCvPAqw047q65eRdlqfhmi26RiDdYLpm-SEPENKBGQ1MmhAd2bS1Tn8P4iFpC0oPHnj2EElMy6P7e6bTdy9NHEIZ7gBClexAxymiSaoiMxpRJi_H8LkQbWjuahNAKIIG2COTocRDesYcRo4kxIkURxqjFOLmLEUKoljo1Ndcqqa_1KFgj1G_hqUrtWvL-hvGdDdMvbTi8s4GM_Ls76uihUEmF5-RoPHTywAYTN4QCv-8OYrT7JyR3Nkyftxto_TbTMun7NP_2vz7T5tyTJsILZVbU6t_vS5vLjOWGeptwVU8_8TQV2NFPMZV221tsRtaioMmBEyrcaJY-h3A5aLKMx4lMJLjty2Pq9ulufPeGo7kRCvlLObSQGr4jDvt-AaVM1m4AZzGH-QaHRh0MY1xoDTxSc01XLOGaknI4q6yWrKtMX2TXTuo1MzO_7U8ATaBEbSfkeqm3mXgHaok6yUd016-Jiu5AhQiKUBzZTLbEFrfH2-LykkAOvnjM-H86ZjpujhlP_tQxh48ds2eY55Ov1ObosWMCMf4fjrEiWY8A6C1SPvcXvcm0LXvj6XB4O92CXoS1B9ufmx4DD_d58VqPoA-PqEQf7kOPDrfYs-ZnFd7zu5I7QXS6A37Mch9twckYo-Eda4AT9cEXJU_RUdiHNzbK4clw2DtuwclIt7u9xQ_o1gf7v8LtlJU78CbJhbSxobkOH_iUI9JhtD2GonPSZNdjaLZa0YnhLQgbW6HGEs-pcTn6Ig5z3H4sjA_3PUYefDwYgkW5DN6HD8Uw_MsL6wSETnJjYWm8N0Wfr_iB7xzajovC-YHsEE5qCP_ewfKmjEAAu1jksKMJ141w3Uf3KAClNf_AxMPBu93_SdB0sryEfyC5Xm7goPl9PD4nHj0YD8fT_vCkP5rS08-dz53_AA"><img src="../examples/materials.svg" width="270" alt="Workshop (materials)" /></a><br/>
<b><a href="../examples/materials.arch">materials</a></b><br/>
<sub>Per-element `style` overrides — wall<br/>materials and hatch fills, furnished.</sub>
</td>
</tr>
</table>

**And one that is here for its furniture** — the drawn symbol catalogue in a single plan,
from the WC's seat ring to the wardrobe's hanging rail. Twenty-six kinds; not one of them
carries a `label`, and most carry no `size` either:

<div align="center">

<a href="https://playground.archlang.uk/#z=rVrbbhtHEn3nVxSkh9gAKQ9JURcjCaCN6bWxjhXQ8gbZF7I4U-T0qtnN7e4RxQ0C5CP2G_bD8iW7VT03SiKVG19CjqZP1-XU1TmGm5zg7efJx_c3nydjWGhc-lyt4Zef_wMIYWN7c8qctSv-U-jConBG-Zwy2KiQQ8gJNrnVBH67mlsNKQbUdlnQSee4cwzjO3JbsCEnB3SPq7UmyBxuPCAs1H0oHIF1fA8oA2v0XpnlCdzkyoM1BMpDTo5gwS_l8azpHJe3eX628qTvyL-GkCsXtj1SyzyAXcj78mPbC7kjamTL4FaZzHcBU2e9B9QaFuqOOsegTGatg8yuUBkPL-YY8i7cqpDmZF4VQWkVtl0ojdIFre6UWb7KlFFm2QW7WKiUXq2UT1-ewPvACmDn-JEhwaHYJORoAMHndhPxvBW5U1JamSVYw68EMMVqTo7R-K9vP1xfTzrHcDUZX3XB2BDPVOq9BhKzrxWlFO2nPHi7oo38QHCEWuy7sYXOYGm7gCZjlM4xaGVCvGvDV3vc8mHo9cDYEnOhLQbP2oIKHjaodRfmmN6y10JUIeoz15afsg3YsF0gPoiQakKHJhX3p1ZrlZGPnEKzDbnQYIYuzeEOtcowEPR6PjiVhhk4WlsXfOeYSZUGvYXrj2PYoIteMLiiLCruLSjxAltppXzAWzJCJ2fDa5h9P_3u6ubd9Ob6evrxajK5_n4GlgkmxEZ9C6rSp-RAFza5SiPzDd7B0qkMVoS-cOQBA5wmCaxWEHJni2V8rz-QZ51jsGsyotr7ALheEzqOpJxKN7uCIymgC5SVSjILEL4dX336PBm_gQ1uOVKU8YEwY5qzaRc4dypFPsUXRW9GvTUtAkOajJHatDNFtqQMkCF7PVjZu3hXdHGwHGZKE_sIKw1XZAQ1txt-U6MBH-zaw5z4MN2pjA_E4H9rC75KmaWHYJl0mVCGTeJt4VLakYcfr1XKOeG1nAfon8DHa_hw9Zfxh08ncBXDv0o1amks23ymcU56JilL3GYdGw_TnP-YkU-dmtOLlzO2isACMB1ykVh7kpNl4FmjtxDoPrCVA6chvpPfTO2KPCycXdX09icCNziBb68_3cB378ffjD_BN1eTyQ8s96f3_xgziZecSoJECXypsq_hl5__y_BfMsbXM2BO-t0QruVcWBvWTpkALxAWTmVLCeazJAHU1iwromqYb-FslEBGtH4p_s_IqbsS2NmAQQmzI2ylRgxdbyUfhyCpseQ5-5fTTgacBCV1MSxy8ouRqiQE5ZMTZnOLLospi8BJGhbJ0BFsHKMbOWeLwDlPmaUmyNFkvdSu1gVfHvPcSYU6s4uFpzCLyYjjOZKEUvrCwzfjjzeTMWg0mX9oDVeYUq1SH35SwTJaKQ9yMvL0r0J4bheQkgmOfEyr6CG1zpDztUjXQpCcYOGIenVgiUy-5uCHnrcL7AK6VZqjcl1I7WJBBAHnmroQ60X5qxGLVelCRv62KiVQHudQC11wxbILa4XGii-0LcySnFybUapRsvvMq3_TrIadU4qFp-gyY6N9QlUWqkDgLEdaw0wMOYsMmWW0DvksKj88gZt3Y5h8_iu8_wRXH-HzxzfjyYerH6pCx_mShADtsHa2YKXK-CrtVNmtktEaTlcOlScW0d6R07iuMnpVnCBVLi20MJlrkM16C6U1SBUnDyqcwKRY-lp11oUAVxU1yrahK5SMyaQwDPF_krMNa2PktN2hLS64JKZoGqNCrrKMDMcddyHRRqdso8l4XOWCq8kYrv8-nrwbX72pa2ydUqrSGsseZCiNlS2CVoZel-VYPg7NkiC3NgPPFZcNFDUK9o647MgPXDGHOWS68mClnLOueXuOXhnAUME-OlRJKBxJca4MhXicb9VkliGveysskxpnZrFbbfY5CyUOK4JQl8rUEc07J2037PAUDYdZWf9LklhPsEblfM2HmiUPaMEumxcBCqPVbbzQFS3v-cDssHMfMNUkRQiFpd06KLB2qM220l-h1k1jJnYojApfeChMRs6rjLg_xVA1Y7H9zdRiQU6SyJzChsi0bcz9rbTW7cq8ybexwkgZTdEIL1oZK5S3YBoK1HpbZuiTjhw4elu34m81hiP4sQMiqudWA2JjMko6AGtck4OrIXA_4VCFDoBPURP0X8sLxrqQQ7HuAGRq5QGLEGMQtZZ3c8q4M5Ga1-lANIvKvtpM41Gg-0BOWcfqqvTWkPfATc-P8CLpJi_hxcVpIl9-2jktFDp4ujoXv_STi-QRiLfFsyKUBw-gbOg5UaIcreM7528VH4c1uqAkPzXn-_H8KClVkS-js8cy8HjxKzCGLV2GT6iSo9ZTcwimuj5iPCWKYPjDGGctOc6ekIP7hMPqDM_qo_H7k67h9uMwzlkjQvze9pF0Lir7yk21uiPJT6H0ZvxwuQS27D1bAqSdhKMPMtnBK3gjtfoICi4xcd7bQa3ClVErH1eow9MkuWcfVah_iy8fQfUR1BJiB7YkQwMbXd3A9luwn-NgerSDwD5s1I1ergS7EIRBg_AOtW6kqgTLYwZoMOeU9RvMaPJa2bMkuT9NGsy_lBNv_6iNWc7BD2EHFWyLFAI7uNgDO3geNjJHYFscibDJQ1gM-WMLMASzSNYCKvsqmy6cNYE7ljp_YYAzNuVGZSGHyyQBLnMEhtDFcQ68FHwZJqNjdiAjMQWyDF4MgvOrIRlhBzLS5wHk6LyW8uJZSEbYgYy-byBl3D1vpHwekhEeQg4eQY5Of4OUjLALKT5_LOVvgGSXQzWr13QQyDLNY4D-WQ3JcSTVgLdHm_hiLIwYYDhs3jtNkn2vnfHw1oLbfS1WJ7714hBa_drpMDmAFismBhicHUKrXzs9He281gE4hl6vBw9yJD_7XR8BvCnbN-54TD1cvI59ZGt6qpvUOGTFWSJOEGUHiaFqFQW4bNTQSRctK4zd9Zv0n15Z0zTAremCG0aeWBzGzWLshk8Eutzw6fb2oFxPyIAVZ4xq8mK4an9UNoBNE5yrTFpYwRXFyjaxPYLwrbKClc0pW6v-cI4bcIqLKTnmuPMkuR9wOCnTJIkGINxNuWMsAdp7ioqZcTDgOrsPg0Wd6pYQQ66_Q5EiCiGlZpQkcQtBzOE9WNHN09LNAV5cJkn3vKVQX6r0XlmqcbuRRYTp10n_MknuL0a1JJd7lSrMtBquBah_OUq6_VGtFMfB_XnyPJIM7m0fcWh2W-bhonn2QKNjuCqn_BSdU-R5ndRaXzdbIWtgXbi19XF6aug0r4dXwdvZQlW7Mgy8CV2VW-C4L-LtcLks2t0SSWgsMG1IekvbuPKRvMnD93caU94XbWWtw9vxWyppbE21dy6n310qR23bVB4l3eEg2TV4fz-V40alRR3mfnc4bOp9n2NhP48dZgqDdU_FguTVMhQktTYQdS4sO7vXzSbNFaa1UWptqGJoCfbTybAdEYVs458P0REXkGiqQZtSTW_ZoJbPpl6Z28OoUpb24sTtA_wK6c6Hh3AkMU9lvfGHcDLl8w1vUdyzOJeHcMpF69N6xabvUWJ8CqdYr8lNqz3KQZyLQzgrlTq7wdLWh3AGB_0eN4ztMBtdJEmXo6KMEu5q7i8fYtQkL-eM313on-R447E9ylWRV0d_2Zq2HO-2NcIhiFGyF0JjYTK3jTHxAEKa6cpTw70QGwzkpjnxfw5BcAFrQdTWrecl-BOtm9lirkmG8aeyWs2cy34tVdmmNxiGO5_YZx3EOL8cjP4oRj8ZnI_2YGzQZc7O6bGTy1a_HQV7MO7QMIOfIEq5r6gFOd8Pkjny_sks8wBkOBjtgDzy9eDP9HV1-ZPaYZP9BpdtqQa7qpG_3YvB-O3M19Sb8yoqHgHGf8iYxsZMOqDTUdK9GNQ5Z6cDenR8bu2tz0kvnpFnWFcGgWgMzXr3_vhnt_DldiOt4RM2bhJFLVAcKFs6yR7-cCY_ryvCo-PlWv_3Ht-kz9e1y0GyX_iQh2L-8HicFqvbT_frrjIKz9x-Mdq5vQMQVNAEP8La2X9SGh5vv2XSms63cHTl0vwD8sZO_q-Bo0EyOOslF73B2RH81Pmp8z8">
<img src="../examples/furnished-flat.svg" alt="A furnished two-bedroom flat — twenty-nine drawn furniture symbols across five room domains" width="440" />
</a>

<b><a href="../examples/furnished-flat.arch">furnished-flat</a></b>

</div>

**Two more, drawn on a smaller sheet** — the same language, laid out to a fixed scale inside a
titled A3 border rather than sized to its own drawing:

<table>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVtdchs5kn7nKTKoB0sRJLdIibYsr3dDbau7FeOxOiR5vTsvIliVZKEFFqoBlGhOR0fMIeYMe7A5yW5mon5IUbK9s3oxWQS-yj_kH9IHcA7jl6Nj-ALj8egUVuB1sTQ49ME63EBuK4-wzq1HcNauPDhdLEEVYEssILWVCxvlslHvoHcAtzm2j0B7CDlvNgil1UUAu-BHpVHFAFSR8beFdj5AyAk4WKiKDJ0P9Kua2yr0DkAHAVMBLm_h8gY-Xt3COVxfXf15BB-tbNUeMkyNcpiBCnA4TZJkcDxNkqPh4XhMX14lSXJ0Jmi9A34300Yf5pU2WYRZO1WWhOJsVWQDYTVYXufvN0J5qozh9QEUzEg2M1jrkPcO6Hvl0c9gbSuTQVkFmIxhNSH216hCjg50EQEXxloHPs0xqwyO4DNxiUVqrEcfOVe9g6gXCLlDHHpcrrAIUCoXdNC2GMBsfceinwl5-IBuE2VKiA5V5hvhwz_-9nf6QrjxzQOYZehTp-d4eDQKNijjZwPekWqXVkbRe5jcbLjQxjCG16vSbMAjeihsZIYYxGgRP1_Aj-fvLj_-BNefPlyM4PyxgfhclShUzh2qe3laKP2AsFYbkpoq_BrJ8noH0F_nOs35l8wiLSaV6SKzazDW3v97fwS36h4bidytIx9xkS2Eq5qOF2QMny9ubmGtjBnBLVFCH9kW0Ddm2-wYgLegwFUm0p3aVcmG13lNNAZ6stJZZrCGaUxNzCPlNwV-03ChUl0sR3DJei9sOOMtS2UMus0LHyXM9hv5YAq9ziJ-TXt9uth4laY99Q5UPjALHWpJcgR6cX5zO4Jzl-YfFB90Ejzb4XwDpbNzItwWKC8JuU7vC_Qe7GIBqNIcFiptOBVslq9dF5BbojSaLtOn7sVAURgoLDsZsGlalRr9AETX2gN-UWkgBlSrBjpqRSYPvbF0ZBcqVRmCMvoeR3CNKmPSVXrP-jhjowRQLs2hNnfCXpUG_b80yEP2eyNeNhz-6m0Bw6FHg2mITHlGotd3zAwcltYFD7O-KLJ_Bn2Sdn_WHtA73L-O9Nif0anqHYgoSSckn_N311c3N7sm2IhmTTr3doWkFnac7KLJpeKKj6acxb9cfby4GcHsr7TO6Ada9Tv842__DX8Qefy4dPpBBWyeC4f8k0f3oNPOT0tnqzJ6EVabDyogKdeLe1vrYunpyPP-XHn4y8X1FSzRrjC4zZk4qXYb6ILNwKG35gHJbFjtZgPKg442xc7ZwRodQoYGA9J5VCsSjnWZLlQgy-EnOvMDmG8CDnWGRdCpMr0DyJxa8yn7M67m6HyuS5Lj-4t3H86vL94PoCDCQBcLdHSoF86uYE1OjQ49cZoTDYWnoOD_175EZx2FbMSmo2uFORq7hlQVkCrnNmSu1ZxdLDArjZcuLKiVrThS9g4aAxBd1nSTEZgMcvVAAnD6AbMRzLZNetdoSQN-Bs4aU4c-5VB5qMo3MBsOu8qfxWDBp1yOO-jg6Qi3YT56JPEqCL9cffivn64-snQG5LckUIHDNCgKXP4MFHwS7dVnvo0EtiD5obilKuQSwpQPI_jsdAjkwnwNyWkIOUwWQ4HsdukXcnVkcjDHsEYkzFJjir72R9FKnNOZdW0C0uhJEI32gd2MrIvgQa_Qk2Mm-aVYBGc1-RtjyNp3-KHQSOxuRTjJotQDOrWsEyISXxXY6hs7io7ZqDlyCCqNSjEj_5sTxfFlUU5uJTo5N94CmegZzAwuwtAu4uFVc_uAMQKGtQWHEsqVgUyTfrQtOHhbTkyiMwTKYN70DmDmjSaHMoPMWue3z4HlU2DrXKYVwKECgyrGI8-OAF4nCaxW7Bo4SRpP5UHHlOKuyOJabY7eRBePMCtteo9B6ICF5BmiUrJkW4x6nNr03zVU_ExevA-_9wCqgkx4teoBHMBs6XQG02R21mZQng4EjJNEgloM8bOFqXw-g4X-EipHSin4ZICC0Wg0TTjcjXoAEbEHUCo60-fHsjZVJfYAfKoMwvhsnNCSwrqQQ1X2ADK98qCqYEEZwwujLbKZ9wAMLrHIekz3LadvNpBHIi_LAggOMdShndKYEcy8pmNM_oKTCEoD35CBFWqFHhb6ARmvo39btPnfI-8hcJzvydsOPx8NJKoeXhwNAH-rVLDujuyYgQ9vBpHJePLiiqMB-Kpw2iOvld2-KjyG-ODzESVguGFtKHh_ff7j7eXHnxj154tP15c3t5fvWPuKfEKJaThr0xWKMYUlRFjZDA1RAWTuoaKsoMjoe6YCq4y4gt9rljiNynGlfckWLuT_IYIfDodD8DkaQ2yTCdS-ozV5ToiGX_3rQcwts7cMCPgloNNsznUydZwk8DscJoPkCA7HL6l2aT-N6dwc0a_xE5cKNaW3awuLypjhWmch75p3ZmFl22R2bd39GR-sOeY6ciNMz_nILcQEBwxL63Qhdtd4U_ZA9eI5Zrx-BBdKwqCqaxbmd46polqSXZsuxE60h9QWQReVrTylA2TFtlrmktRoShdL5SiiQ5qrYokelLFcdo06klzfERl3RctvR5qTWprHIjgRo3z54zGIfx7ktAtyGkGa09kpboJHszhrcuVBjCMx__UDWOkQa9W5DTnFmwKd32aL8Z4jqK1y42cucqFb8dZfjrvEjqeJxOlxklBoFucqvpVCKqlv57WABauGkh6i0K45LShVgWab6qUyd2vYS_Z4ymQTLTXZ_Pl0jzoIBp-AEe7Hkw6OfNkHRNF68ywQ09AQs882Mk25xXMYr-tz-vop-7rXIc2_gaGWm_1WGnL4BpSXScdS5csOEGbj54GmrUTlc3Q5j3AmXyFo3J6W-KVBah2s-BupKzDr1BCU-3ARMvs2B9utcPof5F8CklQAJHfR2Vt3FxdRv6g2Aa__ikDMfqEnMQ2LKH3gvChiM9ZBJ9_iTE3CspicWipd-BCdHr-K3v0i9hW4VpYkzegl9ZjKWQQlF8lI2kWvjBl5v6rkOExBDlNLfaim6JHWFWfLktuu7ENMtRvQhgT6cYtUKo-jV-0KKB6dyCK0EqsJFnkd78rrgvb1RVqCkUuC0wWPZ4qkXx-e_WjveWGEk129yFOnGJESQ7p228GZ8_Y2a9dNyl53R-p2SC0ofm2Toi81RSb8UhqdaipHDzlXXmuPMPt8R33Iuw_nP1x8uLv6dHtz-f5idrQrxzrJLa3ZLG3Bv8K2H_xeV15jPOkEO541ro3i_EmI6bPkTxn91TQ5EvF2u31RZ3xIt_oD_V_ih_3Hij0Lgdek0F_nYCWtan-QvAHGUbsxj3gMOJGubsveVwAnXwM8ZsCuaxLA5AnA4z2AB3V9VZd6UkQVuG6T67OYp1fZhnJOH38xG07abdnJnmA8iLCx4IYMSy4VpAkhrVzxIK1XGIg3EQfBBxOzXfuT1zOtUOuHjzCd7M6pm3YYv6E9kWm7WOgUt2yhbgj1b-KH_bbAQY9OWeiEt9ocHp30P8nqPkRPG3fvak9CYAfzuFUgY046mD-okNPe2nvT7h3AKmizDSgBcz_gp6CNDpuGyEq-19KJ4Uzq5eE_-ScFK5fQoItZLGJC-yhYiG56Rg6wLe_NZhhbB8In3Y8YPUdKp82GcekeRXWhZhCUW2IYNPk6GWLTxZE22fXlf1y8r68QuPetDbexjCHSGDn28LhKq0JuKdNNDSPWQZGSTi8Jg5YWehWo22YdbGw1gquCdtflEaPGpjM2vpjKmOYioTRKF5xwq2KzVpszmJHEmiYMGvOCPP-a8vO6cOeMV2dvszspbsRrjdkfSg1FDkLeLAUbVdMYz00UnGj96lEfhJqf1D9B1zRqlZRnOeplHmCpXIZF3bkClYaKFAfacwhnWCVvzKQ3wsWpNKr8GrEE1OxyOtcEEHsjbTFCpYfPrcm2OZZ-tIHY4iF_1FRSKsBLyt6iDE6TRDhhxvegLLdRpHBhlGmDMkkaFEfst3UTu6cB3yKolo3CbGB8POUu0Zp2xcYeK487y7FsuUcsvZRR1EbwjJsaVO6NNLDiC6knouu8hwuXWMXyMZqMpSFF_tio4l6Ufkh9E6qIGPR0mrDl1_6Z5FKaisqlX9VqfjSIDbJZK6z6HlDpFd8WhqgcKve29SFOOvLEYpRKSgWYtFI8fSzEFkI8Y7MXWQWvpglAd3fXdURv2EKIL9yBOCHVPQVBO7YgpNBhiFjzqABjJkMgXu9CtH6-wwvXJ61ReiZkmjyNQjt2ISaPIE6T5yEmuxDHjyDGzMzTEMdi2u-Ux6zpS0siUFZzo9P6Np1vqGibuC1JHzgXp84VHXjyGYYL7NpL6OytrRPzpnIRj1Uf12ntsmLxu7t7N_Pe3v2y3R2T7Z3tscCn7SeTaR196-3jdrs4k33bMQZbenPc_-T2NqbGy7cz6pqji9d9Po4QfE9MjdeeOntb1CUN01M32_iv47Va_7-zOUpSmEmImbh7V5b7Nm_lRizJ7c0nT2_G7c0vH2nxNRv5U5u3MijefNLd_PLZzVvZEm9-NfnGzb7uOvDmCckrdgK-QWC-bjVI4TL5_s3HDdnHnXbG1zevo2-GmB9IdviNqopn8M7EzZPT6fbm0x2BtfY-Go1CjsWeVvP3ZJZ1mPVxfoSb6zx8wrfPkOHKFj44ThxHWzfa2vO1PWb7xiYIthmc4MyUAzMPEbzZuvCW4QMKmnSrt7ueMN7IFWftbg7qMqdutG-3TzqyEI_ALEUSuSW99Qq4ufp0-7O0sptr2ub6KF5OyAwCA8ReNg0oYF154ZbPGe1ouE6lmop62yVO9rjEx9vX7eDStHugutt55d7d2KlnZfv37M6iB2tpfxwMHrnjReUKzRdj_2SJ0wJ5u1BA7Zm21VSkOWW0tgS-jZOibHKSJF9ed4pVu1D9LaSg5ga3kKgBhFSJMAJx1kW4pfX93lMY0dE_jyGNKtnWb9Pb2lW7qgBHCepWRSKVfLwYeAMzu1h4uuiMNpppGuqQqRqaC2FUvth-4eHdxcfb64vmUkSMlW-OOgN21obSaboxTO2qY9CpCsrYZcXW3DIdqb3zurhvqrVOAVSP8CQglML4mGI2S6nN4zoqDdR1iH_fhnf6HF5KExLovgPv5OQ5vIXT2RK_hz7ukmzhbQFScA3VXFZwpG1teMhJO72pY8zjV0ny5RXfDbco61QoeoQytyHY1ZAr0C7KyR6QufK6eAZEqOmAkEGfTJPeXokzCkf__YeSysQvL5mEA05AvnAyYBdUI63mdNtVlkazNc_VZhD3xrK5CQ31_BtdYBeMs65vluu2hGrnI2TV5UdqvDZ1WWPzzSlwSIOl6OpLYppB0qkEMbrSyh2Zuwy9hPyMs_wzmQdAaTP0Pyufo-vTS08nUyoV-djFsEPTByNp1zhLM03wOpnR9Kcc45VKc13Qmf3h_N2fuIiUUpFI9lVJc5QSuHxA9hS0pDOy13ZA6F40yDW0WCvFbKaNnUZzrDOamlG8Z-jwt0rz8G49y6Coq8egD-PR5JRb4AbVQz3VSp1GZiOJA0EEVnQ0WOtU6hfqpPN0okwAfL778fI_bz9dX9wRu3e3V9wml9v9jna0B_9bpRwOtc8bXbF3kztkburEllLsQjGlRT32W2zNRvG1xrY7E8nEtO_k9TQZvDpuenuvxWBr_11ruFHgTouiM4_TbbQxRXwZKvNGnDeoubemCnHUx4NTsVGjhB85Qr5ppMXUhqx3q-EWZ7zEn9MlOCuxYU96JnERA1MjOPYcckppJOOJt_Y0AsTjX9yVaztOK1RF2BZchv4-VpiUFLxqhMZR71Un6qG_3469c2vvU-VjSsI9-7afyl7ipNOfjYsbsY9Pd5wYFmlbrVC9mLQXAJTebKHR4p0wTlba8aXc_X7el46559tphr-3Fcf0bctymbNz4fJEbjU7bJ5Ib7u1LVn9DJs7VE6-5qy_icpHsMf_Z9jmMPBdEB_Sulcx0wX8K5nwv81iy4INuzP24VBmmqUdHSxPI43gXPIZozjCNPOrj2bqtO_w9Oj6rpl5b6eyxV9K683fx1MgrfDAI5l0s8wTnDzDzsPk1FlX7IqDjbeh7UtrGknbVPDGkrkV2bhzR_CLLO53smVx5NR-_H-5EqDcZNbpfRcvZBaT54Gydq5oXesiOtPWu4y2Z1aakZyKp70VBdXbi-vLq-sn_qMBO704LctpcZzGj2mSmMEbibD8oiKlodW6vyvD6k6Vzf9zEPXEO1KZT1FxeoavyZ2la3bqC4ujoxe3_7OBGaUQR2qjpWAf0JHHpCyEFBF0MBhvqEpnf6XhtkfzgvwrJxV38w306-Gy-JxvPyfJ5OUwOR2OX_b50ueP3v8A"><img src="../examples/courtyard-house.svg" width="270" alt="Courtyard house wrapped round an open court" /></a><br/>
<b><a href="../examples/courtyard-house.arch">courtyard-house</a></b><br/>
<sub>A ring of rooms round an open court —<br/>the case where a window's outward face is<br/><i>not</i> the side its bounding box suggests.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=7VpfTxtLsn_3pyiZh4BkfMcmkIQjHghhD-wmcBS8F62urnB7puzpw7h7trsH4z1aaT_EfsL9JFdV1fPHhpBkT3SflgcEnp5fV1f9qurX3d6BUzgcHsIjjEawhJA7xH0frMM1BHROpQi5rTzCv_7xT7AGIXNqpc0CSnQgAwcwd3YJ0wIfsJjCrLDpvR_2dno7cLoFoj2EHGFW6SIjkLAuEUKuAlhTrGGp7tGDR0NDDXhMg7ZmAMpkDbz2vR3I7QoUlIUy4NXag7dDOFdpLpPTNMqAdZk2yq1l3MxmawaaYWqX6EEHD3ZloFQLPO7twFS5NIfULktd4BRWTgf0EOzKsO3Dj6Ohf1gMup-Mn3xyIJ8okxFihj51eoawv_-rt2YKC2dXHlRcjP-f_50O4fwB3Trk5A5bBa8zFB-xG9nt08ro4KcDmC6czqYDgi5ViY4-8qkqkP7I9NKDqoKd8kvagw8qYAbWpMgrV2VZaF4TIE3axG-GqaLwWIO9nTY62oP2vmIIjr3PEQNwtBB4Ygnz5OIcbianl5_h8gaur87h-v0fz88mcPv5cjI5v4LJxefzc5hcfjq_GcJl5kE5hMrov1YIt5eTi8srUMAuGYC3vHyvlmTLVGcnPkzJAFUUws9oNhkHxgZQkBbK57LqUHMsw7RQThGBhGEhR488syzT52oehjChZ16bRYEwVym_v6LPhIwEVZVE9nlhrfNQ4EIVx_T5GnL1gGAs8d8EyKx1vR2wc3qoHZGrpq42YQo-6KIAhyoT2Ll2PuwzLBTKsMuVpwFpjpkkVWQEhbwOUsOq3b3hA7qgU1VMIbXGYBqI1hRfdqGk8QwLuxrCWa7MAiVy_OCVB00sJQvXtoIFBpje3nEc7_589el0cnZx_mEKToUcHfnQgAKvCzShWEOmfZyTbKVFCBemmXaUpTEAmHUqBc8Vo5ZhaiU8x-KNQi_yAK4yHlRhiX7Bw9zaUDptwitK-4_XVz-DetQ--jXTDqqSZ0MTkCbjQKvAo155KJRboNtPrRSDgIAmG8IFOskymoh88Mhch3XDv4WzlclidKJtnWk4OJymKr2PIYecKEqGpYVezsjgYFfKZTEaDjH81JC7XRowQxGCLcWRkCrnKFF5gZldmemgs0DCzRFsWVqv6xUxjanuFd4Kf2mMUQ9ANSOyjjJEUVkgds58cBUxJtUurQoORW9HKsMqJwfhY4pl4DigCW4NmC1wAKtcp7mkybobOh9s6WE0HB3CEnxuXagdQ07q7cBKFUWdcMHpsk5Vrv3OVgFbv7YpVdP5Xoc0x5hSRGOZtrcDBZpFyGFeOWaqt1XIKQ-WqHxFPjs4TGC5JGuothH3yiD14iBJavfXvhqAWihtfADV24E3SQJLbfSyWjI3Yi47nFceJbLcXlY65JQ-v5xOLu4m19d3V6efP1_fTofwyT5wq2sdxS1MKsDjgJNhpTM0nP-85GP6UDqC2CbOofCCUUvMAAtcouFU53cl924v_sK1-JfTz5PLyeX11Q18uL56NYFP1_99Tp5H8KU2yJGgVHk8ORgnyYDnWGHYd9Yum4frk9dHSRJ7GY1InfW-8_hNkiTEJo7Hc_XZtGwvC5Vik123ZzwnVTUVcp6VUHh0blfogD_zWlqNmtkHyVfLEbZSibhm-6DS-5b_xhIjUluu90vlAx6TFaqRIaFxQZ1jEhcu7bUJmVPaUHDi4xUGtsdTGa7TS9U1TXuY06qDhVRqrPZCaR5H2cMvc-tJVVFQEpssPq29tIyddGWF9PfaZB5QORO7CTtwoxjroqh8cFTUCMBj8YBeorxRvW7PqCuVaDzY-RyU1KnR8A3lKbFHyFsXBm1AB44UmV6gmgvxpqVN7zFMj7nFcHM0ln3tnM6s40UZClfM-jfDN7AcQ1pYdU8eiEXbFzRlgfMwhczph-jkUhkswFhHuWsCIY-HR2QipW2hzH2Xu7s6gEHMPLw9TGLnFzn3NkmgLCqy-Fe1nO1FhyiXoRHXcvopMUSbxZTXuFHWOLwlVUR5Q6WhUkVBsR7CKVBmotQgT1qYtZKBla0KShVJEyaS5qQOalbgT-BXlWg8ciAPBr9CLOPyuUpwha5pqJdoPOmXNCdCqlqbUXo0KoIbEBb4IFKHCugQrixFYj8ayjHkqYjjojWPYUpLuyH7d_emvR1wGCpnPJiqKGBuXdSIRESYVQGmgjaVMnh7d3N7efXz3fX7m8nnP59NSCmkylAxwwc0rDXXwGHUgZzWujsGgXcShhSPgvd_-eX05gZK4h-5IKwsWU3coAq4shCcIjmsTS2Q2eIHVEWkaqSDsZEsTJNgoVTungtG4ApVO1hoOJVE5T2ExF-4SwVvZev-RJWAw30MU0cVnBVH011ErbAAsD7wxK88GfyAzpN9bWlDesRFhFqUqwzzTRX3VNKVl3qOPjSFkv5BZ5o0FFNqQHqFnhITeb7CD3vcjvqTek_Sh996ALyDgOWyB7Aj2wg4TKbHnXpYKhc0U0h7GEvd36r6HkbULHy9fZjOi8rnU8ac68dQOWQh66VAD4fDwwSsoz-ShMS17CJbMUbu1V4USqoM4GPp0HvAR5WGYj3sAURTewC844HTAyitC07p0APZg8DomAdI7ajKHkCzF6KY99jA6yqQiFcpejg8TBLe8iZJ8hO8fpckkBaoHMwwrBBNzEgX1rLuYWcjqz3MCs0tj3FnlqQHUc53XLPSJrOrugM2m9_YzkXckLSpE5j80hQgIiBBd3clLGp9rsq6XBYqCueMSshSZ1nBlZd2D1FGhmYHI5U9RpSx657WspMIjxQ8ei2qDmpbJdqS-ixtrQyFpMAAt3ACh8SS-LMj5IaUZWqhDfo48gOcwCh5kyTx_wmcsOpq38THgE6zN3R6b9DXr978cnl1TsPjRDtRsqtshspRuWTqDqI_gyU37JNnaivPJwBwAqxjGoBNocPlplYpZPizWiYCvj89-xMBsvJpADu6SJs6uK3yZT_2GOEBCxhB_2duzxIlyU-Ir2cn4kdovdK6BWg1v8FuMkj2YPc2_v6wR5982KNG6xH-vonGuQ2d7G7RyKu_wS57mbHkL1rj3hbM6o748jzMSGCSwe35pAHhv7cx2BkvY8jku7eNFQzB0dLZibtj6QJA1bw1HLz-G9JykkcOTKFmWED_QhVFH9qfyqMX7SO7me6-Z3OWQnMz5lnY2fzDsxAXH5lPcZaPPLa_OYsAbKGuUhkhqOyhDdTx6xb1rBZN_Q7qKt1CjFuiiCgui4iUnI8Hb1rEP8nY__rAmqQviDWACBVxtrTn7CS7EyYz-mvaJiR7JBdDTuFKJK7CVlYGLOlEELGAA4nWFmZ0rTWx7agAYyoHAkyVeAOh48gdFnIiQoebMpIPDVoRyTzrbr1ppldeDlygtNqEQYTcPYgLozLADWQgU3tb6KytEKRrpGl3cFPrDDpWnMslqJXijtVd7SqNBm8s-PBts2D6q11Jd52sPvmRO-baPFuXyvtaFmnp-qPhGJaNEKp3jX6FZWj-jagkhOQoj4sg78WjF1tRQ3oDaPP_RQWyIYi218uej0Kv5c2HhjfjTd50Zhfu0S6Fo5-d2A12M44QfBtK6oq8X7fd7MRsJPHoaIO-RxtmbL3pNyYevZYFfOFVfndeOaNZ_Swx04pi09QQZdKczzDKfc4PlkySoiMuJW2GfqKX-1uI3s4VPIc4syHYJQ9uIbkG0o4oQt7YuepvGyl1iCFX6Sac2NhFfC1FdQtipjxtE5-F4HB2IY5omYdJr8Pu2sOkgJ3OapUi-hhuz28m4HHBJxy72mT4CAeDWifzEdFuMmBRsRdBOXUpMfdke2Lnc49CaUVHlUHxIXhU6iSlIjzfCJCE4_JBB2rUmejMo-3vf62UC-j2aX9EFwSdYyqigpzpNcd5fmtIqoIq7KKKydI6MTrhzmtz35w5dbMjmngAshrhPDs9vrrNlUDHJPHnWwDHo5cB505nC_wewHcvA_JOeGNAVIyYxZwgvr1rc2JCL0QGx-MJuhCQmjA6TAbjoyTZk3ffUccjF8mxcA9EPojqGkP_D1z-XxJdP1Rz_RjJ9QMU1-8SXM3FxDcIro8ytl_rlY7AgkYKtNAzzEatHnpZZb3HjF8cReEyk_-3EVXIv1VhvY8Hj_1oLL371MBxC_eyvKoNHG8ZGMvIlW3Jxe1SouHjzYkczTK_-bpm43SSdyZ0Lh07skpT2SMR8MKpMo93RnE7XYeM1lct8lha6bJru1tTABphQsscbSmTrhSj0U_afcg3AXhP-CWA2sMbFowJIDJVBXg9ftGC8dM-36XR9_R5s8HtLYE7flkhdJlBFairEN6-qBBmmAnPuQiy7V_pwFwSx500-2ArLopbXV25zNkZfhH4SV9m_cE74wh8GyH63VYt2-BSIx2cLCzI1jU0T-RgiA8i4rkeaWW6tY90ZeEYj5_pXFegZ3QazuQ_5tSDymTYORAh2AHcnsEM-cRPN9dkcc8vEmQmN1ASm-ETlRLyUM2iR2iSr7n6zbNqp964fQnniWdfEk3PwDTicEvNbQinFyg0fm5d3WUd_nsMGj9n4DYznyfQJjLVplDny-vDw2Twbty0bTJu1DHujAb3WyN-QPM_gP4NpvYrRy7_6f4_qvt_owDwocrW3ygAbmhsf-OQxc7nOsXfIQFu2qvGF1TAkg_Zv00FfKJ7mtj6nxMCbeeLa__m7svjn2u_8LsacFzcl1rwk_MYGf-0CXdD-f_VhLuB-b4mnKG_byuo2P6VUnckbG8qKPr77So3s_Y-VR6fQf1SYX67eQLwPiJsNGCWf91eq-qLv3hzzopRzvFVfX0uX-Coh1FXjufcEZivuOXe_6HeBjc9nP0W1LqDEu-6mya9hLIK8d56axMqBnxzz30nG77nW-6P6bg_tuFG2n0lsgTF2-vvaLmbyF9i4tt_u-m-PXzadOG5ttvN8u9qvPRdpS53-axy0P2CUyQSX7vydxudtXM-pynR7Uu7LvQ9yj2aHGdi4WveytGksJW2OjT-lYcpp_m0Pp-kK6BXng9IuUVnbW938fR5cnF50xyMLuS401iYUopN6QuF8caObpUxG9Y9YQ72AR19zYMoV6uMoEOBUVSUzv6KaYD-pPtd2oncHkqM-OL7braG_qlL84_KLOLn9FWO_jgZH-0nb_dHR33G_3vv_wA"><img src="../examples/townhouse.svg" width="270" alt="Three-storey townhouse, ground floor" /></a><br/>
<b><a href="../examples/townhouse.arch">townhouse</a></b><br/>
<sub>Three storeys in one file (ground floor<br/>shown) — <code>level</code> blocks, one stair<br/>shaft, one drawing per page.</sub>
</td>
</tr>
<tr>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=zVjbbhvJEX3nVxTEB0sISY9oy2sr8IO8UiwhWjtY0XGAIPAUZ2o4vWp2z3b3kOIaBvIR-YZ8WL4kqOqe4UV2YCQv8YNBkd2n63LqOoQLKOyywSJAWNuxD9bRBmrbeoJ__f0fYA1B6XCtzAIachAPjKBydgm5phXpHObaFvd-MhgOhnBHISiz8ICmhFATNBrNeKHtHDVfCLkHrVYE7z_M7m4ur-SM4MQr2DR6A8ECrcht5H1bDYZ8bHkuf85bpUuWR3lQ3rdUgjXyi6-JAmCIfxSoaQJXWNQR_4mHuS03fA0NWFcqg24zGIqE8tNIJFClB3QErVG_tgQfb2bXN-8AI4gYxVuROvcBlcthTtqugR6UD55FmdtQQ6WtdX4wZHH4sMclQWHjs4H8KBkIA_gaHfG7LNqavymp0OjIJ62wCueQl-QLp-YE4_Ev3pp8MARHjXXBgwrQmpIc5CtyQRWoJ4U1hoqgrPF50itE_I3IUynnQ5QSDFHpwVj2qgmDIZT8ra1AsUJrw-7QygQoNKGJfp5dX8H11c3b69kdXP588RHevWc7vR3BxbtLmF1fzODmTk796f3Nu9kELqKd2fpQW6d-syaghqINo2TQwRDymtSiDp1Nl3ZFIth8E5gHQCrU5HpGsjNyesBlo8k_3RJ44leLnJ_qLD8YQqU0sQ3W6GFOlXXEv3qCQmPryUcHUjmBj3XyWYmhXUIl1lH-kQcGQxiPPWkqAkS5fS6WztEVtcQVvzkerxStAR-sySdwE73gVAhkQBkItSOCoMj5ERh0zrJq55HyYrMnvrMLTH_IMlEsRkfU9omPfhwHO5YPI7naNhyweUfbfyYZ4VmWZUweuyLnVElCn8q6RMaYAVBbQ5E3CLlXWudP85qwzJnhCGtlSruGuW1N6eNN5mqjqGBj2woWGn9TZjHpZPcT0rRCZmQOFz_--OGnD7cXs6u76CN51Se3OxQvhxoNLFsdVKM3yiyYJ8ksu-z1zFKMthFG8IGFY8niiSe-U51_NVZSxBQexBIT-Mn6kPTheK3JkfiH-GjNNJNIxXshDLzKsqfT0yyDkipsdfC_l6_D2kYzlDbdxsgw-QU5qBJpCzQsQyCtYWNbwLltw2Qg0XE0O0jCR_B5AJyKgoflcgCwcKqEs2wAsEMJ6P4ND5ggft3lSiejhFXoOQAqDAAaZMZcPAONpvQFNjQAMNaFGtpmAFCqpQdsgwXUejAA0BTgI7yGl9lWhiHYNpCDtSpDDcdr1BoKMoGcVob8Sbp2Ca_hh69cK6kJdTozg9cw3dOOHgI5ZR0IbKhVcW_I-3T--uL2lq90d4aJW6gc1HzhqWjGTnCtidmharWOjzKxYzGqQlSOA-cUjt7ucCn6A-L7qnzta3ZjL1YvEczgMxxno-wEjj-m_y9P-JvLEyi09QRf9oBYvk9raNAFxTGyA8Vk-wzHrJ0gyYfLkwOAexWKmsx3YDx7kUWB4ocvA8Fx1i47QThAovBe_UZi0AdxlsY5aTi6Rq2PQLImH9-7r9VKYibAMd_rQc5eZtkDv9iB3MrBBBNv7QElhbZIUdwdsOdbsD_GwwktXY2KSTFT5Wspbuzk6DPOAaevsiwR9ZTV8xKgygS71au7Xn5KmlkDyVkY4PRlj_BqH2BHoy1Ep9Mextmzb2Hs6TGECwjsnJR7LZ-QXIeuJHPO6QxsVUVaS_Rz4mobLt_T51k2AmU8B3uolU-QfQXhNDKBWU3do32KJx8TRExrHkwqwl1W9H1KnERCxnuqfL3eMVlv9LNsa3M2HtcWEZ2ri8j5CGXHaj3M6bOt1U6nWRZtVLXOqNA6Am8r5PLa0dEUNcenbaDSra_ZFCS1MFE8y7KHl2c9n-5shUcHkF2EeWXuAReoDBcO9sg29mxVMS5LxK93DmSgmIc4Z8gHpvVplo1Oz3pWv8qyhylHSKlczLgSm53jye3VPSmP21p3vm2elNl21XB9dXF59fNOtd-2FYIt9SOWf-W7KmGN3sAxPoKUBnptW13CnODq0-3Vn69uP_1085eTSZ8xp3D0h62YR7ttx_9t8pxjqP8zQDZ6_irrAeLnAwwq_-fk25Wnr-RffrJPnfFYynaFckWrpbPaA2OlElKUdwsmDUwCe4OhTkh8Yx-CytPvSOVvqJQbpx1O_PsQavp9ubxDmx6gpZT1zm4pI5m1baRpO__KUFagc4q2cwAPWeh3omaw0zU98d0kAlgU7LiFw6YGR1jGO717PH9Z1FTGQdi2QZLkSqEMMru5NUoygeM3cejoJrRdt8lQsrQlaU1lDMTtZEYlYEJcYknjtoE56sKaTVR_fzg7Oag44sHvLFl89vH16f7159Ozb1-fHl7H2Fel-OLXT_vXXx5cZ_I9yv2d_F-tH2dfKRadxN-uFF0x5QeFaOk6J-5aLWrJho1TKyw252n46QaixA-pVT4o6R3jGADBJmQJLh410HC3XFue7mVSSvNUuiKLC-raTqGnbcjw0PRYq2TIbe_yfNpr9aIro2KQg6o159WCgRjJfRUcO0nKX62FjPIw3Wn3Lm0713T0TeBpBzy3IdjlN1CzA9Q7ZRaPUdeFgErq2gUdc1uekAXveexJD4VCr8w3EHZVFogXnFbPsv-mOpd23bdls53MoK299_JrJLWQhQtEzEdchQE5flsfHJYxaTnikZ73Lxz0CZW_7vkmw6HHjQdveZWSr6wqZRHAU6WB4xI9ZyNHRUA2K_wurqFKhQtrUPuTBJs2Qe_f3M1-_vDj7G4vDTFpeSRNI-oa9T1g4ayPSxsdd4JrFWqRin_Hue7yXY3agm-bxpH3cSsXR08qFzSCORW8aOkeYItzNMRVi0OlZVtwk6bTd-9nCbawHBipr012fiIrOjyP46xpl3Ny3b6HQ7pbicipve0XhsHOaMgpvNUUtzaHC7ZowbhjE0_4dh4cFrzfjPpzLMZ9AbdECVgTruLk30383So0sLGgVB4XjiguRx49qmWN2G30Eqb42__1b_nW-LGuBqhQaw_KjGBdq6KOWrJMCIYCVGrBccFG9FKsYm5hPGb7QvrKTc_36R7dOVnvspw186MuY3Ezvdsvxt2L8v26NZds1S_i0i7Lmo4w0sqV22ru0qwwu765gwYXkf_GQs49Vp42dRIrUhcnXYNRSWDVaBYQ5wdpq4IKmlLL2Tj7C-_pHi9YYsXiKPo038DRhSvqWzSL9D0GgqNpNn0xzn4YT18cCfaXwb8B"><img src="../examples/two-storey.svg" width="270" alt="Two-storey house" /></a><br/>
<b><a href="../examples/two-storey.arch">two-storey</a></b><br/>
<sub>A void over the ground-floor gallery,<br/>and eaves on the storey above.</sub>
</td>
<td width="33%" align="center" valign="top">
<a href="https://playground.archlang.uk/#z=rVpdctvIEX7nKbqkSlnekFzo17acdYq2mF1VvFJKVkqVJ2EINIlZAjPIzEAks7VVe4icIQfLSZLuHoCA7KSSbPQkAZie6b-vv-7RIczg1fQEtnA6TaCCSmfOTgpbIVgD1iCU-IQl_P3nv0IoEK5ub-8mv7--ufo0md1cTT58nM_uZjcf5oBbVdUlTkeHo0OYQdBmB4VtPIL2vHLR6DLXZgWbAh0CPqHbQaXLUlcYHH-m3KrBHOwTujF4Czq0i51eFWF0CHWpDAQLvrAbfhEKhwilMqtGrRCW1lW0QgVQDkEtbBPgq6UOX4FToUBH7wz4QtV4yUcFyK11sFDOAMDff_4b2BoNJNMLAFBQolqKvEKZlSej0La_m32Yg13y7xtVlqCND6hyeqYN6NCTrJe2zFnyRuehgOOLJIGwsST7CeNp-RttgiWR2oHdGD6INisRpSvISlQOAI7Uy8m7o8VLAD5iris0XlsDdVOWSGJA5PAu1zc38zs55FJl6Fnrh2IHSpTmQyqTg7EBFBTarMgHBn8L96QdBnDWVuSJ4-n5OVSkBk5h1n5KJhodgt9osyL_agNL25TiuIcPb_dvyBk6gN8g1vLamnJHZ1tv1I7PXaBEDcmn440OxQVxjbGBdgXybylRmZICn2iLo5cpOAyNMx5MQ_paF-PMWDOJx11rk1N0jQ4hfXj89HB98-3j7ftP93d__HA_v0ohU4YsgU9oQNV1uSNj6sB7kZlq5dZdHIjvA2SqQlg6W01JrC91HmM2BY8m9_RNsBvl8m7ZCw9L5QBNDkf0zJOIEpfha14ImTVPaIK2ZIOUD59C49GPwVGkqdKaVV8ahUxw6gmdVyXk2mFGq1-OYVPorABOuzYZS2XW5DTbhGKCytN-zqBrg7rUT2Rn9nw_cxYqW3OCyld2GaBUeY5OEj9tkyelna7uZmTeye3Nxz9N4Sb6rkLlG4c5q0GWuWQLUn6hB0psskun3uhQrEz71cpgSZJzpzamjVqWiiUFzTUjxsbpENCIxgvMFMFQP9x5OalfNLxAm1z7oM2q0b5Qi1J8OcgG8nitakIm2pZPY7UJrcFIJEe_Hx12CCVQx5aiIF5Z9PTMRGQjY4ndONOUy51dCBIyXIaJNuAwQ-_HMT3ZIRyKAY6nb2BLxqakFIlkucbk4p7RIZxBdQLLknROS21CCritMQueji3SRJ9MlSUfP7CyG9v8E7MWZLWl5jCKtiWj6YqzYmMpF4Kmt56FKEgF7VI282UP5caAimJQlWIuBsEIcOPRIeNfCxEdru76sNqhyOskgaoSsFSwUmWJOwFRhqjXHURFy7Kl-CmFBv2ZdmhKgFFbF_wUZgasy7VRbscfpG2gelhg2CCaFlKpDpHrPexsAxtnA76FNMojDPaiLJpcQkRTJY2QrA1l2Wf1Q9wVd6zQBHCN8aIkubsLpKgvQfleQAycpbMmdOEpO9GHo8P2U2NdKMAXGMHTy6FMUy3Q9St1iNWGS9YYcnT6CfMxGOTc39WYE9TdqzXChTjELmFj3TrYuvWilsMcn5x3H7RQ7xnqWmhix-yiEZZO5yvc16WBirFmZgRFNhQUogw5iuI2iz6_vZnD1fzj9fv53ex-Dg-zu5vrm2_HvKU4A-rG1dZ3HODh8Q-z--8e729vH29md3e3D7A97jgPHbqtqA-xHE4hVS4rIEefOb1AmEx-8NZ08dRSAEnGNNMua0rFibQobbbGPIWNDgUo-H4--_THu_kVpBS1Pjyo3bX5vkrJXmdJAmqlKA2idQBeibkrbXTVVFPGjpgTe4TTXCsFprTJirdCo6SQX8IxCdnCiaxjsUXMQMXQxTgHDx9iXi-U12bgLarAPXJgQA14JBdxlptZT-kVEc7wFnWNyglTeTqenp5Ok7HgIh-yKRF8sHWNOawsLfC6pJSwJmIWC6aiwTBFijrOOPLYApeWc0WR-toLZxS3YP6MQbQqbZSn4I1H5konK-jTMzYSA6APiqr5oCIifWOanAqF2qjdJVT2SSxZa8wQgmWprERGkNpPcy0lT8kxSW0fReKTzmlBG2pPqtS5CsillbLTvGW5w7cwmfjgdBb2ochWsAanI97j4J64-XfkoAP4cUQxqoOnMAA4hHTldA7nSSoV5zhJLiOH6sC-YxLHRGQLna2ZrVOp2IbGIamSYQ7psmx8kbLYNoi5o2AbsjOpHkxYhEHv4Wg6nZ4nLyGzAsUBxzEAaSs-mVQmb1TNcv9JzJiSXN_c33ZoOh0BRDVGEDGvqUe8YDKZTCIA_rrjyOwnrok_WG1IWWkhsgDKgw-uyVixyfCHBb464VQ6TaigtcTINiFir38LF68l2QgntfHMnikd5BTiG8hK6zFnibYJpTYoHZCPxMxDpYOL9oiFk42opdVpOU-qAhxtx7uXUld4D3GBEFhq1LIAGZrgkLfhGtUmAgGrsVBZZk5gl8tJrE_KQGoN9zEqwG9q698xWSZjCw3OvxGNcBvQaetg71iy0Y9wlIyTl3D0Kkl6vxAGvaRX8gvbAX4SZ_UbEGK41C10YTiFG1VRTWoZHteuPgIWDTEKNtFiRwWVhRLVU5SIzPHIwkvtfGjtcHR-ysfr67V5pFPsE2Cv2LEoFtfEX0STvg6xfF1SknRFWsVuZQpzSjDBpVDgDtCIGTQFny7LSMcnjH0kVCidEsKnpGxzchM0UCF0BnPx-DMC6WtFZXKgG7Ul8O_US8YnCXvphD2WiHrPZTziv5PRWxp_71uJ05LU88-T7L_-YXm3Jla7nDi3mG8MvkSsGZqJ8lq75qfDqpZSj9X2P2sdsgKNJJBXO38ZibZqX3GTSeZvwY_KV0uH-11U14z2-pURxPKZf-MeK6WZx0iWcMH4CwIF1JbrdKkWWMLBR5H5NXwiZQ7gC8cdiKXIZbFtjLJYIgADsS2xOQD5YbELFYqefyiv_k_-oayQTGiTtRsH9MYKg5HAvvHiz7hNEQbFrYGUGZcRU1sj1kJgL-FNx07_3CgX0E1y7bMBp-_YpeRjt88CTVaQk-SM-Tf5Y8zeAEcnr7oYlrkObbTHXFFDKKeXztB8DmpTSPllKuWw16FS2FLGVqgMq0gqRUYq1deQBeiJDizXqAr9fjrVdZ3t4Ersl2qTtuaOg4NfG-sqVQJVpste989SpUXsGtlY-PeUnycJcbwUM0G69MDt4RosV4jBaIB6Zd_79CL5Vb_pa1t_InA0zyiHLiDbsaGsAQFm6vDOyfrsBwrq1uLQG8V0g73PcZmnTdy5vvD90RxP5Xpzm9ZZ3H2R6XmiFVs7lirt2aAmtd6SvF9goSW8KjJRN_d7piPtGCeHoiY9UMzHkv4cURS1Teil6Uab3G5-aaISvLMgOpF5jH0nRf6rpEWoXuT3Q59JTEuFvDbrZ7IWmPPoMsDR6V5Y1OpkmEYDWQtmSHtRm8cVT2sibB6fJX1Rz441WOkfObll5dnps1R-dojBShREhdYUyZhir1158WzPvVfEgJdxYp2poErL4-5YOLhC95jvl_0XU2m59Bi6PO4YTUwiprMvPHyY39zfzWM-iTk9rrjtSLrulumxpHpDLZ4q13Qo4kZSidrBJxc5a0PtePaR2Tjy5BedPtwKGBsHB0K4sA4FWLcfQveHdDnPLTdaWMmycUZzHY217JHip2sfeoGx10SsAYQAlPJSSQeyfLBPGAvbfySLA-DLsuJ44r-Q9Xogq5enbff8y8vpzGSFpY46jilYLMO99GDsFW6RpSXtRludA6mL4tsZrgnSW3UDpEHD245Gh62btxXK5NBR_BAwLnZUe_KhW2W4IPZg7OaTQ7D1hGslAPCRhaa8SZLtmyQZSNhkbPrnEhY2BFuJkJ6EsyTZvkqSPebzKGNPOPB517rYfdZ-MojHqYKsiTdCnnp7poaBWm_qJSiaW6Ih5D51lt8mPFE0Hg64Y42e4vQ7YP-0H75JaIwYxAncvPOZX_g4fTe80Xz26R6QQpETdD8kkjgct9zp8xF_W6uiKzqqEdQaeUwveuaYlTylScmQDDaq3KjdvtuYqC3NnFtMuIwHRvC7amFLkKsYaXlBh7GEJmZBmVWJ3cbDABH_ELhenJ0n45PjpOWsZ-fJlvC1M1MXA72kKlt63HH9_zGpeieSciWIT138mM8kh6JWZkuFpyXS7zGPHPrL-BHrTix_Z8lARSolrONemsmKg38traOuJO2YhJ2ed2cj5Nmenu-lPcSvD1obHr8ewpykSO9a54WHQoWsGMecilG7wcDNaL8bvxBm0r9x4W0FS9o7m-ubT9dX8y5V9sEDBx95x4N9QC5ptgGnMj1e2G2XjVKukGar6DgPaWaBNPfycvniqGroIB2CkOR2dCTXF64xMqZuuUU7ONrbViwQPXV2cT7w-4XgCnS2bU8PX8T67pL2F9EylvcdN68F5fsAl-nSwoNqgk0vpZ2Q23ICEF-1V2j0vlJBZ_Dt-6_vwaM0D2Ib24QJuWlwYT-FeXuRcXt3Nb-DWmdrH7ldjh2R4GESTbO47Ek71t1Rfpz_7h5in2GXXEMm7-LdRluahL34ATuIINbdZkaI4dmuI5JLF1Y9Eg6VcittZMAmVxh82aOc0xxVkAbchlT6nE1hyzgAa6OUZR-_Pk_oj-6q0i6X3bBwf5UuMxW-DKGDLnathQvrmM93l_Y08RgndG1_0k1BIj244PJGn7LMbhI2edefj-05zvDj_Sft98OP9xFIR5Ou5v_QvqcyV2zLKAXai_4ccz8DdDJ4YU6YkulSyEoV_y_EIOZMWtrBnKoWetVILaWmrPfvKBtUzjNuOGuXss9lnM2Pu8sOAiEFvlk0bqEkWhaNWanSbui_PnIUEatS_YXZjg5FnMIsGQqoWSahZLigQ4k8IQeonf0BszAYnvMLRrXHxQ4OZi4rPiqzis9JiYOT5ORikryeHF_Q059GP43-AQ"><img src="../examples/tiny-house.svg" width="270" alt="Tiny House" /></a><br/>
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
