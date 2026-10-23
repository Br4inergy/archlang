# 03 · IFC 输出：可行性实测与 Q4 的证据

> 状态：已深挖（实测）· 日期：2026-10-23（v0.5：Q17 已决定）· [`00-deep-dive-ranking.md`](00-deep-dive-ranking.md) 的第 3 位 · 上游：主文档 [§4.10](../development-plan.md)（IFC 映射）、§9.6（M5）、Q4、R13/R17
>
> **本文只给证据与推荐，不替所有者做 Q4 的最终选型**（Q4 的决定状态是"判据已决、待 M5 spike 执行"；**Q17 已于 2026-10-24 决定**为判据补第三条几何保真，仍不是选型）。
> 脚本：[`ifc_probe_iflite.mts`](../spike/src/ifc_probe_iflite.mts)、[`ifc_probe_minimal_writer.mts`](../spike/src/ifc_probe_minimal_writer.mts)、[`ifc_check.py`](../spike/src/ifc_check.py)、[`ifc_batch.sh`](../spike/src/ifc_batch.sh)、[`ifc_webifc_read.mjs`](../spike/src/ifc_webifc_read.mjs)；结果 `../spike/results/ifc_minimal_writer_summary.json`。除特别标注外全部是 **[实测]**（IfcOpenShell 0.9.0.post1、`@ifc-lite/create` 5.1.0、web-ifc 0.0.78，Linux x86_64，2026-10-23）。

## 1. 问题定义

M5 要把同一个 `Scene3D` 导出为 IFC。Q4 的判据是：先试 `@ifc-lite/create`，若 **(a)** 输出经 IfcOpenShell 读回干净且 **(b)** 能注入确定性 GlobalId 就采用，否则自研最小 STEP 写入器。需要回答：

1. 两条路各自能做到什么、卡在哪；
2. 判据 (a)(b) 够不够——是否漏了对本项目最要紧的"几何保真"（每墙多边形含弧、洞口、门窗）；
3. 许可证、体积、确定性、GlobalId 稳定性、BIM 软件兼容性的事实。

## 2. 当前证据

### 2.1 选项 1：`@ifc-lite/create`

| 项 | 事实 |
|---|---|
| 版本/许可 | 5.1.0；MPL-2.0；依赖全部是 MPL-2.0 的 `@ifc-lite/*` [实测：`npm view` 与 `LICENSE`] |
| 体积 | 安装后 42 个包，`node_modules` 约 96 MB（不含 web-ifc 的 24 MB）[实测] |
| 确定性 | `ProjectParams` 支持 `Timestamp` 与 `GuidSource`，两次运行输出**逐字节相同** [实测] |
| GlobalId | 按调用顺序生成，**编辑后会整体漂移**（插入一面墙，后面全部变）[实测+读码] |
| 墙 | `addIfcWall` 只接受直线轴（`Start/End/Thickness/Height`）+ 矩形 `Openings`；另有宿主门窗 `addIfcWallDoor/Window`。任意多边形需用低层 `addElement` + `ArbitraryProfile`（**只有外轮廓，无孔**），且无开洞 API [读码+实测] |
| 读回 | 风味 A（轴线墙 + 宿主门窗，`laneway-house`）：IfcOpenShell **0 个校验问题**，墙体积 17.214 m³ vs 理想 17.109（拐角处相互重叠，+0.6%）；风味 B（H1 的所有权多边形，无洞口）：0 个问题，19.635 m³ = 所有权体积（精确）[实测] |

要点：库本身能产出**干净、确定**的 IFC（判据 a、b 都满足），但它的高层 API 对"弧墙、斜接、带洞口的多边形墙"无能为力；要保真就得退到低层 API，而低层 API 又没有开洞——这正是本项目最需要的部分。

### 2.2 选项 2：自研最小 STEP 写入器（原型 117 行）

