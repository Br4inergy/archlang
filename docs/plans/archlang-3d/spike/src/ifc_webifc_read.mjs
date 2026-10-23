// Second, independent reader: web-ifc (wasm). Usage (cwd = dir with web-ifc installed): node ifc_webifc_read.mjs a.ifc b.ifc ...
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const req = createRequire(process.cwd() + "/x.js");
const WebIFC = await import(pathToFileURL(req.resolve("web-ifc")).href);
const api = new WebIFC.IfcAPI();
await api.Init();
for (const f of process.argv.slice(2)) {
  const id = api.OpenModel(new Uint8Array(readFileSync(f)));
  let meshes = 0,
    tris = 0,
    _verts = 0;
  const t0 = performance.now();
  api.StreamAllMeshes(id, (m) => {
    meshes++;
    for (let i = 0; i < m.geometries.size(); i++) {
      const g = api.GetGeometry(id, m.geometries.get(i).geometryExpressID);
      tris += g.GetIndexDataSize() / 3;
      _verts += g.GetVertexDataSize() / 6;
      g.delete?.();
    }
  });
  console.log(
    JSON.stringify({
      file: f.split("/").pop(),
      meshes,
      triangles: tris,
      ms: +(performance.now() - t0).toFixed(0),
      walls: api.GetLineIDsWithType(id, WebIFC.IFCWALL).size(),
      doors: api.GetLineIDsWithType(id, WebIFC.IFCDOOR).size(),
    }),
  );
  api.CloseModel(id);
}
