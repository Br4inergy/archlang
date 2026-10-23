#!/usr/bin/env python3
"""archlang-3d SPIKE: Plan JSON (one storey) -> GLB, with 2D polygon ops (shapely) + extrusion (trimesh).

Not production code. It exists to answer: can the public Plan JSON drive a 3D build, and what is missing?
Coordinates: Plan JSON mm, x right, y DOWN.  glTF: metres, Y up.  Mapping  (x, y_plan, z_up) -> (x/1000, z_up, y_plan/1000)
i.e. glTF X = plan x, glTF Y = height, glTF Z = plan y (no mirror: seen from above the model reads like the plan).
Usage: plan2glb.py plan.json out.glb [--roof flat|none] [--furnish]
"""
import json, sys, math, hashlib, argparse
import numpy as np
import trimesh
from shapely.geometry import LineString, Polygon, box, Point
from shapely.ops import unary_union
from shapely import affinity

M = 0.001
ROUND = 6  # decimals (m) -> fixed-precision determinism

# --- authored vertical defaults (spike values; archlang plans carry only wall height, window sill/head) ---
DOOR_HEAD, WIN_SILL, WIN_HEAD, STOREY = 2100, 900, 2100, 3000
FURN_H = {  # category -> height mm (spike guesses, NOT sourced: to be replaced by the asset manifest)
    'fridge': 1800, 'refrigerator': 1800, 'stove': 900, 'hob': 900, 'kitchen_sink': 900, 'sink': 900, 'counter': 900,
    'worktop': 900, 'wc': 800, 'toilet': 800, 'basin': 850, 'shower': 40, 'bathtub': 550, 'bed': 500, 'double_bed': 500,
    'nightstand': 500, 'wardrobe': 2100, 'robe': 2100, 'sofa': 800, 'couch': 800, 'armchair': 850, 'table': 750,
    'dining_table': 750, 'desk': 750, 'chair': 900, 'office_chair': 950, 'bookshelf': 1800, 'bookcase': 1800,
    'shelf': 1800, 'coffee_table': 400, 'tv_unit': 500, 'washer': 850, 'dryer': 850, 'dishwasher': 850, 'rug': 15,
    'plant': 900, 'bench': 450, 'island': 900, 'upper_cabinet': 700, 'car': 1500, 'piano': 1000,
}
FURN_DEFAULT_H = 600

def wall_axis_angle(p0, p1):
    return math.atan2(p1[1] - p0[1], p1[0] - p0[0])

