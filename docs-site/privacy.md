# Privacy

ArchLang collects as little as it can. This page says what happens to data, and nothing more.

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

An `/svg/` link puts the plan in the URL path, so unlike a playground link it reaches Cloudflare's
edge like any URL.

It writes only aggregate counts to Cloudflare Analytics Engine: the request method, the tool name,
and, for a refused request, the reason (rate limit or size cap). No plan text, no address.

To limit abuse it applies a per-address rate limit. The sender's IP address is used as the rate
limit key and is not stored by us. Cloudflare, as the host, processes IP addresses under its own
privacy policy.

## Local tools

The npm packages, the command line tool and the VS Code extension run on your machine and send
nothing anywhere. The `arch-plan` web component fetches only the `.arch` file the page author points
it at.

## Contact

Questions or requests: [open an issue](https://github.com/ChanMeng666/archlang/issues).
