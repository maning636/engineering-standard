# DORMANT-SWITCHES.md · 休眠开关总清单

> [DORMANT - TEAM MODE] 单人（SOLO）阶段所有条目均处于休眠。
> 团队模式激活时按第 5 节顺序启用，无需删除任何文件——只需按「激活动作」列执行。
> 与 `PROJECT-RUN/DUAL-MODE.md` §4 表格一一对应。

## 1. 总表（7 项）

| # | 休眠项 | 文件位置 | 激活动作 | 验证方式 | 归属检查单编号 |
|---|--------|----------|----------|----------|----------------|
| 1 | PR 模板 | `.github/pull_request_template.md` | 保留文件即可（GitHub 自动加载），把顶部 `<!-- DORMANT -->` 注释块删除 | 新建空 PR，正文应自动带出模板字段 | TEAM 硬激活 #2 |
| 2 | CODEOWNERS | `.github/CODEOWNERS` | 取消每行行首 `# `，把 `@TBD` 换成真实 GitHub username | `git push` 后开 PR，应自动请求对应 reviewer | TEAM 硬激活 #3 |
| 3 | branch protection 规则说明 | 本文档第 2 节 | 在 GitHub Settings → Branches → Add rule 中按文档勾选 | `git push origin main` 应被拒绝 | TEAM 硬激活 #1 |
| 4 | CI required status checks | GitHub Settings → Branches（同 #3） | 勾选 CI job 为 required | 红 CI 的 PR 应无法合并 | TEAM 硬激活 #1b |
| 5 | 模块 Owner 名单 | `docs/engineering/MODULE-OWNERS.md` | 把 `<待填>` 换成真实姓名/团队 | 每人能在文档里搜到自己负责的目录 | TEAM 硬激活 #4 |
| 6 | 发布轮值表 | `docs/engineering/RELEASE-ROTATION.md` | 排班并公布到团队渠道 | P4 执行人能在表格里查到当日责任人 | TEAM 软激活 #5 |
| 7 | 团队 onboarding 检查单 | `docs/engineering/ONBOARDING.md` | 启用并让新人走一遍 | 新人 1 天内跑通完整 P2-P4 | TEAM 软激活 #7 |

Agent 产出人类复核声明随 PR 模板激活自动生效（TEAM 软激活 #6），不单列。

## 2. branch protection 操作文档（第 3 项展开）

> 位置：GitHub → Repository → Settings → Branches → Add branch ruleset（或旧版 Branch protection rules）。
> 目标分支：`main`。以下 5 项建议配置。

1. **Require a pull request before merging**
   - 勾选后：`git push origin main` 直接被拒。
   - 子项建议：`Require approvals` = 1（≥1 人审批，TEAM 起步阈值）。
2. **Dismiss stale pull request approvals**：保持关闭（PR 更新后不重置审批，减少来回）。
3. **Require status checks to pass before merging**
   - 勾选后勾选具体 CI job（如 `test`、`lint`）。
   - **必须包含 `pull_request` 触发的 job**，否则 PR 阶段 CI 不跑，required check 永远 pending。
4. **Require branches to be up to date**：视团队偏好，默认关闭（避免频繁 rebase）。
5. **Restrict who can push to matching branches**：可勾选并限定到维护者，SOLO→TEAM 首日建议启用。

### 2.1 验证命令（激活后一次性核对）

```bash
# 期望：被 GitHub 拒绝，HTTP 403 / pre-receive hook declined
echo "# branch-protection-smoke $(date +%s)" >> docs/PROGRESS.md
git add docs/PROGRESS.md && git commit -m "chore: branch-protection smoke"
git push origin main
# 期望输出片段：
#   ! [remote rejected] main -> main (pre-receive hook declined)
#   error: failed to push some refs to 'origin'
# 验证通过后回滚：git reset --hard HEAD~1
```

若上述 push 成功（exit 0），说明 branch protection 未生效——回仓库 Settings 检查勾选。

### 2.2 常见坑

- CI job 名与勾选名不一致 → required check 永远 pending。以 Actions 页面顶部 job 名为准。
- 只在 `push` 触发未加 `pull_request` → PR 阶段 CI 不跑，required check 无信号。
- 规则加在 `main` 上、但本地默认分支被改成 `master` → 规则不生效；仓库里确认 Default branch = `main`。

## 3. 激活顺序（一次性，约 30 分钟）

1. branch protection（含 CI required check）→ 2. PR 模板 → 3. CODEOWNERS 填实名
→ 4. MODULE-OWNERS 公布 → 5. RELEASE-ROTATION 排班 → 6. ONBOARDING 走通
→ 7. 全员通读 AGENT.md 红线。
8. 完成后把 `docs/engineering/PROJECT-RUN/PROGRESS.md` 头部改为 `# 模式: TEAM` 并更新时间戳。

## 4. 反向切换（TEAM → SOLO）

- 关闭或放宽 main 的 branch protection
- 把 CODEOWNERS 每行行首重新加上 `# `
- PR 模板可保留（单人也能自审）
- 无需删除任何历史 ADR / pitfalls / CI 配置
