# FLOW · 完整流程一页图

> 主线：P0 → P1 → P2 → P3 → P4 → P5；日常环 P2↔P3；失败线 P4→P6。
> 10 分钟读完，之后按阶段展开 AGENT-PROTOCOL。

## 总览

```
       ┌───────────────────┐
       │  P0 建仓         │  .git 就位 · CI 骨架 · 首提交
       └────────┬──────────┘
                ▼
       ┌───────────────────┐
       │  P1 环境绿        │  依赖声明 · 本地四步 · CI 首绿
       └────────┬──────────┘
                ▼
       ┌───────────────────┐        ┌───────────────────┐
       │  P2 开发循环      │◄──────►│  P3 评审          │
       │  TDD · 显式 add   │        │  comment · ADR   │
       └────────┬──────────┘        └───────────────────┘
                ▼
       ┌───────────────────┐
       │  P4 发版          │  顶号 · tag · release
       └────────┬──────────┘
                │ 失败 ─────────►┌───────────────────┐
                ▼               │  P6 事故处置     │
       ┌───────────────────┐    │  止损 · 回滚     │
       │  P5 换版运维      │    └───────────────────┘
       │  镜像 · 文档 · 备份│
       └───────────────────┘
```

## P0 · 建仓

- **目标**：有 CI 骨架的仓，一次干净的首提交
- **关键动作**：`git init`；`.gitignore`/`LICENSE` 先于代码；显式 `git add <path>`
- **关卡**：`git status --short` 干净；`git ls-files | grep -E '\.(db|sqlite)$'` 空
- **产出**：首个 commit + 依赖声明文件就位

## P1 · 环境绿

- **目标**：本地四步绿 + CI 首跑绿
- **关键动作**：依赖闸门脚本；`pytest` + lint + `tsc --noEmit` + deps-gate
- **关卡**：deps-gate exit=0；Actions 首跑全绿
- **产出**：`origin/main` HEAD 对应 CI 全绿

## P2 · 开发循环（日常主环）

- **目标**：特性合入 main，每步有证据
- **关键动作**：TDD 红→绿；显式 add（**禁 `-A`/`.`**）；末行 `AI-Model:`；push 等 CI 绿
- **关卡**：本地四步全绿；PR CI 全绿
- **产出**：目标 commit 进 `origin/main`

## P3 · 评审（P2 对偶）

- **目标**：Critical/High 全 resolved，涉及决策入 ADR
- **关键动作**：分级处置表 → comment → 修复（新 commit，不 squash 覆盖）→ 复审
- **关卡**：所有 Critical/High resolved；ADR 落 `docs/architecture/decisions/`
- **产出**：PR merged
- **日常环**：P2↔P3 反复迭代直至合入

## P4 · 发版

- **目标**：tag + release artifacts 可下载
- **关键动作**：七步——顶号 → 本地全绿 → `release:` commit → 双推 → tag → release.yml → 验收
- **关卡**：本地四步绿；`release.yml` artifacts 校验；已发布防覆盖
- **产出**：`git tag --list v*` 含新版本

## P5 · 换版运维

- **目标**：三件事当日完成，回退路径可执行
- **关键动作**：Docker build/push → 官网 ff-only 同步 → 备份（镜像 + 源码 + db dump）
- **关卡**：`docker manifest inspect` 成功；`git rev-parse HEAD` 与 origin 对齐
- **产出**：新版本对外可取；上一版仍可回滚

## P6 · 事故处置

- **目标**：止损 → 回滚 → 入档 → 补 ADR
- **关键动作**：决策表——CI 红停推；假警报降严格度（**禁 skip job**）；误推凭据 `git filter-repo`
- **关卡**：影响消除；事故报告入 `docs/handover/`；ADR 落地
- **产出**：无残留告警；下一版带修复

## 三支柱贯穿

| 阶段 | 干净的施工环境 | 可追溯的知识 | 可验证的拦截 |
|:---:|---|---|---|
| P0 | gitignore 三件套先就位 | 首条 ADR 建目录 | 显式 add，禁 `-A` |
| P1 | 依赖声明 = 单真源 | 依赖闸门脚本 + 自测 | CI 硬门四步 |
| P2 | 每 commit 单一真源不变 | TDD 红→绿留证据 | 本地四步 + CI |
| P3 | 不 squash 覆盖历史 | 决策写 ADR；分级处置表 | PR CI + 评审清单 |
| P4 | tag 与版本号单一真源 | CHANGELOG 溯源到 commit | release.yml 体积/防覆盖守卫 |
| P5 | 部署仓 ff-only 同步 | 事故/换版入 handover | 备份可拉；manifest 可查 |
| P6 | 先止损再修 | 事故报告 + ADR 入档 | 门禁本身可自测修复 |

## 全局红线

- 禁 `git add -A` / `git add .` / force push（除非人类显式指令）
- CI 硬门不可绕过：不 skip job、不注释 gate、不改 CI 让红变绿
- 凭据 / cookie / 指纹 / IP 池 / 本地 db 绝不入库
- 协议未覆盖 → 写 `BLOCKED` 留人，不自由发挥
- 决策变更必须写 ADR；AI 主导 commit 末行 `AI-Model:`
- U+FFFD=0 / LF 换行 / 中文优先
