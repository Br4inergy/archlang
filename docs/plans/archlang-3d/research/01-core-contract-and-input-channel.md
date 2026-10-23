# 01 · 核心契约与输入通道：核对 `main@98a4156` 的真实导出面

> 状态：已深挖（实测）· 日期：2026-10-23（v0.5：Q18 已决定；v0.6，2026-10-24：在 `main@1a1efd9` 重核，见 §2.5）· 属于 [`00-deep-dive-ranking.md`](00-deep-dive-ranking.md) 的第 1 位 · 上游：主文档 [§2](../development-plan.md)（输入契约）、§2.6–§2.8（核心 C1/C2 与配合事项）
>
> 标记：**[实测]** 在 `main@98a4156`（PR #229 的合并提交，根 `package.json` 1.43.1）的检出里用脚本运行得到；**[读码]** 读源码得到、未运行；**[待核实]** 未验证。脚本在 [`../spike/src/`](../spike/README.md)，结果在 `../spike/results/`。**v0.6 更正（2026-10-24）：**下文 §2.1 的"10 个直接类型"少算了两个，正确的闭包是 **13 个类型 + `AnalyzeOptions`**，以 §2.5 为准。

## 1. 问题定义

计划的主通道 A 是"库 API"：`compile(src, {world}).ast` → `resolveAll(ast)` → `PlanResolution`，再用 `joinWallSet`、`doorSwing` 取墙体轮廓与门扇姿态（C1/C2 要求核心导出它们）。这条链上有三个可以在写第一行 TypeScript 之前就核对的问题：

1. C1/C2 要导出的名字，其**签名可达的类型闭包**到底有多大（附录 H 第 19 项）；
2. `compile().ast` 与 `resolveAll` 组合，对带 `import` 的平面是否真的给出完整元素（计划 §2.1 默认它成立）；
3. `joinWallSet` 的**真实**签名与返回，是否支持"每墙一个多边形"（H1 的前提）。

## 2. 当前证据

### 2.1 根入口现状 [实测]

`src/index.ts` 共 461 个导出名（`main@98a4156`；`main@1a1efd9` 为 462，见 §2.5）。用 TypeScript 编译器 API 解析导出集合（[`export_closure.mjs`](../spike/src/export_closure.mjs)）：

| 类别 | 已导出 | **未导出** |
|---|---|---|
| 函数 | `resolve`、`resolveAll`、`levelBlocks`、`makeVirtualWorld`、`NULL_WORLD` | `joinWallSet`、`loopsToPolygons`、`doorSwing`、`resolvePlan`、`parse`、`link` |
| IR 类型 | `PlanResolution`、`ResolvedLevel`、`ResolvedPlan`、`ResolvedElement`、`RWall`、`RDoor`、`RWindow`、`RRoom`、`RFurniture`、`RColumn`、`Point`、`DoorKind` | `Opening`、`RStair`、`RRoof`、`RVoid`、`ROpening`、`RElevator`、`REscalator`、`ROutdoor`、`RFence` |
| 门/连接类型 | — | `DoorLike`、`DoorSwing`、`DoorSwingDir`、`DoorHinge`、`Arc`、`Edge`、`EdgeLoop`、`JoinedWallSet`、`JoinedCut`、`JoineryResult`、`JoinerySplit`、`JoinableWall`、`WallSegment` |

`joinWallSet`/`doorSwing` 的签名直接可达、而根入口没有的类型共 **10 个**：`Arc`、`EdgeLoop`、`JoinedCut`、`JoinedWallSet`、`JoineryResult`、`JoinerySplit`、`Opening`、`DoorLike`、`DoorSwing`，以及泛型参数 `W`（泛型参数不是导出项）。再加经由 `DoorLike` 间接到达的 `DoorHinge`、`DoorSwingDir`（定义在 `src/grammar/tokens.ts`，根入口只有同文件的 `DoorKind`）。

