# 04 · 垂直数据与屋顶：楼梯、多层、屋顶（RF0–RF4）

> 状态：已深挖（实测 + 公开资料）· 日期：2026-10-23（v0.5：Q20、Q22 已决定）· [`00-deep-dive-ranking.md`](00-deep-dive-ranking.md) 的第 4 位 · 上游：主文档 [§4.5](../development-plan.md)（屋顶）、§4.7（多层与楼梯）、Q7/Q8、附录 H 第 3、7、30 项
>
> 脚本：[`stairs_probe.mts`](../spike/src/stairs_probe.mts)、[`skeleton_eval.mts`](../spike/src/skeleton_eval.mts)；结果 `../spike/results/stairs_probe.json`、`skeleton_eval_v1.json`。除标注外为 **[实测]**（`main@98a4156` 的 34 个示例；2026-10-23）。

## 1. 问题定义

核心的 IR 对"垂直方向"只给了**身份与占地**，没有构造数据。3D 要生成可信的楼梯、楼板洞、屋顶，必须知道：

1. 核心到底提供了什么、缺什么（数据完整性）；
2. 缺的部分用什么规则补，补出来的东西与平面里画的是否一致；
3. 屋顶：示例里真实出现的屋檐环是什么形状，决定了 RF3（任意直边环）值不值得做、用什么库、许可是否干净。

## 2. 当前证据

### 2.1 数据完整性 [读码 + 实测]

| 对象 | 核心提供 | 3D 需要而缺的 | 处理（沿用既有决定）|
|---|---|---|---|
| 层 | `ResolvedPlan.storeyHeight`、`elevation`；`verticalConnections` 按 id 配对（只有身份）| 楼板厚 | Q6：默认 200 mm，写账本 |
| 楼梯 | `at`、`size`（梯段沿**长轴**）、`dir`、`width`；语言只模型**直跑**梯段 | 踢面数/高、踏面、休息平台、转角 | 由 3D 推导（§3.1）；不支持转角梯 |
| 电梯 | 占地 | 门洞、井道高度 | 井道盒，门洞不推断 |
| 自动扶梯 | 占地 + `dir` | 倾角、踏步 | M4 仅斜板 |
| `void` | 多边形 | 与楼梯井是否重合 | 有 `void` 用之，否则 `W3D_STAIR_NO_VOID` |
| 屋顶 | **只有**屋檐环 `RRoof.ring`（已含 `roof overhang N` 的悬挑）| 坡度、形式、屋面厚、檐口 | Q7：默认平屋顶；坡屋顶须显式 `--roof` |

**H7 的答案（附录 H 第 7 项）**：平面里楼梯的踏步线数是**绘图约定**——`src/elements/vertical-glyphs.ts` 的 `TREAD_GOING_MM = 280`（名义踏面），按梯段长度除以 280 画踏步线 [读码；取整细节待核实]——与楼层高无关。所以**不能复用**它作为 3D 的踏步数；3D 的踏步数必须从层高推导，并且与平面符号的线数**不会一致**（`garden-house` 的 3200 mm 梯段按 280 约画 11 道线，3D 推导 15 个踏面）。这要在文档里明说，否则读者会以为是 bug。

### 2.2 示例里的楼梯 [实测]

34 个示例里共 14 个楼梯类元素（楼梯、电梯、自动扶梯及其上下层对应项），其中**能被推导的直跑楼梯**共 5 个：`garden-house`（3000 mm 层高，梯段 900×3200）、`hillside-villa`（3000，2200×1000）、`townhouse` ×2（3000，900×3200）、`two-storey`（2700，900×2600）。

对每个梯段，在 `150 ≤ 踢面 ≤ 220` 内选踢面数 n，使 `2R + G` 最接近 625 mm（625 取下述来源 600–650 的中点，**建议值**）：

| 梯段 | n | 踢面 R | 踏面 G | 2R+G | 坡度 | 英格兰 AD K 范围内 |
|---|---|---|---|---|---|---|
| garden-house | 15 | 200 | 229 | 629 | 41.2° | 是 |
| townhouse（两个）| 15 | 200 | 229 | 629 | 41.2° | 是 |
| two-storey | 13 | 208 | 217 | 632 | 43.8° | **否**（坡度 > 42°，踏面 < 220）|
| hillside-villa | 14 | 214 | 169 | 598 | 51.7° | **否**（坡度 > 42°，踏面 169）|

