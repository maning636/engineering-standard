# ORCHESTRATION · 代码阶段编排

> 位置：FLOW 的 P2 开发循环。单模块项目不需要本文件；两个以上模块要并行开发时必须走本文件。
> 解决的问题：多个子代理并行时接口对不上、命名不统一、越界改文件、合并冲突、架构跑偏。过去靠技术总监盯，现在靠契约、任务图和合并门脚本。
> 上游：`REQUIREMENTS.md` 的需求编号（已确认状态）。下游：`VERIFY.md`、`CRAFTS/ACCEPTANCE.md`。

## 1. 四条原则

1. **连贯性靠契约，不靠盯人。** 并行开工前冻结接口。子代理只在契约内写实现，不改契约。
2. **状态全在文件和 git 里。** 任务图、契约、尝试记录都是文件。新会话读完文件就能接手，不依赖任何 Agent 的记忆。
3. **能不能合并由脚本判定。** 合并门的退出码说了算，模型说“我测过了”不算数。
4. **总监这一层尽量薄。** 调度和门禁用脚本；只有重排计划和漂移检查需要模型判断。

## 2. 五步流程

### ① 架构阶段（只做一次；用强模型，人确认）

输入：已确认的需求集（client-requirements 产出的 prd.md 或 REQ 文件）。

产出，全部进仓库：

| 产出 | 位置 | 模板 |
|---|---|---|
| 架构图和模块边界 | `docs/arch/ARCH-MAP.md` | `templates/ARCH-MAP-TEMPLATE.md` |
| 接口契约（类型/接口定义 + 说明） | `contracts/` + `docs/arch/contracts/*.md` | `templates/INTERFACE-CONTRACT-TEMPLATE.md` |
| 桩代码 | 各模块目录，只有签名，实现抛“未实现” | - |
| 契约测试 | `contracts/__tests__/` 或项目约定位置 | - |
| 任务图 | `docs/arch/TASK-GRAPH.yaml` | `templates/TASK-GRAPH-TEMPLATE.yaml` |

完成判据（全部满足才进入②）：

- 桩代码能编译或能被导入
- 契约测试能跑起来（此时允许失败，不允许报“找不到测试”）
- `node scripts/orchestrate/next-tasks.mjs validate docs/arch/TASK-GRAPH.yaml` 退出码为 0
- 人看过 ARCH-MAP，并在文件头部写上确认人和日期

### ② 调度循环（脚本为主）

```bash
node scripts/orchestrate/next-tasks.mjs list docs/arch/TASK-GRAPH.yaml       # 现在能开工的任务
node scripts/orchestrate/next-tasks.mjs dispatch docs/arch/TASK-GRAPH.yaml T-014 > .orchestrate/T-014.md   # 生成工作包
```

调度者（人或主 Agent）做三件事：取任务、生成工作包、把任务状态改为 `doing` 并填 `owner`。`list` 已经排除了和 `doing` 任务写范围冲突的任务，按它的输出派发就不会撞车。

### ③ 子代理执行（弱模型也行）

子代理只读工作包和 `read_scope` 里的文件，只改 `write_scope` 里的文件，跑通 `accept` 命令后提交。发现契约不够用时，停下来写契约变更提案（第 4 节），不要绕过。

### ④ 合并门（纯脚本）

```bash
node scripts/orchestrate/merge-gate.mjs T-014 --graph docs/arch/TASK-GRAPH.yaml --base integration
```

依次检查：改动文件都在 `write_scope` 内 → 没碰契约目录（除非任务标了 `contract_change: true`）→ `accept` 通过 → 契约测试通过 → 全量测试通过 → lint 通过。

- 退出码 0：调度者把分支合进集成分支，任务状态改为 `done`。
- 退出码 1：把输出原样贴回给子代理重做。尝试次数记在 `.orchestrate/attempts.json`。
- 退出码 3（第 3 次失败）：任务状态改为 `blocked`，交给人，不再自动重试。

合并门只判定，不改任务图，也不替你合并。状态由调度者改，这样每一次状态变化都留在 git 记录里。