结论（**v0.4 的读数；v0.6 已更正**：旧脚本 `export_closure.mjs` 不跟随泛型约束与类型别名，漏了 `JoinableWall`（`W extends JoinableWall`）与 `Edge`（`EdgeLoop = Edge[]` 经别名），并把泛型参数 `W` 算成了导出项；正确的数字见 §2.5）：**C1 的类型闭包 = 上表"未导出"的函数 + 10 个直接类型 + 2 个门词汇类型**；`RStair`、`RRoof` 等元素类型**不是阻塞项**——`ResolvedElement` 已导出，下游可用 `Extract<ResolvedElement, { kind: "…" }>` 取得（`kind` 字面值 [读码]，类型层面可行性 [待核实]）；仍建议作为类型导出一并加入，成本为零。

### 2.2 通道 A 的陷阱：`compile().ast` 是未链接的 AST [实测]

在 `imports.arch`（引用 `lib/` 下的构件）上：

- `compile(src, { world })` 与 `describe` 看得到被导入的家具与门；
- 但 `resolveAll(compile(src, { world }).ast)` 只返回 **3 个元素**（墙、房间、尺寸线）——**被导入的内容全部丢失，且没有任何诊断**。

原因 [读码+实测]：`compile().ast` 是 `parse` 的输出，`link`（展开 `import`/`place`）发生在核心内部的 `resolvePlan(source, { world })`（`src/analyze.ts`，lint/repair/finish/suggest 都经由它）。`parse`、`link`、`resolvePlan` 均未导出。`resolvePlan` 返回 `{ ir | null, diagnostics, levels }`。

后果：计划 §2.1/§2.4 把通道 A 写成"`compile().ast` → `resolveAll`"，对 **`imports`、`museum-wings` 以及任何用 `import`/`place` 的平面** 是错的。这不是风险，是已测得的缺陷。

### 2.3 `joinWallSet` 的真实形状 [读码+实测]

```text
joinWallSet(walls, groupKeys, split?) -> { result: JoineryResult, cuts: JoinedCut[] } | null
split = { faceOf: (w) => string, faces: string[] }   // 填充 result.split
JoinerySplit = { fills: [{ group, face, loops }], faces: [{ face, runs }] }
```

- `JoineryWall.group` 来自 `hatchKey(hatchOf(w))`，**不是**调用方给的"分组键"——所以主文档 H1 写的"以每面墙 `id` 作分组键"在字面上不成立；**成立的是 `split.faceOf = w => w.id`**（见 [`02-wall-geometry.md`](02-wall-geometry.md)）。
- 弧是精确的 `Edge`（`{ t: "line" | "arc" }`）；离散化步长 `ARC_STEP_DEG = 7.5`，在 `loopsToPolygons` 里做。
- `DoorLike = { at, width, hinge, swing, host: { a, b, thickness, arc? } | null, doorKind? }` → `DoorSwing { hinge, farJamb, leafEnd, radius, sweep }`；未被墙承载或非平开门返回 `null`。

### 2.4 与 ADR 0021 及 backlog 的关系 [读码]

- ADR 0021 的轴测视图（`src/view/`、`toIso`、`--view`）已弃用，**backlog V.5（2.0 移除）仍为 todo**。`src/view/extrude.ts` 是 `joinWallSet` 的消费者之一，但不是唯一的：`src/wall-lowering.ts`（两处，其中一处带 `faceOf` 拆分）与 `src/analyze/wall-faces.ts` 也调用它 [读码：`grep` 调用点]。所以 2.0 移除视图后 `joinWallSet` 仍留在核心里，而且 `split`（`faceOf`）这条路径已被核心自己使用——这是 H1 依赖它的好消息。C1 的导出等于把一个内部函数提升为公共契约，ADR 0031 要写明它与视图移除无关。
- backlog V.1（不同高度墙的接头互相穿插）为 won't-fix：核心不会替 3D 解决混合高度（见 02）。
- 最新 ADR 编号为 0029，计划占用的 0030/0031 仍空闲 [实测：`docs/adr/` 目录列表；v0.6 于 2026-10-24 在 `main@1a1efd9` 复核相同，且远端分支里没有 0030 以上的 ADR]。
- `docs/agents/iron-laws.md`：`MODEL_RANGE_MM = 2^25`（`E_OUT_OF_RANGE`），3D 的微米量化（×1000）最大 ≈ 3.4×10^10 < 2^53，安全 [算术]。

