/**
 * H1, second half: turn each wall's owned region into a watertight prism and check it.
 * Also: mixed-height ownership (core backlog V.1) with the "height-priority" variant.
 * Usage: tsx h1_prism_check.mts <core-root> <dir-with-.arch> [more dirs...]
 * Needs `earcut` resolvable from the working directory.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(process.argv[2] ?? ".");
const dirs = process.argv.slice(3).map((d) => path.resolve(d));
const req = createRequire(path.join(root, "package.json"));
const _ec = req("earcut");
const earcut = (_ec.default ?? _ec) as (d: number[], h?: number[], dim?: number) => number[];
const src = (p: string) => import(path.join(root, "src", p));
const { resolvePlan } = await src("analyze.ts");
const { joinWallSet } = await src("wall-lowering.ts");
const { joinWalls, loopsToPolygons, bandBBox } = await src("geometry/joinery.ts");
const { hatchOf, hatchKey } = await src("hatches.ts");
const { wallBand, openingCut, loopBBox, PointInterner, loopsContain } = await src("geometry/band.ts");
const { makeVirtualWorld } = await src("world.ts");
type Pt = { x: number; y: number };
const sa = (r: Pt[]) => {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!,
      b = r[(i + 1) % r.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};
const inRing = (p: Pt, r: Pt[]) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!,
      b = r[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/** rings (outer +, holes −) -> triangles (flat xy + index) via earcut, holes assigned by containment */
function triangulate(rings: Pt[][]) {
  const outers = rings.filter((r) => sa(r) > 0),
    holes = rings.filter((r) => sa(r) < 0);
  const tris: number[][][] = [];
  let area = 0;
  for (const o of outers) {
    const hs = holes.filter((h) => inRing(h[0]!, o));
    const flat: number[] = [];
    const hidx: number[] = [];
    for (const p of o) flat.push(p.x, p.y);
    for (const h of hs) {
      hidx.push(flat.length / 2);
      for (const p of h) flat.push(p.x, p.y);
    }
    const idx = earcut(flat, hidx, 2);
    for (let i = 0; i < idx.length; i += 3) {
      const t = [0, 1, 2].map((k) => [flat[idx[i + k]! * 2]!, flat[idx[i + k]! * 2 + 1]!]);
      tris.push(t);
      area += Math.abs(sa(t.map(([x, y]) => ({ x: x!, y: y! }))));
    }
  }
  return { tris, area, outers, holes };
}
/** closed-manifold + volume check of a vertical prism over `rings`, height h */
function prismCheck(rings: Pt[][], h: number) {
  const { tris, area } = triangulate(rings);
  const key = (x: number, y: number, z: number) => `${x.toFixed(4)},${y.toFixed(4)},${z}`;
  const edges = new Map<string, number>();
  const add = (a: string, b: string) => {
    edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1);
  };
  let vol = 0;
  const face = (p: number[][]) => {
    // triangle with 3D points, accumulate volume + edges
    const [a, b, c] = p as [number[], number[], number[]];
    vol +=
      (a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
        a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
        a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)) /
      6;
    const k = p.map((q) => key(q[0]!, q[1]!, q[2]!));
    add(k[0]!, k[1]!);
    add(k[1]!, k[2]!);
    add(k[2]!, k[0]!);
  };
  for (const t of tris) {
    // plan is y-down; x,y,z -> orientation: bottom faces down. we only need consistency, so orient by signed plan area
    const ccw = sa(t.map(([x, y]) => ({ x: x!, y: y! }))) > 0;
    const [a, b, c] = ccw ? t : [t[0]!, t[2]!, t[1]!];
    face([
      [a![0]!, a![1]!, h],
      [b![0]!, b![1]!, h],
      [c![0]!, c![1]!, h],
    ]); // top, normal +z for ccw (in numeric xy)
    face([
      [a![0]!, a![1]!, 0],
      [c![0]!, c![1]!, 0],
      [b![0]!, b![1]!, 0],
    ]); // bottom
  }
  for (const r of rings) {
    // outer ring numeric orientation sa>0 (ccw numeric): outward side normal = right of edge
    const pts = sa(r) > 0 ? r : [...r].reverse(); // holes: reverse so that solid is on the left
    const _ring = sa(r) > 0 ? pts : [...pts].reverse().reverse();
    for (let i = 0; i < r.length; i++) {
      const a = (sa(r) > 0 ? r : [...r].reverse())[i]!,
        b = (sa(r) > 0 ? r : [...r].reverse())[(i + 1) % r.length]!;
      const flip = sa(r) < 0; // hole ring: solid on the other side
      const A0 = [a.x, a.y, 0],
        B0 = [b.x, b.y, 0],
        A1 = [a.x, a.y, h],
        B1 = [b.x, b.y, h];
      if (!flip) {
        face([A0, B0, B1]);
        face([A0, B1, A1]);
      } else {
        face([B0, A0, A1]);
        face([B0, A1, B1]);
      }
    }
  }
  // each directed edge must be matched by its reverse exactly once
  let bad = 0;
  const ex: string[] = [];
  for (const [e, n] of edges) {
    const [a, b] = e.split(">");
    if (n !== 1 || edges.get(`${b}>${a}`) !== 1) {
      bad++;
      if (ex.length < 4) ex.push(`${e} x${n}`);
    }
  }
  return { area, vol, openEdges: bad, tris: tris.length, ex };
}

