# START HERE · 从这里开始

> 这是这套工程体系的教学包入口。所有文档按推荐阅读顺序编号，编号即路径。
> 适用读者：想把这套工程体系**照搬到自己的项目**的开发者或团队。

## 这是什么

一套在 2026 年的真实桌面应用项目（12 天冲刺发版，30+ commits、CI 全绿发版）里验证过的工程体系，打包成可复制经验。核心资产：

- 4 篇工程手册 + 一个纯技术 ADR 案例集（本目录，仅保留 2 条无业务敏感的 ADR）
- 1 套纯执行包 [`../PROJECT-RUN/`](../PROJECT-RUN/README.md)（含 AGENT 协议 + 流程总览 + 台账 + 30 项检查单 + 6 个模板）

**适用任何语言的软件项目**——机制（gitignore 纪律、依赖闸门、CI 硬门、决策台账、AI 参与记录）语言无关；模板需要按你的技术栈微调。

## 学习路线

三条路径按你的时间预算选：

### 路径 A：速览（30 分钟）

1. 读本文（5 分钟）
2. 读 `01-ENGINEERING-PLAYBOOK.md` §1 三支柱（15 分钟）
3. 读 `02-GIT-LIFECYCLE-SPEC.md` §1 三远程拓扑（10 分钟）

**产出**：知道这套体系"是什么、为什么这样、Git 上怎么落地"。

### 路径 B：系统学（约 4 小时）

按编号 01→05 顺序通读，边读边勾 [`../PROJECT-RUN/checklist.md`](../PROJECT-RUN/checklist.md)：

| 顺序 | 文档 | 时长 | 关注点 |
|:---:|---|:---:|---|
| 01 | [`01-ENGINEERING-PLAYBOOK.md`](./01-ENGINEERING-PLAYBOOK.md) | 90 分钟 | 三支柱、CI 门禁、发布、知识管理、软著 |
| 02 | [`02-GIT-LIFECYCLE-SPEC.md`](./02-GIT-LIFECYCLE-SPEC.md) | 60 分钟 | 三远程、commit 纪律、tag/发版、回退 |
| 03 | [`03-ADR-CASEBOOK/`](./03-ADR-CASEBOOK/ADR-CASEBOOK-README.md) | 20 分钟 | 2 条纯技术 ADR 案例，理解"决策怎么留痕" |
| 04 | [`04-SOFT-COPYRIGHT-SOP.md`](./04-SOFT-COPYRIGHT-SOP.md) | 45 分钟 | 软著材料整理、AGPL 义务履行 |
| 05 | [`05-AI-CONTRIBUTIONS.md`](./05-AI-CONTRIBUTIONS.md) | 20 分钟 | AI-Model trailer 规范、审计 |

**产出**：能讲清三支柱的每个机制为什么这样设计；能照抄出完整仓库骨架。

### 路径 C：直接用（30 分钟）

不读手册，直接复制执行包落地：

1. 按 [`../PROJECT-RUN/README.md`](../PROJECT-RUN/README.md) §复制到新项目 执行
2. 逐项走 [`../PROJECT-RUN/checklist.md`](../PROJECT-RUN/checklist.md) 30 项检查单
3. CI 全绿即算完成

**产出**：一个具备完整工程护栏的空项目骨架。

### 路径 D：AI Agent 直接执行（0 分钟学习）

AI Agent 不必通读手册。直接读 [`../PROJECT-RUN/AGENT-PROTOCOL.md`](../PROJECT-RUN/AGENT-PROTOCOL.md) + [`../PROJECT-RUN/PROGRESS.md`](../PROJECT-RUN/PROGRESS.md)，按 P0-P6 阶段状态机执行——读 PROGRESS.md 台账定位当前阶段 → 只读当前阶段的步骤 → 每步都有验证命令与 done-when。细节按引用章节按需展开，未覆盖场景写 `BLOCKED` 留人，不自由发挥。

## 各文档一句话 + 阅读时长

