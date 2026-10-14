# Privacy

ArchLang collects as little as it can. This page says what happens to data.

## Who we are

ArchLang is an open-source project run by Chan Meng. The same publisher offers the npm packages,
these sites, the hosted endpoint at `mcp.archlang.uk` and the ArchLang plugins.

## This site and the playground

The documentation site and the playground are static pages served by Cloudflare. We set no
cookies, run no accounts or sign-in, and load no analytics or tracking script. The playground
compiles your plan in your browser; a share link keeps the plan after the `#`, which a browser
never sends to a server.

## The hosted MCP endpoint

`https://mcp.archlang.uk` compiles the plan text an AI client sends it, in memory, and returns the
result. It keeps no request logs: Workers Logs are off and the Worker logs nothing. It stores no
plan, sign-in or cookie. The one thing it keeps is a rendered drawing in Cloudflare's edge cache for
an `/svg/` link, which carries the plan's labels.

The only personal data it handles is the sender's IP address, used transiently as a rate-limit key
and not stored by us. Its tools accept only plan text and a few drawing options. They never ask for
conversation history, credentials, location or any other personal data, so please do not put such
data in a plan.

An `/svg/` link puts the plan in the URL path, so unlike a playground link it reaches Cloudflare's
edge like any URL.

## Retention

- A cached `/svg/` drawing is stored under a versioned path with `max-age=31536000` (one year). The
  unversioned `/svg/` path tells clients to reuse a drawing for 300 seconds and revalidate with an
  `ETag`. We cannot list or delete individual entries; Cloudflare may evict them sooner.
- The aggregate counts in Cloudflare Analytics Engine are the request method, the tool name and, for
  a refused request, the reason. They hold no plan text and no address. Cloudflare keeps them for
  three months.

## Sharing and your choices

We do not sell data, share it with advertisers, or send it to anyone except Cloudflare, which hosts
the service and processes IP addresses under its own privacy policy. Because we keep no plan text,
account or log, there is nothing to access, correct or delete on our side. To avoid the edge cache,
use the playground or the local tools, which send nothing.

## Local tools

The npm packages, the command line tool and the VS Code extension run on your machine and send
nothing anywhere. The `arch-plan` web component fetches only the `.arch` file the page author points
it at.

## Contact

Requests: [open an issue](https://github.com/ChanMeng666/archlang/issues).
