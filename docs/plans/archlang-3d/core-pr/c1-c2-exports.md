# 核心 PR 草案：C1/C2 导出（`resolvePlan`、`joinWallSet`、`doorSwing` 等）

> **状态：草案，只有文字，没有任何核心源码改动。** 本文给**核心仓库**的维护者提 PR 时用，分两部分：**第一部分**是可直接粘贴进 GitHub 的英文 PR 正文（按核心 `.github/PULL_REQUEST_TEMPLATE.md` 的五节：Description / Related Issue / Type of Change / How Has This Been Tested? / Checklist）；**第二部分**是中文的"提 PR 之前"清单（核对最新 `main`、闭包重推导命令、要改的文件、CHANGELOG 条目草案、契约测试要点、验收命令与预期、已知风险）。**PR 与 ADR 0031 都还需要所有者手动提交**；本目录不替你提交，也不改核心。
>
> **证据口径：** 文中的行号、导出数、闭包名单都是 2026-10-24 在 `main@1a1efd9`（PR #233 合并提交，2026-10-24 00:44 NZDT）上读码或用 `spike/src/` 的脚本运行得到的 [实测]；预期数字（如 462 → 488）以"期间 `main` 没有其他导出变化"为前提，**提 PR 时必须重跑**。关联文档：[ADR 0031 草案](../adr-draft-0031-core-exports-for-downstream-3d.md)、主文档 [§2.6–§2.8](../development-plan.md)。

## 第一部分：PR 正文（英文，可直接粘贴）

建议标题（Conventional Commits）：`feat(exports): export resolvePlan, joinWallSet, loopsToPolygons and doorSwing with the types their signatures reach (additive; no output change)`

~~~~markdown
## Description

Export, from the package root, the four functions a downstream consumer needs to read a **resolved** plan and reuse the core's wall joinery and door-leaf geometry instead of re-implementing them, together with the types their signatures reach. Purely additive: `src/index.ts` gains 26 names (462 → 488), four declaration sites gain a JSDoc block, one contract test is added. No function body, cache key, backend, grammar, diagnostic or generated file changes; `compile()`, `describe()` and `lint()` output is byte-identical.

**Why.** The downstream 3D package planned in `docs/plans/archlang-3d/` (ADR 0030 draft) consumes resolved data. Three things it needs are not reachable from `@chanmeng666/archlang` today:

- `resolvePlan(source, { world })` (`src/analyze.ts`) — the complete parse → link → resolve path. `compile().ast` is the *unlinked* AST, and `resolveAll(compile(src).ast)` silently drops imported/placed content: on `main@1a1efd9`, `examples/imports.arch` gives 3 elements that way and 8 through `resolvePlan`; `examples/museum-wings.arch` gives 8 vs 42, with no diagnostic.
- `joinWallSet` (+ `loopsToPolygons`) — the wall-joinery seam, including its `split` argument that yields one ownership polygon per wall (ADR 0018: one joinery, not two).
- `doorSwing` — the one place that turns hinge/swing/host wall into the leaf's pose (ADR 0018's principle again).

The package `exports` map is `"."` and `"./link"` only, so none of these can be imported by name, and a deep import of `src/*` bypasses the published surface.

**What is exported**

| Kind | Names | Declared in |
|---|---|---|
| values | `resolvePlan` | `src/analyze.ts` |
| values | `joinWallSet` | `src/wall-lowering.ts` |
| values | `loopsToPolygons` | `src/geometry/joinery.ts` |
| values | `doorSwing` | `src/geometry.ts` |
| types (signature closure) | `AnalyzeOptions` | `src/analyze.ts` |
| types | `JoinableWall`, `JoinedCut`, `JoinedWallSet` | `src/wall-lowering.ts` |
| types | `JoineryResult`, `JoinerySplit` | `src/geometry/joinery.ts` |
| types | `Edge`, `EdgeLoop` | `src/geometry/band.ts` |
| types | `Arc` | `src/geometry/arc.ts` |
| types | `Opening` | `src/ir.ts` |
| types | `DoorLike`, `DoorSwing` | `src/geometry.ts` |
| types | `DoorHinge`, `DoorSwingDir` | `src/grammar/tokens.ts` |
| types (element names, C2) | `ROpening`, `RStair`, `RElevator`, `REscalator`, `RRoof`, `RVoid`, `ROutdoor`, `RFence` | `src/ir.ts` |

The 14 closure types are not typed by hand: they are what `test/public-surface.test.ts`'s own technique derives (breadth-first over type-reference nodes of each function's signature, stopping at names the root already exports). `RWall.arcs` already exposes `Arc` through an exported type, so that one is an existing hole.