### 2.5 v0.6 重核：`main@1a1efd9`（#233 合并提交，2026-10-24 00:44 NZDT）[实测]

自 `98a4156` 起新增 #230（segment 选择器）、#231（`at <pct>%` 精确解析）、#232（PS3.9：Plan JSON 带"组件推导墙"）、#233（首次接触复核，只含测试与审计文档）。脚本：[`export_surface.mjs`](../spike/src/export_surface.mjs)（导出面与声明位置）、[`export_closure_refs.mjs`](../spike/src/export_closure_refs.mjs)（闭包，与核心 `public-surface` 测试同法）、[`resolveplan_levels_probe.mts`](../spike/src/resolveplan_levels_probe.mts)、[`resolveplan_import_probe.mts`](../spike/src/resolveplan_import_probe.mts)；两个提交各跑一遍，结果在 `../spike/results/`。

**与 v0.4/v0.5 的逐项对比（`98a4156` → `1a1efd9`）：**

| 项 | 结果 |
|---|---|
| 根导出名 | 461 → 462：**只多类型 `SegmentSelect`**（来自 `export type * from "./ast.js"`，`src/index.ts` 本身无 diff）；**没有删除** |
| `resolvePlan`、`AnalyzeOptions`、`joinWallSet`、`loopsToPolygons`、`doorSwing`、`DoorLike`、`DoorSwing`、`JoinerySplit`、`JoinedWallSet`、`JoinedCut` | 文件、行号与声明文本**逐项相同**：`resolvePlan` `src/analyze.ts:99`、`AnalyzeOptions` `:57`、`joinWallSet` `src/wall-lowering.ts:130`、`loopsToPolygons` `src/geometry/joinery.ts:1223`（**`const` 箭头函数**，不是 `function`）、`doorSwing` `src/geometry.ts:175`；仍均**未导出** |
| `DoorHinge`、`DoorSwingDir`、`DoorLike`、`DoorSwing`、`Arc`、`Edge`、`EdgeLoop`、`JoinableWall`、`JoinedCut`、`JoinedWallSet`、`JoineryResult`、`JoinerySplit`、`Opening`、`AnalyzeOptions` | 仍均**未导出**；`DoorKind` 是门类型里唯一已导出的 |
| 签名闭包（遇到根入口已有的名字就停）| 缺 **14 个名字** = 13 个类型 + `AnalyzeOptions`：`AnalyzeOptions`、`Arc`、`DoorHinge`、`DoorLike`、`DoorSwing`、`DoorSwingDir`、`Edge`、`EdgeLoop`、`JoinableWall`、`JoinedCut`、`JoinedWallSet`、`JoineryResult`、`JoinerySplit`、`Opening`。按根函数分：`resolvePlan` 1（`AnalyzeOptions`）、`joinWallSet` 9、`loopsToPolygons` 3（`Arc`、`Edge`、`EdgeLoop`）、`doorSwing` 5 |
| 与 v0.4 的差别 | v0.4 的"10 个直接类型"含泛型参数 `W`（不是导出项），并**漏了 `JoinableWall` 与 `Edge`**；实际为 13 个类型 + `AnalyzeOptions`。`RWall.arcs` 已经通过已导出的 `RWall` 暴露 `Arc`，所以 `Arc` 是**现存**的洞 |
| 完整传递闭包（不在已导出名处停；与现有测试字面同法）| 从 `resolvePlan` 出发 139 个自有类型、**40 个未导出**（含上面的 13 个、C2 的 8 个，另 27 个：`FurnitureAuthored`、`WallRelation`、`OpeningRelation`、`RelConstraint`、`RInstance`、`RWallsFromRooms`、`RoomDatums`、`DatumTable`、`DatumAccess`、`DatumAxis`、`DatumRefusal`、`WallSegment`、`Frame`、`Side`，以及解析器内部的 `Token`、`TokenType`、`Expr`、`BinOp`、`Value`、`Env`、`ParseExprOpts`、`ParamDoc`、`DoorHingeNear`、`DoorSlideDir`、`DoorSwingBuilding`、`AccessibleOptions`、`Bounds`）。这是 `ResolvedPlan` 本来就有的洞，**不是 C1 引入的**；C1 取"遇到已导出名即停"的范围 |
| `ResolvedElement` 联合的成员 | 9 个根入口没有名字：C2 的 8 个 + `RWallsFromRooms`（C2 的清单少了它；适配器不需要，派生墙在 `ir.walls`）|
| 假设 C1 + C2 的 26 个名字已导出 | 闭包不再缺任何名字，也没有重名；根导出 462 → **488** |
| `@experimental` 一类约定 | `src/`、`docs/agents/`、`docs/adr/` 无此词；`@internal` 在 3 个文件里表示"非公共、未从根入口再导出" |
| 带 `import` 的平面（`resolvePlan` 与未链接路径）| `imports`：8 个元素 vs 3；`museum-wings`：42 vs 8（墙 10 vs 2）；`laneway-house`：29 vs 29（单文件）；两个提交结果相同。`room`/`furniture` 元素个数等于 `describe()` 的 `rooms`/`furniture` 个数 |
| `levels` 的形状 | `ResolvedLevel = { level, name?, ir, diagnostics }`；`townhouse` 3 层、`two-storey` 2 层、`hillside-villa`（levels 与 `place` 并存）2 层；`one-room` 的 `levels` 为 `[]` 且 `ir.level` 未定义；`ir` 是最低一层 |

