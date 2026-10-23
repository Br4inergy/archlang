#!/usr/bin/env python3
"""Spike verification: load a GLB produced by plan2glb.py and check it against its Plan JSON.
Checks: node census, watertight/volume, bbox, floor area vs plan, opening probes (rays), determinism hash."""
import json, sys, numpy as np, trimesh
glb, plan_path = sys.argv[1], sys.argv[2]
plan = json.load(open(plan_path))
sc = trimesh.load(glb, force='scene')
out = {'nodes': len(sc.graph.nodes_geometry), 'by_kind': {}, 'not_watertight': [], 'neg_volume': []}
meshes = {}
for n in sc.graph.nodes_geometry:
    T, g = sc.graph[n]; m = sc.geometry[g].copy(); m.apply_transform(T)
    meshes[n] = m
    k = n.split(':')[0]; out['by_kind'][k] = out['by_kind'].get(k, 0) + 1
    if not m.is_watertight: out['not_watertight'].append(n)
    elif m.volume < 0: out['neg_volume'].append(n)
allv = np.vstack([m.vertices for m in meshes.values()])
out['bbox_m'] = {'min': np.round(allv.min(0), 3).tolist(), 'max': np.round(allv.max(0), 3).tolist(), 'size': np.round(allv.max(0) - allv.min(0), 3).tolist()}
# floor area (top faces) vs plan areas
fa = 0.0; planA = 0.0
for r in plan['rooms']:
    m = meshes.get(f"floor:{r['id']}")
    if m is None: continue
    up = m.face_normals[:, 1] > 0.9
    a = m.area_faces[up & (m.triangles_center[:, 1] > 0.0115)].sum()
    fa += a; planA += r['area']
out['floor_area_m2'] = {'mesh': round(float(fa), 3), 'plan_json': round(planA, 3)}
# opening probes: a ray cast through each opening centre ALONG THE HOST WALL NORMAL, at mid-opening height, must hit no wall face
# (the hole is real); a control ray cast the same way 0.4 m + half-width along the wall must hit wall faces (the wall is solid there).
import math, os; sys.path.insert(0, os.path.dirname(__file__)); from plan2glb import nearest_segment
wall_all = trimesh.util.concatenate([m for n, m in meshes.items() if n.startswith('wall:')])
ri = trimesh.ray.ray_triangle.RayMeshIntersector(wall_all)
def cast(px, py, z, nx, ny):   # plan mm point + plan-normal -> glTF ray
    org = np.array([px / 1000 - nx * 0.6, z, py / 1000 - ny * 0.6]); d = np.array([nx, 0, ny])
    loc, _, _ = ri.intersects_location([org], [d]); return sum(1 for q in loc if abs(np.linalg.norm(q - org) - 0.6) < 0.3)   # only hits within +-0.3 m of the centre
blocked, ctrl_missed, n_chk = [], [], 0
for o in plan['openings']:
    d, w, a, b = nearest_segment(plan['walls'], o['x'], o['y'], o.get('wall'))
    tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty); tx, ty = tx / L, ty / L; nx, ny = -ty, tx
    z = (o.get('sill', 900) + o.get('head', 2100)) / 2000 if o['kind'] == 'window' else 1.0
    if cast(o['x'], o['y'], z, nx, ny) != 0: blocked.append(o['id'])
    off = o['width'] / 2 + 400
    for sgn in (1, -1):    # control only where the wall actually continues (inside the segment)
        cx, cy = o['x'] + sgn * tx * off, o['y'] + sgn * ty * off
        if min(a[0], b[0]) - 1 <= cx <= max(a[0], b[0]) + 1 and min(a[1], b[1]) - 1 <= cy <= max(a[1], b[1]) + 1:
            if cast(cx, cy, z, nx, ny) == 0: ctrl_missed.append((o['id'], sgn))
            break
    n_chk += 1
out['opening_probe'] = {'checked': n_chk, 'hole_blocked_by_wall': blocked, 'control_ray_missed_wall': ctrl_missed}
print(json.dumps(out, indent=1))
