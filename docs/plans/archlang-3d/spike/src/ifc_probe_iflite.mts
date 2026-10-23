/**
 * Q4 evidence, option "@ifc-lite/create": build the same ArchLang plan as IFC4 with
 *   A) straight-axis walls (addIfcWall + Openings + hosted doors/windows)
 *   B) polygon walls from H1 ownership (addElement IFCWALL + arbitrary profile; no openings)
 * and write two files per flavour (run twice) to check byte-determinism.
 * Usage (cwd must resolve @ifc-lite/create): tsx ifc_probe_iflite.mts <core-root> <plan.arch> <outdir>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]!);
const planFile = process.argv[3]!;
const outDir = path.resolve(process.argv[4]!);
mkdirSync(outDir, { recursive: true });
const src = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const { resolvePlan } = await src("analyze.ts");
const { makeVirtualWorld } = await src("world.ts");
const { joinWallSet } = await src("wall-lowering.ts");
const { loopsToPolygons } = await src("geometry/joinery.ts");
const { hatchOf, hatchKey } = await src("hatches.ts");
const here = createRequire(path.join(process.cwd(), "x.js")); // resolve from the cwd, where the npm install lives
const { IfcCreator } = await import(pathToFileURL(here.resolve("@ifc-lite/create")).href);
const { generateIfcGuid } = await import(
  pathToFileURL(createRequire(here.resolve("@ifc-lite/create")).resolve("@ifc-lite/encoding")).href
);
const res = resolvePlan(readFileSync(planFile, "utf8"), { world: makeVirtualWorld({}) });
if (!res.ir) throw new Error("no ir " + JSON.stringify(res.diagnostics.slice(0, 2)));
const storeys = res.levels.length ? res.levels.map((l: any) => ({ ir: l.ir, n: l.level })) : [{ ir: res.ir, n: 0 }];
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
type P = { x: number; y: number };
const sa = (r: P[]) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!,
      b = r[(i + 1) % r.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};

function build(flavour: "A" | "B") {
  const rng = lcg(42);
  const c = new IfcCreator({
    Name: "archlang-3d probe",
    Schema: "IFC4",
    LengthUnit: "MILLIMETRE",
    Timestamp: Date.UTC(2026, 9, 23),
    GuidSource: () => generateIfcGuid(rng),
  });
  let elev = 0;
  const stats = { walls: 0, openings: 0, polyPieces: 0 };
  for (const { ir, n } of storeys) {
    const st = c.addIfcBuildingStorey({ Name: `L${n}`, Elevation: elev });
    if (flavour === "A") {
      for (const w of ir.walls)
        for (let i = 0; i + 1 < w.points.length + (w.closed ? 1 : 0); i++) {
          const a = w.points[i]!,
            b = w.points[(i + 1) % w.points.length]!;
          if (w.arcs?.[i]) continue; // arcs unsupported in A
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / len,
            uy = (b.y - a.y) / len;
          const ops = w.openings.filter((o: any) => {
            const t = (o.at.x - a.x) * ux + (o.at.y - a.y) * uy;
            return t > 0 && t < len && Math.abs((o.at.x - a.x) * uy - (o.at.y - a.y) * ux) < 1;
          });
          const wid = c.addIfcWall(st, {
            Name: `${w.id}:${i}`,
            Start: [a.x, a.y, 0],
            End: [b.x, b.y, 0],
            Thickness: w.thickness,
            Height: w.height,
          });
          stats.walls++;
          for (const o of ops) {
            const t = (o.at.x - a.x) * ux + (o.at.y - a.y) * uy;
            stats.openings++;
            if (o.kind === "window")
              c.addIfcWallWindow(wid, {
                Name: o.ownerId,
                Position: [t, 0, o.sill ?? 900],
                Width: o.width,
                Height: (o.head ?? 2100) - (o.sill ?? 900),
              });
            else
              c.addIfcWallDoor(wid, { Name: o.ownerId, Position: [t, 0, 0], Width: o.width, Height: o.head ?? 2100 });
          }
        }
    } else {
      const walls = ir.walls.map((w: any) => ({ ...w, openings: [] }));
      const ids = [...new Set(walls.map((w: any) => w.id))] as string[];
      const j = joinWallSet(walls, [...new Set(walls.map((w: any) => hatchKey(hatchOf(w))))] as string[], {
        faceOf: (w: any) => w.id,
        faces: ids,
      });
      for (const id of ids) {
        const w = walls.find((x: any) => x.id === id);
        const rings: P[][] = j.result.split.fills
          .filter((f: any) => f.face === id)
          .flatMap((f: any) => loopsToPolygons(f.loops));
        for (const r of rings.filter((q) => sa(q) > 0)) {
          stats.polyPieces++;
          c.addElement(st, {
            IfcType: "IFCWALL",
            Name: id,
            Placement: { Location: [0, 0, 0] },
            Profile: { ProfileType: "AREA", OuterCurve: r.map((p) => [p.x, p.y] as [number, number]) },
            Depth: w.height,
          });
        }
      }
    }
    elev += ir.storeyHeight;
  }
  const out = c.toIfc();
  return { content: out.content as string, stats };
}
for (const fl of ["A", "B"] as const) {
  const r1 = build(fl),
    r2 = build(fl);
  writeFileSync(path.join(outDir, `iflite_${fl}.ifc`), r1.content);
  const same = r1.content === r2.content;
  console.log(
    JSON.stringify({
      flavour: fl,
      bytes: r1.content.length,
      lines: r1.content.split("\n").length,
      byteIdenticalTwoRuns: same,
      ...r1.stats,
    }),
  );
}
