/**
 * Q4 evidence, option "own minimal STEP writer": IFC4 from H1 ownership.
 *  - one IfcWall per ArchLang wall piece, body = IfcExtrudedAreaSolid over IfcArbitraryProfileDefWithVoids
 *  - one IfcOpeningElement (+IfcRelVoidsElement) per opening, body extruded from the core's own cut loop
 *  - IfcDoor/IfcWindow as simple boxes filling the opening (IfcRelFillsElement)
 *  - GlobalId = base64(IFC) of sha1(stable key), so it is stable under edits and byte-deterministic
 * Usage: tsx ifc_probe_minimal_writer.mts <core-root> <plan.arch> <out.ifc>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(process.argv[2]!);
const src = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const { resolvePlan } = await src("analyze.ts");
const { makeVirtualWorld } = await src("world.ts");
const { joinWallSet } = await src("wall-lowering.ts");
const { loopsToPolygons } = await src("geometry/joinery.ts");
const { hatchOf, hatchKey } = await src("hatches.ts");
const res = resolvePlan(readFileSync(process.argv[3]!, "utf8"), { world: makeVirtualWorld({}) });
if (!res.ir) throw new Error("no ir");
type P = { x: number; y: number };
const MARGIN = Number(process.env.IFC_OPENING_MARGIN_MM ?? "20"); // mm; 0 = exact cut (IfcOpenShell then silently skips voids on curved walls); >0 = wall-normal overshoot
const sa = (r: P[]) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!,
      b = r[(i + 1) % r.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};
const inRing = (p: P, r: P[]) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!,
      b = r[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/** push every vertex of an opening's footprint away from the host centreline by `m` mm (wall-normal only, so the opening's width is unchanged):
 *  the exact cut shares its two long faces with the wall, which some boolean kernels (IfcOpenShell/OCC) fail on once the wall is curved. */
function overshoot(poly: P[], host: any, m: number): P[] {
  return poly.map((v) => {
    let best = { d: 1e18, ux: 0, uy: 0 };
    for (let i = 0; i + 1 < host.points.length + (host.closed ? 1 : 0); i++) {
      const a = host.points[i],
        b = host.points[(i + 1) % host.points.length];
      const arc = host.arcs?.[i];
      let d: number, ux: number, uy: number;
      if (arc) {
        const dx = v.x - arc.center.x,
          dy = v.y - arc.center.y,
          r = Math.hypot(dx, dy) || 1;
        d = Math.abs(r - arc.r);
        const s = r >= arc.r ? 1 : -1;
        ux = (s * dx) / r;
        uy = (s * dy) / r;
      } else {
        const abx = b.x - a.x,
          aby = b.y - a.y,
          L2 = abx * abx + aby * aby;
        const t = Math.max(0, Math.min(1, ((v.x - a.x) * abx + (v.y - a.y) * aby) / L2));
        const qx = a.x + t * abx,
          qy = a.y + t * aby;
        const dx = v.x - qx,
          dy = v.y - qy;
        d = Math.hypot(dx, dy);
        if (d < 1e-9) {
          const L = Math.sqrt(L2);
          ux = -aby / L;
          uy = abx / L;
        } else {
          ux = dx / d;
          uy = dy / d;
        }
      }
      if (d < best.d) best = { d, ux, uy };
    }
    return { x: v.x + best.ux * m, y: v.y + best.uy * m };
  });
}
// ---- tiny STEP emitter -------------------------------------------------------------------
const lines: string[] = [];
let nid = 0;
const e = (s: string) => {
  lines.push(`#${++nid}=${s};`);
  return nid;
};
const f = (n: number) => {
  const s = (Math.round(n * 1000) / 1000).toString();
  return s.includes(".") || s.includes("e") ? s : s + ".";
};
const str = (s: string) =>
  `'${s.replace(/'/g, "''").replace(/[^\x20-\x7e]/g, (c) => `\\X2\\${c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()}\\X0\\`)}'`;