[`ifc_probe_minimal_writer.mts`](../spike/src/ifc_probe_minimal_writer.mts)：IFC4；每个所有权连通片一个 `IfcWall`，几何为 `IfcExtrudedAreaSolid` over `IfcArbitraryProfileDefWithVoids`；每个洞口对其覆盖的每个片各一个 `IfcOpeningElement` + `IfcRelVoidsElement`（一个开洞只能挖一个构件，见 [`02`](02-wall-geometry.md) §2.4）；`IfcDoor/IfcWindow` 为盒体 + `IfcRelFillsElement`；材质关联；GlobalId = IFC 的 22 字符 base64 编码 of `sha1(稳定键)`，键由元素 id 与片序号组成，**编辑无关元素时不漂移**。

在 **43 个平面**上（32 个示例 + 11 个压力平面；`imports`、`museum-wings` 需要虚拟世界，批处理用空世界故未含）：

| 指标 | 结果 |
|---|---|
| IfcOpenShell 校验问题 / 形状失败 | **0 / 0** |
| GlobalId 唯一 | 43/43 |
| 两次运行逐字节相同 | 43/43 |
| 墙体积读回 vs 期望（采样法，扣除洞口）| 合计 2828.99 vs 2833.08 m³（**−0.14%**）；单个平面最大偏差 −0.98%（`library`）|
| 实体数 | 最大 1925（`hillside-villa`）；全部平面合计 24644 个实体 |
| web-ifc 0.0.78 读取 | 全部抽查文件可读（`laneway` 14 网格/312 三角形；`aquarium` 21/1392；`transit-hall` 38/1148）|

"期望体积"是按网格点采样得到的估计，不是解析值；−0.98% 的来源（`library` 的鼓墙）未逐项归因 [待核实]。

### 2.3 一个会悄悄出错的坑 [实测]

用核心给出的**精确**洞口切口（与墙的两个长面共面）时，IfcOpenShell 的布尔运算在**弧墙**上**静默跳过开洞**，不报错、校验也通过：`aquarium` 的外壳读回 304.49 m³ vs 期望 296.28 m³（多出 2.8%）。把切口沿墙法向两侧各外扩 **20 mm**（`IFC_OPENING_MARGIN_MM`，洞口宽度不变）后恢复为 295.95 m³。含义：**校验通过 ≠ 几何对**；M5 必须有体积对账（V-IFC-04）并把该外扩写入规范。原型的默认值已设为 20 mm。

### 2.4 许可证 [实测+官方页面]

- `@ifc-lite/*` 与 web-ifc：MPL-2.0（文件级 copyleft；作依赖使用、不改其文件即无需公开自有代码，**不要把它们的源码拷进本仓库**）。是否可接受由所有者判断（附录 H 第 2 项，Q13；Q20 已决定的许可门不替代这一判断）。
- IfcOpenShell 0.9.0.post1：LGPL-3.0-or-later，**只**作测试期独立进程校验器（与 Q4 原文一致）。
- 自研写入器：无第三方运行时依赖；STEP/IFC 是公开规范，写入器自己的代码适用 MIT。

### 2.5 未能核实的 [待核实]

- IFC4.3 实体与关系（`IfcWallStandardCase` 的弃用状态、电梯用 `IfcTransportElement` 是否合适）：规范站点对自动请求返回 403（附录 H 第 1 项），原型用的是 IFC4。
- **BIM 软件兼容性**（Revit、Archicad、BlenderBIM/Bonsai、Solibri）：本次只用了 IfcOpenShell 与 web-ifc 两个读取器，**没有**在任何商业 BIM 软件中打开过。
- `IfcSpace.NetFloorArea` 与 `describe` 的 `net_area_m2` 对账、`Pset` 的写法：本次未做。
- 楼板（`IfcSlab`）、楼梯（`IfcStair`/`IfcStairFlight`）、屋顶（`IfcRoof`）、栏杆未写入；原型只覆盖墙/门/窗/材质。

## 3. 方案比较