**稳定性等级的证据与建议**见 ADR 0031 草案与主文档 §2.7 的"稳定性等级"行：`resolvePlan` 被 `src/` 里 12 个模块与 32 个测试文件使用，`planToJson`、`describe()`、`lint()` 都建在它上面；没有任何 workspace 包使用它；核心约定只有"公共 / `@internal`"两档；`exports` 只有 `"."` 与 `"./link"`；`CHANGELOG.md` 声明 SemVer，ADR 0018 记载 `src/index.ts` 是 append-only。建议：公共、只增不删、窄承诺，不设 `@experimental` 档；**决定权在核心维护者**。

**Plan JSON 通道的影响**（#232 等）见主文档 §2.4 末："13/32"不变；#232 让"组件推导墙"的新平面不再被拒绝，但 Plan JSON 带的是语句、不是墙。

**未核实：**核心维护者是否接受建议、弃用窗口、`resolvePlan` 签名的历史变更（公开仓库历史从 2026-10-14 起、共 295 个提交）、嵌套 `place` 跨多层的 `levels` 语义（只测了 5 个示例）、`ResolvedPlan` 另外 27 个未导出类型是否有适配器要用的（主文档附录 H 第 38 项）。

## 3. 方案比较

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A1（推荐）** C1 增加导出 `resolvePlan`（+ `AnalyzeOptions`）| 3D 直接 `resolvePlan(source, { world })` 取 `{ ir, diagnostics, levels }`；与 lint/finish 走同一条路 | 一次覆盖 import；诊断一并拿到；不改任何现有输出 | 又一个公共契约；需 ADR 0031 登记稳定性 |
| A2 导出 `parse` + `link` | 3D 自己组合 | 更细粒度 | 契约面更大；`link` 的选项/诊断语义要一并稳定 |
| A3 走 Plan JSON（通道 C）| 放弃对 import 平面的库通道 | 无核心改动 | **有损**：弧被压成弦、`walls from rooms` 缺失（spike 实测 37/39 + IoU 0.46），已被否决 |
| A4 deep-import `dist/analyze.js` | 原型期权宜 | 零核心改动 | 违反 R1 的初衷，升级即坏 |

