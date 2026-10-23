"""Top-down footprint IoU: union of the GLB's wall top faces (projected to the plan) vs union of the Plan JSON wall bands.
Catches lost area from ownership trimming / mitre / opening cuts. Run over the corpus."""
import json, glob, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, trimesh
from shapely.geometry import Polygon
from shapely.ops import unary_union
from plan2glb import band, nearest_segment
import math
from shapely.geometry import box
from shapely import affinity
res = []
for f in sorted(glob.glob('json/*.json')):
    n = os.path.basename(f)[:-5]; g = f'out/corpus_{n}.glb'
    if not os.path.exists(g): continue
    plan = json.load(open(f)); sc = trimesh.load(g, force='scene'); tris = []
    H = max(w.get('height', plan.get('storey_height', 3000)) for w in plan['walls']) / 1000
    for nn in sc.graph.nodes_geometry:
        if not nn.startswith('wall:'): continue
        T, gg = sc.graph[nn]; m = sc.geometry[gg]
        sel = (m.face_normals[:, 1] > 0.9)
        for tri in m.triangles[sel]:
            p = Polygon([(x * 1000, z * 1000) for x, y, z in tri])
            if p.area > 1e-6: tris.append(p.buffer(0.01))
    mesh_fp = unary_union(tris); plan_fp = unary_union([band(w) for w in plan['walls']])
    # a full-height cased opening removes the wall top: subtract its cut rectangle from the expected footprint
    for o in plan['openings']:
        if o['kind'] != 'opening': continue
        _, w, a, b = nearest_segment(plan['walls'], o['x'], o['y'], o.get('wall')); ang = math.atan2(b[1]-a[1], b[0]-a[0])
        if o.get('head', w.get('height', plan.get('storey_height', 3000))) < w.get('height', plan.get('storey_height', 3000)): continue
        r = affinity.translate(affinity.rotate(box(-o['width']/2, -w['thickness']/2-5, o['width']/2, w['thickness']/2+5), ang, origin=(0,0), use_radians=True), o['x'], o['y'])
        plan_fp = plan_fp.difference(r)
    iou = mesh_fp.intersection(plan_fp).area / mesh_fp.union(plan_fp).area
    res.append((n, round(iou, 5)))
print(json.dumps(res)); print('min IoU', min(r[1] for r in res), 'n=', len(res))