/** one group per connected piece: an outer ring and the holes inside it */
function splitPieces(rings: Pt[][]): Pt[][][] {
  const outers = rings.filter((r) => sa(r) > 0),
    holes = rings.filter((r) => sa(r) < 0);
  return outers.map((o) => [o, ...holes.filter((h) => inRing(h[0]!, o))]);
}
function ownedRegions(walls: any[], mode: "thickest" | "height-first") {
  const ids = [...new Set(walls.map((w) => w.id))] as string[];
  const groups = [...new Set(walls.map((w) => hatchKey(hatchOf(w))))] as string[];
  if (mode === "thickest") {
    const j = joinWallSet(
      walls.map((w) => ({ ...w, openings: [] })),
      groups,
      { faceOf: (w: any) => w.id, faces: ids },
    );
    return {
      j,
      regions: new Map<string, Pt[][]>(
        ids.map((id) => [
          id,
          j?.result.split?.fills.filter((f: any) => f.face === id).flatMap((f: any) => loopsToPolygons(f.loops)) ?? [],
        ]),
      ),
    };
  }
  // direct joinWalls with ownership priority = height first (spoofing `thickness`, which is only read for ownership + the prefilter reach)
  const intern = new PointInterner();
  const jw: any[] = [];
  walls.forEach((w, i) => {
    const loops = wallBand(w, intern);
    if (loops.length)
      jw.push({
        index: i,
        id: w.id,
        thickness: w.height * 1e6 + w.thickness,
        group: hatchKey(hatchOf(w)),
        face: w.id,
        loops,
        bbox: bandBBox(loops),
      });
  });
  const res = joinWalls(jw, [], groups, ids);
  return {
    j: { result: res },
    regions: new Map<string, Pt[][]>(
      ids.map((id) => [
        id,
        res.split?.fills.filter((f: any) => f.face === id).flatMap((f: any) => loopsToPolygons(f.loops)) ?? [],
      ]),
    ),
  };
}
/** mixed-height error: ∫|h_owner − h_true| dA over a 25 mm sample grid, plus the true volume */
function heightError(walls: any[], regions: Map<string, Pt[][]>) {
  const intern = new PointInterner();
  const bands = walls.map((w) => ({ w, loops: wallBand(w, intern) }));
  let minX = 1e9,
    minY = 1e9,
    maxX = -1e9,
    maxY = -1e9;
  for (const b of bands)
    for (const l of b.loops) {
      const bb = loopBBox(l);
      minX = Math.min(minX, bb.minX);
      minY = Math.min(minY, bb.minY);
      maxX = Math.max(maxX, bb.maxX);
      maxY = Math.max(maxY, bb.maxY);
    }
  const step = 25;
  let err = 0,
    vtrue = 0,
    vown = 0;
  for (let x = minX + step / 2; x < maxX; x += step)
    for (let y = minY + step / 2; y < maxY; y += step) {
      const p = { x, y };
      let ht = 0;
      for (const b of bands) if (loopsContain(b.loops, p)) ht = Math.max(ht, b.w.height);
      let ho = 0;
      for (const w of walls) {
        const rs = regions.get(w.id) ?? [];
        if (
          rs
            .filter((r) => sa(r) > 0)
            .some((o) => inRing(p, o) && !rs.filter((r) => sa(r) < 0).some((h) => inRing(p, h)))
        ) {
          ho = w.height;
          break;
        }
      }
      err += Math.abs(ht - ho) * step * step;
      vtrue += ht * step * step;
      vown += ho * step * step;
    }
  return {
    absErr_m3: +(err / 1e9).toFixed(3),
    trueVol_m3: +(vtrue / 1e9).toFixed(3),
    ownedVol_m3: +(vown / 1e9).toFixed(3),
    relErr: +(err / Math.max(1, vtrue)).toFixed(4),
  };
}

