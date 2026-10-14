# Agent integrations

ArchLang keeps one skill source, `skills/<name>/SKILL.md` (the umbrella `archlang` skill and the task
skills beside it), and publishes it in the shape each agent host reads. The plugin root for every host
is the slim folder `plugins/archlang/`, not the repository root: the repository carries an 11 MB font
that plugin directories can reject. `plugins/archlang/skills/` is filled by `npm run gen:plugin`; the
other files below by `npm run gen:agent-manifests`. Both are gated by `npm run check:drift`, so edit
the skill or `src/manifest.ts`, never the output. No generated manifest names a version or a count, so
none can go stale; hosts read the repository's own tags and releases.

Formats were taken from each host's own documentation on 2026-10-13; the source URLs are in the header
of `scripts/gen-agent-manifests.ts`. The Claude Code plugin (`plugins/archlang/.claude-plugin/`) is
covered in [`overview.md`](overview.md) and is not repeated here.

| Host | Plugin files (under `plugins/archlang/`) | Copy-in files |
|---|---|---|
| Codex and ChatGPT | `plugin.json`, `skills/` | none |
| GitHub Copilot (CLI) | `plugin.json`, `mcp.json`, `skills/` | `integrations/copilot/*` |
| Cursor | `.cursor-plugin/plugin.json`, `mcp.json`, `skills/`, `rules/archlang.mdc` | none |
| Any Agent Plugins client | `plugin.json`, `mcp.json`, `skills/` | none |

## What the files are

- `plugin.json`: the portable Agent Plugins manifest (`$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`).
  Identity fields only (name, description, author, homepage, repository, license, keywords). The skills
  are found in the plugin root's `skills/` directory, so there is no `skills` field.
- `.cursor-plugin/plugin.json`: the Cursor plugin manifest. Cursor requires only `name`; it discovers
  `skills/` and `rules/*.mdc` from the plugin root.
- `mcp.json`: the MCP server (see below).
- `rules/archlang.mdc`: a Cursor rule scoped to `**/*.arch`.
- `integrations/copilot/copilot-instructions.md` and `integrations/copilot/archlang.instructions.md`:
  Copilot custom instructions (repository-wide, and path-specific with `applyTo: "**/*.arch"`), for a
  user to copy into their own project.

`mcp.json` declares the MCP server as a stdio server run with `npx -y @chanmeng666/archlang-mcp`, the
unpinned command the README recommends, so it names no version. Copilot CLI gives the portable
`plugin.json` precedence over the Claude manifest, and this file is how Copilot (and Cursor) users get the
server as well as the skills. It is not part of the OpenAI directory ZIP described below.

## How a user installs them

- **Codex / ChatGPT:** once the plugin is in the directory, open the Plugins tab and search for
  ArchLang. Without the directory, copy the folders you want from `plugins/archlang/skills/` into the
  project's `.agents/skills/` (or `~/.agents/skills/` for every project).
- **GitHub Copilot:** once the plugin is in Awesome Copilot, `copilot plugin install archlang@awesome-copilot`.
  Without it, copy the skill folders into the project's `.github/skills/`, and optionally
  `integrations/copilot/copilot-instructions.md` to `.github/copilot-instructions.md` and
  `integrations/copilot/archlang.instructions.md` to `.github/instructions/`.
- **Cursor:** once listed, install from the Cursor Marketplace. Locally, copy `plugins/archlang/` to
  `~/.cursor/plugins/local/archlang` and reload the window.
- **Anything else:** `npx skills add ChanMeng666/archlang` installs the same skills for the hosts the
  `skills` CLI supports.

## Hosted MCP server

`https://mcp.archlang.uk/mcp` is the same tool set over Streamable HTTP, with no sign-in
([ADR 0026](adr/0026-hosted-mcp-worker.md)). claude.ai takes it as a custom connector per user
(there is no separate Claude connectors directory); its `compile` result renders as an MCP App card.

## Submission

The policy is stated once, in [`seo.md`](seo.md) section 8: an agent may drive a submission form or
publish step through the owner's logged-in browser or CLI when the owner has asked for that listing.
The owner personally does account creation, logins, 2FA/OTP, API-token and secret creation,
acceptance of terms and attestations, native file pickers (the OpenAI portal's ZIP upload is one),
and the final submit of anything that accepts terms. Live status per host is the table in
`seo.md`; the steps below are the recipes.

### OpenAI plugin directory (Codex and ChatGPT)

Blocked on the owner's individual developer identity verification (step 1); the privacy and terms
pages the form asks for exist at <https://archlang.uk/privacy> and <https://archlang.uk/terms>.

1. Sign in at <https://platform.openai.com/plugins> with an organization-owner account (or a member with
   Apps Management Write) and complete the individual or business verification in organization settings.
2. Choose **Upload new or existing plugin** and upload a ZIP of `plugins/archlang/plugin.json` plus
   `plugins/archlang/skills/` only (not the whole folder: the `.claude-plugin` and `.cursor-plugin`
   directories are other hosts'). The directory's Codex checklist also asks for `version`,
   `author.name`, `capabilities` and a `composerIcon`, and the portal collects `displayName` (30
   characters or fewer), `shortDescription` (30 or fewer), `longDescription`, `developerName`,
   `category`, an icon and HTTPS website, support, privacy-policy and terms-of-service URLs. The
   generated `plugin.json` deliberately has no `version`; add the release tag's version in the ZIP, not
   in the repository.
3. Resolve the automated Metadata and Skills findings, then fill in the review form: five positive and
   three negative test cases and a reviewer-accessible video URL. Submit for review and attest to the
   policies.
4. After approval the owner chooses when to publish. The portal does not currently accept
   `.app.json` references or lifecycle hooks; the ZIP has neither.

### Awesome Copilot (GitHub Copilot CLI marketplace)

1. Do not edit `plugins/external.json` in `github/awesome-copilot`: its contributing guide routes
   external plugins through an issue form. Open a new issue at <https://github.com/github/awesome-copilot/issues/new/choose>
   from the owner's GitHub account and choose the external plugin form.
2. Fill in: the repository `https://github.com/ChanMeng666/archlang` (public GitHub hosting is the only
   source accepted); the plugin path `plugins/archlang`; an immutable ref (a release tag) and that tag's
   full 40-character commit SHA; the plugin name `archlang`; its description from `plugin.json`; the
   plugin version, which is the version of that release tag (the manifest carries none); and the
   license, `MIT`.
3. A new release needs a new ref and SHA in the listing.

### Cursor Marketplace

1. Sign in to Cursor with the owner's account and open <https://cursor.com/marketplace/publish>.
2. Submit the repository `https://github.com/ChanMeng666/archlang` with the plugin path
   `plugins/archlang` (plugins must be open source and are distributed as Git repositories); the
   manifest it reads is `.cursor-plugin/plugin.json`. If the form takes only a repository root, say so
   in the submission: the Cursor docs describe a `.cursor-plugin/marketplace.json` for multi-plugin
   repositories, which this repository does not ship.
3. Cursor reviews every plugin and every update by hand before listing it. Follow its submission
   checklist at <https://cursor.com/docs/reference/plugins>.

Listing counts, ratings and install numbers on these hosts measure usage, not revenue, and are quoted
nowhere in this repository.
