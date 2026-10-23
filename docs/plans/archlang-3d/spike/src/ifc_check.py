"""IfcOpenShell read-back + validation for a generated IFC file.
Usage: python ifc_check.py file.ifc [expected_total_wall_volume_m3]
Reports: schema, entity counts, GlobalId uniqueness, IFC schema-validation issues,
and geometry-derived volumes (ifcopenshell.geom) per IfcWall / IfcWallStandardCase."""
import sys, json, collections
import ifcopenshell, ifcopenshell.geom, ifcopenshell.util.element as E, ifcopenshell.util.unit as U
import ifcopenshell.validate as V
path = sys.argv[1]
f = ifcopenshell.open(path)
out = {"file": path.split("/")[-1], "schema": f.schema, "ifcopenshell": ifcopenshell.version}
cnt = collections.Counter(e.is_a() for e in f)
out["entities_total"] = len(list(f))
out["products"] = {k: v for k, v in cnt.items() if k in ("IfcWall","IfcWallStandardCase","IfcDoor","IfcWindow","IfcSlab","IfcOpeningElement","IfcBuildingStorey","IfcRelVoidsElement","IfcRelFillsElement","IfcFurnishingElement","IfcBuildingElementProxy","IfcRoof","IfcStair","IfcSpace")}
gids = [e.GlobalId for e in f.by_type("IfcRoot")]
out["globalids"] = {"n": len(gids), "unique": len(set(gids)) == len(gids)}
lgr = V.json_logger()
try:
    V.validate(f, lgr)
    st = lgr.statements
    out["validate"] = {"issues": len(st), "first": [str(s.get("message", s))[:200] for s in st[:4]]}
except Exception as ex:
    out["validate"] = {"exception": str(ex)[:200]}
settings = ifcopenshell.geom.settings()
scale = U.calculate_unit_scale(f)  # model length unit -> metres
vol = {}
bad = []
for w in list(f.by_type("IfcWall")):
    try:
        sh = ifcopenshell.geom.create_shape(settings, w)
        g = sh.geometry; v = g.verts; faces = g.faces
        import numpy as np
        V3 = np.array(v).reshape(-1, 3); T = np.array(faces).reshape(-1, 3)
        a, b, c = V3[T[:,0]], V3[T[:,1]], V3[T[:,2]]
        vol[w.Name] = vol.get(w.Name, 0.0) + abs(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0)
    except Exception as ex:
        bad.append((w.Name, str(ex)[:80]))
out["per_wall_volume_m3"] = {k: round(v, 4) for k, v in vol.items()}
out["geometry"] = {"walls_with_shape": len(vol), "walls_failed": bad[:5], "total_wall_volume_m3": round(sum(vol.values()), 4)}
if len(sys.argv) > 2: out["expected_total_wall_volume_m3_before_openings"] = float(sys.argv[2])
print(json.dumps(out, indent=1))
