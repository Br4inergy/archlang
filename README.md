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

## Send this to your agent
Paste this into any coding agent. The skills are listed on skills.sh: https://skills.sh/ChanMeng666/archlang
```text
1. Run: npx -y skills add ChanMeng666/archlang --yes
2. Run: npx -y @chanmeng666/archlang spec   (read it before writing anything)
3. Write my floor plan as plan.arch from this brief: <describe rooms, areas, adjacencies>
4. Run: npx -y @chanmeng666/archlang compile plan.arch -o plan.svg --json
   then describe plan.arch --json, validate plan.arch --strict --json (same prefix); fix, recompile
5. Run: npx -y @chanmeng666/archlang finish plan.arch, then compile again to export.
```
For MCP clients: `claude mcp add archlang -- npx -y @chanmeng666/archlang-mcp`.

<a href="https://playground.archlang.uk"><img src="./.github/readme/card.svg" width="100%" alt="ArchLang compiles plain-text source into floor plans. The card shows source being typed and the drawing compiling beside it: five example plans, one constant changed, and a lint finding raised and cleared."></a>

<br>



https://github.com/user-attachments/assets/a60f3174-6a8c-4a42-b24a-fac030d39627



## Try it

```bash
npx skills add ChanMeng666/archlang
```

Then ask your coding agent:

> *Design a one-bedroom flat of about 54 m², with the front door on the north wall.*

It writes the plan, compiles it and checks it. This one is 57 lines of text:

<div align="center">
<a href="https://playground.archlang.uk/#z=jVZdbhs3EH7fU3yQXhxAdmjZcuw2CZC2AQrESIs0QdAn70gcaRmvSIGkvHICA3nqAYqeoQfoEXqUnKQYciWtHNupnihq5ptvvvkR-3gBZ3l_zNo7N0dNlhu6xsTFSDPGl89_4fgM83__QawowjPpAArihIV3M0_zg6Jf9PHaxcrYGSr2DBOwcMFE4yxrjK9RkdUHeHnF_hpuwVYsxchYMYgOBL-00CZEshMG1c7OQEUfluas0VBdY690Fk_l-BwU8XThwvPy0QCcYKdmFZee4Tm4-ooDaEbGhijQkprzoIRT9LFXGouncv0cZCeV8_jy-e9ygHLtlALK3aMByGrEijGmWD1eK7Ug4yWFmoyGW0aMr4s-yhC9WZQHKIOJjE8I0TNHWOdjhZsypRMSWmwcpjQh3X5f1GQRl96KuN-lK-2cL_pi1dpIeQbpNKsphM4vM_Ka7UGRUHrnbRl_dsvAPXwqgKU1MWA-L4CZNxojhc6njwX5mAoWQJ5xqBRiZSaXAwSpTjmtl6EqNyrXZLUQBYlKI1WgzXG5KABt5gG0lLrWdQHcKUZRIMts9LPmQlIDwKvI3jiPHN1yCBgqhU_YUwP1CHtPRiodbna8mUJ82Hvtlw8nI_UVRpbwYQbZ736Mhr_FI5O427uSE7al6HgfZu_jYZtFOtyFIU36PzCGnUSGLUyBPClGP_MXtblimbJMOJiPDHFcSUzUNOYavXNzJYP8GK9MnFRse1gGDqjz9WW-lPLLUEC7xibEdRIzWkChMTpWODoScoX04pZDyiWFHnai_kCx6olhCiY2t91Yo2WsOm55cFuO7RgXyHnLpImzvph6ZyOks9uepIihKJd5nikF2XMMy-QRIvmI0KR9ZqNDFm4Hse2rUBstZgm5vRPsJxvsw1Olkhmj5mncAUk5tbRSm1DE6GTjerqhJZ67hMasC5nwMnuWsrUaqi9Zp33y5Y8_M5s06WWO782siiUCy5Sn7USW61xC-RpcbfJWTtBjrl2TfvhA8_H3axThUqJxy1qDzBwmJtpKYT7PW1X6onx_8esvP756-fbizbvX5cFu2m03u8klx93sz3aS79BOe8VY7Zrs0M6kaH281Xqo1C27bU2kJGs79YDd6HS0wTv5yq7dSRRxONrEFbMCmC69NWmRTr3RM27X8M6_T8vcTaeBo7QyYOy2wbYQIbqrNcJDEJLzPRDtrF4EYy8fghiqeyEmbmkj-2-yGJ7egujjbcXwy_QiIIt3r396-eb8xe8DaE-NxZinznPuQsP5D4-ijJ7VorSJ0ri5K6ckfZVAI41rln8eXJlgxvW12Ea3gKdYsRcQiyrPpInppZOfAvlBIniyIQaozWWmmd4Z-ZXDdeD01BnAyjUIE-e8NpYiH-zoIol1Krd-b4xdjG6-n8bV2HWF87I7VWp1dJwaaouT8-kATVj0Zp2dDo-UWp1t191bMe_t9onI8w0q6W--JTQctYTOlFqlyq_Bf3NT2sVu91PCTudd7DSYd4PLcGT07aLexfZuzHdhR7fIpOWzg71WUjbq6qRD_D15LXC3hKlcw74NIBunEyAz3wTY6HF2qzzNBFsBOhhdcbsYx0qtntzCGFMw9n6MrogJ40Sp1fEoLZRoYi1PrIV3H3gSv3oCplG6GF-j98JPqnOysx40RUZvqIYn--p0__Ckh5vipvgP"><img src="./examples/laneway-house.svg" alt="A one-bedroom laneway house, compiled from 57 lines of ArchLang. Click to open it in the playground." width="620" /></a>

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