| 维度 | `@ifc-lite/create` | 自研最小写入器（原型 117 行）|
|---|---|---|
| 校验 + 读回（43 平面）| 仅测了 2 份（风味 A/B），0 问题 | 43 份，0 问题 |
| 弧墙/斜接多边形 + 洞口 | 高层 API 不支持；低层无孔、无开洞 | 支持（`IfcArbitraryProfileDefWithVoids` + 每片开洞）|
| 确定性 | 支持（`Timestamp` + `GuidSource`）| 天然支持 |
| GlobalId 稳定性 | 调用顺序，编辑即漂移 | 内容键哈希，稳定 |
| 实体广度（楼板/楼梯/屋顶/Pset/空间）| 有现成 API（本次未测）| 要自己写，估计占 M5 大头 |
| 依赖/许可 | 42 包、约 96 MB、MPL-2.0 | 0 依赖 |
| 维护风险 | 项目年轻（创建于 2026-03）| 自己维护 STEP 序列化与规范细节 |
| 已知陷阱 | 未发现 | 布尔外扩（§2.3）|

## 4. 推荐与理由（**不是最终选型**）

1. **证据倾向"自研写入器负责墙/洞口/门窗这一核心几何"**：它是唯一在带洞口的弧墙/多边形墙上通过读回的路线，而且 GlobalId 稳定性（对"重新导出后 BIM 里的变更对比"是关键）只有自研能保证。
2. `@ifc-lite/create` 的价值在**实体广度**（楼板、楼梯、Pset 等）而非墙几何；可以在 M5 spike 里再评估"自研墙 + 其余用库"是否值得 96 MB 与 MPL-2.0 的代价——**我不推荐一开始就引入**。
3. Q4 的判据 (a)(b) 对 `@ifc-lite/create` 是**满足的**，按字面会选它；但它没覆盖"几何保真"，所以字面判据会导致选了一个做不了弧墙洞口的库。补一条判据 **(c)：对 H1 所有权多边形（含弧、含洞口）读回体积误差 ≤ 1%**——这是 **Q17，所有者已于 2026-10-24 决定采纳**。
4. 无论选哪条，都要：体积对账（V-IFC-04）、20 mm 外扩、每片开洞、GlobalId 用内容键。

## 5. 风险与未验证项

- 原型只覆盖墙/洞口/门窗；M5 的真实工作量在其余实体与 Pset，**14/8 人天的估算未因此改变**，但把风险从"库能不能用"挪到"写多少实体"。
- 未在任何商业 BIM 软件里验证（见 §2.5）；"IfcOpenShell 与 web-ifc 能读"不等于"Revit 能读"。
- IfcOpenShell 版本升级可能改变布尔行为；V-IFC-04 的体积对账是护栏。
- `@ifc-lite/create` 只测了两份文件；若所有者希望保留它为候选，应补测多层、斜墙。

## 6. 对计划的影响

| 项 | 变化 |
|---|---|
| Q4 | 证据已入 §10.2；判据已按 **Q17**（已决定）补第三条几何保真 |
| M5（14/8）| 工作量**不变**；spike 第 1–2 天的任务改为"在原型上扩展楼板/楼梯并对 `@ifc-lite/create` 做同口径对比"|
| §4.10 | 增加"每片开洞""切口外扩 20 mm""GlobalId 内容键"三条规则 |
| V-IFC | 新增 V-IFC-04（墙体积对账 ≤ 1%）与 V-IFC-05（弧墙开洞回归：`aquarium` 外壳），均为必选；V-IFC-02 仍是 `IfcSpace.NetFloorArea` 对账 |
| R13/R17 | 增补"校验通过但几何错"的失效模式 |
| 附录 H | 第 2 项部分核实（可行性与许可事实）；新增第 32 项（商业 BIM 软件兼容性）|
| 核心 | 无新增；需要 C1 导出 `joinWallSet`（已在 C1）|
