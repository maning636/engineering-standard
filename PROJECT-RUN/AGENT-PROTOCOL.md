# AGENT-PROTOCOL · AI Agent 操作协议

> **给机器读的协议**。Agent 读到本文件后：读 `PROGRESS.md` 定位当前阶段 → 执行当前阶段的步骤 → 更新台账。
> 细节不在本文件展开，全部**引用**到 ENGINEERING-KIT 对应章节，agent 需要时才打开。

## 头部约定

- 位置：仓库根 `PROGRESS.md`（由 `PROJECT-RUN/templates/PROGRESS-TEMPLATE.md` 实例化；PROJECT-RUN 已附带一份 `PROGRESS.md` 现成台账）。
- 入口关系：`AGENT.md` = 本仓库纪律入口（红线/禁令/本地数据）；本文件 = 通用操作协议（阶段机）。**先读 AGENT.md，再读本文件。**
- 台账格式（PROGRESS.md 顶部两行）：
  ```
  # 阶段: P2
  # 更新: 2026-10-25T13:40
  ```
- 每次进入新阶段：改这两行 + 勾选对应 checklist；不跨阶段勾选。
- 每阶段三件套：**进入条件 / 步骤（做什么+怎么验证）/ 完成标志（done-when）**。
- 升级路径：协议未覆盖 → 读引用的手册章节 → 仍无答案 → 在 PROGRESS.md「裁决记录」写 `BLOCKED: <问题>` 留给人类。**禁止自由发挥绕过门禁。**

## 阶段总览

| 阶段 | 触发 | 产出 | 参考章节 |
|:---:|---|---|---|
| P0 | 无 `.git/` | 有 CI 骨架的仓 | GIT-SPEC §2、PROJECT-RUN/README |
| P1 | 有仓但 CI 未绿 | 本地+CI 全绿 | PLAYBOOK §2、§5 |
| P2 | 日常迭代 | 特性合入 main | AGENT.md、PLAYBOOK §5 |
| P3 | PR 或子智能体产物 | 评审通过 | PLAYBOOK §5.4 |
| P4 | 版本就绪 | tag + release 出包 | GIT-SPEC §6 |
| P5 | 发版后运维 | 镜像/官网/备份就位 | GIT-SPEC §8-§9 |
| P6 | 事故信号 | 止损+回滚完成 | GIT-SPEC §8、附录 A.3 |

## P0 · 新项目引导

**进入条件**：`test ! -d .git`
**参考**：[PROJECT-RUN/README.md](./README.md)、[GIT-SPEC §2](../ENGINEERING-KIT/02-GIT-LIFECYCLE-SPEC.md)

步骤：
1. 复制本执行包：`cp -r docs/engineering/PROJECT-RUN/* .`（含 AGENT-PROTOCOL / checklist / templates / PROGRESS 台账），并按 `README.md` §复制步骤落位。
   验证：`ls .github/workflows/ AGENT.md docs/architecture/decisions/ PROGRESS.md`
2. 实例化 PROGRESS.md：`PROJECT-RUN/PROGRESS.md` 已实例化好台账，直接改 `{{项目名}}` / `{{owner}}` / `{{版本号}}` 即可；也可从 `PROJECT-RUN/templates/PROGRESS-TEMPLATE.md` 重新实例化。
   验证：`grep -c '{{' PROGRESS.md` 期望 0（除非你保留 `{{owner}}` 类占位符，则全部替换成实际值）。
3. `.gitignore` / `.gitattributes` / `LICENSE` 三件套先于任何代码文件就位。
   验证：`git check-ignore -v <敏感路径样例>` 命中。
4. `git init && git add <显式路径> && git commit -m "chore: 建仓骨架"`。
   验证：`git status --short` 干净；`git ls-files | grep -E '\.(db|sqlite)$'` 空。
5. PROGRESS.md 更新 `# 阶段: P1`，勾选 P0 checklist。

**done-when**：`git log --oneline | wc -l` ≥ 1，`git status` 干净。

## P1 · 环境就绪

**进入条件**：`.git/` 存在且首次提交已完成
**参考**：[PLAYBOOK §2 环境即代码](../ENGINEERING-KIT/01-ENGINEERING-PLAYBOOK.md)

步骤：
1. 依赖声明就位（`requirements*.txt` / `package.json`），跑依赖闸门脚本。
   验证：`python scripts/tests/check_requirements_cover_imports.py` exit=0。
2. 本地全绿：`pytest` + lint + `tsc --noEmit` + 依赖闸门。
   验证：四步 exit=0。
3. 复制 CI 模板到 `.github/workflows/ci.yml`，`git push origin main`。
   验证：GitHub Actions 首跑全绿。