## 4. 推荐与理由

**A1**：把 `resolvePlan` 与 `AnalyzeOptions`（类型）加入 C1，并在 C1 的验收里加一条"对 `imports.arch`、`museum-wings.arch` 经此函数得到的 `ir.elements` 数量等于 `describe` 看到的元素数"。理由：这是**唯一**能让通道 A 对全部 34 个示例成立的最小增量，且与核心已有内部路径一致。它改变主文档 C1 的范围，故列为 **Q18**（主文档 §10.2；**所有者已于 2026-10-24 决定采纳 A1**，`resolvePlan` 的稳定性等级：v0.6 已给出建议（§2.5、ADR 0031 草案），待核心评审，附录 H 第 31 项；行为用例按 §2.5 的实测值写成"`room`/`furniture` 元素个数等于 `describe()` 的个数"）。

## 5. 风险与未验证项

- `resolvePlan` 的返回形状在核心内部可能变化（它现在是内部函数）：ADR 0031 草案建议声明为"公共、只增不删、窄承诺"（见 §2.5）。v0.6 读了 `packages/mcp/scripts/check-core-exports.ts`：它只检查 mcp shim 运行时加载的**子路径**，**不会**守住根入口的名字，所以守护靠核心 `test/public-surface.test.ts` 的扩展与下游的导出面快照测试 [读码；未运行，附录 H 第 28 项]。
- `levels` 的语义：v0.6 实测每层一份 `ir`（`ResolvedLevel = { level, name?, ir, diagnostics }`），单层为 `[]`；`place` 嵌套多层仍只测了 5 个示例，未穷举 [待核实]。
- `main` 之后的新提交会改变上表；C1 的 PR 提交时必须重跑 `export_closure_refs.mjs`（v0.6；取代少算两个的 `export_closure.mjs`）与 `export_surface.mjs`。
- 本文只核对了 `src/index.ts`、`src/ir.ts`、`src/analyze.ts`、`src/wall-lowering.ts`、`src/geometry/*`、`docs/agents/`、`docs/adr/` 的目录与相关段落，未通读核心。

## 6. 对计划的影响

| 项 | 变化 |
|---|---|
| 核心 C1 | 新增 `resolvePlan`、`AnalyzeOptions`、`DoorHinge`、`DoorSwingDir` 与其余类型——**v0.6 更正：共 13 个类型 + `AnalyzeOptions`**，另加 `joinWallSet`/`loopsToPolygons`/`doorSwing`；元素类型（`RStair` 等）建议同批类型导出 |
| 主文档 §2.1/§2.4/§2.6 | 通道 A 的写法改为 `resolvePlan`；"`compile().ast`"仅用于单文件无 import 的情形 |
| Q 编号 | 新增 **Q18**（C1 范围增加 `resolvePlan`；**已决定**，2026-10-24）；Q3 的落实方式随之细化 |
| 里程碑 | M0 的 S1 适配器改走 `resolvePlan`，**工时不变**；C1 的 PR 描述多一项 |
| 附录 H | 第 19 项由"待核实"改为已核（闭包清单；v0.6 更正）；新增第 31 项（`resolvePlan` 稳定性与 `levels` 语义；v0.6 部分已核）；v0.6 另新增第 38–40 项 |

## 7. 需要核心仓库做的事

1. C1 增加：`resolvePlan`、`AnalyzeOptions`、`doorSwing`、`joinWallSet`、`loopsToPolygons` 及上述类型（类型只导出，不改实现）。
2. ADR 0031：登记以上为 3D/IFC 消费的稳定契约，并写明与 backlog V.5（视图移除）无关。
3. 不需要新增 IR 字段。
