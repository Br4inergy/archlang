"""Check: the visible floor of each room in the spike model (room polygon minus wall bands) vs describe().rooms[].net_area_m2 (ADR 0027)."""
import json, glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from shapely.geometry import Polygon
from shapely.ops import unary_union
from plan2glb import band
rows = []
for f in sorted(glob.glob('json/*.json')):
    n = os.path.basename(f)[:-5]; base = n.split('.L')[0]
    plan = json.load(open(f)); dpath = f'describe/{base}.json'
    if '.L' in n or not plan['walls'] or not os.path.exists(dpath): continue   # single-storey, Plan JSON with walls only
    d = json.load(open(dpath))
    if not d.get('rooms'): continue
    walls = unary_union([band(w) for w in plan['walls']])
    net = {r['id']: r.get('net_area_m2') for r in d['rooms']}
    for r in plan['rooms']:
        if net.get(r['id']) is None: continue
        vis = Polygon([(p['x'], p['y']) for p in r['floor_polygon']]).difference(walls).area / 1e6
        rows.append((n, r['id'], round(vis, 3), net[r['id']], round(vis - net[r['id']], 3)))
bad = [r for r in rows if abs(r[4]) > 0.02]
print('rooms compared', len(rows), '| within 0.02 m2:', len(rows) - len(bad), '| outside:', len(bad))
for r in bad[:25]: print(r)
