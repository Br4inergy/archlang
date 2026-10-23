"""Cumulative usage coverage of the top-N fixture families across the shipped examples.
Reads results/fixture-families.json (from fixture_coverage.mts). Usage: python fixture_topn.py [results-dir]"""
import json, sys
d = sys.argv[1] if len(sys.argv) > 1 else "../results"
f = json.load(open(f"{d}/fixture-families.json"))
alias = {}
for r in f["data"]:
    alias[r["canonical"]] = r["canonical"]
    for a in r["aliases"]:
        alias[a] = r["canonical"]
fam = {}
free = 0
for k, v in f["usedInExamples"].items():
    if k.startswith("(free:"):  # a category word the catalogue does not know (labelled rectangle)
        free += v
        continue
    c = alias.get(k, k)
    fam[c] = fam.get(c, 0) + v
tot = sum(fam.values())
srt = sorted(fam.items(), key=lambda kv: -kv[1])
cls = json.load(open(f"{d}/fixture-classes.json"))["classes"]  # A box-like / B composed primitives / C curved (author judgement)
share = {c: sum(v for k, v in fam.items() if cls.get(k) == c) for c in "ABC"}
out = {"occurrencesIncludingFreeNames": tot + free, "freeNameOccurrences": free, "classOccurrences": share, "classShare": {c: round(v / tot, 3) for c, v in share.items()}, "occurrences": tot, "familiesUsed": len(fam), "familiesUnused": f["families"] - len(fam), "top": srt[:12], "cumulativeShare": {}}
cum = 0
for i, (_, v) in enumerate(srt, 1):
    cum += v
    if i in (10, 20, 30, 40):
        out["cumulativeShare"][str(i)] = round(cum / tot, 3)
print(json.dumps(out, indent=1))