### ⑤ 漂移检查（每合并约 5 个任务，或每个里程碑一次）

评审 Agent 对照 `docs/arch/ARCH-MAP.md` 和 `templates/DRIFT-REVIEW-CHECKLIST.md` 逐项检查，输出偏离项。偏离项转成修复任务写进任务图（`id` 用 `T-FIX-xx`），不在原地顺手改。

## 3. 拆任务的规则

- 一个任务只改一个模块。没有依赖关系的任务之间，`write_scope` 不能重叠（`validate` 会检查）。
- 一个任务改动的文件不超过 6 个（`budget.files`），改动量是弱模型一次能稳妥完成的大小。
- 先公共层（类型、数据结构、工具函数），后业务层；前端和后端通过契约并行。
- 依赖链短而宽。同时推进的任务通常是 3～8 个。能并行多少，取决于任务图有多宽，和开了多少个代理无关。
- 每个任务都有能机判的 `accept` 命令。写不出验收命令，说明任务拆得不对，回去重拆。
- 每个任务都要关联需求编号（`req`）。任务图里出现没有需求编号的任务，要么是架构类任务（写 `req: [ARCH]`），要么是范围蔓延。

## 4. 契约变更

子代理不能自己改契约。流程：

1. 写 `docs/arch/contract-changes/CC-<两位>.md`（模板 `templates/CONTRACT-CHANGE-TEMPLATE.md`）：改什么、为什么、影响哪些任务。
2. 由人批准。这属于“架构”类拍板，不能由 Agent 自己批。
3. 批准后：契约文件升版本号；开一个专门的任务（带 `contract_change: true`）改契约和契约测试；受影响的已完成任务回到 `ready`。

契约变更如果来自需求变化，先走 `REQUIREMENTS.md` 第 7 节的变更提案（CP），CP 批准后再提 CC。

## 5. 环境一致性

FLOW 的 P1“环境绿”在本流程里要求一条命令起好环境，包括依赖安装、测试数据和 `.env.example`。这条命令写进 ARCH-MAP 的“环境”一节。所有子代理用同一条命令，不接受“我这能跑”。

任务图顶层的 `gate` 段写的是合并门使用的命令，必须和 CI 里的命令一致。

## 6. 降级跑法（同一套文件，三种执行方式）

| 工具条件 | 跑法 |
|---|---|
| 支持子代理或多会话 | 真并行。每个子代理用 `git worktree add ../wt-T-014 -b task/T-014 integration` 开独立工作目录 |
| 只有单会话 CLI | 按 `list` 的输出串行执行，每个任务开一个新会话，只给工作包 |
| 没有 CLI，只有聊天模型 | 人把工作包贴进对话，把代码贴回仓库，合并门照常在本地跑 |

三种跑法里，合并门都不能省。省掉合并门，就退化成“看起来写完了”。

## 7. 和其他文件的关系

- `REQUIREMENTS.md`：任务的 `req` 字段写需求编号；任务合并后在追踪表“任务/PR”列登记。
- `AGENT-DISPATCH.md`：工作包由 `next-tasks dispatch` 生成，“范围”一段就是 `write_scope`。脚本输出的五段标题是目标/范围/输入/验收/约束，如果 AGENT-DISPATCH 定义的段名不同，以 AGENT-DISPATCH 为准，改脚本里的标题。
- `CRAFTS/VERIFY.md`：合并门是 VERIFY 在任务一级的机判版；整体 VERIFY 仍在里程碑结束时做。
- `CRAFTS/DESIGN.md`：多模块项目的设计产物就是 ARCH-MAP 加接口契约。
- 脚本限制：任务图解析器只支持受限 YAML 子集，见模板头部说明。

## 8. 借鉴边界

借鉴了契约优先开发（contract-first）、看板的 WIP 限制、代码所有权（CODEOWNERS）的思路。没有引入完整的项目管理工具，也不要求固定的 Agent 框架。脚本是零依赖 Node，换任何 Agent 都能用。