4. PROGRESS.md 更新 `# 阶段: P2`，勾选 P1 checklist。

**done-when**：`origin/main` HEAD 对应 CI 全绿。

## P2 · 日常开发循环

**进入条件**：CI 全绿
**参考**：[PLAYBOOK §5 质量门禁](../ENGINEERING-KIT/01-ENGINEERING-PLAYBOOK.md)、[AGENT.md](../../../AGENT.md)

步骤：
1. 领取任务：读 issue / 需求 / 用户请求，写在 PROGRESS.md「任务栈」。
   验证：任务描述 ≤5 行，含验收标准。
2. TDD 红→绿：先写失败测试 → 跑一遍看到红 → 写实现 → 跑到绿。
   验证：`pytest -x` exit=0，且新增测试先红后绿有据可查（commit diff 里 test 与 impl 同 PR）。
3. 本地四步全绿：`pytest` + lint + `tsc` + deps-gate。
4. 显式 add 后提交：`git add <path1> <path2>`（**禁 `git add -A` / `.`**），message 遵循 GIT-SPEC §3.1，末行 `AI-Model: <模型名>`（若 AI 主导）。
   验证：`git diff --cached --stat` 每行都是预期文件。
5. push + 等 CI 绿：`git push origin main`。
   验证：Actions 全绿。
6. 更新 PROGRESS.md 勾选该任务。

**done-when**：目标 commit 已进 `origin/main` 且 CI 绿。

<!-- 双模执行层 -->
**[SOLO]** 直推 main（本地四步全绿 + 自审清单通过后）；Agent 可互审。
**[TEAM]** 必须走 PR + CODEOWNERS 审查 + ≥1 人类审批；Agent 产出需人类在 PR 描述声明「已人工复核关键逻辑」。

## P3 · 变更评审

**进入条件**：PR 打开 或 子智能体产出待审
**参考**：[PLAYBOOK §5.4 评审流](../ENGINEERING-KIT/01-ENGINEERING-PLAYBOOK.md)

步骤（实现 → 评审 → 修复 → 复审）：
1. 打开 PR，跑评审清单（引用 [checklist.md](./checklist.md) 相关节）。
2. 逐条 comment，按分级处置表分类。
3. 修复：新增 commit，不 squash 覆盖历史。
4. 复审：所有 Critical/High comment resolved 后关闭 PR。

**发现分级处置表**：

| 级别 | 定义 | 处置 | 是否阻断合入 |
|:---:|---|---|:---:|
| Critical | 数据丢失/凭据泄露/门禁绕过 | 立即回退或修复 | 是 |
| High | 破坏兼容/性能回归/测试缺失 | 本 PR 内修复 | 是 |
| Medium | 设计漂移/文档未更/命名不一致 | 本 PR 或下一 PR | 否 |
| Low | 措辞/格式/注释 | 下一 PR 或 backlog | 否 |

**done-when**：PR merged，所有 Critical/High resolved，ADR 涉及决策已入 `docs/architecture/decisions/`。

<!-- 双模执行层 -->
**[SOLO]** 直推 main（本地四步全绿 + 自审清单通过后）；Agent 可互审。
**[TEAM]** 必须走 PR + CODEOWNERS 审查 + ≥1 人类审批；Agent 产出需人类在 PR 描述声明「已人工复核关键逻辑」。

## P4 · 发版

**进入条件**：待发布特性集齐，CHANGELOG 已更新，本地全绿
**参考**：[GIT-SPEC §6.3 发版七步](../ENGINEERING-KIT/02-GIT-LIFECYCLE-SPEC.md)

步骤（七步，只列步号，细节读 §6.3）：
1. §6.3-S1 顶号：改 `CHANGELOG.md` 与版本号单一真源。
2. §6.3-S2 本地全绿四步。
3. §6.3-S3 commit：`release: vX.Y.Z`。
4. §6.3-S4 双推：`origin` → 等 CI 绿 → `{{deploy-remote}}`（部署裸仓，可省略）。
5. §6.3-S5 tag：`git tag -a vX.Y.Z` → `git push origin vX.Y.Z`。
6. §6.3-S6 release.yml 出包，看 artifacts。
7. §6.3-S7 验收：装包 / 冒烟 / 更新 latest.yml。

**done-when**：`git tag --list v*` 包含新版本，release artifacts 可下载，验收清单全勾。

<!-- 双模执行层 -->
**[SOLO]** 直推 main（本地四步全绿 + 自审清单通过后）；Agent 可互审。
**[TEAM]** 必须走 PR + CODEOWNERS 审查 + ≥1 人类审批；Agent 产出需人类在 PR 描述声明「已人工复核关键逻辑」；发布轮值执行、技术 Owner 保留最终解释权。

