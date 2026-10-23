# archlang-3d spike（M0 最小可行性验证）

> **这是一次性验证代码，不是生产代码。** 目的：回答"能否由 ArchLang 已有的公开数据自动生成正确的 3D 模型，缺什么"。结论与完整分析见上一级的 [`development-plan.md`](../development-plan.md) §2.4 与 §11.7。不要把这里的 Python 当作 `archlang-3d` 的实现；生产版本是 TypeScript，见计划 §3。

## 目录

| 路径 | 内容 |
|---|---|
| `src/plan2glb.py` | Plan JSON（一层）→ GLB：shapely 做墙带与"最厚者拥有"裁剪、洞口切割，trimesh 挤出；窗下墙/过梁、地板、楼板、平屋顶、门窗（框+玻璃、门扇）、家具体块；节点名 `kind:id[:part]`，`extras.archlang`；输出确定 |
| `src/verify.py` | 对一个 GLB 与其 Plan JSON：节点普查、水密/负体积、包围盒、地板面积、**洞口射线探针**（沿宿主墙法线、±0.3 m、带对照射线）|
| `src/run_corpus.py` | 对 `json/` 里全部 Plan JSON 跑 `plan2glb` + 检查，写 `corpus-results.json` |
| `src/iou_walls.py` | 墙顶投影与 Plan JSON 墙带的 IoU（循环检查）|
| `src/iou_truth.py` | 以**核心自己的墙体连接输出**（`truth/`）为真值的平面投影 IoU |
| `src/net_area.py` | 房间可见地板面积 vs `describe()` 的 `net_area_m2`（ADR 0027）|
| `src/compare_hand.py` | 节点普查/包围盒，用来与宣传片的手建 GLB 对照 |
| `src/render_glb.py` | 无头 Blender 渲染 GLB（`iso` 切开式 / `top`），Cycles CPU |
| `tools/coverage.mts` | **IR 覆盖探针**：对每个示例 `resolveAll`，统计 3D 需要而 Plan JSON 没有的信息 |
| `tools/ir-sample.mts` | 打印被 Plan JSON 丢掉的 IR 事实（弧、楼梯、void、屋檐环、标高、派生墙）|
| `tools/joinery-dump.mts` | 导出核心 `joinWallSet` 的墙体轮廓作真值 |
| `tools/val/` | glTF-Validator 调用（`npm ci` 后 `node validate.mjs x.glb`）|
| `compile_all.sh` | 把示例编译成 Plan JSON（强制 `-o`；用 `ARCHLANG=…` 指定与示例同一检出构建的编译器）|
| `results/` | `corpus-results.json`（逐文件结果）、`coverage-ir.json`（IR 覆盖）|
| `requirements.txt` | shapely 2.2.0、trimesh 5.1.1（需要 `mapbox-earcut` 做多边形三角化，否则报 "No available triangulation engine!"）、numpy、scipy、rtree 等，已锁版本（Python 3.13）|

`json/ describe/ truth/ out/ renders/` 是可再生数据，见 `.gitignore`，不入库。

## 实测结果（2026-10-23；Linux x86_64、8 核、无 GPU；单机、非基准）

| 指标 | 结果 |
|---|---|
| Plan JSON → GLB 成功 | 37 / 39（失败的 2 个是 `relational`、`two-bed`：`walls from rooms` 的墙不在 `walls[]`，被显式拒绝）|
| 网格 | 37 份全部水密 |
| glTF-Validator | 0 错 0 警告 |
| 转换耗时 | 13–259 ms/份，中位 74 ms（含布尔与导出）|
| 确定性 | 同输入 3 次 SHA-256 相同，且与 `PYTHONHASHSEED` 无关 |
| laneway-house | 36 节点（6 墙、3 地板、1 楼板、1 屋顶、8 窗节点、5 门节点、12 家具）；洞口探针 8/8；地板面积 48.75 m² = Plan JSON |
| 与核心墙体连接的 IoU（35 个可比平面）| 29 个 ≥ 0.99，中位 1.0，最差 0.46（全部在弧墙平面）|
| 房间面积 vs `net_area_m2` | 165 / 176 间一致（容差 0.02 m²），11 个例外全在含弧/圆的平面 |
| IR 覆盖（32 个可编译示例）| 19 个只靠 Plan JSON 即可；**13 个（41%）需要 Plan JSON 没有的信息** |
| Blender 5.2.3 渲染（无 GPU，laneway，1000×800）| Cycles CPU 16 spp 约 4.2 s；EEVEE（`xvfb-run`，软件 GL）约 18.8 s；同机两次 Cycles 输出大小相同但 SHA-256 不同 |

