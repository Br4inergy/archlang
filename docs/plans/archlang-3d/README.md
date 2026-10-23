# archlang-3d：从平面图到 3D 模型与渲染图

**Status:** Proposed（v0.5）· **Date:** 2026-10 · **Owner:** ChanMeng666

这个目录是一个**开发计划**（programme plan），回答一个问题：ArchLang 的 `.arch` 平面图已经是精确、确定、可校验的源码，能否再跑一个自动化工作流，得到带语义的 3D 建筑模型（GLB / IFC）、交互查看器、渲染图与漫游视频？结论：**可以，而且应当作为独立的下游包去做，核心保持 plan-first**（[ADR 0021](../../adr/0021-plan-first-view-deprecated.md)）。

> ArchLang 本身仍然只画平面。本目录描述的 3D 能力来自一个**消费已解析数据**的下游工具，不属于语言，也不在核心的 `compile()` 路径里。

## 文件

| 文件 | 内容 |
|---|---|
| [`development-plan.md`](development-plan.md) | **主文档**：背景/目标/非目标、输入契约与缺口分析、架构、算法、资产库、渲染、CLI/Agent 接口、QA、里程碑与前两周逐日任务、第一周开工清单、风险与决策记录、需要核心仓库配合的事项、附录（Scene3D schema、CLI 帮助、参考资料、未核实清单）|
| [`adr-draft-0030-3d-as-downstream-package.md`](adr-draft-0030-3d-as-downstream-package.md) | ADR 草案（英文，沿用 `docs/adr/` 格式）：3D 是下游包；`archlang-3d` 消费已解析 IR；核心只做加性导出 |
| [`research/`](research/00-deep-dive-ranking.md) | **v0.4 深挖研究（结论已由 v0.5 的决定采纳）**：[`00`](research/00-deep-dive-ranking.md) 排序与依据；[`01`](research/01-core-contract-and-input-channel.md) 核心契约与输入通道；[`02`](research/02-wall-geometry.md) 墙体几何；[`03`](research/03-ifc-output.md) IFC；[`04`](research/04-vertical-and-roof.md) 楼梯与屋顶；[`05`](research/05-rendering-and-materials.md) 渲染与材质；[`06`](research/06-assets-and-fixtures.md) 家具与资产；[`07`](research/07-agent-loop-and-engineering.md) Agent 闭环与工程化。每份含问题定义、证据（实测/读码/待核实分开标）、方案比较、推荐、未验证项、对里程碑/人天/Q 编号/核心的影响 |
| [`spike/`](spike/README.md) | M0 最小验证与 v0.4 深挖实验：Python 原型（Plan JSON → GLB）、校验脚本、IR 覆盖探针；TypeScript 实验（导出闭包、每墙所有权、IFC、家具覆盖、楼梯与直骨架、耗时）；合成压力平面；结果与复现步骤 |

## 怎么读

1. **5 分钟**：`development-plan.md` 开头的 TL;DR、§0.3 的决策状态与 §3.1 的管线图。
2. **要质疑结论**：§2.4（spike 实测）、[`research/`](research/00-deep-dive-ranking.md)（v0.4 的证据与排序依据）、§10（风险、问题与决策记录：每个问题有推荐答案与决定状态）。
3. **要动手**：§9（里程碑、验收、**前两周逐日任务**）与 §7（CLI/接口）。
4. **要核对事实**：附录 H 汇总了所有标"待核实"的事项；附录 D 是真实参考链接。

## 当前状态（v0.5，2026-10-24）