## P5 · 运维与换版

**进入条件**：新 tag 已推送
**参考**：[GIT-SPEC §8 变更回退](../ENGINEERING-KIT/02-GIT-LIFECYCLE-SPEC.md)、[§9 部署仓同步](../ENGINEERING-KIT/02-GIT-LIFECYCLE-SPEC.md)

步骤：
1. 镜像轮次：新 tag → Docker build/push → 更新部署仓指向。
   验证：`docker manifest inspect <image>:vX.Y.Z` 成功。
2. 官网/文档同步：`git push {{deploy-remote}} main`（§9.2 ff-only，仅启用部署裸仓时）。
   验证：服务器工作副本 `git rev-parse HEAD` == `origin/main`。
3. 备份轮次：数据库 dump + 源码包 → 备份盘，按 §8.3 命名。
   验证：备份目录 `ls -lt | head` 包含当日条目。
4. 保留上一版本可回退（§8.2）。
   验证：旧 tag 镜像仍可拉取。

**done-when**：三件事（镜像/文档/备份）当日完成，回退路径可执行。

<!-- 双模执行层 -->
**[SOLO]** 直推 main（本地四步全绿 + 自审清单通过后）；Agent 可互审。
**[TEAM]** 必须走 PR + CODEOWNERS 审查 + ≥1 人类审批；Agent 产出需人类在 PR 描述声明「已人工复核关键逻辑」；发布轮值负责备份与回退路径验证。

## P6 · 事故处置

**进入条件**：CI 红 / 发布失败 / 误推敏感信息 / 生产告警
**参考**：[GIT-SPEC §8 变更回退](../ENGINEERING-KIT/02-GIT-LIFECYCLE-SPEC.md)、附录 A.3

**决策表**：

| 信号 | 立即动作 | 后续 |
|---|---|---|
| CI 硬门红 | 停 push，本地复现 | 修 → 新 commit，不 amend |
| CI 假警报 | 降规则集严格度 | **禁 skip 整个 job**，写 ADR 记录 |
| 发布失败 | 不重打 tag，回 §6.3-S4 排查 | 定位后重推 CI 绿再推 tag |
| 误推敏感信息 | 立即吊销凭据；`git filter-repo` 清历史 | 走 §8.1 revert + 新凭据入库前 review |
| 生产事故 | 先止损（回退到上一版镜像/源码） | 事故报告入 `docs/handover/` + ADR |
| 门禁本身有 bug | 修 gate 脚本 + `--self-test` 加用例 | 写 ADR，不跳过当前 PR 检查 |

**done-when**：影响消除 + 事故记录入档 + 相关 ADR 落地。

## 全局红线（禁越）

1. **禁 `git add -A` / `git add .`** — 必须显式列路径。
2. **禁 force push**（除非人类显式指令，且限于未共享分支）。
3. **凭据 / cookie / 指纹 / IP 池 / 本地 db 绝不入库**（AGENT.md 本地数据清单为准）。
4. **CI 硬门不可绕过**：不 skip job、不注释 gate、不改 CI 让红变绿。
5. **依赖变更走闸门**：新增 import 必须先在 `requirements*.txt` / `package.json` 声明。
6. **决策变更必须写 ADR**：涉及架构 / 版本策略 / 门禁规则的改动。
7. **协议未覆盖 → BLOCKED 留人**，禁止 agent 自由发挥绕过。
8. **AI 主导的 commit 末行必带 `AI-Model: <模型名>`**（AGENT.md AI 参与记录）。
9. **不 push 到未确认的远程**；三远程拓扑见 GIT-SPEC §1。
10. **U+FFFD=0 / LF 换行 / 中文优先** — 所有本仓库文档。
11. **派发小模型执行时按其能力极限写提示词**：给完整路径/完整代码/可复制命令/可验证验收，禁止只给「思路」；见 [`AGENT-DISPATCH.md`](./AGENT-DISPATCH.md)。
12. **执行交给子智能体，主模型只监工**：拆解/设计/审核/判定归主模型，文件读写与命令执行归子智能体；子智能体不可用时才可临时接管，且必须在报告中记录原因与范围。见 [`AGENT-DISPATCH.md`](./AGENT-DISPATCH.md) §9。

## 附录 · Agent 自查 checklist（每次行动前扫一遍）

- [ ] `git status --short` 已看，无敏感文件入 index
- [ ] 当前 PROGRESS.md 阶段 = 我要做的事的阶段？
- [ ] 本阶段引用章节是否已读？未读则读
- [ ] 步骤 4-5 的验证命令我已准备好跑？
- [ ] 若本阶段协议没覆盖 → 我会写 BLOCKED 而不是硬上
