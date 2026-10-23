#!/usr/bin/env bash
# Compile every example to Plan JSON (one file per storey when the plan has levels).
#   usage: compile_all.sh <examples-dir> [out-dir]
# Use the compiler built from the SAME checkout as the examples (the published npm release can lag `main`,
# see README "Findings"): ARCHLANG="node <checkout>/dist/cli.js" (after `npm ci && npm run build`)
# or ARCHLANG="npx tsx <checkout>/src/cli.ts". Defaults to the published CLI.
set -u
ARCHLANG=${ARCHLANG:-"npx -y @chanmeng666/archlang"}
OUT=${2:-json}; mkdir -p "$OUT"
for f in "$1"/*.arch; do
  b=$(basename "$f" .arch)
  $ARCHLANG compile "$f" -f json -o "$OUT/$b.json" --quiet >/dev/null 2>"$OUT/$b.err"; echo "$b exit=$?"
done