## 发现

1. Plan JSON 对 3D **有损**：弧墙被静默压成弦；`walls from rooms` 的墙缺失；多层只有分开的文件，无层号与标高；楼梯/电梯/自动扶梯/void/屋檐环/室外面/栏栅全部缺失。→ 主输入通道必须是库 API `resolveAll`。
2. 已发布的 npm 版本（1.43.1）解析不了 `main` 的 3 个示例（`materials`、`relational`、`two-bed`）：下游要钉版本并同测"已发布/`main`"。
3. `joinWallSet`（核心）已经提供拐角/T 型/洞口的闭式结果，且其文档说明正是为"3D 挤出不应有第二套墙体连接"而拆出；计划建议加性导出它。
4. `archlang compile -f json` 不带 `-o` 会把 JSON 写在输入文件旁边。

## 复现

```bash
# 0) 取得 archlang 仓库的一个检出（与示例同一版本），并安装依赖
git clone https://github.com/ChanMeng666/archlang && cd archlang && npm ci --ignore-scripts && cd ..
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 1) 示例 → Plan JSON（用同一检出的编译器）
ARCHLANG="npx tsx archlang/src/cli.ts" bash compile_all.sh archlang/examples json

# 2) IR 覆盖与真值（在检出里运行 tsx）
(cd archlang && npx tsx ../tools/coverage.mts "$PWD" examples > ../coverage-ir.json)
(cd archlang && npx tsx ../tools/joinery-dump.mts "$PWD" ../truth)

# 3) 构建与对账
.venv/bin/python src/run_corpus.py                       # → corpus-results.json
.venv/bin/python src/plan2glb.py json/laneway-house.json out/laneway.glb --roof flat
.venv/bin/python src/verify.py out/laneway.glb json/laneway-house.json
.venv/bin/python src/iou_truth.py

# 4) 校验与渲染
(cd tools/val && npm ci && node validate.mjs ../../out/laneway.glb)
blender -b --factory-startup --python-exit-code 1 -P src/render_glb.py -- out/laneway.glb renders/iso.png iso 16
```

> 说明：`net_area.py` 另需 `describe/<name>.json`（`archlang describe <file> --json` 的输出）。
>
> **已在全新目录 + 全新 venv + 全新拷贝的仓库里按上面步骤复现（2026-10-23）：** 示例 → 39 份 Plan JSON；`coverage.mts` 得到 34 行；`joinery-dump.mts` 得到 37 份真值；`run_corpus.py` 得 37 个 ok、2 个 `NO_WALLS_IN_PLAN_JSON`；laneway-house 的 GLB 为 32 544 字节、SHA-256 `a969093c…8d1c`，与此前一次构建**逐字节相同**；`verify.py` 洞口探针 8/8。

## v0.4 深挖实验（库 API 通道；TypeScript，用 `tsx` 在已检出的核心仓库里运行）

结论与解释在 [`../research/`](../research/00-deep-dive-ranking.md)；这里只列脚本、用法与小结果。单机（Linux x86_64、8 核、无 GPU）、单次实验、**不是基准**。核心检出为 `main@98a4156`（根 `package.json` 1.43.1）。

