# 07 · Agent 闭环、产品形态与工程化（性能、供应链、版本、测试）

> 状态：**部分深挖**——性能与许可是实测，Agent 闭环与产品形态主要是读码与设计推演（证据较弱，已逐项标注）· 日期：2026-10-23 · [`00-deep-dive-ranking.md`](00-deep-dive-ranking.md) 的第 7、8 位 · 上游：主文档 [§7](../development-plan.md)（CLI/API/Agent 接口）、§3.2.1、§3.3、§8、R10/R19、Q16/Q20
>
> 脚本：[`perf_budget.mts`](../spike/src/perf_budget.mts)；结果 `../spike/results/perf_budget.json`。标记同 [`01`](01-core-contract-and-input-channel.md)。

## 1. 问题定义

1. 3D 包以什么形态进入"AI 写平面、人审阅"的工作流：命令行、MCP 工具、Skill 各承担什么，"渲染→检查→修改"闭环里哪一步由谁做；
2. 核心侧新增的工作量（解析 + 所有权 + 三角化）会不会成为瓶颈；
3. 依赖的许可证门（§8.5 L1）能否真正拦住"标签是 MIT、实质是 GPL"的包；
4. 与核心的版本耦合、测试与 CI 成本。

## 2. 当前证据

### 2.1 核心现有的 Agent 接口 [读码]

- CLI 命令清单（`src/manifest.ts`）23 个，含 `manifest`、`spec`、`context`、`describe`、`lint`、`finish`、`repair`、`fix`、`suggest`、`explain`；`archlang manifest` 是机器可读的发现入口（§7.4 已计划扩展）。
- MCP 薄壳（`packages/mcp`）11 个工具：`compile`、`describe`、`lint`、`validate`、`score`、`repair`、`fix`、`finish`、`suggest`、`complete`、`link`；依赖 `@chanmeng666/archlang ^1.43.1`、`@modelcontextprotocol/sdk ^1.29.0`、`zod ^4.6.5`。另有托管版 `packages/mcp-worker`（Cloudflare Worker，ADR 0026）——**不能运行 Blender/Chromium**，所以 3D 的 MCP 只能是独立的本地服务（主文档 §7.5 已如此设计）。
- 核心 Skill 5 个：`archlang`、`archlang-brief-to-plan`、`archlang-edit-plan`、`archlang-export`、`archlang-review-plan`；`archlang-export` 的写法是"**工作流**而非语言参考，所有动作走 CLI 并带 `--json`"，并写明"不要裸跑 `arch`"（Linux/macOS 上是 coreutils 命令）。
- **铁律 [读码：`docs/agents/iron-laws.md`]：T3（诊断闭环的在线实验）被所有者永久否决，不得声称"模型闭环有提升或没有提升"**。含义：本计划里任何"渲染反馈能改善 Agent 表现"的说法都不能出现，只能写成**设计意图**，且不得在 CI 里触发在线模型评测。检查：主文档目前没有这类断言 [实测：`grep` 全文 0 处]。

### 2.2 闭环应当怎么分工 [设计推演，无实测]

| 步骤 | 谁做 | 依据 |
|---|---|---|
| 写/改 `.arch` | 现有 Skill（`archlang-brief-to-plan`、`archlang-edit-plan`）| 3D Skill 草案已写"不为让 3D 好看而改平面，只报告平面缺口" |
| 文本优先的检查 | `archlang3d check --strict --json`（V-GEO/V-FUR 等）+ 核心 `describe`/`lint` | 文本诊断可复现、可进 CI；图像只作补充 |
| 图像检查 | `archlang3d render --preset … -o x.png`；Agent 看图 | 需要 Blender 或 three.js 回退 |
| 把 3D 发现转回平面修改 | 人或 `archlang-edit-plan` | 3D 层只读平面（ADR 0005）|

接口层面要做的只有两处：① `check --json` 的诊断带**平面元素 id 与行号**（核心诊断本来就有行号，3D 诊断沿用），让 `archlang-edit-plan` 能定位；② `archlang3d manifest` 与核心 `manifest` 同形。这些都是设计，**未实现、未评测**。

### 2.3 核心侧耗时 [实测]

[`perf_budget.mts`](../spike/src/perf_budget.mts)（Node 20.19.2，单进程，冷缓存清空后取 15 次中位数）：

| 平面 | 墙数 | `resolvePlan` | 所有权（`joinWallSet` + `split`）| 盖面三角化（earcut）|
|---|---|---|---|---|
| tiny-house | 4 | 2.2 ms | 0.8 ms | 0.02 ms |
| townhouse（3 层）| 12 | 5.3 ms | 1.3 ms | 0.04 ms |
| hillside-villa | 25 | 11 ms | 3.2 ms | 0.07 ms |
| library（含圆形鼓墙）| 15 | 3.8 ms | 3.0 ms | 0.06 ms |
| aquarium（弧墙）| 10 | 3.5 ms | 1.3 ms | 0.03 ms |

（另测了 laneway-house、clinic、transit-hall，量级相同，见 JSON。）**核心侧三项合计 ≤ 15 ms/平面**，远低于 §6.6 的"单层构建 ≤ 2 s"目标；真正的耗时在渲染（见 [`05`](05-rendering-and-materials.md)）与 GLB 序列化/优化（**未测**）。结论：性能预算的风险不在解析与几何，不需要为它设计缓存或增量构建。

### 2.4 供应链：npm 的 `license` 字段不可信的实例 [实测]

