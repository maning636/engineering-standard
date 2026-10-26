# PROJECT-RUN · 纯执行包

> 从建仓到发版的完整流程，一个文件夹 = 完整闭环。**不含教材**；想懂原理，去 `../ENGINEERING-KIT/START-HERE.md`。

## 人用 · 三步上手

1. 读 [`FLOW.md`](./FLOW.md) 看全貌（10 分钟）
2. 照 [`checklist.md`](./checklist.md) 30 项逐项勾
3. 卡住时查 [`AGENT-PROTOCOL.md`](./AGENT-PROTOCOL.md) 对应阶段（P0-P6）

**双模说明**：SOLO 起步、TEAM 切换，见 [`DUAL-MODE.md`](./DUAL-MODE.md)。

## Agent 用 · 零步上手

读 [`AGENT-PROTOCOL.md`](./AGENT-PROTOCOL.md) + [`PROGRESS.md`](./PROGRESS.md) 即开工（1k token 内），按 P0-P6 阶段状态机执行。

## 包内文件清单

| 文件 | 说明 |
|---|---|
| `README.md` | 本文件：定位、三步上手、文件清单 |
| `FLOW.md` | 完整流程一页图（P0-P6 + 分支 + 三支柱贯穿） |
| `AGENT-PROTOCOL.md` | Agent 阶段状态机（P0-P6 + 台账 + 全局红线） |
| `PROGRESS.md` | 现成台账（已按模板实例化，占位符保留） |
| `DUAL-MODE.md` | 双模工程协议：SOLO/TEAM 切换、休眠开关、模式标记 |
| `checklist.md` | 30 项启动检查单 |
| `templates/ci-template.yml` | 精简版硬门 CI 骨架 → `.github/workflows/ci.yml` |
| `templates/security-template.yml` | 安全扫描骨架 → `.github/workflows/security.yml` |
| `templates/AGENT-TEMPLATE.md` | AGENTS.md 骨架 → `AGENT.md` |
| `templates/ADR-TEMPLATE.md` | 单条 ADR 模板 → `docs/architecture/decisions/` |
| `templates/PROGRESS-TEMPLATE.md` | 台账模板（`PROGRESS.md` 即由其实例化） |
| `templates/PULL_REQUEST_TEMPLATE.md` | PR 模板 → `.github/pull_request_template.md`（十节：验证证据/坑清单/文档同步/AI 记录/TEAM 人工复核声明） |
| `templates/CODEOWNERS-TEMPLATE` | CODEOWNERS 骨架（`[DORMANT - TEAM MODE]` 全注释） |
| `templates/DORMANT-SWITCHES-TEMPLATE.md` | 休眠开关总清单 + branch protection 操作文档 |
| `templates/MODULE-OWNERS-TEMPLATE.md` | 模块 Owner 名单骨架（通用目录占位） |
| `templates/RELEASE-ROTATION-TEMPLATE.md` | P4 发布轮值表模板 |
| `templates/ONBOARDING-TEMPLATE.md` | 新人 1 天跑通 P2-P4 检查单 |
| `templates/PITFALLS-TEMPLATE.md` | pitfalls 五元组格式说明 + 虚构示例 |

## 复制到新项目

```bash
# 在新项目根目录执行
cp -r docs/engineering/PROJECT-RUN/* .
# 然后：替换 templates/ 与 PROGRESS.md 里的 {{项目名}} 等占位符
grep -rn '{{' . --exclude-dir=.git --exclude-dir=node_modules
```