| 脚本 | 回答的问题 | 结果文件 |
|---|---|---|
| `src/export_closure.mjs <core-root>` | C1/C2 要导出的名字的类型闭包；哪些根入口还没有 | （标准输出）|
| `src/h1_wall_ownership.mts <core-root>` | `joinWallSet` + `split.faceOf = id` 的每墙所有权（slots/solid 两种模式）| `results/h1_wall_ownership.json` |
| `src/h1_prism_check.mts <core-root>` | 所有权棱柱：面积/体积、开放边、切口对宿主、混合高度误差 | `results/h1_prism_check.json` |
| `src/ifc_probe_iflite.mts`、`src/ifc_probe_minimal_writer.mts`、`src/ifc_check.py`、`src/ifc_batch.sh`、`src/ifc_webifc_read.mjs` | IFC 两条路线：`@ifc-lite/create` 与自研最小 STEP 写入器（117 行）；IfcOpenShell 校验与体积读回；web-ifc 读取；`IFC_OPENING_MARGIN_MM`（默认 20）| `results/ifc_minimal_writer_summary.json` |
| `src/fixture_coverage.mts <core-root>`、`src/fixture_topn.py` | 核心 83 个家族/129 个词；示例里的使用频次与累计覆盖；A/B/C 分类的使用占比 | `results/fixture-families.json`、`fixture-classes.json`、`fixture_topn.json` |
| `src/stairs_probe.mts <core-root>` | 示例里的楼梯：层高、梯段、2R+G 与坡度 | `results/stairs_probe.json` |
| `src/skeleton_eval.mts <core-root> <dir>` | `straight-skeleton@1.1.0` 在 8 个真实屋檐环与 9 个合成多边形上的健壮性（`<dir>` 为其 `node_modules` 所在目录）| `results/skeleton_eval_v1.json` |
| `src/perf_budget.mts <core-root>` | 核心侧耗时：`resolvePlan`、所有权、盖面三角化 | `results/perf_budget.json` |
| `src/img_diff.py`、`src/three_headless.html` | 渲染确定性：逐像素比较（不比文件字节）；无头 three.js 渲染页 | （见 research/05）|
| `stress/s1…s11 *.arch` | 11 个合成压力平面：T/十字/Y/重复/窄缝/弧上开门/斜墙开门/锐角/共线异厚/混合高度 | — |

**需要额外安装（不在核心的依赖里，装在核心检出或脚本参数指定的目录）：** `earcut`（`h1_prism_check.mts`、`perf_budget.mts`，v3 的默认导出写法见脚本）、`@ifc-lite/create` 与 `web-ifc`（IFC 脚本）、`straight-skeleton@1.1.0`（`skeleton_eval.mts`）、Python 的 `ifcopenshell`（`ifc_check.py`）、`typescript@5`（`export_closure.mjs` 经核心的 TypeScript 运行）。注意：核心的 `npm ci` 会清掉手动加在其 `node_modules` 里的包，需重装。

要点（详见 research）：IFC 批处理用空虚拟世界，故 `imports`、`museum-wings` 未含（43 = 34 − 2 + 11）；`h1_wall_ownership.mts` 的虚拟世界没有放进 `museum-wing.arch`，故 `museum-wings` 报 `no-ir`，`h1_prism_check.mts` 用含全部示例的虚拟世界；`ifc_probe_minimal_writer.mts` 的外扩默认值是 20 mm，设 `IFC_OPENING_MARGIN_MM=0` 可复现 IfcOpenShell 对弧墙共面切口的静默失败。

## 局限

- 上面「实测结果」表只覆盖 Plan JSON 通道（Python）；库 API 通道的 TypeScript 实验见「v0.4 深挖实验」一节（仍是一次性实验，不是 M0 的 S1–S3 的生产实现）。
- 家具高度是**未经来源核对的猜测值**（`plan2glb.py` 里的 `FURN_H`），仅用于让模型有体积；生产版本以资产 manifest 为准。
- 弧墙平面在此通道上不可靠（见发现 1）；屋顶只有平板。
- 样本只有 34 个示例，不代表所有可能的平面。
