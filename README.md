<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./brand/archlang-wordmark.svg" />
  <img src="./brand/archlang-wordmark-black.svg" alt="ArchLang" width="440" />
</picture>

### Floor plans as code.

Write a floor plan as text. Get a precise, dimensioned drawing back.

<a href="https://playground.archlang.uk"><img src="./.github/readme/pill-playground.svg" height="40" alt="Playground"></a> <a href="https://archlang.uk"><img src="./.github/readme/pill-docs.svg" height="40" alt="Docs"></a> <a href="https://archlang.uk/gallery"><img src="./.github/readme/pill-gallery.svg" height="40" alt="Gallery"></a> <a href="https://www.npmjs.com/package/@chanmeng666/archlang"><img src="./.github/readme/pill-npm.svg" height="40" alt="npm"></a>

</div>

<br>

<a href="https://playground.archlang.uk"><img src="./.github/readme/card.svg" width="100%" alt="ArchLang compiles plain-text source into floor plans. The card shows source being typed and the drawing compiling beside it: five example plans, one constant changed, and a lint finding raised and cleared."></a>

<br>



https://github.com/user-attachments/assets/a60f3174-6a8c-4a42-b24a-fac030d39627



## Try it

```bash
npx skills add ChanMeng666/archlang
```

Then ask your coding agent:

> *Design a one-bedroom flat of about 54 m², with the front door on the north wall.*

It writes the plan, compiles it and checks it. This one is 56 lines of text:

<div align="center">
<a href="https://playground.archlang.uk/#z=jVZdbhs3EH7fU3yQXhxAdmjZUuw2CZC2AQrESIs0QdAn70gcaVmvSIGkvHIDA3nqAYqeoQfoEXqUnKQYciWtHMepnijuzMdvvvkh-3gBZ_lwwto7t0BNlhu6wdTFSHPGp49_4fQci3__QawowjPpAArihKV3c0-Lo6Jf9PHaxcrYOSr2DBOwdMFE4yxrTG5QkdVHeHnN_gZuyVYsxchYMYgOBL-y0CZEslMG1c7OQUUflhas0VBd46B0Fk9l-RwU8XTpwvPy0QCcYGdmHVee4Tm4-poDaE7GhijQEprzoIRT9HFQGounsv0cZKeV8_j08e9ygHLjlA6UvUcDkNWIFWNCsXq8UWpJxksINRkNt4qY3BR9lCF6syyPUAYTGR8QomeOsM7HCrdlCicktNg4zGhKuv2_rMkirrwVcb9JW9o5X_TFqrWR9AzSal5TCJ0vc_Ka7VGRUHoXbRp_dKvAPXwogJU1MWCxKIC5Nxojhc6vjyX5mBIWQJ5xrBRiZaZXAwTJTjmrV6EqtyrXZLUQBYlKI1WgjXG1LABtFgG0krzWdQHcK0ZRIMts9LPmUkIDwOvI3jiPfLrlEDBUCh9woAbqEQ6ejFRa3O55M4X4sPfGLy_GI_UZRpbwYQbZ78sYDX-NRyZxv3clK-xS0fE-zt6nwzaKtLgPQ4r0f2AMO4EMW5gCuVOMfuYva3PN0mWZcDC_M8RxLWeipgnX6F2Ya2nkx3hl4rRi28MqcECdt6_ypqRfmgLaNTYhboKY0xIKjdGxwsmJkCukFnccUizp6GHn1O8oVj0xTIeJzV031mgZq45bbtyWY9vGBXLc0mnirC9n3tkIqey2JiliKMplnudKQeYcwzJ5hEg-IjRpntnokIXbQ2zrKtRGi1lCbvcE-8kW-_hMqWTGqHkW90BSTC2tVCYUMRpvXc-2tMRzn9CEdSEdXmbPUqZWQ_UV6zRPPv3xZ2aTOr3M53szr2KJwNLlaTqR5TqnUP4GV5s8lRP0hGvXpA-_0WLy7QZFuJRo3KrWILOAiYm2Ulgs8lSVuijfX_780_evXr69fPPudXm0H3ZbzW56xXE_-vO94Du001wxVrsmO7Q9KVqf7rQeKnXHbpcTScnGTj1gNzobbfHGn9m1M4kijkfbc8WsAGYrb00apDNv9JzbMbx3-7TM3WwWOEopA8buCmwHEaK73iA8BCExfwGi7dXLYOzVQxBDdQeij7cVw6_SdU4W717_8PLNxYtfB9CeGosJz5znXEKG821FUfrGapHJRKm6XFIzkqJIoJEmNcu1gWsTzKS-EdvolvAUK_YCYlHlhjIxPVPyPZ5fE4In7T1Aba4yzfRIyE8UrgOnd8oAVrZBmDrntbEU-WhPFwmsI_vmsTBxMbrFYeo1YzfpyZPqTKn1yWmqhh1OjqcDNGUbWdgmp-MTpdbnu1n1Vsx7-0kWeb5CJd3RLaHhqCV0rtQ6pW0D_oub0T52O1wSdlrvY6euuh9cKjuj76bsPrZ3E74PO7plJi2_PeyNkjIO1-MO8ffktcDdEaZyDfv2ABkXnQMy8-0BWz3O76SnmWInQAejK24X41Sp9ZM7GBMKxn4ZoytiwhgrtT4dpWkQTazlfbT07jeexs_eb6mVLic36L3w0-qC7LwHTZHRG6rh-FCdHR6Pe7gtbov_AA"><img src="./examples/laneway-house.svg" alt="A one-bedroom laneway house, compiled from 56 lines of ArchLang. Click to open it in the playground." width="620" /></a>

<sub>Click the drawing to open this exact plan in the playground. Change a number and it redraws.</sub>
</div>

## Why text

- **Change one number, and one thing moves.** Nothing else is redrawn.
- **The same source gives the same drawing**, byte for byte.
- **An agent can check its own plan** without ever looking at an image.

```mermaid
flowchart LR
    B([Brief]) --> W[Write .arch]
    W --> C{Compiles?}
    C -->|no| F[Apply the fix<br/>the error carries] --> C
    C -->|yes| V{Matches<br/>the brief?}
    V -->|no| W
    V -->|yes| O([SVG · DXF · PDF · PNG])
```

## For your agent

This page is all a person needs. Everything else is written for agents: clone the repo and point yours at [`AGENTS.md`](AGENTS.md), or give it the whole language in one call:

```bash
npx -y @chanmeng666/archlang context
```

<sub>[Full overview](docs/overview.md) · [Language reference](docs/language-reference.md) · [Release notes](https://github.com/ChanMeng666/archlang/blob/main/CHANGELOG.md) (installed: `node_modules/@chanmeng666/archlang/CHANGELOG.md`) · [Contributing](CONTRIBUTING.md) · [MIT](LICENSE)</sub>

<sub>ArchLang is the engine behind [ArchCanvas](https://github.com/archcanvas/archcanvas). Built by [Chan Meng](https://github.com/ChanMeng666).</sub>