def nearest_segment(walls, cx, cy, host):
    """Find the wall segment nearest (cx,cy) among walls whose id or category == host (else all)."""
    cands = [w for w in walls if host in (w['id'], w.get('category'))] or walls
    best = None
    for w in cands:
        pts = [(p['x'], p['y']) for p in w['points']]
        if w.get('closed'): pts = pts + [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            d = LineString([a, b]).distance(Point(cx, cy))
            if best is None or d < best[0]:
                best = (d, w, a, b)
    return best

def band(w):
    pts = [(p['x'], p['y']) for p in w['points']]
    if w.get('closed'): pts = pts + [pts[0]]
    return LineString(pts).buffer(w['thickness'] / 2, cap_style='flat', join_style='mitre', mitre_limit=5.0)

def to_mesh(poly, z0, z1):
    """extrude a shapely (Multi)Polygon between z0..z1 (mm) -> trimesh in glTF space (m, Y up)."""
    if poly.is_empty: return None
    polys = [poly] if poly.geom_type == 'Polygon' else [g for g in poly.geoms if g.geom_type == 'Polygon']
    parts = []
    for g in polys:
        if g.area < 1.0: continue
        g = g.simplify(0.01)
        m = trimesh.creation.extrude_polygon(g, height=(z1 - z0))   # in (x, y_plan, z_up)
        m.apply_translation([0, 0, z0])
        parts.append(m)
    if not parts: return None
    m = trimesh.util.concatenate(parts)
    v = m.vertices * M
    v = np.column_stack([v[:, 0], v[:, 2], v[:, 1]])            # (x, z_up, y_plan)
    f = m.faces[:, ::-1]                                          # axis swap is a reflection: flip winding
    out = trimesh.Trimesh(np.round(v, ROUND), f, process=True)
    out.fix_normals()
    return out

def mat(name, rgb, rough=0.7, metal=0.0, alpha=1.0, double=False):
    c = [int(rgb[i:i+2], 16) for i in (1, 3, 5)] + [int(alpha * 255)]
    return trimesh.visual.material.PBRMaterial(name=name, baseColorFactor=c, roughnessFactor=rough, metallicFactor=metal,
                                               alphaMode='BLEND' if alpha < 1 else 'OPAQUE', doubleSided=double)

MATS = {
    'wall': mat('m_wall', '#f4f1ea', .85), 'slab': mat('m_slab', '#d9d4c8', .9), 'floor': mat('m_floor', '#cdb892', .55),
    'floor_wet': mat('m_floor_wet', '#c9ced3', .35), 'glass': mat('m_glass', '#9fc4e6', .05, 0, .28, True),
    'frame': mat('m_frame', '#2b2f38', .4), 'door': mat('m_door', '#b98b5a', .5), 'furn': mat('m_furn', '#a9b4c2', .8),
    'roof': mat('m_roof', '#e4ddd0', .8),
}
WET = {'Bathroom', 'Kitchen'}

def build(plan, roof='flat', furnish=True):
    scene = trimesh.Scene()
    stats = {'walls': 0, 'openings': {'door': 0, 'window': 0, 'opening': 0}, 'furniture': 0, 'floors': 0, 'warnings': []}
    H = plan.get('storey_height', STOREY)
    walls = plan['walls']
    bands = {w['id']: band(w) for w in walls}
    # --- ownership trimming (cf. ADR 0018): thicker wall owns the overlap; ties -> source order
    order = sorted(walls, key=lambda w: (-w['thickness'], [x['id'] for x in walls].index(w['id'])))
    taken = None; solids = {}
    for w in order:
        s = bands[w['id']] if taken is None else bands[w['id']].difference(taken)
        solids[w['id']] = s
        taken = bands[w['id']] if taken is None else taken.union(bands[w['id']])
    # --- opening cut rectangles (2D) + z-range
    cuts = {w['id']: [] for w in walls}   # per host wall: (rect2d, z0, z1, meta)
    placed = []
    for o in plan['openings']:
        near = nearest_segment(walls, o['x'], o['y'], o.get('wall'))
        if near is None: stats['warnings'].append(f"opening {o['id']}: no host wall"); continue
        dist, w, a, b = near
        if dist > w['thickness']: stats['warnings'].append(f"opening {o['id']}: centre {dist:.0f} mm off host {w['id']}")
        ang = wall_axis_angle(a, b)
        rect = box(-o['width'] / 2, -w['thickness'] / 2 - 5, o['width'] / 2, w['thickness'] / 2 + 5)
        rect = affinity.translate(affinity.rotate(rect, ang, origin=(0, 0), use_radians=True), o['x'], o['y'])
        if o['kind'] == 'window':
            z0, z1 = o.get('sill', WIN_SILL), o.get('head', WIN_HEAD)
        elif o['kind'] == 'door':
            z0, z1 = 0, o.get('head', DOOR_HEAD)
        else:
            z0, z1 = 0, o.get('head', w.get('height', H))
        cuts[w['id']].append((rect, z0, z1, o))
        placed.append((o, w, a, b, ang, rect, z0, z1))
        stats['openings'][o['kind']] += 1
    # --- wall meshes: full-height body minus all opening footprints; + sill piece + lintel per opening
    for w in walls:
        s = solids[w['id']]; wh = w.get('height', H)
        allrect = unary_union([c[0] for c in cuts[w['id']]]) if cuts[w['id']] else None
        body = s.difference(allrect) if allrect is not None else s
        parts = [to_mesh(body, 0, wh)]
        for rect, z0, z1, o in cuts[w['id']]:
            piece = s.intersection(rect)
            if z0 > 0: parts.append(to_mesh(piece, 0, z0))
            if z1 < wh: parts.append(to_mesh(piece, z1, wh))
        parts = [p for p in parts if p is not None]
        if not parts: continue
        m = trimesh.util.concatenate(parts); m.visual = trimesh.visual.TextureVisuals(material=MATS['wall'])
        scene.add_geometry(m, node_name=f"wall:{w['id']}", geom_name=f"wall:{w['id']}",
                           metadata={'archlang': {'kind': 'wall', 'id': w['id'], 'category': w.get('category')}})
        stats['walls'] += 1
    # --- floors
    room_polys = []
    for r in plan['rooms']:
        poly = Polygon([(p['x'], p['y']) for p in r['floor_polygon']]); room_polys.append(poly)
        m = to_mesh(poly, 0, 12); 
        if m is None: continue
        m.visual = trimesh.visual.TextureVisuals(material=MATS['floor_wet' if r.get('room_type') in WET else 'floor'])
        scene.add_geometry(m, node_name=f"floor:{r['id']}", geom_name=f"floor:{r['id']}",
                           metadata={'archlang': {'kind': 'floor', 'id': r['id'], 'room_type': r.get('room_type'), 'area_m2': r.get('area')}})
        stats['floors'] += 1
    footprint = unary_union(room_polys + list(bands.values()))
    ext = Polygon(footprint.exterior) if footprint.geom_type == 'Polygon' else None
    slab = to_mesh(ext if ext else footprint, -200, 0)
    if slab is not None:
        slab.visual = trimesh.visual.TextureVisuals(material=MATS['slab'])
        scene.add_geometry(slab, node_name='slab', geom_name='slab', metadata={'archlang': {'kind': 'slab'}})
    if roof == 'flat' and ext is not None:
        top = max(w.get('height', H) for w in walls)
        rf = to_mesh(ext.buffer(300, join_style='mitre'), top, top + 200)
        rf.visual = trimesh.visual.TextureVisuals(material=MATS['roof'])
        scene.add_geometry(rf, node_name='roof', geom_name='roof', metadata={'archlang': {'kind': 'roof', 'style': 'flat', 'overhang_mm': 300}})
    # --- openings: frame+glass for windows, leaf/panels for doors
    for (o, w, a, b, ang, rect, z0, z1) in placed:
        L = o['width']; T = w['thickness']
        def local(poly):  # polygon in the opening's local frame (u along wall, v across) -> plan
            return affinity.translate(affinity.rotate(poly, ang, origin=(0, 0), use_radians=True), o['x'], o['y'])
        if o['kind'] == 'window':
            f = 50
            frame = unary_union([box(-L/2, -30, L/2, 30).difference(box(-L/2+f, -31, L/2-f, 31))])
            fm = to_mesh(local(frame), z0, z1)
            gm = to_mesh(local(box(-L/2+f, -8, L/2-f, 8)), z0 + f, z1 - f)
            for nm, m, k in ((f"window:{o['id']}:frame", fm, 'frame'), (f"window:{o['id']}:glass", gm, 'glass')):
                if m is None: continue
                m.visual = trimesh.visual.TextureVisuals(material=MATS[k])
                scene.add_geometry(m, node_name=nm, geom_name=nm, metadata={'archlang': {'kind': 'window', 'id': o['id'], 'part': k}})
        elif o['kind'] == 'door':
            dk = o.get('door_kind', 'hinged'); top = z1 - 30
            panels = []
            if dk in ('sliding',):
                panels = [box(-L/2, 10, 0, 50), box(0, -50, L/2, -10)]   # two overlapping panels (closed pose)
            elif dk == 'pocket':
                panels = [box(-L/2, -20, L/2, 20)]
            else:
                panels = [box(-L/2, -20, L/2, 20)]
            for i, p in enumerate(panels):
                m = to_mesh(local(p), 0, top)
                nm = f"door:{o['id']}" + (f":panel{i}" if len(panels) > 1 else "")
                m.visual = trimesh.visual.TextureVisuals(material=MATS['door'])
                scene.add_geometry(m, node_name=nm, geom_name=nm,
                                   metadata={'archlang': {'kind': 'door', 'id': o['id'], 'door_kind': dk, 'hinge': o.get('hinge'), 'swing': o.get('swing'),
                                                           'width_mm': L, 'host': w['id']}})
    # --- furniture: footprint boxes (Plan JSON footprints are already plan-axis, rotation only matters for real models)
    if furnish:
        for fu in plan['furniture']:
            h = FURN_H.get(fu['category'], FURN_DEFAULT_H)
            poly = box(fu['x'], fu['y'], fu['x'] + fu['width'], fu['y'] + fu['height'])
            m = to_mesh(poly, 0, h)
            if m is None: continue
            m.visual = trimesh.visual.TextureVisuals(material=MATS['furn'])
            nm = f"furn:{fu['id']}"
            scene.add_geometry(m, node_name=nm, geom_name=nm, metadata={'archlang': {
                'kind': 'furniture', 'id': fu['id'], 'category': fu['category'], 'rotate': fu.get('rotate', 0), 'room': fu.get('room'),
                'catalogued': fu['category'] in FURN_H}})
            stats['furniture'] += 1
    return scene, stats

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('plan'); ap.add_argument('out')
    ap.add_argument('--roof', default='flat'); ap.add_argument('--no-furnish', action='store_true')
    a = ap.parse_args()
    plan = json.load(open(a.plan))
    scene, stats = build(plan, a.roof, not a.no_furnish)
    data = scene.export(file_type='glb')
    open(a.out, 'wb').write(data)
    print(json.dumps({'out': a.out, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), **stats}))
