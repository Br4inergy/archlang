"""Run plan2glb + the verify checks over every Plan JSON in json/ and print a table (JSON lines -> corpus-results.json)."""
import json, glob, os, sys, time, subprocess, math, traceback
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, trimesh
from plan2glb import build, nearest_segment
rows = []
ir = {r['file'][:-5]: r for r in json.load(open('coverage-ir.json'))}
for f in sorted(glob.glob('json/*.json')):
    name = os.path.basename(f)[:-5]; base = name.split('.L')[0]
    plan = json.load(open(f)); row = {'file': name, 'plan_walls': len(plan['walls']), 'rooms': len(plan['rooms']), 'openings': len(plan['openings']), 'furniture': len(plan['furniture']), 'levels_in_json': 'level' in plan}
    t = time.time()
    try:
        if not plan['walls']:
            row['status'] = 'NO_WALLS_IN_PLAN_JSON' + (' (walls_from_rooms=%s)' % json.dumps(plan.get('walls_from_rooms'))[:60] if 'walls_from_rooms' in plan else '')
            rows.append(row); continue
        scene, st = build(plan, 'flat', True)
        data = scene.export(file_type='glb'); open(f'out/corpus_{name}.glb', 'wb').write(data)
        row.update({'ms': round((time.time() - t) * 1000), 'bytes': len(data), 'walls': st['walls'], 'warn': st['warnings'][:3]})
        sc = trimesh.load(f'out/corpus_{name}.glb', force='scene')
        bad = 0
        for n in sc.graph.nodes_geometry:
            T, g = sc.graph[n]; m = sc.geometry[g]
            if not m.is_watertight: bad += 1
        row['non_watertight_nodes'] = bad; row['nodes'] = len(sc.graph.nodes_geometry)
        # floor-area check
        fa = 0; pa = 0
        for r in plan['rooms']:
            n = f"floor:{r['id']}"
            if n in sc.graph.nodes_geometry:
                T, g = sc.graph[n]; m = sc.geometry[g]
                fa += float(m.area_faces[m.face_normals[:, 1] > 0.9][:, ].sum() if False else m.area_faces[(m.face_normals[:, 1] > 0.9) & (m.triangles_center[:, 1] > 0.0115)].sum()); pa += r['area']
        row['floor_area_err_m2'] = round(fa - pa, 3)
        row['status'] = 'ok'
    except Exception as e:
        row['status'] = 'ERROR ' + repr(e)[:120]
    rows.append(row)
json.dump(rows, open('corpus-results.json', 'w'), indent=1)
for r in rows: print(r['file'].ljust(22), r['status'][:70].ljust(70), r.get('nodes', ''), r.get('non_watertight_nodes', ''), r.get('floor_area_err_m2', ''), r.get('ms', ''), r.get('warn', ''))
