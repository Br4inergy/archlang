#!/usr/bin/env bash
# usage: ifc_batch.sh <core-root> <tsx> <python-with-ifcopenshell> <outdir> <dir-with-.arch>...
set -u
CORE=$1; TSX=$2; PY=$3; OUT=$4; shift 4; mkdir -p "$OUT"; HERE=$(cd "$(dirname "$0")" && pwd)
for d in "$@"; do for f in "$d"/*.arch; do b=$(basename "$f" .arch)
  # run from the core root so the plan's relative imports resolve like the CLI would (virtual world is empty: import-free plans only)
  (cd "$CORE" && $TSX "$HERE/ifc_probe_minimal_writer.mts" . "$f" "$OUT/$b.ifc" > "$OUT/$b.writer.json" 2> "$OUT/$b.err") || { echo "{\"plan\":\"$b\",\"writer\":\"FAILED\"}" > "$OUT/$b.check.json"; continue; }
  cp "$OUT/$b.ifc" "$OUT/$b.2.ifc" 2>/dev/null
  (cd "$CORE" && $TSX "$HERE/ifc_probe_minimal_writer.mts" . "$f" "$OUT/$b.2.ifc" >/dev/null 2>&1)
  same=$(cmp -s "$OUT/$b.ifc" "$OUT/$b.2.ifc" && echo true || echo false)
  $PY "$HERE/ifc_check.py" "$OUT/$b.ifc" > "$OUT/$b.check.json" 2> "$OUT/$b.check.err"
  python3 - "$OUT/$b" "$same" <<'P'
import json,sys
b,same=sys.argv[1],sys.argv[2]
w=json.load(open(b+'.writer.json')); c=json.load(open(b+'.check.json'))
row={"plan":b.split('/')[-1],"entities":w["entities"],"pieces":w["pieces"],"openings":w["openings"],"expected_m3":w["expectedVolume_m3"],"readback_m3":c["geometry"]["total_wall_volume_m3"],"validation_issues":c["validate"].get("issues"),"shape_failures":len(c["geometry"]["walls_failed"]),"globalids_unique":c["globalids"]["unique"],"byte_identical_two_runs":same=="true"}
open(b+'.row.json','w').write(json.dumps(row))
P
done; done
python3 - "$OUT" <<'P'
import json,glob,sys
rows=[json.load(open(f)) for f in sorted(glob.glob(sys.argv[1]+'/*.row.json'))]
json.dump(rows,open(sys.argv[1]+'/summary.json','w'),indent=1)
for r in rows: print(r)
P