const rows: any[] = [];
for (const dir of dirs) {
  const files: Record<string, string> = {};
  const libDir = path.join(dir, "lib");
  try {
    for (const f of readdirSync(libDir)) files["lib/" + f] = readFileSync(path.join(libDir, f), "utf8");
  } catch {}
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".arch")))
    files[f] = readFileSync(path.join(dir, f), "utf8");
  const world = makeVirtualWorld(files);
  for (const f of Object.keys(files)
    .filter((k) => k.endsWith(".arch") && !k.startsWith("lib/"))
    .sort()) {
    const res = resolvePlan(files[f]!, { world });
    if (!res.ir) {
      rows.push({
        plan: f,
        status: "no-ir",
        errors: res.diagnostics
          .filter((d: any) => d.severity === "error")
          .map((d: any) => d.code)
          .slice(0, 2),
      });
      continue;
    }
    const storeys = res.levels.length ? res.levels.map((l: any) => l.ir) : [res.ir];
    const r: any = {
      plan: f,
      status: "ok",
      walls: 0,
      prisms: 0,
      openEdgeTotal: 0,
      areaMismatch: 0,
      volMismatch: 0,
      cutsOutsideHost: 0,
      cuts: 0,
      mixedHeight: false,
    };
    for (const ir of storeys) {
      const walls = ir.walls;
      r.walls += walls.length;
      const hs = new Set(walls.map((w: any) => w.height));
      if (hs.size > 1) r.mixedHeight = true;
      const { j, regions } = ownedRegions(walls, "thickest");
      for (const w of walls) {
        const rings = regions.get(w.id) ?? [];
        if (!rings.length) continue;
        const groups = splitPieces(rings);
        r.pieces = (r.pieces ?? 0) + groups.length;
        const pcs = groups.map((g) => prismCheck(g, w.height));
        const pcAll = prismCheck(rings, w.height);
        r.openEdgesWholeWall = (r.openEdgesWholeWall ?? 0) + pcAll.openEdges;
        const pc = {
          area: pcs.reduce((s, x) => s + x.area, 0),
          vol: pcs.reduce((s, x) => s + x.vol, 0),
          openEdges: pcs.reduce((s, x) => s + x.openEdges, 0),
          ex: pcs.flatMap((x) => x.ex),
        };
        r.prisms++;
        r.openEdgeTotal += pc.openEdges;
        if (pc.openEdges) {
          r.openEdgeWalls ??= [];
          r.openEdgeWalls.push({
            wall: w.id,
            openEdges: pc.openEdges,
            examples: pc.ex,
            rings: rings.length,
            vertices: rings.map((q) => q.length),
            minEdge_mm: +Math.min(
              ...rings.flatMap((q) =>
                q.map((a, i) => Math.hypot(a.x - q[(i + 1) % q.length]!.x, a.y - q[(i + 1) % q.length]!.y)),
              ),
            ).toFixed(4),
          });
        }
        const ringArea = rings.reduce((s, q) => s + sa(q), 0);
        if (Math.abs(pc.area - ringArea) > 1e-6 * Math.max(1, ringArea) + 1) r.areaMismatch++;
        if (Math.abs(pc.vol - ringArea * w.height) > 1e-6 * Math.max(1, ringArea * w.height) + 1) r.volMismatch++;
      }
      // opening cuts: each cut's loop must lie (centroid) inside its host wall's owned region... or inside any wall region incl. a neighbour at a junction
      const intern = new PointInterner();
      walls.forEach((w: any) => {
        for (const op of w.openings) {
          const l = openingCut(w, op, intern);
          if (!l) continue;
          r.cuts++;
          const poly = loopsToPolygons([l])[0]!;
          const c = {
            x: poly.reduce((s: number, p: Pt) => s + p.x, 0) / poly.length,
            y: poly.reduce((s: number, p: Pt) => s + p.y, 0) / poly.length,
          };
          const rs = regions.get(w.id) ?? [];
          const inHost = rs.filter((q) => sa(q) > 0).some((o) => inRing(c, o));
          if (!inHost) r.cutsOutsideHost++;
        }
      });
      if (hs.size > 1) {
        r.heightErr_thickest = heightError(walls, regions);
        r.heightErr_heightFirst = heightError(walls, ownedRegions(walls, "height-first").regions);
      }
    }
    rows.push(r);
  }
}
console.log(JSON.stringify(rows, null, 1));
