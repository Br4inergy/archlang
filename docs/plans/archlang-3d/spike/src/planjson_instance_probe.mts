// What does Plan JSON hold for a placed component that derives its walls (`walls from rooms`)?
// The plan is the one in the core's test/plan-json-instances.test.ts (two placed units); the probe prints
// the Plan JSON shape and the resolved wall count, so the result can be compared across core commits.
// Usage: tsx planjson_instance_probe.mts <core-root>
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const src = (p: string) => import(path.join(root, "src", p));
const { resolvePlan } = await src("analyze.ts");
const { planToJson } = await src("plan-json.ts");

const unit = `  component unit() {
    room id=liv at (0,0) size 5000x4000 label "Living" uses living
    room id=kit at (5000,0) size 3000x4000 label "Kitchen" uses kitchen
    room id=bed at (0,4000) size 5000x3000 label "Bed" uses bedroom
    walls from rooms exterior 200 partition 100 { open between liv and kit }
    door id=d between liv and bed at 800 from start width 900 swing in
  }
`;
const root1 = `  room id=lobby at (0,8000) size 6000x2000 label "Lobby" uses hall
  wall id=lw exterior thickness 200 { (0,8000) (6000,8000) (6000,10000) (0,10000) close }
`;
const places = `  place unit() as west at (0,0)
  place unit() as east at (20000,0) rotate 90 mirror x
`;
const source = `plan "Twin units" {\n  units mm\n${root1}${unit}${places}}\n`;

const res = resolvePlan(source);
const derived = res.ir ? res.ir.walls.filter((w: { _derived?: boolean }) => w._derived).length : -1;
const pj = planToJson(source);
const json = pj.json as Record<string, unknown[]> | undefined;
console.log(
  JSON.stringify(
    {
      irWalls: res.ir?.walls.length,
      irDerivedWalls: derived,
      planJsonOk: Boolean(json),
      diagnostics: pj.diagnostics.map((d: { code?: string; severity: string }) => `${d.severity}:${d.code ?? "?"}`),
      keys: json ? Object.keys(json) : [],
      walls: json?.walls?.length,
      components: json?.components?.length,
      instances: json?.instances?.length,
    },
    null,
    2,
  ),
);