- **已完成：** 调研、可行性 spike（Plan JSON 通道，37/39 份构建成功，全部水密、glTF-Validator 0 错 0 警告、同输入字节一致）、IR 覆盖分析（32 个可编译示例中 13 个依赖 Plan JSON 没有的信息）。
- **所有者已决定（Q1–Q16：2026-10-23 分两批；Q17–Q22：2026-10-24 第三批，全部按推荐方案采纳；Q1–Q22 没有待决问题）：** monorepo 孵化 `packages/archlang-3d`（`private`，M6 评估拆仓）；包名 `@chanmeng666/archlang-3d`、命令 `archlang3d`；输入主通道 = 库 API（入口 `resolvePlan`）+ 核心加性导出 C1/C2（**C1 含 `doorSwing`，并按 Q18 增加 `resolvePlan`、`AnalyzeOptions`、`JoinerySplit`**），C4 暂缓；默认楼板 200 mm；默认平屋顶、坡屋顶仅显式 `--roof`，M3 只交付 RF0–RF2；门默认闭合；日照不进核心；包 MIT、资产包 CC0-1.0；轻量单测进核心 `npm test`、重测试放 `e2e/`（Q16 方案 A）；M6 之前官网不宣传 3D；**第三批：** Q4 的判据补第三条几何保真（读回体积误差 ≤ 1%，Q17）；混合墙高接受并发 `W3D_MIXED_HEIGHT_JOINT` 告警（Q19）；许可门不只信 npm 的 `license` 字段（Q20）；视觉回归以钉死 Chrome 的无头 three.js 为 CI 判据、Blender 不进阻断（Q21）；楼梯不合规时生成并发 `W3D_STAIR_PROPORTION` 警告（Q22）。
- **判据已决、待执行：** Q4（IFC 写入器）——M5 第 1–2 天 spike，先试 `@ifc-lite/create`；读回干净、可注入确定性 GlobalId、**且几何保真达标（Q17）**三条全满足才采用，否则自研最小 STEP 写入器；**不是最终选型**。
- **仍待执行的动作与复核（不是决定）：** ADR 0030 评审；第一个 PR 里实测 `check:test-wiring` 对非 `.test.ts` 文件的处理；名称占位复查；核心的 C1/C2 PR（M0 D3 前提交，含 `resolvePlan` 等，Q18；`resolvePlan` 的稳定性等级待核实）；核心版本号核对；M1 的许可门与告警码、M3 的 Chrome 钉死与跨机器实验（Q19–Q21）；Q9/Q13 的白名单与资产包许可最晚 M2 前复核。清单见主文档 §0.3。
- **需要核心仓库（archlang 本体）配合的事项：** 主文档 §2.8（11 项，含是否阻塞 3D 里程碑；第 11 项为条件触发）。
- **v0.4 深挖（只做不入库的实验，未改核心仓库）：** 通道 A 的入口须更正为 `resolvePlan`（`compile().ast` 未链接，对带 `import` 的平面静默丢元素）；**H1 成立**（`split.faceOf = id`，45 个平面实测）；IFC 两条路线的实测证据（自研写入器原型 43 个平面 0 校验问题、逐字节确定；`@ifc-lite/create` 做不了弧墙洞口；IfcOpenShell 对共面切口静默失败）；8 个屋檐环全是矩形、`straight-skeleton@3` 实质 GPL；渲染同机可逐像素复现（跨机器未测）；家具前 30 个家族覆盖 91.1%。里程碑人天重估为 **85 / 47**（M1 +1/+1，M3 −8/−4）；v0.5 落实 Q17–Q22 后**无变化**。
- **未核实的事项**集中在主文档附录 H（第 31–37 项为 v0.4 新增）：`resolvePlan` 的稳定性等级、商业 BIM 软件对 IFC 的兼容、楼梯规范原文、渲染的跨机器确定性、`straight-skeleton@2.x` 的实质来源、Kenney/Quaternius 的条款等。
- **未开始：** M0 的 TypeScript 移植（库 API 适配器、H1 测试、朝向约定验证）、Scene3D schema 定稿。第一周开工清单见主文档 §9.10。

## 与现有文档的关系

- 上游约束：[ADR 0021](../../adr/0021-plan-first-view-deprecated.md)、[ADR 0018](../../adr/0018-zero-dep-wall-joinery.md)、[ADR 0005](../../adr/0005-no-invisible-architect.md)、[ADR 0015](../../adr/0015-cli-as-agent-interface.md)；backlog **P3-2**（IFC）见 [`docs/backlog.md`](../../backlog.md)。
- 输入契约：[`schemas/plan.schema.json`](../../../schemas/plan.schema.json)、[`docs/language-reference.md`](../../language-reference.md)（Levels、Heights、Roof、Void、Stair）、[`docs/furniture.md`](../../furniture.md)。
- 同级方案：[`plan-soundness`](../plan-soundness/README.md)（本计划的格式与"先证据后决策"的做法参照它）。