| 编号 | 文档 | 一句话 | 时长 |
|:---:|---|---|:---:|
| — | 本文（START-HERE） | 学习地图与复刻指引 | 5 分钟 |
| 01 | ENGINEERING-PLAYBOOK | 工程三支柱 + 9 章机制手册 + 25 项新项目检查单 | 90 分钟 |
| 02 | GIT-LIFECYCLE-SPEC | 三远程拓扑 + commit 纪律 + tag/发版/回退命令 | 60 分钟 |
| 03 | ADR-CASEBOOK | 2 条纯技术 ADR 案例（公开版仅保留无业务敏感的） | 20 分钟 |
| 04 | SOFT-COPYRIGHT-SOP | 中国版权保护中心 30 项材料清单 + AGPL 义务履行 | 45 分钟 |
| 05 | AI-CONTRIBUTIONS | AI-Model commit trailer 规范与审计命令 | 20 分钟 |
| A | AGENT-PROTOCOL（已迁至 [`../PROJECT-RUN/AGENT-PROTOCOL.md`](../PROJECT-RUN/AGENT-PROTOCOL.md)） | AI Agent 阶段状态机操作协议（P0-P6 + 台账 + 全局红线） | 5 分钟 |

> **执行包位置**：`AGENT-PROTOCOL.md`、`PROGRESS.md`、`checklist.md`、`templates/` 已迁至 [`../PROJECT-RUN/`](../PROJECT-RUN/README.md)。**只想执行不看教材**，直接去 PROJECT-RUN；本教学包仅供学习路径 A/B 使用。

## 核心主张（从 PLAYBOOK 提炼）

三条硬主张构成整套体系的骨架：

1. **三支柱不可缺一**
   - 干净的施工环境：仓库只装该装的，运行时数据绝不入库
   - 可追溯可更新的知识体系：决策写 ADR、坑写 handover、手册单一真源
   - 可验证可自动化的测试拦截：CI 硬门拦缺陷、deps-gate 拦依赖漂移、软门兜告警
2. **证据优先**：所有结论标【已验证】/【已确认】/【推测】三档，避免"看起来对"污染决策
3. **一切知识工具化**：机制必须落到脚本 / CI / 模板 / 检查单里，避免"文档说了但没人做"的漂移。文档是索引，工具是权威

## 复刻指引

**只需执行不看原理**：直接去 [`../PROJECT-RUN/`](../PROJECT-RUN/README.md)——完整执行包，含流程总览 + 30 项检查单 + 6 个模板，一个文件夹拷走即用。

**边学边复刻**：在 `../PROJECT-RUN/templates/` 与 `../PROJECT-RUN/checklist.md` 下用 `grep -r "{{"` 找到所有占位符，替换清单：

### 1. 替换占位符

- `{{项目名}}` — 仓库名 / 项目显示名
- `{{owner}}` — 主仓库 owner（GitHub）
- `{{技术栈}}` — 后端 / 前端 / 桌面栈（Python + TypeScript + Electron 是参考实现）
- `{{版本号}}` — 起始版本号，建议 `0.1.0`
- `{{owner-email}}` — commit trailer 里的作者邮箱

### 2. 第一个 CI 怎么点绿

- 先跑通本地：`pytest` + `npx tsc --noEmit` + `npx eslint` + 依赖闸门脚本
- 复制 `ci-template.yml` 到 `.github/workflows/ci.yml`
- 首次 push，看 Actions 面板；有红先看是否是真缺陷
- **不要**为了点绿删掉硬门，改代码或调 gate 范围

### 3. 常见落地障碍

1. **占位符漏替换**：`grep -r "{{"` 一遍，尤其是 `.github/workflows/*.yml` 里的 owner 与 secret 名
2. **CI 硬门一开始就绿不了**：先降规则集严格度（如 ruff 只留 `E9,F63,F7,F82`），别 skip 整个 job。硬门必须存在，严格度可以渐进
3. **依赖闸门与现有代码冲突**：先跑 `--self-test` 确认脚本自身工作，再跑一次实际扫描；缺声明就补 `requirements*.txt`，多声明就删，双向对齐

## 溯源声明

本教学包源自一个 2026 年的真实桌面应用项目实践，非模板套模板。公开版**不含**源项目的经营决策细节、平台名、账号体系、计费模型、服务器路径或提交 hash——那些内容留在内部版本。

- **实践窗口**：2026-10-13 建仓至 2026-10-25 冲刺发版，12 天冲刺发版，30+ commits、CI 全绿发版
- **文档版本**：与源仓库 HEAD（截至 2026-10-25）对齐
- **免责声明**：文档中的"本项目"指源项目；读者复刻到新项目时，机制可复制，具体数字（如 17 类 gitignore、8 硬门）请按你的技术栈重定

---

**下一步**：选一条路径开始。速览走 A，系统学走 B，直接落地走 C。
