/** What the core knows about stairs, and what a comfortable flight would need. Usage: tsx stairs_probe.mts <core-root> */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
const root = path.resolve(process.argv[2]!);
const src = (p: string) => import(pathToFileURL(path.join(root, "src", p)).href);
const { resolvePlan } = await src("analyze.ts");
const { makeVirtualWorld } = await src("world.ts");
const exDir = path.join(root, "examples");
const files: Record<string, string> = {};
for (const f of readdirSync(path.join(exDir, "lib")))
  files["lib/" + f] = readFileSync(path.join(exDir, "lib", f), "utf8");
for (const f of readdirSync(exDir).filter((x) => x.endsWith(".arch")))
  files[f] = readFileSync(path.join(exDir, f), "utf8");
const world = makeVirtualWorld(files);
const rows: any[] = [];
let totalStairs = 0;
for (const f of Object.keys(files)
  .filter((k) => k.endsWith(".arch") && !k.startsWith("lib/"))
  .sort()) {
  const r = resolvePlan(files[f]!, { world });
  if (!r.ir) continue;
  const storeys = r.levels.length ? r.levels.map((l: any) => ({ n: l.level, ir: l.ir })) : [{ n: 0, ir: r.ir }];
  for (const s of storeys)
    for (const e of s.ir.elements)
      if (["stair", "elevator", "escalator"].includes(e.kind)) {
        totalStairs++;
        const next = storeys.find((t: any) => t.n > s.n && t.ir.elements.some((x: any) => x.id === e.id));
        const _prev = storeys.find((t: any) => t.n < s.n);
        const above = storeys.find((t: any) => t.n > s.n);
        const rise = above ? above.ir.elevation - s.ir.elevation : null; // floor-to-floor to the NEXT storey (what an up-run climbs)
        const run = e.kind === "stair" ? Math.max(e.size.w, e.size.h) : null,
          _wid = e.kind === "stair" ? Math.min(e.size.w, e.size.h) : null;
        let n: number | null = null,
          going: number | null = null,
          riser: number | null = null,
          blondel: number | null = null;
        if (rise && run && e.kind === "stair") {
          n = Math.ceil(rise / 190);
          riser = rise / n;
          going = run / (n - 1);
          blondel = 2 * riser + going;
        }
        // n-free alternative: pick the riser count that puts 2R+G closest to 625 mm (midpoint of the 600-650 band) with 150 <= R <= 220
        let best: any = null;
        if (rise && run && e.kind === "stair")
          for (let k = Math.ceil(rise / 220); k <= Math.floor(rise / 150); k++) {
            const R = rise / k,
              G = run / (k - 1),
              b = 2 * R + G;
            if (!best || Math.abs(b - 625) < Math.abs(best.b - 625))
              best = { n: k, R, G, b, pitchDeg: (Math.atan(R / G) * 180) / Math.PI };
          }
        const adk =
          best &&
          best.R >= 150 &&
          best.R <= 220 &&
          best.G >= 220 &&
          best.G <= 300 &&
          best.pitchDeg <= 42 &&
          best.b >= 550 &&
          best.b <= 700;
        rows.push({
          plan: f,
          level: s.n,
          id: e.id,
          kind: e.kind,
          best: best && {
            n: best.n,
            riser_mm: Math.round(best.R),
            going_mm: Math.round(best.G),
            blondel: Math.round(best.b),
            pitchDeg: +best.pitchDeg.toFixed(1),
            withinEnglandAdK: !!adk,
          },
          dir: e.dir ?? null,
          size: `${e.size.w}x${e.size.h}`,
          connectedAbove: !!next,
          rise_mm: rise,
          riserCount: n,
          riser_mm: riser && Math.round(riser),
          going_mm: going && Math.round(going),
          blondel_2R_plus_G: blondel && Math.round(blondel),
        });
      }
}
console.log(JSON.stringify({ totalStairLikeElements: totalStairs, rows }, null, 1));
