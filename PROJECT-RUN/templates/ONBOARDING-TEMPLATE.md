# ONBOARDING.md · 新人 Onboarding 检查单

> [DORMANT - TEAM MODE] 单人阶段无 onboarding 需求；TEAM 模式激活时给每位新成员走一遍。
> 目标：新人 1 天内（8 小时内）跑通一个完整的 P2-P4 循环（本地开发 → 评审 → 发布演练）。
> 参见 `templates/DORMANT-SWITCHES-TEMPLATE.md` 第 7 项。

## 1. 首日必读（≤ 2 小时）

按顺序读，不要跳：

1. `AGENT.md` —— 仓库红线（Push Rules / Local-Only Data / Interface Border 等）。
   **不看就写代码的人，一律先 revert。**
2. `docs/engineering/PROJECT-RUN/AGENT-PROTOCOL.md` —— P0-P6 阶段机骨架。
3. `docs/engineering/PROJECT-RUN/PROGRESS.md` —— 当前项目状态、当前模式（SOLO/TEAM）、待办优先级。
4. 最近 3 条 ADR：`docs/architecture/decisions/` 目录下最新 3 个 ADR 文件（先读 index，再读内容）。
5. `docs/pitfalls.md` —— 已知坑清单，先入后读成本更低。

## 2. 实操：本地四步跑绿（≤ 2 小时）

```bash
git clone <repo-url> && cd <repo>
<安装依赖：按项目 README 或 pyproject / package.json / go.mod 自行执行>
```

- [ ] 步骤 1：单元测试全绿（项目当前口径）
- [ ] 步骤 2：Lint 全绿（项目当前口径）
- [ ] 步骤 3：类型检查全绿（项目当前口径）
- [ ] 步骤 4：应用启动 + 关键路径 smoke test 通过

任一步红 → 停在这里，不要跳过；先看 `docs/pitfalls.md`，仍未解 → 找模块 Owner。

## 3. 读一篇 SOP / 避坑文（≤ 30 分钟）

从 `docs/sop/` 或 `docs/engineering/` 挑一篇对应你职责的文档通读：
- 后端 / API
- 前端 / 交互
- 打包 / 分发
- 授权 / 激活
- 协作 / 流程

## 4. 提一个 PR（TEAM 模式，≤ 30 分钟）

- 选一个 `docs/engineering/PROJECT-RUN/checklist.md` 里的低价值改动（如修个错别字、补一条 pitfall）。
- 走完整 PR 流程：填 PR 模板 → 触发 CI → 等待 review → 合并。
- 若 PR 由 AI Agent 协助，务必在模板第 6 节填写「已人工复核关键逻辑」。

## 5. 首日完成判定

- [ ] 本地四步全绿
- [ ] 至少读过 1 篇 SOP / 避坑文
- [ ] 至少提交并合并 1 个 PR（哪怕是文档改动）
- [ ] 能在 3 分钟内说明本仓库的 3 条关键红线

## 6. 第二周（可选）

- 认领 1 个 P2 级任务（`docs/engineering/PROJECT-RUN/PROGRESS.md` 中的 P2 列表）。
- 与 Owner 结对一次 code review（不是自己审自己）。

## 7. 卡住时去哪里问

1. 先 `grep` / `docs/pitfalls.md` / `docs/sop/`
2. 再看 `docs/engineering/MODULE-OWNERS.md` 找对应目录 Owner
3. 都无效 → 团队渠道 @ 值班人（见 `RELEASE-ROTATION.md`）
