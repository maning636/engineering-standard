# engineering-standard · 工程标准库

> 本库是团队的**软件工程标准**：从建仓到发版回滚的完整流程与规则，源自一个 2026 年的真实桌面应用项目冲刺实践。
> 新项目从这里复制骨架；AI Agent 进项目后按协议执行。

## 库结构

| 目录 | 用途 | 给谁用 |
|---|---|---|
| `PROJECT-RUN/` | **纯执行包**：完整流程（FLOW）+ Agent 协议 + 台账 + 30 项检查单 + 6 个模板 | 新项目开工直接拷；Agent 零学习执行 |
| `ENGINEERING-KIT/` | 教材区：工程手册 + Git 全生命周期规范 + 12 条 ADR 案例 + 软著 SOP + AI 贡献记录 | 理解"为什么"；新人系统学习 |

## 新项目怎么用（人）

1. 拷 `PROJECT-RUN/` 到新仓库根
2. 读 `PROJECT-RUN/README.md` 三步上手：FLOW 看全貌 → checklist 逐项勾 → 卡住查 AGENT-PROTOCOL
3. 模板按需实例化（CI/安全工作流/AGENT.md/PR 模板）

## 新项目怎么用（AI Agent）

把 `PROJECT-RUN/AGENT-PROTOCOL.md` 与 `PROGRESS.md` 放进新仓库根。Agent 阅读顺序：

```
AGENT.md（项目纪律，若有）→ AGENT-PROTOCOL.md（阶段状态机）→ PROGRESS.md（定位当前阶段）
```

冷启动约 1k token，之后按阶段增量读取。

## 标准的演进

- 任何标准变更走本库的 PR：改动 → 说明为什么 → 合入
- 大的原则性变更记录为 ADR（模板在 `PROJECT-RUN/templates/ADR-TEMPLATE.md`）
- 各项目落地时按需裁剪，但**三支柱与十条红线不可裁**（见 `PROJECT-RUN/AGENT-PROTOCOL.md`）

## 溯源

本库的方法论抽象自一个 2026 年的真实桌面应用项目冲刺实践——从建仓到发版回滚、从 CI 硬门到事故处置，都是在那个项目里被验证过的。公开版不含任何业务经营细节、平台名、账号体系、计费模型、服务器路径或提交 hash；方法论保留完整，落地数字与真实资产需按你的技术栈自行替换。
