import fs from "node:fs";
import validator from "gltf-validator";
const f = process.argv[2];
const data = new Uint8Array(fs.readFileSync(f));
const r = await validator.validateBytes(data, { uri: f, maxIssues: 50 });
console.log(
  JSON.stringify(
    {
      version: validator.version(),
      file: f,
      severity:
        r.issues.numErrors + "E/" + r.issues.numWarnings + "W/" + r.issues.numInfos + "I/" + r.issues.numHints + "H",
      info: {
        generator: r.info.generator,
        meshes: r.info.drawCallCount,
        materials: r.info.materialCount,
        tri: r.info.totalTriangleCount,
        verts: r.info.totalVertexCount,
      },
      messages: r.issues.messages.slice(0, 8).map((m) => m.severity + " " + m.code + " " + m.pointer),
    },
    null,
    1,
  ),
);