const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
function guid(key: string): string {
  // IFC GlobalId: 128 bits -> 22 chars (first char carries 2 bits)
  const h = createHash("sha1").update(key).digest();
  let n = 0n;
  for (let i = 0; i < 16; i++) n = (n << 8n) | BigInt(h[i]!);
  let out = "";
  for (let i = 0; i < 22; i++) {
    out = B64[Number(n & 63n)] + out;
    n >>= 6n;
  }
  return out;
}
const used = new Set<string>();
const gid = (k: string) => {
  const g = guid(k);
  if (used.has(g)) throw new Error("guid clash " + k);
  used.add(g);
  return g;
};
const pt3 = (x: number, y: number, z: number) => e(`IFCCARTESIANPOINT((${f(x)},${f(y)},${f(z)}))`);
const pt2 = (x: number, y: number) => e(`IFCCARTESIANPOINT((${f(x)},${f(y)}))`);
const dir = (x: number, y: number, z: number) => e(`IFCDIRECTION((${f(x)},${f(y)},${f(z)}))`);
const place = (rel: number | null, x = 0, y = 0, z = 0) =>
  e(`IFCLOCALPLACEMENT(${rel ? "#" + rel : "$"},#${e(`IFCAXIS2PLACEMENT3D(#${pt3(x, y, z)},$,$)`)})`);
const poly = (r: P[]) => e(`IFCPOLYLINE((${[...r, r[0]!].map((p) => "#" + pt2(p.x, p.y)).join(",")}))`);
function profile(outer: P[], holes: P[][]) {
  const o = sa(outer) > 0 ? outer : [...outer].reverse();
  if (!holes.length) return e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#${poly(o)})`);
  return e(
    `IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$,#${poly(o)},(${holes.map((h) => "#" + poly(sa(h) < 0 ? h : [...h].reverse())).join(",")}))`,
  );
}
const extrude = (prof: number, depth: number, z0 = 0) =>
  e(`IFCEXTRUDEDAREASOLID(#${prof},#${e(`IFCAXIS2PLACEMENT3D(#${pt3(0, 0, z0)},$,$)`)},#${dir(0, 0, 1)},${f(depth)})`);
let ctxBody = 0;
const body = (solid: number) =>
  e(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${e(`IFCSHAPEREPRESENTATION(#${ctxBody},'Body','SweptSolid',(#${solid}))`)}))`);

// ---- header / spatial structure ------------------------------------------------------------
const person = e("IFCPERSON($,$,'',$,$,$,$,$)"),
  org = e("IFCORGANIZATION($,'archlang-3d',$,$,$)"),
  pao = e(`IFCPERSONANDORGANIZATION(#${person},#${org},$)`),
  app = e(`IFCAPPLICATION(#${org},'0.0','archlang-3d','archlang-3d')`);
const owner = e(`IFCOWNERHISTORY(#${pao},#${app},$,.NOCHANGE.,$,$,$,0)`);
const wcs = e(`IFCAXIS2PLACEMENT3D(#${pt3(0, 0, 0)},$,$)`);
const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#${wcs},$)`);
ctxBody = e(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${ctx},$,.MODEL_VIEW.,$)`);
const units = e(
  `IFCUNITASSIGNMENT((#${e("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)")},#${e("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)")},#${e("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)")},#${e("IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)")}))`,
);
const proj = e(`IFCPROJECT('${gid("project")}',#${owner},${str(res.ir.name)},$,$,$,$,(#${ctx}),#${units})`);
const sitePl = place(null);
const site = e(`IFCSITE('${gid("site")}',#${owner},'Site',$,$,#${sitePl},$,$,.ELEMENT.,$,$,$,$,$)`);
const bPl = place(sitePl);
const bld = e(`IFCBUILDING('${gid("building")}',#${owner},'Building',$,$,#${bPl},$,$,.ELEMENT.,$,$,$)`);
e(`IFCRELAGGREGATES('${gid("rel:proj-site")}',#${owner},$,$,#${proj},(#${site}))`);
e(`IFCRELAGGREGATES('${gid("rel:site-bld")}',#${owner},$,$,#${site},(#${bld}))`);
const storeys = res.levels.length ? res.levels.map((l: any) => ({ ir: l.ir, n: l.level })) : [{ ir: res.ir, n: 0 }];
const matIds = new Map<string, number>();
const matUsers = new Map<string, number[]>();
const stats: any = { walls: 0, pieces: 0, openings: 0, doors: 0, windows: 0, expectedVolume_m3: 0 };
const storeyIds: number[] = [];
let elev = 0;
for (const { ir, n } of storeys) {
  const sPl = place(bPl, 0, 0, elev);
  const st = e(
    `IFCBUILDINGSTOREY('${gid("storey:" + n)}',#${owner},${str("L" + n)},$,$,#${sPl},$,$,.ELEMENT.,${f(elev)})`,
  );
  storeyIds.push(st);
  const contained: number[] = [];
  const walls = ir.walls;
  const ids = [...new Set(walls.map((w: any) => w.id))] as string[];
  const groups = [...new Set(walls.map((w: any) => hatchKey(hatchOf(w))))] as string[];
  const solid = joinWallSet(
    walls.map((w: any) => ({ ...w, openings: [] })),
    groups,
    { faceOf: (w: any) => w.id, faces: ids },
  );
  const withCuts = joinWallSet(walls, groups); // gives the cut loops
  const wallEnt = new Map<string, number[]>();
  const pieceRegions: Array<{ ent: number; outer: P[]; holes: P[][]; name: string; vol: number }> = [];
  for (const id of ids) {
    const w = walls.find((x: any) => x.id === id);
    stats.walls++;
    const rings: P[][] = solid.result.split.fills
      .filter((fl: any) => fl.face === id)
      .flatMap((fl: any) => loopsToPolygons(fl.loops));
    const outers = rings.filter((r) => sa(r) > 0),
      holes = rings.filter((r) => sa(r) < 0);
    outers.forEach((o, k) => {
      stats.pieces++;
      stats.expectedVolume_m3 +=
        (Math.abs(sa(o) + holes.filter((h) => inRing(h[0]!, o)).reduce((s, h) => s + sa(h), 0)) * w.height) / 1e9;
      const hs = holes.filter((h) => inRing(h[0]!, o));
      const wl = e(
        `IFCWALL('${gid(`wall:${n}:${id}:${k}`)}',#${owner},${str(id)},$,$,#${place(sPl)},#${body(extrude(profile(o, hs), w.height))},$,.NOTDEFINED.)`,
      );
      pieceRegions.push({
        ent: wl,
        outer: o,
        holes: hs,
        name: id,
        vol: (Math.abs(sa(o) + hs.reduce((s, h) => s + sa(h), 0)) * w.height) / 1e9,
      });
      stats.perWall ??= {};
      stats.perWall[id] =
        (stats.perWall[id] ?? 0) + (Math.abs(sa(o) + hs.reduce((s, h) => s + sa(h), 0)) * w.height) / 1e9;
      contained.push(wl);
      (wallEnt.get(id) ?? wallEnt.set(id, []).get(id)!).push(wl);
      (matUsers.get(w.material) ?? matUsers.set(w.material, []).get(w.material)!).push(wl);
    });
  }
  // openings: one void per cut, hosted by the wall piece whose region contains the cut centroid (fallback: first piece of the host)
  withCuts.cuts.forEach((c: any, idx: number) => {
    const host = walls[c.wall];
    const op = c.opening;
    const poly2: P[] = loopsToPolygons([c.loop])[0];
    const _cen = {
      x: poly2.reduce((s, p) => s + p.x, 0) / poly2.length,
      y: poly2.reduce((s, p) => s + p.y, 0) / poly2.length,
    };
    const sill = op.sill ?? 0,
      head = op.head ?? host.height;
    stats.openings++;
    const pieces = wallEnt.get(host.id) ?? [];
    const key = `${n}:${op.ownerId ?? host.id + "#" + idx}`;
    // Which wall pieces does this cut overlap? Sample the cut footprint on a grid (<= 12 mm); an IFC opening may void ONE element only,
    // so every overlapped piece gets its own IfcOpeningElement built from the SAME cut loop.
    const xs = poly2.map((q) => q.x),
      ys = poly2.map((q) => q.y),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const step = Math.max(6, Math.min(40, Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000)));
    const hit = new Map<number, number>();
    let inSolid = 0;
    for (let x = x0 + step / 2; x < x1; x += step)
      for (let y = y0 + step / 2; y < y1; y += step) {
        const q = { x, y };
        if (!inRing(q, poly2)) continue;
        for (const pr of pieceRegions)
          if (inRing(q, pr.outer) && !pr.holes.some((h) => inRing(q, h))) {
            hit.set(pr.ent, (hit.get(pr.ent) ?? 0) + 1);
            inSolid++;
            stats.perWall[pr.name] -= (step * step * (head - sill)) / 1e9;
            break;
          }
      }
    stats.expectedVolume_m3 -= (inSolid * step * step * (head - sill)) / 1e9;
    const targets = [...hit.keys()].length ? [...hit.keys()] : pieces.slice(0, 1);
    let first = 0;
    targets.forEach((wl, k) => {
      const ve = e(
        `IFCOPENINGELEMENT('${gid("open:" + key + ":" + k)}',#${owner},${str("Opening " + (op.ownerId ?? idx))},$,$,#${place(sPl)},#${body(extrude(profile(MARGIN > 0 ? overshoot(poly2, host, MARGIN) : poly2, []), head - sill, sill))},$,.OPENING.)`,
      );
      e(`IFCRELVOIDSELEMENT('${gid("void:" + key + ":" + k)}',#${owner},$,$,#${wl},#${ve})`);
      if (!first) first = ve;
      stats.voidsCreated = (stats.voidsCreated ?? 0) + 1;
    });
    stats.openingsOverMultiplePieces = (stats.openingsOverMultiplePieces ?? 0) + (targets.length > 1 ? 1 : 0);
    const ve = first;
    if (op.kind === "door" || op.kind === "window") {
      const box = extrude(profile(poly2, []), (head - sill) * 0.98, sill + (head - sill) * 0.01);
      const ent = e(
        `${op.kind === "door" ? "IFCDOOR" : "IFCWINDOW"}('${gid("fill:" + key)}',#${owner},${str(op.ownerId ?? "")},$,$,#${place(sPl)},#${body(box)},$,${f(head - sill)},${f(op.width)}${op.kind === "door" ? ",.DOOR.,.NOTDEFINED.,$" : ",.WINDOW.,.NOTDEFINED.,$"})`,
      );
      e(`IFCRELFILLSELEMENT('${gid("fills:" + key)}',#${owner},$,$,#${ve},#${ent})`);
      contained.push(ent);
      op.kind === "door" ? stats.doors++ : stats.windows++;
    }
  });
  e(
    `IFCRELCONTAINEDINSPATIALSTRUCTURE('${gid("contain:" + n)}',#${owner},$,$,(${contained
      .filter((x) => !lines[x - 1]!.includes("IFCOPENINGELEMENT"))
      .map((x) => "#" + x)
      .join(",")}),#${st})`,
  );
  elev += ir.storeyHeight;
}
e(`IFCRELAGGREGATES('${gid("rel:bld-storeys")}',#${owner},$,$,#${bld},(${storeyIds.map((s) => "#" + s).join(",")}))`);
for (const [m, users] of matUsers) {
  const mid = matIds.get(m) ?? e(`IFCMATERIAL(${str(m)},$,$)`);
  matIds.set(m, mid);
  e(`IFCRELASSOCIATESMATERIAL('${gid("mat:" + m)}',#${owner},$,$,(${users.map((u) => "#" + u).join(",")}),#${mid})`);
}
const text = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');\nFILE_NAME('plan.ifc','2026-10-23T00:00:00',(''),(''),'archlang-3d','archlang-3d','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
writeFileSync(process.argv[4]!, text);
stats.expectedVolume_m3 = +stats.expectedVolume_m3.toFixed(4);
if (process.env.IFC_PROBE_PERWALL !== "1") delete stats.perWall;
console.log(
  JSON.stringify({
    file: path.basename(process.argv[4]!),
    bytes: text.length,
    entities: nid,
    ...stats,
    writerLoc: readFileSync(new URL(import.meta.url).pathname, "utf8").split("\n").length,
  }),
);