**Stability level (proposed; see ADR 0031).** Public and append-only, like the rest of `src/index.ts` (ADR 0018). The commitment is narrow: the signature `resolvePlan(source, opts?) => { ir: ResolvedPlan | null; diagnostics: Diagnostic[]; levels: ResolvedLevel[] }` with fields only added; the documented semantics (never throws on user-source problems; `ir` is the lowest storey; `diagnostics` aggregates every storey; `levels` is `[]` for a single-storey plan); the shapes of the 14 types. Underscore-prefixed IR fields are not part of it. No `@experimental` tier is introduced (none exists in the repository). `resolvePlan` already has twelve callers under `src/` and 32 test files, so its shape is expensive to change today whether or not it is exported.

**Not in this PR:** new IR fields, new arguments, new diagnostic codes, `makeNodeWorld`, a lossless building JSON, a slab keyword, `parse`/`link`, or the other 27 own types that `ResolvedPlan` reaches and the root does not export (listed in the ADR, for a separate decision).

Also adds `docs/adr/0031-….md` (the exports, the stability level, the downstream contract).

## Related Issue

No issue. Context: ADR 0031 (this PR); the ADR 0030 draft and the programme plan under `docs/plans/archlang-3d/` (PR #235); backlog P3-2 (IFC4 export — the IR fields it needs already exist and are read through these exports; none is added here).

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [x] Documentation update

## How Has This Been Tested?

New: `test/public-surface.test.ts` — the closure walk now also starts from the signatures of the four functions (type parameters, parameters, return type; never the body) and requires every own type reached to be exported from `src/index.ts`; it also asserts the four values exist on the root namespace and the eight element type names (C2, which belong to no signature closure) are exported from a short list, and that the walk is not vacuous (it must reach `JoinedCut` through `joinWallSet` and `DoorSwingDir` through `doorSwing`). A behavioural case compares `resolvePlan(source, { world })` for `imports`, `museum-wings` and `laneway-house` with `describe()`: the number of `room` elements equals `describe().rooms.length` and the number of `furniture` elements equals `describe().furniture.length`.

Before the change (on `main@1a1efd9`) the extended closure walk reports exactly the 14 type names above as missing; after it, nothing.

Commands run from the repository root; results: <paste the actual results before opening the PR>

```
npm run typecheck           # <result>
npm run lint                # <result>
npm run check:test-wiring   # <result>
npm test                    # <result: test files / tests passed; byte-identity suites included>
npm run check:drift         # <result: no drift; examples/*.svg unchanged>
npm run build               # <result>
node -e "import('./dist/index.js').then(m => console.log(['resolvePlan','joinWallSet','loopsToPolygons','doorSwing'].map(n => typeof m[n]).join()))"   # expect: function,function,function,function
```

## Checklist

- [ ] My commits follow the [Conventional Commits](https://www.conventionalcommits.org/) style
- [ ] I have tested my changes locally
- [ ] I have updated documentation where needed (`CHANGELOG.md` `[Unreleased]`, `docs/adr/0031-….md`, JSDoc on the four declarations)
- [ ] I agree to follow this project's [Code of Conduct](https://github.com/ChanMeng666/archlang/blob/main/CODE_OF_CONDUCT.md)
~~~~

## 第二部分：提 PR 之前的清单（中文）

### 1. 核对最新 `main` 上的导出状态

```bash
git fetch origin main && git rev-parse origin/main          # 记下哈希；2026-10-24 的读数是 1a1efd9e8c9615ac21fab21644428e166f4a975a
git ls-tree -r origin/main --name-only | grep '^docs/adr/' | sort | tail -3   # 最大编号；2026-10-24 为 0029，0030/0031 空闲
git ls-remote --heads origin | grep -i adr                  # 有没有别的分支已占用 0030/0031
grep -nE "joinWallSet|loopsToPolygons|doorSwing|resolvePlan|AnalyzeOptions" src/index.ts   # 预期：无输出（尚未导出）
```

- 若 `src/index.ts` 已出现其中任何一个名字（别人先导出了），把清单里对应项划掉，并在 PR 正文的"What is exported"表里同步。
- 若 ADR 0030/0031 已被占用：两份草案一起顺延编号，并同步全文里的 `0030`/`0031` 引用（草案、主文档 §1.6/§0.3、README）。

### 2. 闭包重推导命令（`main` 一动就重跑）

在核心仓库检出里（需要 `node_modules` 里有 `typescript`，即先 `npm ci`），把本目录 `spike/src/` 的脚本拿过来运行：

```bash
node <本目录>/spike/src/export_closure_refs.mjs . /tmp/closure.json    # 签名闭包（与 public-surface 测试同法）
node <本目录>/spike/src/export_surface.mjs . /tmp/surface.json          # 根导出名 + 各声明的文件:行
```

**当前预期（`main@1a1efd9`）：** `index.ts export count: 462`；"frontier closure"（遇到根入口已导出的名字就停）总共缺 **14 个**：`AnalyzeOptions`、`Arc`、`DoorHinge`、`DoorLike`、`DoorSwing`、`DoorSwingDir`、`Edge`、`EdgeLoop`、`JoinableWall`、`JoinedCut`、`JoinedWallSet`、`JoineryResult`、`JoinerySplit`、`Opening`；"full transitive closure"（与现有测试字面同法，不在已导出名处停）从 `resolvePlan` 出发会得到 139 个自有类型、其中 40 个未导出，整体缺 49 个——**这是 `ResolvedPlan` 本来就有的洞，PR 范围取 frontier，不取 full**（理由见 ADR 0031 的 Alternatives）；末尾的 `proposal` 段应显示"collision check: none"与"still missing after the proposal: nothing"。

**合入后的预期：** 同一脚本显示 `index.ts export count: 488`（= 462 + 4 个值 + 14 个类型 + 8 个 C2 类型名）、frontier 缺 0 个，`collision check` 会列出这 26 个名字（因为它们此时已经导出）。旧脚本 `export_closure.mjs` 少算两个（`JoinableWall`、`Edge`：它不跟随泛型约束与类型别名），**请用 `export_closure_refs.mjs`**。

### 3. 要改的文件清单

| 文件 | 改动 | 备注 |
|---|---|---|
| `src/index.ts` | 新增一个带注释的导出块（放在现有 `resolveAll`/`PlanResolution`、`ResolvedLevel` 那组导出之后，约第 323–342 行）：4 个值 + 22 个类型名（14 + 8），逐个 `export { … } from "./模块.js"` / `export type { … } from "./模块.js"`，按声明所在模块分组：`analyze.js`、`wall-lowering.js`、`geometry/joinery.js`、`geometry/band.js`、`geometry/arc.js`、`ir.js`、`geometry.js`、`grammar/tokens.js` | 文件现为 552 行；该文件按 ADR 0018 是 append-only，只追加 |
| `src/analyze.ts`、`src/wall-lowering.ts`、`src/geometry.ts`、`src/geometry/joinery.ts` | 只在 `resolvePlan`（第 99 行）、`joinWallSet`（第 130 行）、`doorSwing`（第 175 行）、`loopsToPolygons`（第 1223 行，是 `const` 箭头函数）的既有 JSDoc 里**追加**稳定性说明；不改函数体 | 行号以重跑 `export_surface.mjs` 为准。追加的是注释，输出字节不变，但这是改 `src/` 文件，PR 里要说明 |
| `test/public-surface.test.ts` | 见第 5 节 | 现有 5 个 `it`；不新增测试文件，所以 `check:test-wiring` 不受影响 |
| `CHANGELOG.md` | `[Unreleased]` → `### Added` 一条（第 4 节） | 核心发版步骤（CONTRIBUTING）：发版时再更新 CHANGELOG 版本头与根 `package.json` 版本；功能 PR 只写 `[Unreleased]`（待核实：功能 PR 是否也要动版本号，按近期已合并 PR 的做法为准）|
| `docs/adr/0031-….md` | 由本目录的 `adr-draft-0031-core-exports-for-downstream-3d.md` 改写：相对链接改成同目录写法（如 `0018-zero-dep-wall-joinery.md`），去掉中文"草案说明"，Status 保持 Proposed（由评审改为 Accepted）| 合入 `docs/adr/` 后会被文档站发布：其中不得有未静态化的 arch 围栏（草案里没有）；表格单元格里的竖线（包括代码片段里的）须写成反斜杠加竖线（`docs-table-pipes` 测试；本目录的文件已按此检查）|
| **不改** | `compile()`、缓存键、各后端、语法、`describe()/lint()`、`examples/`、任何生成产物（`schemas/`、`spec.llm.md`、`docs/error-codes.md`、`src/context-size.ts` 等）、`docs/backlog.md`（P3-2 条目在 M5 开工时另改）、`packages/*` | `check:drift` 验证 |

### 4. CHANGELOG 条目草案（英文，放进 `[Unreleased]` → `### Added`）

```markdown
- Package-root exports for downstream consumers of a resolved plan (ADR 0031). `resolvePlan` (the
  complete parse → link → resolve path; unlike `resolveAll(compile(src).ast)` it keeps imported and
  placed content), `joinWallSet` and `loopsToPolygons` (the wall-joinery seam, including the `split`
  argument that yields one ownership polygon per wall), and `doorSwing` (the door leaf's pose) are now
  exported, with the 14 types their signatures reach (`AnalyzeOptions`, `JoinableWall`, `JoinedWallSet`,
  `JoinedCut`, `JoineryResult`, `JoinerySplit`, `Edge`, `EdgeLoop`, `Arc`, `Opening`, `DoorLike`,
  `DoorSwing`, `DoorHinge`, `DoorSwingDir`) and the element type names `ROpening`, `RStair`,
  `RElevator`, `REscalator`, `RRoof`, `RVoid`, `ROutdoor`, `RFence`. Append-only like the rest of
  `src/index.ts`; the stability level is recorded in ADR 0031. `test/public-surface.test.ts` now also
  derives the closure of these signatures. Output byte-identical.
```

（核心 CHANGELOG 里已有 `### Changed — internal, output byte-identical` 小节的写法；这一条是新增导出，放 `### Added`，句末写明字节不变。）

### 5. 契约测试要点（沿用 `test/public-surface.test.ts` 的推导法）

1. **不手写清单。** 现有测试的做法：用 `ts.createProgram` 读仓库真实的 `tsconfig.json`，从 `SceneSummary` 的声明出发，对类型引用节点广度优先，凡解析到 `src/` 内自有的 interface/type alias/enum 就记下并继续；集合差即缺口。新增用例照此做。
2. **起点改成函数签名。** `reachableNamedTypes` 目前接收 `ts.InterfaceDeclaration`；泛化成接收任意声明，并加一个 `signatureNodes(decl)`：`FunctionDeclaration` 取 `typeParameters`、`parameters`、`type`（**不要**遍历函数体，否则会把体内的局部类型引用也算进闭包）；`VariableDeclaration`（`loopsToPolygons` 是 `const x = (…): T => …`）取其类型标注与初始化箭头函数的 `parameters`/`type`。`W extends JoinableWall` 在 `typeParameters` 的约束里，必须被遍历，否则漏掉 `JoinableWall`（旧脚本就漏了）。
3. **在已导出名处停止展开。** 否则从 `resolvePlan` 出发会经 `ResolvedPlan`/`CompileOptions` 拉进 40 个与本 PR 无关的类型。判据：名字在 `exportedFromIndex` 里就记录但不入队。
4. **程序根文件要显式包含**：现有 `createProgram([INDEX, DESCRIBE])`，需加 `analyze.ts`、`wall-lowering.ts`、`geometry.ts`、`geometry/joinery.ts`；路径比较沿用已有的 `\\`→`/` 归一化（Windows 腿）。
5. **非空洞断言**（照现有"walks TRANSITIVELY"一条）：从 `joinWallSet` 必须能走到 `JoinedCut`（再到 `Opening`），从 `doorSwing` 必须能走到 `DoorSwingDir`（经 `DoorLike`），每个起点的可达集大于若干个；否则一个"空走"会让缺口集合为空而误绿。
6. **值导出断言**：`import * as core from "../src/index.js"`，四个值 `typeof === "function"`。C2 的八个名字不在任何函数签名闭包里，用一条显式小清单断言它们已导出（或从 `ResolvedElement` 联合的成员用同一个遍历器推导：实测该联合有 **9 个**根入口未命名的成员——这 8 个加 `RWallsFromRooms`；所有者接受的清单是 8 个，第 9 个由评审者决定是否追加，追加则为 27 个名字、导出数 489）。
7. **行为用例（防止回到"丢元素"路径）：** 用 `makeVirtualWorld` 装入 `examples/lib/*` 与全部 `examples/*.arch`（脚本 `spike/src/resolveplan_import_probe.mts` 就是这样做的），对 `imports`、`museum-wings`、`laneway-house`：`resolvePlan(source, { world }).ir.elements` 中 `kind === "room"` 的个数等于 `describe(...).rooms.length`，`kind === "furniture"` 的个数等于 `describe(...).furniture.length`。**实测值**（`main@1a1efd9`，与 `98a4156` 相同）：`imports` 8 个元素（房间 1、家具 3）而经 `compile().ast` → `resolveAll` 只有 3 个；`museum-wings` 42 vs 8（房间 9、家具 4）；`laneway-house` 29 vs 29（单文件，两条路相同）。不要断言元素总数（示例一改就动），断言与 `describe()` 的对应关系。
8. **先红后绿。** 建议两个提交：先提交扩展后的测试（此时应红，且失败信息恰好列出那 14 个名字），再提交导出（转绿）。这能让评审者看到"清单是推导出来的"。

### 6. 验收命令与预期结果

| 命令（核心仓库根目录）| 预期 |
|---|---|
| `npm run typecheck` | 通过 |
| `npm run lint`（`biome check .`）| 通过；新增测试代码须符合 biome（双引号、分号、尾逗号、行宽 120）|
| `npm run check:test-wiring` | 通过（没有新增测试文件）|
| `npm test` | 全部通过，含 `public-surface` 新用例与各 `*-byte-identity` 套件 |
| `npm run check:drift` | 无漂移；`git status` 无 `examples/`、`schemas/`、`spec.llm.md` 变化 |
| `npm run build` 后检查 `dist/index.d.ts` | 含全部 26 个名字；**注意** 打包器可能给同名但未导出的内部类型加后缀（如 `Arc$1`），用 `grep -nE 'Arc[$][0-9]' dist/index.d.ts`（再把 `Arc` 换成 `Edge`、`Opening` 各查一次）看一眼 |
| `node -e "import('./dist/index.js').then(m => console.log(['resolvePlan','joinWallSet','loopsToPolygons','doorSwing'].map(n => typeof m[n]).join()))"` | `function,function,function,function` |
| 第 2 节的闭包脚本 | `export count: 488`；frontier 缺 0 个 |
| 把第 5 节第 7 条的行为用例单独跑 | 通过；若 `imports` 的元素数回到 3，说明走了未链接路径 |

### 7. 已知风险

1. **导出的是"今天的 IR 词汇"。** `ResolvedPlan` 本身还有 27 个自有类型未导出（C1/C2 之外：`FurnitureAuthored`、`WallRelation`、`OpeningRelation`、`RelConstraint`、`RInstance`、`RWallsFromRooms`、`RoomDatums`/`DatumTable`/`DatumAccess`/`DatumAxis`/`DatumRefusal`、`WallSegment`、`Frame`、`Side`，以及解析器内部的 `Token`、`TokenType`、`Expr`、`BinOp`、`Value`、`Env`、`ParseExprOpts`、`ParamDoc`、`DoorHingeNear`、`DoorSlideDir`、`DoorSwingBuilding`、`AccessibleOptions`、`Bounds`）。本 PR 不扩大这个洞也不修它；3D 适配器是否还要其中某些，在 M0 D2 验证（附录 H 第 38 项）。若评审者要求"一并导出"，按 ADR 0031 的 Alternatives 回应：解析器内部类型不该公开。
2. **稳定性等级是建议，不是决定。** 评审者可能要求 `@experimental` 之类的新档位或改为子路径导出；仓库里没有这类约定（`@internal` 只表示"不是公共 API"）。回退方案见 ADR 0031。
3. **C2 清单少一个。** `ResolvedElement` 联合里还有 `RWallsFromRooms`（ADR 0028 的语句元素）未命名；适配器不需要它（派生墙已在 `ir.walls`），故按所有者接受的 8 个提；评审者若要求联合成员全部可命名，追加即可。
4. **通用名字进入根命名空间。** `Arc`、`Edge`、`Opening` 是很通用的名字；目前无冲突（脚本核对过），但评审者可能想加前缀或别名。注意：别名会让"推导出的名字 = 声明名"的测试方法失效，需改测试。
5. **测试泛化的范围。** 若把"遇到已导出名也展开"（full closure）当成要求，会被迫导出解析器内部类型，见风险 1。
6. **`loopsToPolygons` 是 `const` 箭头函数而不是 `function` 声明**，既有 JSDoc 的位置与"取声明"的写法要按变量声明处理；重命名/改成函数声明都不属于本 PR。
7. **ADR 编号竞争。** 其他分支先占用 0030/0031 时的处理见第 1 节。
8. **发版与版本范围。** 导出属 minor（SemVer）；`packages/mcp` 的 lockstep 测试"每次核心发版必红、需要重新钉依赖范围"是既有设计，与本 PR 无关；3D 包的 `peerDependencies` 版本号要等核心实际发版后才知道（附录 H 第 20 项）。
9. **未核实：** 功能 PR 是否需要同时动根 `package.json` 版本；`packages/mcp/scripts/check-core-exports.ts` 是否确实无需改动（读过、没运行）；`check:drift` 是否对根导出名有任何派生物（预期没有，须跑一次确认）。
