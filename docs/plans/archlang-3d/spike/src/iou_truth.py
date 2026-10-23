"""IoU of the spike's 2D wall solid (Plan JSON bands minus every opening cut) against ArchLang's OWN joinery output (ADR 0018,
dumped by tools/joinery-dump.mts from the repo's resolveAll + joinWallSet). Where the two differ, the Plan JSON route
loses information (arcs, derived walls) or the spike's mitre/cut differs from the closed-form joinery."""
import json, glob, os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely import affinity
from plan2glb import band, nearest_segment
rows = []
for t in sorted(glob.glob('truth/*.json')):
    n = os.path.basename(t)[:-5]; plan = json.load(open(f'json/{n}.json'))
    if not plan['walls']: rows.append((n, None, 'Plan JSON has no walls (walls_from_rooms)')); continue
    sol = Polygon()
    for l in json.load(open(t))['loops']: sol = sol.symmetric_difference(Polygon(l).buffer(0))
    mine = unary_union([band(w) for w in plan['walls']]); cuts = []
    for o in plan['openings']:
        _, w, a, b = nearest_segment(plan['walls'], o['x'], o['y'], o.get('wall')); ang = math.atan2(b[1]-a[1], b[0]-a[0])
        cuts.append(affinity.translate(affinity.rotate(box(-o['width']/2, -w['thickness']/2-5, o['width']/2, w['thickness']/2+5), ang, origin=(0,0), use_radians=True), o['x'], o['y']))
    mine = mine.difference(unary_union(cuts)) if cuts else mine
    iou = mine.intersection(sol).area / mine.union(sol).area
    rows.append((n, round(iou, 4), f'truth {sol.area/1e6:.3f} m2, spike {mine.area/1e6:.3f} m2'))
for r in rows: print(r)
ok = [r[1] for r in rows if r[1] is not None]
print('n', len(ok), 'min', min(ok), 'median', sorted(ok)[len(ok)//2], '>=0.99:', sum(1 for x in ok if x >= 0.99))