关键事实：**坡度基本只由"层高 ÷ 梯段长度"决定，与 n 几乎无关**（n 从 10 变到 21，坡度只变约 1.5°）。所以 `hillside-villa`（52°）与 `two-storey`（44°）的作者占地**无论选多少级都不可能合规**——这是平面作者的事实，不是推导错误。早先用 `ceil(层高/190)` 选 n 得到的 2R+G = 522–588 偏低，是选 n 的方法偏悲观；改用"2R+G 逼近 625"后 3/5 合规。

适用范围：判据来自公开资料——Blondel 公式 2R+G ≈ 600–640 mm（[Tarulo](https://tarulo.com/en/floors-stairs/stair-dimensions-rules)）；BAuA 步幅 590–650 mm、踏面 260–320 mm、踢面 140–190 mm（[BAuA](https://www.baua.de/EN/Topics/Work-design/Workplaces/Safe-stairways-floors/The-design-of-safe-stairs)）；Textbook of Architecture 600–660 mm（[链接](https://textbookofarchitecture.com/chapter/stairs)）；英格兰 Approved Document K（私人住宅）：踢面 150–220、踏面 220–300、坡度 ≤ 42°、2R+G 550–700（[Practical Architecture 的转述](https://www.practicalarchitecture.com/blog/the-geometry-of-a-comfortable-staircase)，**二手转述，未核对规范原文**）。各国规范不同，仅作**示意性**警告。

### 2.3 示例里的屋顶 [实测]

- 带 `roof overhang` 的示例 8 个：`bungalow`、`courtyard-house`、`garden-house`、`hillside-villa`、`tiny-house`、`townhouse`、`two-bed`、`two-storey`。
- 这 8 个示例的屋檐环**全部是 4 顶点矩形**（附录 H 第 30 项的答案：**凹环 0 个**）。所以 RF0–RF2（矩形/凸环，闭式解）对现有示例是**充分**的；RF3 解决的是示例之外的 L/T/凹平面。

### 2.4 直骨架库 [实测 + 官方页面]

| 库 | 许可 | 事实 | 评估 |
|---|---|---|---|
| `straight-skeleton@3.0.0` | npm 标 MIT | 其 README 声明封装 CGAL 的直骨架（WebAssembly）| **许可有隐患**：CGAL 的 *2D Straight Skeleton and Polygon Offsetting* 包在 CGAL 官方包概览与仓库 `license.txt` 中均为 **GPL v3 或更高**（[包概览](https://doc.cgal.org/latest/Manual/packages.html)，[license.txt](https://github.com/CGAL/cgal/blob/master/Straight_skeleton_2/package_info/Straight_skeleton_2/license.txt)）；GeometryFactory 出售商业许可（[页面](https://geometryfactory.com/products/licenses/)）。npm 上的 MIT 标签不能覆盖被封装的 GPL 代码——正是 Q8 要排除的"GPL 的 CGAL-WASM 系"。**排除，不再测试**（CGAL 官方许可页 `cgal.org/license.html` 对 curl 返回 403，但经搜索摘要核到同一内容）|
| `straight-skeleton@1.1.0` | MIT | 纯 TS，C# 实现（reinterpretcat/csharp-libs，仓库 LICENSE 为 Apache-2.0）的移植；README 自称"不依赖外部数学库" | 见下，**可作 RF3 候选** |
| `@proc-geo/core@0.2.1` | MIT | 纯 TS；2026-07-26 更新；运行依赖 `loglevel`；**无孔洞接口**；返回骨架图（节点/边），**不给面与高度**；失败时记日志而不抛错 | 在 T 形与 48 边形上输出了"子多边形失败"的日志却仍返回图；**正确性未独立核验** [待核实]。不推荐作首选 |

`straight-skeleton@1.1.0` 的健壮性（17 个用例，每个检查：不抛错、各面面积之和 = 环面积）：

| 用例 | 结果 |
|---|---|
| 8 个示例的真实屋檐环（矩形）| 8/8 成功，每个 ≤ 0.3 ms，面积误差 0 |
| 矩形、L、U、T、带中庭孔的矩形、非轴向六边形、10×0.2 m 细条 | 7/7 成功，面积误差 0，≤ 3.5 ms |
| 矩形上有共线中点 | 不抛错，但**面积误差 10%**（面缺失，静默错误）|
| 48 边形（离散化的圆）| **抛异常** |

结论：1.1.0 在"简单顶点"上正确且很快，**对共线顶点与近圆多边形不可靠**。可用的防护：先去共线顶点；环顶点数超过阈值（例如 24，**建议值**）或来自弧时退回 RF1；运行时自检（各面面积之和 = 环面积，误差 > 1×10^-6 则退回 RF1 并发 `W3D_ROOF_UNSUPPORTED_RING`）。该库还是一个 Apache-2.0 代码的 MIT 移植——使用时要在 `THIRD-PARTY-NOTICES` 里同时保留两份声明（§8.5 的清单项）。

## 3. 方案比较

### 3.1 楼梯踏步

| 方案 | 做法 | 评价 |
|---|---|---|
| **V1（推荐）** n 使 2R+G 逼近 625，限 150 ≤ R ≤ 220；越界仍生成并发 `W3D_STAIR_PROPORTION` | 平面事实不改；坡度不合规的梯段照画并警告（示意）| 5 个示例里 3 个合规，2 个带警告；不替作者"修正"（ADR 0005）|
| V2 `round(H/175)`（主文档 v0.3 的写法）| 固定踢面约 175 | 在 `garden-house` 得 2R+G = 553（偏低），与"逼近 625"相比无依据 |
| V3 拒绝生成 | 坡度不合规则报错 | 与"3D 只消费不审判"的定位冲突；2/5 示例会失败 |
| V4 沿用平面的踏步线数 | 复用 `TREAD_GOING_MM = 280` | 与层高无关，§2.1 已否 |

### 3.2 屋顶

| 方案 | 成本（估算）| 评价 |
|---|---|---|
| **R-a（推荐）** M3 只做 RF0–RF2；RF3 在 M3 里**不做**，凹环保持 RF1 并发 `W3D_ROOF_UNSUPPORTED_RING` | 比 v0.1 估算（含 RF3 自研 8–10 人天）少约 9 人天 | 现有示例 0 个凹环；不引入任何新依赖或许可风险 |
| R-b RF3 = `straight-skeleton@1.1.0` + §2.4 的三项防护 | 约 2–3 人天集成 + 退化用例 | 许可 MIT/Apache 干净；作为 M3 之后的可选项，出现真实凹平面时再做 |
| R-c 自研 Felkel–Obdržálek | 8–10 人天 + 大量退化用例 | 最可控但最贵；仅当 R-b 的防护不够时 |
| R-d `straight-skeleton@3`（CGAL）| — | **否决**：GPL 传导 |

## 4. 推荐与理由

- 楼梯：**V1**。这是**Q22**（楼梯不合规时如何处理）——**所有者已于 2026-10-24 决定：生成 + 警告、不拒绝**；非阻塞，M4 落地；无需核心改动。
- 屋顶：**R-a**，RF3 评估**已完成**（不必等 M3 第 1 周）：现有 8 个屋檐环全是矩形，库的候选是 R-b，必要时 R-c。据此 M3 的人天**重估**（见 §6）。
- 把"屋顶的构造事实"（坡度、屋面厚、檐口）继续留在 3D 层的显式参数里，**不**请求核心加语法（语言改动代价高，且现有示例不需要）。

## 5. 风险与未验证项

- 英格兰 AD K 数值来自二手转述，未核对规范原文；其他国家规范未查；全部仅作示意警告。
- 14 个楼梯类元素里只有 5 个直跑楼梯可推导；`library` 的楼梯（`st_main`，1400×4500）在示例里没有上层配对，未纳入推导 [读码+实测]。
- 本次未验证楼梯与楼板洞（`void`）的几何一致性，也未验证楼梯头顶净空。
- 直骨架库只在 17 个用例上测过；"没有凹环示例"不等于"用户不会写凹环"。
- `straight-skeleton@1.1.0` 的上游（C# 库）的许可文件为 Apache-2.0（仓库 `LICENSE`）；npm 包 MIT；二者是否一致地授权该移植，未请法律意见 [待核实]。
- CGAL 官方许可页返回 403；GPL 结论依据 CGAL 手册的包概览页与 GitHub 仓库的 `license.txt`。

## 6. 对计划的影响

| 项 | 变化 |
|---|---|
| M3（原 22/11）| **重估为 14/7**：去掉 RF3 自研（−9/−4.5），保留 RF0–RF2 与凹环的降级路径（+1/+0.5）；估算不确定度仍为 ±50% |
| M4 | 14/8 不变；§4.7 第 3 步改为 V1，新增 `W3D_STAIR_PROPORTION` 的判据说明 |
| Q 编号 | 新增 **Q22**（楼梯合规性策略；**已决定**）；Q8 的"RF3 评估"改为已完成（结论 R-a）|
| 附录 H | 第 3 项部分核实（候选库许可与健壮性）；第 7 项已核；第 30 项已核（0 个凹环）；新增第 33 项（AD K 原文）|
| 风险 | R7（直骨架）降级；新增"npm 许可标签与被封装代码不一致"的供应链风险（R23）|
| 核心 | 无 |