[`04`](04-vertical-and-roof.md) §2.4：`straight-skeleton@3.0.0` 在 npm 上标 MIT，实际封装 GPL v3+ 的 CGAL 直骨架（WebAssembly）。主文档 §8.5 L1 的方法是"CI 读取锁文件中各包的 `license` 字段"——**这个方法会放过它**。其它候选依赖的许可（`npm view`，2026-10-23）：`earcut` 3.2.4 ISC；`polygon-clipping` 0.15.7 MIT；`martinez-polygon-clipping` 0.9.0 MIT；`clipper2-js` 1.2.4 Boost；`clipper2-wasm` 0.4.0 BSL-1.0；`manifold-3d` 3.5.4 Apache-2.0；`three-bvh-csg` 0.0.18 MIT；`@jscad/modeling` 2.13.0 MIT；`poly2tri` 1.5.0 BSD-3；`cdt2d` 1.0.0 MIT——这些本身没问题，但"字段正确"不等于"没有被封装的 GPL 代码"。

### 2.5 版本耦合、测试与 CI [读码 + 部分实测]

- 版本偏移是已测事实（spike：已发布 1.43.1 解析不了 `main` 的 3 个示例）；Q1（monorepo）与 Q16（轻量单测进核心套件）已针对它设计。
- 核心 `npm run check` = `typecheck` + `lint` + `check:test-wiring` + `npm test`。核心 `vitest run` 全套的基线耗时见 §2.6。
- `npm ci` 与 `prepublishOnly` 的增量（附录 H 第 17、21 项）仍需 M0 D1 前后各量一次，**本次未测**。
- Node 18 上 `three`、`earcut`（v3 仅 ESM 默认导出需 `default ?? 模块` 的写法）等的可用性未测。

### 2.6 核心测试基线 [实测，单机]

在 `main@98a4156` 的检出里（Node 20.19.2、8 核；`npm ci --ignore-scripts` 在有缓存时 8 s）运行 `npx vitest run`：**360 个测试文件、8869 个测试，总用时 241 s**（转换 9 s、收集 154 s、测试 1348 s 的累计线程时间）。结果 8855 通过、4 跳过、**10 失败**，失败全部在 `test/share-codec.test.ts`（`#z=` 分享编码的固定哈希，9 个）与 `playground/test/llm-prompt.test.ts`（1 个）——与 3D 无关，**原因未调查**（可能是缺少 playground 依赖或 Node 版本差异；我没有运行 `npm run check`，也没有在 CI 里复现）。含义：核心套件约 4 分钟量级，轻量层的 3D 单测（Q16 方案 A）若控制在秒级，不会明显改变核心 CI 时间；`npm ci` 与 `prepublishOnly` 的增量仍需 M0 D1 前后实测（附录 H 第 17、21 项）。

## 3. 方案比较

| 议题 | 方案 | 评价 |
|---|---|---|
| 闭环形态 | **P1（推荐）** CLI 为主 + 独立本地 MCP（薄壳）+ 3D Skill 只读平面；文本诊断优先，图像为补充 | 与 ADR 0012/0015 一致；不触碰 T3 铁律 |
| | P2 把 3D 工具并入核心 MCP 壳 | 托管版无法运行；版本纪律冲突（核心铁律要求 mcp 变动必须升版本）|
| | P3 做"自动渲染→模型自评→自动改平面"的全自动闭环 | 触碰 T3（不得声称闭环收益）；3D 层只读平面的定位也不允许 |
| 许可门 | **L-a（推荐）** 强化 L1：① 保留 `license` 字段检查；② 新增生产依赖须在 PR 里附"来源核对"（仓库、README 与 LICENSE、是否封装/移植其它项目）并登记到 `THIRD_PARTY_NOTICES`；③ 对已知"封装 GPL"的包建显式拒绝清单（先放 `straight-skeleton@3`，其 2.x 是否同样基于 CGAL **未核**）| 便宜，补上 L1 的盲区 |
| | L-b 只信 `license` 字段（现状）| 已被实例证伪 |
| | L-c 引入 SBOM/扫描器（如 `license-checker`、`scancode`）| 能抓 NOTICE 级信息，但**我没有评估这些工具**，M2 选型时再定 |

## 4. 推荐与理由

- **P1 + L-a**。许可门强化是 **Q20**（**所有者已于 2026-10-24 决定采纳**；非阻塞，落地时点 M1 的 CI 骨架——`check:3d` 在 M0 D1 就会建立，门要从第一天起就是对的）。
- 不为核心侧性能设计缓存。把 `perf_budget.mts` 留作基线脚本，M1 末复测。
- 3D Skill 与 MCP 的措辞遵守 T3：只写"做什么"，不写"提升多少"。

## 5. 风险与未验证项

- §2.2 的闭环分工没有任何实测（没有跑过 Agent，也不会跑——T3 禁止在线评测）；它只是对接口的推演。
- `resolvePlan` 耗时里包含解析与链接；大平面（上百面墙）与深度 `place` 嵌套没有测。
- 本次没有测 GLB 序列化/`dedup/weld/prune` 的耗时与体积，所以 §6.6 的体积目标仍是估计。
- 许可检查只看了 npm 元数据与几个仓库页；没有做依赖树的传递许可审计。

## 6. 对计划的影响

| 项 | 变化 |
|---|---|
| §7.5/§7.6 | 补一句"遵守 T3：不声称闭环收益"；诊断带平面元素 id 与行号 |
| §8.5 L1 | 按 L-a 强化（Q20）|
| §6.6 | 补核心侧耗时实测（≤ 15 ms/平面）|
| M1 | +1/+1 人天：CI 骨架加许可门（L-a）与每片实体、切口跨片等（与 [`02`](02-wall-geometry.md) 的新增合并计）|
| Q 编号 | 新增 **Q20**（**已决定**）|
| 附录 H | 第 17、21 项不变；新增第 36 项（`straight-skeleton@2.x` 的实质依赖）|
| 核心 | 无（`manifest` 同形属 3D 包自己的接口）|
