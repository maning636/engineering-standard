# Git 全生命周期规范 · GIT LIFECYCLE SPEC

> 来源：一个 2026 年的真实桌面应用项目从建仓第一天到发版回滚的完整 Git 实现实践。公开版已把源项目的仓库名、服务器地址、SSH 密钥路径、备份盘路径全部替换为占位符（`{{owner}}` / `{{repo}}` / `{{server-ip}}` / `{{app}}` / `{{backup-root}}` 等）——按你的环境替换。
> 定位：`01-ENGINEERING-PLAYBOOK.md` 的**姊妹篇**。PLAYBOOK 讲「为什么这样工程化」，本手册讲「Git 具体怎么做」；工程原理回 PLAYBOOK，本手册只写命令与流程。
> 阅读方式：先扫 §1 三远程拓扑建立心智，再按章查流程；附录 A 命令速查卡，附录 C 新项目 15 项启动检查单。

---

## §1 仓库拓扑：三远程模型

### 1.1 三个远程

| 名 | 位置 | 用途 | 权限 |
|---|---|---|---|
| `origin` | GitHub 公开仓 `{{owner}}/{{repo}}` | 代码真源；CI/CD 触发点；对外交付通道 | 读 + 写（push main + tag） |
| `{{deploy-remote}}` | `root@{{server-ip}}:/opt/{{app}}/repo.git`（**裸仓库**） | 部署源；服务器工作副本的源 | 只写（push），不 fetch |
| `upstream` | 上游开源仓（仅 fork 场景需要） | 只读上游同步 | 只读；`fetch upstream` 后本地 merge |

### 1.2 同步方向图

```
       ┌──── 上游（upstream，仅 fork 场景） fetch → 本地 merge ────┐
       ▼                                                         │
  ┌──────────┐  push main/tag  ┌──────────┐   触发    ┌────────┐ │
  │  本地    │ ───────────────► │  origin  │ ────────► │ release│ │
  │ worktree │                 │ (GitHub) │           │  .yml  │ │
  └──────────┘                 └──────────┘           └────────┘ │
      │ push main (SSH)                                          │
      ▼                                                          │
  ┌────────────┐  服务器 git fetch + merge --ff-only  ───────────┤
  │ {{deploy-remote}}│                                          │
  │ (bare repo) │                                                 │
  └─────┬──────┘                                                  │
        │ clone 出工作副本                                       │
        ▼                                                        │
  ┌──────────────────┐                                           │
  │ /opt/{{app}}/                                        │
  │  app  ← systemd {{app}}-cloud.service                │
  └──────────────────┘                                           │
  服务器代码 = 最新已推送 main（无本地改动） ────────────────────┘
```

### 1.3 新项目最小拓扑

**最小拓扑 = 只有 `origin`**：`本地 ── push main/tag ──► origin ──► CI/CD`。单人 + 高频小步场景够用。

**何时加部署裸仓**（三选一）：
1. 服务器不接受公网直连 GitHub；
2. 部署源与主仓需物理隔离（GitHub 公开、部署源含私有配置）；
3. 部署机需跑额外门禁（post-receive hook 跑 smoke test）。

本项目取条件 1：国内服务器访问 GitHub 不稳定，且希望「可推 origin 但暂不部署」解耦。

---

## §2 建仓初始化：从零到第一个提交

```bash
mkdir MyProject && cd MyProject
git init -b main                     # 首次 init 就用 main
git config user.name  "your-name"
git config user.email "your-email@example.com"

# 先于任何代码文件就位（顺序不能反）
git add .gitignore .gitattributes LICENSE NOTICE.txt README.md AGENT.md
git commit -m "chore: 仓库初始化——三件套 + AGENT + README"
git remote add origin git@github.com:{{owner}}/{{repo}}.git
git push -u origin main
```

### 2.1 `.gitignore`：先于第一行代码

**原则**：`.gitignore` 必须先于第一份业务代码存在。一旦运行时目录进了历史，即使后补规则也不能自动剔除，只能 `git rm --cached`——那是重写历史的操作（坑 G2）。

本项目 `.gitignore` 319 行覆盖 **17 类**运行时目录，唯一权威是 `AGENT.md` → Local-Only Data：

| 类 | 例子 | `.gitignore` 行 |
|---|---|---|
| 凭据 | `.env` / `*.env.local` | 71 / 46 |
| 数据库 | `*.db` / `*.sqlite*` / `*.db-wal` / `dump.rdb` | 73–79 |
| 账号资产 | `backend/cookiesFile/` / `browser_profiles/` / `fingerprints/` | 114 / 121 / 244 |
| 运营数据 | `backend/data/ip_pool*.json` / `data/analytics/` / `data/videos/` | 220 / 185 / 187 |
| 日志临时 | `logs/` / `backend/logs/` / `_caches/` / `_deploy_inputs/` | 68 / 245 / 299 / 303 |
| 本地 AppData | `_appdata_electron/` / `_appdata_bid/` / `_electron_userdata*/` | 296 / 300 / 301 |
| IDE / OS | `.vscode/` / `.idea/` / `.claude/` / `.DS_Store` / `Thumbs.db` | 53–64 |
| 付费版独占 | `cloud_service/llm_proxy/_premium_assets/`（注入见 `scripts/cloud/inject_premium_assets.py`） | 318 |
| 一次性脚本 | `verify_*.py` / `fix_*.js` / `scan_*.py` / `_probe*.py` | 276–290 |
| 上游 clone | `tools/`（hermes-agent / hermes-home / persona-studio 等） | 272 |

**允许清单（`!` 负向白名单）**：`!scripts/packaging/build-package.bat`（第 146 行，父规则忽略 `scripts/packaging/*` 但打包脚本要入库）；`!frontend/public/contact-qr.png`（第 241 行，前端默认路径，运营直接覆盖）。

### 2.2 `.gitattributes`：行尾锁定

引用真实 `.gitattributes` 摘要：

```
* text=auto eol=lf                        # 默认：所有文本存 LF
*.sh    text eol=lf                       # Unix shell 脚本强制 LF
*.bash  text eol=lf
*.bat   text eol=crlf                     # Windows 脚本强制 CRLF
*.cmd   text eol=crlf
*.ps1   text eol=crlf
*.png   binary                            # 30+ 二进制后缀
backend/reverse_api/signing/vendor/vendored-blob.js -text
                                           # vendored blob 本身含 CRLF，git 不得转换
```

**为什么必须这么做**：
1. 无 `.gitattributes` 时 Windows 提交会把 CRLF 存进 blob，`git archive` 打出的 shebang 变成 `#!/usr/bin/env bash\r`——Linux 报「bad interpreter」；
2. vendored blob 不加 `-text`，`git status` 会持续报告「modified」掩盖真实修改（见 `.gitattributes:10–18` 头注）；
3. **禁止 `git add --renormalize .`**——批量改写所有 blob 行尾是重写历史（`.gitattributes:18`）。

**新项目最小版**：`* text=auto eol=lf` + Windows 脚本三行 + 已知二进制后缀。

### 2.3 LICENSE + NOTICE 首提交就带

许可证是「生效即刻起」——首提交未带 LICENSE 的仓库，公开前每一行代码都属「无授权代码」，之后补 LICENSE 无法追溯（AGPL 义务履行见 PLAYBOOK §7.1）。本项目首提交包含：`LICENSE`（AGPL-3.0）/ `NOTICE.txt`（含 MIT `social-auto-upload` + Apache-2.0 `SynapseAutomation` 上游，第 3 行署名 `{{owner}}`）/ `README.md` / `CONTRIBUTING.md` / `SECURITY.md`。

---

## §3 提交纪律

### 3.1 Message 规范

**格式**：`type(scope): 简短描述`（中文为主）。从 40+ 真实 commit 提炼的 `type`：

| type | 用途 | 实例 |
|---|---|---|
| `feat` | 用户可见新功能 | `feat(providers): 供应商管理页` |
| `fix` | 修复 bug | `fix(security): 修 pip-audit 编造参数` |
| `docs` | 文档变更 | `docs(engineering): 工程手册` |
| `ci` | CI/CD 配置 | `ci(release): 补齐 PyInstaller 构建` |
| `build` | 打包 / 构建 | `build(size): 低风险瘦身` |
| `test` | 测试代码 | `test(state-machine): 旧名映射穷举` |
| `chore` | 构建 / 依赖 / 杂项 | `chore(release): 版本顶号 1.1.6 / build 6` |
| `refactor` / `perf` / `revert` | 重构 / 优化 / 撤回 | — |

**常见 scope**：`security` / `adr` / `engineering` / `delivery` / `release` / `deps` / `ux` / `db` / `pipeline` / `providers` / `settings` / `receipts` / `state-machine` / `handover` / `gitignore` / `reports` / `changelog` / `wizard` / `acceptance`。

**Trailer**（末行 metadata）：
```
AI-Model: Kimi-Code
Fixes: #123
Reviewed-by: @user
```

**AI 参与记录**（`AGENT.md:54`）：AI Agent 主导或大幅参与的提交，末行追加 `AI-Model: <模型名>`。完整规范见 `05-AI-CONTRIBUTIONS.md`。自 2026-10-24 起执行，历史不回填。审计：`git log --grep="AI-Model:" --oneline`。

### 3.2 禁令清单

以下命令**一律禁用**（`AGENT.md` Push Rules）：

| 禁 | 为什么 | 替代 |
|---|---|---|
| `git add -A` / `git add .` | 把 `.gitignore` 漏掉的运行时数据带进历史（G2） | 逐个显式 `git add <path>`；只 add 已跟踪用 `git add -u` |
| `git stash` | 把未 ignore 的运行时文件打进 reflog；后续可能误 pop 再被 add | 用 `git diff > /tmp/patch.diff` |
| `git reset --hard` | 丢弃工作区修改；已推送时执行要求 force | 已推送用 `git revert` |
| `git checkout .` / `git checkout <file>` | 同上（`.` 尤其危险） | 单文件用 `git checkout -- <file>` 或 `git restore <file>` |
| `git clean` | 删未跟踪文件（含运行时数据 / 未提交工作） | — |
| `git push --force` / `--force-with-lease` | 重写已推送历史，服务器 / 备份盘对应关系断裂 | 用 `git revert` |
| `git commit --no-verify` | 跳过 pre-commit hooks | — |

### 3.3 提交前三步检查

```bash
git status --short                                    # 看暂存区
git diff --cached                                     # 看实际差异
git log -1 --format=%B \
  | grep -E "(D:/|C:/|/Users/|password|token|cookie|sk-|ghp_)"  # message 扫描
```

### 3.4 敏感信息拦截

**四类拦截对象**：本机绝对路径 / 凭据值 / 账号标识 / 原始数据（DB 导出、日志、账号 profile）。扫描正则见 PLAYBOOK §6.3：`grep -rE '(sk-|ghp_|api_key|password).*=[^*]' .`。

**三道防线**：① `.gitignore`（§2.1）+ 逐文件 `git add`（§3.2）；② pre-commit hook（推荐 `lefthook` / `pre-commit`，本项目未强制启用）；③ CI 侧 `.github/workflows/security.yml` `secret-scan` job（gitleaks）。参考坑 G5：签发脚本曾带本机绝对路径。

---

## §4 分支模型

### 4.1 本项目现行：单 main + tag 发版

- 单一长期分支 `main`；所有代码直接 push；发版通过 `git tag v<X.Y.Z>` + `git push origin vX.Y.Z` 触发 `release.yml`；
- CI 对分支全放开（`ci.yml:27-32` `push.branches: ['**']`），`tags-ignore: ['v*']` 让 tag 走 `release.yml`；
- CI 并发组 `ci-${{ github.ref }}` + `cancel-in-progress: true`（main 上允许取消旧 run）。

**适用条件**（本项目同时满足）：单人 + AI Agent；高频小步（11 个月 150+ commits）；无外部贡献者；每次修改 24 小时内可回滚。

### 4.2 何时升级到 feature 分支 + PR 流

**触发条件**（任一即升级）：加入外部贡献者 / 团队 ≥ 2 人 / 需要「提交前评审」作为质量门禁。

**升级后的分支保护配置**（GitHub Settings → Branches → Branch protection rules，本项目配置为参考实例）：

| 参数 | 本项目建议 | 说明 |
|---|---|---|
| Require a pull request before merging | ✅ | PR 必须走 CI |
| Require approvals | `1` | 单人仓也可设 1 |
| Dismiss stale approvals when changes are pushed | ✅ | 有新 commit 后审批失效 |
| Require review from Code Owners | ✅（配 CODEOWNERS） | 见 PLAYBOOK §8.1 |
| Require status checks to pass before merging | ✅ | 8 硬门全绿 |
| Require branches to be up to date | ❌ | 允许 rebase 前合并 |
| Require linear history | ✅ | 禁 merge commit，用 squash / rebase |
| Enforce admin status checks | ❌（本项目 `enforce_admins=false`） | 单人仓允许 owner bypass；多人仓建议 ✅ |
| Restrict who can push to matching branches | 视情况 | 严格模式仅维护者可 push 到 main |

本项目 commit 历史无 merge commit（`git log --oneline --no-merges` 与 `--no-merges` 结果一致），符合线性历史约束。

---

## §5 推送操作规程

### 5.1 链路探测先行（坑 G1）

**G1**：`git push` 到 github.com 挂死，几百秒零输出。**根因**：本机全局 `http.proxy`/`https.proxy` = `http://127.0.0.1:7897`，故障时刻走代理的 TLS 握手失败。**同一天内直连/代理会翻转，且是按 host 分的**——不能硬编码。

```bash
# Step 1: 探测两条链路（直连 TLS + 代理 CONNECT）
python D:/cache/tmp/_probe_links.py

# Step 2: 按结果选通道（直连可用则空覆盖，代理可用则填代理）
# Step 3: 推送
git -c http.proxy= -c https.proxy= push origin main              # 直连
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main  # 代理
```

**不要**：全局 `git config --global http.proxy ...`——按 host 翻转场景下全局配置永远有一半时刻失败。用 `-c` 命令行覆盖。

### 5.2 双远程推送顺序

**顺序**：`origin` 先，`{{deploy-remote}}` 后。

**理由**：`origin` 是 CI 触发点，先推保证 CI 跑起来；若 `{{deploy-remote}}` 先推而 `origin` 挂死，服务器代码比 GitHub 版本新——「服务器运行版本在 GitHub 找不到」的追溯断链；反过来（部署先、CI 后）虽能工作，但 CI 红灯时需手动回滚服务器，代价高。

```bash
# Step 1: push origin（探测后选通道）
git -c http.proxy= -c https.proxy= push origin main
# Step 2: 等 CI 全绿
# Step 3: push {{deploy-remote}}（SSH）
GIT_SSH_COMMAND="ssh -i {{ssh_key_path}} \
  -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15" \
  git push {{deploy-remote}} main
```

### 5.3 推送失败处置树

```
push 失败
├─ 挂死（几百秒零输出）→ 换通道（§5.1），失败则 `curl -x http://127.0.0.1:7897 https://github.com -I` 查代理
├─ `! [rejected] main -> main (fetch first)`
│    ├─ 别 force！先 git fetch origin
│    ├─ git log --oneline HEAD..origin/main     # 看远端新增
│    ├─ git log --oneline origin/main..HEAD     # 看本地独有
│    ├─ 远端是新提交 → git pull --rebase origin main   # 保线性历史
│    └─ 冲突 → rebase → 手解 → push
├─ `error: failed to push some refs`（tag 已存在）
│    └─ 本地误删重建：git tag -d vX.Y.Z && git tag vX.Y.Z <commit> && git push origin vX.Y.Z
├─ `pre-receive hook declined`（服务器裸仓拒绝）→ 看 post-receive 输出，通常 CI 未跑完 / 依赖缺失
└─ 网络瞬断 → 重试（git push 幂等，成功过的对象不会重复传）
```

**禁止 force push 已推送历史**——即使单人仓。理由：① 服务器裸仓 `{{deploy-remote}}` pull 过旧 commit 后，force push 会让服务器拿到悬空引用；② 备份盘（`{{backup-root}}`）源码包对应 commit hash，force 后对应关系断裂；③ 审计轨迹断裂：`docs/dev-reports/` 每条都对应某个 commit。**替代**：`git revert <commit>` 生成反向 commit，历史保持线性、审计轨迹保留。

---

## §6 版本与 tag 发版

### 6.1 版本号单一真源

**本项目真源**：`desktop-electron/package.json` 的 `version` 字段。**下游派生**（都从这一个真值同步）：资产名 `{{Product}}-<version>-setup.exe` / GitHub Release tag `v<version>` / 云端地址 `cloudUrl`（`release.yml` + `scripts/packaging/resolve_cloud_url.ps1` 读同一字段）/ CHANGELOG 条目 / GitHub Actions `env.APP_VERSION`（`release.yml:51`）。

**同步机制**（`release.yml:16-19` 头注）：`git push origin v<X.Y.Z>` → workflow 自动把 `package.json` 的 `version` 同步；`workflow_dispatch` 填 version 输入则同步，留空则用现有值。

**版本顶号独立成提交**：`chore(release): 版本顶号 1.1.6 / build 6`。让「顶号」本身可审计——`git log --oneline -- desktop-electron/package.json` 一眼看到「v1.1.5 → v1.1.6」在哪一步发生；顶号 commit 通常是发版前 main 的最后一个提交。

### 6.2 Tag 命名

`v<X.Y.Z>` SemVer：破坏性变更 / 兼容新功能 / 修复。预发布 `v1.2.0-rc1`（本仓暂未用）。**资产命名**（`release.yml:3` 头注 / 坑 P2）：`{{Product}}-${version}-setup.${ext}` 纯 ASCII。中文文件名会让 electron-builder 的 `isSafeGithubName` 正则 `/^[0-9A-Za-z._-]+$/` 不通过 → `latest.yml` 静默失效。

### 6.3 发版流程七步（v1.1.6 实录抽象）

1. **顶号**：改 `desktop-electron/package.json` version + `scripts/packaging/build-version.json`；独立 commit `chore(release): 版本顶号 X.Y.Z / build N`；push origin main → 等 CI 全绿。
2. **准备**：CHANGELOG 补条目；`docs/handover/PROJECT-HANDOVER.md` 更新现状快照；`docs/release-delivery-statement.md` 换版。
3. **双推**：`push origin main` → `push {{deploy-remote}} main`（§5.2）→ 服务器 `bash /tmp/_sync_app.sh`（§9.3）。
4. **打 tag**：`git tag -a v1.1.6 -m "v1.1.6 - 版本顶号" && git push origin v1.1.6`。⚠️ 不用 `workflow_dispatch` 手动 dispatch（见 §6.5）。
5. **CI 出包**：`release.yml` 触发 → `check` job 防覆盖 → `build-windows` / `build-mac` / `build-appimage` → `verify-release-assets.mjs` 校验资产 + 版本 + 哈希 → 体积下限守卫 ≥ 400 MB → `ncipollo/release-action` 发布。
6. **验收**：从 `https://{{downloads-domain}}/downloads` 下载（自建通道）；客户端安装 + 启动 + 自动更新（`latest.yml` 生效）；官网下载页指向最新 tag；备份到 `{{backup-root}}`（§8.3）。
7. **换版**：CHANGELOG 加 `## [1.1.6] - 2026-10-25`；`docs/release-delivery-statement.md` 换版；`PROJECT-HANDOVER.md` §2.1 交付清单指向 1.1.6；commit `docs(delivery): 交付口径文档换版 v1.1.6`。

### 6.4 Tag 纪律

**禁止**：
- **`workflow_dispatch` 手动 dispatch 覆盖已验收资产**——`check` job 会跳过 release 本身，但 dispatch 若填**不同 version** 输入仍会覆盖 `package.json` 版本字段（风险不在 release，而在版本字段被 CI 覆写）；
- **删除 tag**——除非该 tag 指向含已确认高危凭据的 commit，或测试 tag（`v0.0.1-test`）从未发布过资产；且必须有 PR / issue 记录说明。

**流程**：删除前 `git push origin :refs/tags/vX.Y.Z`；`docs/dev-reports/` 留记录注明删除理由与对应 issue/PR。

### 6.5 发版流水线防覆盖设计

`release.yml:54-76` `check` job：

```bash
if gh release view "$TAG" >/dev/null 2>&; then
  echo "Release $TAG already exists - skip rebuild."
  echo "should_build=false" >> "$GITHUB_OUTPUT"
fi
```

**语义**：Release 已存在 → 跳过整个 build 阶段（不只是发布）。**目的**：已验收资产不被 CI 用未验收产物覆盖。**副作用**：若打包脚本有 bug 导致资产不完整，第二次推 tag 不会重打包——需走「删除 Release → 重打 tag → 重跑」的破坏性路径。

**并发控制**（`release.yml:43-45`）：`cancel-in-progress: false`——与 CI 相反：发版不允许取消，避免半成品资产。

---

## §7 CI/CD 挂钩

### 7.1 Push 触发的门禁矩阵（8 硬门）

`ci.yml`，完整「拦什么 / 失败教训」表见 PLAYBOOK §5.1。

| # | 门名 | 关键坑 |
|---|---|---|
| 1 | `python-smoke` | 语法错 + 模块级 import + `.env.example` 遗留字段 |
| 2 | `lint` | 后端 ruff（E9/F63/F7/F82） |
| 3 | `lint-frontend` | 前端 ESLint 全量 |
| 4 | `frontend-lint-test` | 前端 tsc + vitest；坑 C2：Node 22 硬性下限 |
| 5 | `backend-selftest` | 后端 M1/M2/M3 自运行脚本 |
| 6 | `cloud-service-tests` | cloud_service/ 5 个自运行脚本；坑 C3：必须传目录 |
| 7 | `deps-gate` | 依赖声明与 import 对齐；坑 C4：必须带 `--self-test` |
| 8 | `test` | 后端 pytest + license 护栏 |

**1 软门**：`e2e-packaged`（`continue-on-error: true`，仅 `workflow_dispatch` 且 `run_e2e_packaged=true`）。

**触发条件**：
```yaml
on:
  push:
    branches: ['**']
    tags-ignore: ['v*']        # tag 触发走 release.yml
  pull_request:
  workflow_dispatch:
```

### 7.2 Tag 触发的发版流水线（`release.yml`）

| Job | 作用 | 关键设计 |
|---|---|---|
| `check` | Release 已存在时跳过 | 防覆盖已验收资产 |
| `build-windows` | NSIS 打包 | 体积下限 ≥ 400 MB（防静默空壳包） |
| `build-mac` | macOS dmg + zip | 默认 unsigned；`APPLE_*` Secrets 配好后自动签名 |
| `publish` | `ncipollo/release-action` 发布 | 资产挂 tag 下 |

**体积下限守卫**（`build-windows` step）：`if size < 419430400 (400 MB): fail`。目的：一旦 `build_services.ps1` 抛错未 fail 或被跳过，装包会掉到 200 MB 左右，此守卫直接 fail CI 而非让用户下载到空壳包。

### 7.3 Security 5 job（`security.yml`）

| # | Job | 工具 | 说明 |
|---|---|---|---|
| 1 | `secret-scan` | gitleaks | 密钥 / 凭据扫描，SARIF 上传 Code Scanning |
| 2 | `pip-audit` | pip-audit | Python 依赖 CVE；SARIF 因 schema 不符已被移除 |
| 3 | `npm-audit` | npm audit | frontend 生产依赖高危扫描 |
| 4 | `license-audit` | 自研 | Python 依赖 license 报告（report-only，不 fail） |
| 5 | `coverage-baseline` | 自研 | 仅 main push 触发；上传 coverage 快照 |

**触发**：`push` + `schedule: '0 8 * * *'`（每天 8:00 UTC）。**未来定位**：Security 5 job 落地后作为**第 9 硬门**（PLAYBOOK §6.3）。

### 7.4 PR 触发的检查

`pull_request` 触发 `ci.yml` 的 push 部分（不含 tag 相关 job）。本项目当前无外部贡献者，PR 场景主要用于内部 feature 分支协作（未来升级 §4.2 时启用）。

---

## §8 变更回退

### 8.1 单提交回退（`git revert`）

```bash
git revert <commit-sha>          # 生成反向 commit（不改历史）
git push origin main

# 多个连续提交
git revert <oldest-sha>^..<newest-sha>
# revert merge commit（-m 1 保留 main 那条线）
git revert -m 1 <merge-sha>
```

**为什么不用 `git reset --hard <sha>`**：`reset --hard` 重写本地历史，push 需 `--force`（§5.3 禁令）；`revert` 保留原 commit + 新反向 commit，审计轨迹清晰。

### 8.2 发版回退（旧版镜像并存）

**核心原则**：不发新包替换，做「镜像并存 + superseded 标记」。

**本项目 1.1.4 / 1.1.5 并存实录**（`PROJECT-HANDOVER.md` §2.3 第 8 行）：服务器 `/var/www/downloads/` 下 1.1.4 + 1.1.5 三件套并存。

**做法**：
1. **GitHub Release 保留历史**——不删除 v1.1.5 Release；
2. **自建下载通道保留旧版 `latest.yml` 备份**——`latest-1.1.5.yml` / `latest-1.1.6.yml` 各存一份；
3. **官网下载页指向最新 tag**——默认按钮指向 v1.1.6，旧版手动切 URL 访问；
4. **CHANGELOG 显式标注**——`## [1.1.6]` 后加 `⚠️ Supersedes 1.1.5`（若为修复性回滚）。

**服务器侧回退**（不重建，只切引用）：

```bash
# 假设 1.1.6 有问题需要回退到 1.1.5
sudo cp /var/www/downloads/latest-1.1.5.yml /var/www/downloads/latest.yml
sudo nginx -t && sudo systemctl reload nginx
# 客户端下次检查更新会拿 1.1.5 的 latest.yml，静默降级
```

**教训**（坑 P3）：`latest.yml` 里名字对不上（1.1.4 时代老 bug）——版本号匹配不精确导致静默发错包。修法：打包脚本按版本号精确匹配（已修于 `commit <sha>`）。

### 8.3 灾难恢复（备份盘 + 源码包对应提交）

**备份盘**：`{{backup-root}}`（`PROJECT-HANDOVER.md` §2.4）

| 项 | 说明 |
|---|---|
| 二进制 | 1.1.5 三件套（GitHub Release 逐字节一致） |
| 源码包 | `{{repo}}-source.zip` = `git archive <commit>`（与已发布二进制严格对应，1423 条目） |
| MANIFEST | 14 条目，含 SHA-256；`--verify` 通过 14 / 不符 0 |
| 历史轮次 | `_superseded_round18/` 存 1.1.4 三件套 + 旧源码包 + 旧 MANIFEST |

**round N 轮次模型**：每次发版对应一个 round（当前 round 18）；旧 round 移入 `_superseded_round<N>/` 保留不物理删除；`build_backup_manifest.py --round <N>` 生成 MANIFEST；`--verify` 回读校验逐文件 SHA-256。

**源码包必须对应 commit**：

```bash
git -c core.autocrlf=false -c core.eol=lf archive --format=zip \
  -o '{{backup-root}}\{{repo}}-source.zip' <commit-sha>
```

`git archive` 会用 `.gitattributes` 规则导出，确保 shebang 正确、二进制不被误转。

**灾难恢复流程**：
1. 定位受影响 commit：`git log --oneline v1.1.5..v1.1.6`；
2. 决定回退粒度（整轮 vs 单 commit）；
3. 整轮 → 服务器切 `latest.yml`（§8.2）+ GitHub Release 页加 warning banner；
4. 单 commit → `git revert` + 重打 tag `v1.1.7`；
5. 备份 round：`build_backup_manifest.py --round 19`；
6. 记录：`docs/dev-reports/YYYY-MM-DD-v1.1.6-rollback.md`。

---

## §9 部署仓同步

### 9.1 Bare 仓库模型

**服务器布局**（`deploy/README.md` §2.1、`deploy/deploy.sh:44` 头注）：

```
/opt/{{app}}/
├── repo.git/           # 裸仓库，git push 落点（无工作树）
├── app/                # 工作副本（git clone repo.git app）
├── venv/               # Python 虚拟环境
├── .db_credentials/    # 数据库凭据（700 / 600）
└── .env.cloud          # 应用环境变量（600）
```

**初始化**：

```bash
sudo mkdir -p /opt/{{app}}
cd /opt/{{app}}
sudo git init --bare repo.git
sudo git clone /opt/{{app}}/repo.git /opt/{{app}}/app
```

**为什么用裸仓**：① 裸仓的 HEAD 与所有 ref 都是「远端推送目标」，与本地 worktree 概念分离；② post-receive hook 可挂在这里跑自动化；③ 工作副本与裸仓分离，push 触发部署不污染本地 git 状态。

### 9.2 工作副本 ff-only 同步

```bash
cd /opt/{{app}}/app
git fetch origin
git merge --ff-only origin/main    # 只允许 fast-forward
git status                          # 验证 HEAD 已更新
```

**纪律**：工作副本永远只 `fetch + merge --ff-only`，**禁止 `reset` / `pull --rebase`**。

**为什么**：
- `git reset --hard origin/main` 会**丢弃**服务器本地改动（运维临时改的 config）；
- `--ff-only` 强制本地 HEAD 是 origin/main 的祖先，任何分叉都 fail——fail 是好事，说明服务器代码有本地改动需人工介入；
- `git pull --rebase` 重新生成 commit hash，破坏审计追溯（`docs/dev-reports/` 里的 commit 不再对应服务器实际运行代码）。

### 9.3 服务器侧 `_sync_app.sh` 模式

本项目部署推送流程（`PROJECT-HANDOVER.md` §9.5）：

```powershell
# SSH 密钥与参数（数组写法避免参数展开——坑 W7）
$key = '{{ssh_key_path}}'
$opts = @('-i', $key, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')

# 上传同步脚本（走 /tmp，服务器端脚本不入版本库）
& scp @opts 'D:\cache\tmp\_sync_app.sh' 'root@{{server-ip}}:/tmp/_sync_app.sh'
& ssh @opts 'root@{{server-ip}}' 'bash /tmp/_sync_app.sh'

# 重启云端服务
& ssh @opts 'root@{{server-ip}}' 'systemctl restart {{app}}-cloud && systemctl status {{app}}-cloud --no-pager'
```

**`_sync_app.sh` 内容骨架**：

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/{{app}}/app
git fetch origin
git merge --ff-only origin/main
source /opt/{{app}}/venv/bin/activate
pip install --quiet -r requirements.txt
```

**为什么脚本走 `/tmp`**：① 避免 `ssh host "cd /opt/... && git ..."` 长命令被 PowerShell 参数展开破坏（坑 W7）；② `scp` 一次上传 vs `ssh` 逐条执行，失败可复现；③ 服务器侧脚本不入版本库（运维态资产与代码仓库解耦）。

### 9.4 部署前置纪律

1. 本地 `git status` 干净；
2. CI 全绿（8 硬门 + Security 5 job）；
3. `git log --oneline <prev-sha>..HEAD` 确认部署范围；
4. 服务器磁盘剩余 ≥ 20 GB（本项目服务器 3.6 GB 内存 / 19 GB 可用磁盘）；
5. 备份上一轮 round（`build_backup_manifest.py --round <N>`）。

---

## §10 审计与追溯

### 10.1 `git log` 考古法

**按版本**：
```bash
git log --oneline v1.1.5..v1.1.6
git log --pretty=format:'%h %ad %an %s' --date=short v1.1.5..v1.1.6
git log --oneline --no-merges v1.1.5..v1.1.6
```

**按文件**：
```bash
git log --oneline -- desktop-electron/package.json
git log --since="2026-10-20" --oneline -- .github/workflows/release.yml
git log -p -- backend/config/hermes_agent.toml
```

**按作者**：
```bash
git shortlog -sne
git log --author="<name>" --oneline
```

**按关键词**：
```bash
git log --grep="security" --oneline
git log --grep="AI-Model:" --oneline
```

### 10.2 AI-Model trailer 审计

**记录格式**：`AI-Model: <model-name>`（如 `Kimi-Code` / `Claude-Sonnet-4` / `GPT-4o`），置于 commit message 末行（`AGENT.md:54`）。

**审计命令**：
```bash
git log --grep="AI-Model:" --oneline                                    # 列出
git log --grep="AI-Model:" --format="%s" | \
  awk -F'AI-Model: ' '{print $NF}' | sort | uniq -c | sort -rn           # 聚合
git log --format=%B | \
  git interpret-trailers --parse --no-divider | grep "AI-Model:" | \
  sort | uniq -c                                                          # 结构化提取
git show --stat <commit-sha>                                              # 单提交详情
```

**目的**：合规审计（追溯 AI 生成代码）/ 责任界定（AI 代码评审可区别对待）/ 未来合规（监管要求 AI 生成内容可识别时直接可用）。

**时间线**：`AGENT.md:56` 起自 2026-10-24，向前兼容、历史不回填。

### 10.3 ADR 与 commit 的互链

**原则**：
- **决策看 ADR**——`docs/architecture/decisions/` 每个重要架构决策独立 ADR，含「背景 / 决定 / 后果」；
- **实现看 commit**——ADR 落地对应 commit，message 里引用 ADR 编号；
- **变更看 commit + ADR 更新**——ADR 被推翻时新 ADR 引用旧 ADR 并标注 `supersedes ADR-XXX`。

**本项目 ADR 编号**：commit `docs(adr): N 项关键决策补录 ADR + AI 贡献记录机制 + 软著 SOP`，N 项 ADR 覆盖 P1–P7、B2、D4 等。

**示例互链**：
```
ADR-007（docs/architecture/decisions/0007-single-client-consolidation.md）
  → commit <sha> feat(client): 合并单一客户端——按 ADR-007 落地
  → commit <sha> docs(adr): ADR-007 补录（初稿）
```

**追溯路径**：代码变更疑问 → `git log --oneline <file>` 找实现 commit → message 里的 ADR 引用 → 打开 ADR 读决策；决策疑问 → 打开 ADR → 底部「Implementation commits」→ `git show <commit>` 看实现。

---

## 附录 A：命令速查卡

按场景分组。所有命令在项目根目录执行，除非另有说明。**共 48 条**。

### A.1 日常（20 条）

```bash
git status --short                          #  1 查看暂存区状态
git status                                  #  2 完整状态
git diff                                    #  3 工作区 vs 暂存
git diff --cached                           #  4 暂存 vs HEAD
git diff HEAD                               #  5 工作区 vs HEAD（含未暂存）
git log --oneline -20                       #  6 最近 20 条
git log --oneline --graph --decorate -30    #  7 图形化 log
git log --oneline v1.1.5..v1.1.6            #  8 两 tag 之间
git log --grep="AI-Model:" --oneline        #  9 AI 参与提交
git add <path>                              # 10 逐个显式 add
git add -u                                  # 11 只 add 已跟踪文件的修改
git commit -m "type(scope): 简短描述"        # 12 提交
git commit --amend                          # 13 修改上一个 commit（未推送前）
git tag -l                                  # 14 列出所有 tag
git tag -l 'v1.1.*'                         # 15 按通配符
git show v1.1.6 --stat                      # 16 tag 详情
git branch                                  # 17 本地分支
git branch -a                               # 18 含远端
git switch -c <branch>                      # 19 新建并切换
git fetch origin                            # 20 拉取远端（不合并）
```

### A.2 发版（8 条）

```bash
python D:/cache/tmp/_probe_links.py                              # 21 探测链路（坑 G1）
git -c http.proxy= -c https.proxy= push origin main              # 22 push origin 直连
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main  # 23 push origin 代理
GIT_SSH_COMMAND="ssh -i {{ssh_key_path}} -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15" git push {{deploy-remote}} main  # 24 push 部署源
git tag -a v1.1.6 -m "v1.1.6"                                    # 25 打 tag
git -c http.proxy= -c https.proxy= push origin v1.1.6            # 26 推 tag
git -c core.autocrlf=false -c core.eol=lf archive --format=zip -o '{{backup-root}}\{{repo}}-source.zip' <sha>  # 27 源码包
python scripts/backup/build_backup_manifest.py --backup-root '{{backup-root}}' --repo '.' --source-commit <sha> --round 18 && python scripts/backup/build_backup_manifest.py --backup-root '{{backup-root}}' --verify  # 28 备份 + 校验
```

### A.3 救火（10 条）

```bash
git revert <commit-sha>                                    # 29 单提交回退（禁 reset --hard）
git revert <oldest-sha>^..<newest-sha>                     # 30 批量回退
git revert -m 1 <merge-sha>                               # 31 revert merge commit
git checkout -- <path>                                    # 32 丢弃单文件误改
git restore <path>                                        # 33 等价（新语法）
scp -i {{ssh_key_path}} -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15 D:/cache/tmp/_sync_app.sh root@{{server-ip}}:/tmp/_sync_app.sh && ssh -i {{ssh_key_path}} -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15 root@{{server-ip}} 'bash /tmp/_sync_app.sh'  # 34 服务器同步
ssh ... root@{{server-ip}} 'cp /var/www/downloads/latest-1.1.5.yml /var/www/downloads/latest.yml && nginx -t && systemctl reload nginx'  # 35 latest.yml 回滚
git tag -d v1.1.6                                         # 36 删除本地误打 tag（推送前）
git rm --cached <path> && echo "<path>" >> .gitignore && git add .gitignore && git commit -m "chore(gitignore): 剔除误跟踪的运行时文件 <path>"  # 37 从误跟踪运行时文件剔除
git config --local core.autocrlf input                    # 38 服务器端强制 LF
```

### A.4 审计（10 条）

```bash
git log --grep="AI-Model:" --format="%s" | awk -F'AI-Model: ' '{print $NF}' | sort | uniq -c | sort -rn  # 39 AI-Model 聚合
git log --format=%B | git interpret-trailers --parse --no-divider | grep "AI-Model:" | sort | uniq -c    # 40 trailer 结构化提取
git log --oneline -- desktop-electron/package.json                                                # 41 按文件追溯
git log -p --since="2026-10-01" -- .github/workflows/release.yml                                  # 42 按文件 + 时间段
git shortlog -sne                                                                                 # 43 作者聚合
git show <sha> / git show --stat <sha> / git show --name-only <sha>                              # 44 commit 详情
grep -r "ADR-" docs/architecture/decisions/                                                       # 45 找 ADR 对应 commit
git log --grep="ADR-007" --oneline                                                                 # 46 ADR 相关 commit
git log --oneline --pretty=format:'%h %ad %s' --date=short v1.1.5..v1.1.6                          # 47 发版变更集
git diff --stat v1.1.5..v1.1.6                                                                     # 48 发版 diff 统计
```

---

## 附录 B：坑对照表

### B.1 本项目 Git 相关坑

| 坑 | 现象 | 修法 |
|---|---|---|
| **G1** | `git push` 到 github.com 挂死几百秒零输出 | 探测脚本 → 选通道 → 推送三步（§5.1）；用 `-c http.proxy=` 覆盖，不硬编码 |
| **G2** | `git add -A` 把运行时数据带进仓库 | 逐个显式 `git add <path>`；禁 `-A` / `.` / stash / reset / force / `--no-verify` |
| **G3** | `git ls-tree` 中文路径被八进制转义，假报「仅在 zip / 仅在 tree」差异 | `-c core.quotepath=false` |
| **G4** | `git push` 写 stderr 触发 `NativeCommandError`（即使成功） | 不用 `$ErrorActionPreference='Stop'` 包原生命令；`Select-String -Pattern 'main ->'` 取结果 |
| **G5** | commit message 写绝对路径泄露本机路径 | 提交前扫 diff 里的路径与账号标识（`AGENT.md` Repo Hygiene） |
| **W11** | `edit` 工具在 CRLF 文件多行匹配 NOT FOUND | Python 脚本按 CRLF 精确替换，脚本自适应行尾 |
| **G3（扩展）** | `git diff` 中文路径显示乱码 | `git -c core.quotepath=false diff` |

### B.2 常见 Git 坑速查

| 坑 | 修法 |
|---|---|
| 中文文件名在 Linux `ls` 显示为 `??.txt` | `export LANG=zh_CN.UTF-8`（服务器） |
| 服务器 `git clone` 后 hook 报 `not found`（CRLF） | `.gitattributes` 强制 LF（`*.sh text eol=lf`） |
| `Updates were rejected because the remote contains work you do not have locally` | 先 `git fetch` 再判断，禁 force（§5.3） |
| 服务器 `git status` 显示修改，但本地没改过 | `git config --local core.autocrlf input`（LF 服务器端） |
| `git archive` 出的 tarball 里 shebang 报错 | `.gitattributes` 未强制 `*.sh text eol=lf`（§2.2） |
| 打包产物有整份第三方包目录 | `deps-gate --self-test`（C4）+ electron-builder `files` 白名单 |
| 误删已推送 tag，服务器找不到 commit | 立即停止；本地 reflog 有则重建：`git tag -a v<版本号> <sha> && git push origin v<版本号>` |

---

## 附录 C：新项目 Git 启动检查单（15 项）

复制 `../PROJECT-RUN/` 后逐项勾选，**全部勾选后打第一个 tag** `v0.1.0`。

| # | 项 | 参考 |
|---|---|---|
| 1 | `git init -b main`，用户名邮箱配置好 | §2 |
| 2 | `.gitignore` 覆盖至少 8 类运行时目录（凭据 / 数据库 / 日志 / 缓存 / IDE / OS / 构建产物 / 敏感数据） | §2.1 |
| 3 | `.gitattributes` 强制 `* text=auto eol=lf` + Windows 脚本 CRLF + 已知二进制后缀 | §2.2 |
| 4 | `LICENSE` 首提交就带（AGPL / MIT / Apache-2.0 三选一） | §2.3 |
| 5 | `NOTICE.txt` 首提交就带（无第三方时留 stub） | §2.3 |
| 6 | `README.md` + `AGENT.md`（含 Repo Hygiene / Push Rules / Local-Only Data） | §2 / `AGENT.md` |
| 7 | `CONTRIBUTING.md` + `SECURITY.md`（新项目建议） | §2.3 |
| 8 | 第一个 commit：`chore: 仓库初始化`，只含上述文件 | §2 |
| 9 | `git remote add origin` + 探测链路 + `git push -u origin main` | §5.1 |
| 10 | Commit message 规范：`type(scope): 描述`，AI 参与加 `AI-Model:` trailer | §3.1 |
| 11 | 禁令清单在 `AGENT.md` 写清：禁 `-A` / `.` / stash / reset / force / `--no-verify` | §3.2 |
| 12 | 分支保护：至少 `Require status checks` + `Require linear history`（多人场景加 approvals） | §4.2 |
| 13 | `ci.yml` 至少 4 硬门（lint / test / deps-gate / security） | §7.1 |
| 14 | `release.yml` 就位，含 tag 触发 + 体积下限守卫 + 已发布防覆盖 | §6.3 / §6.5 |
| 15 | 若需部署裸仓：服务器侧 `git init --bare repo.git` + `_sync_app.sh` 走 `/tmp` + ff-only 同步 | §9 |

**打第一个 tag**：`git tag -a v0.1.0 -m "v0.1.0 - 首个可发布版本" && git push origin v0.1.0`。

---

*本手册版本 v1.0，与源项目仓库 HEAD（截至 2026-10-25）对齐。公开版已把源项目的仓库名、服务器地址、SSH 密钥路径、备份盘路径全部替换为占位符（`{{owner}}` / `{{repo}}` / `{{server-ip}}` / `{{app}}` / `{{backup-root}}` / `{{ssh_key_path}}` 等）。*
*姊妹篇：`01-ENGINEERING-PLAYBOOK.md`（工程体系总纲）。*
*相关：`AGENT.md`（Repo Hygiene / Push Rules 唯一权威）、`docs/handover/PROJECT-HANDOVER.md` §8.1（G1–G5 坑）、`05-AI-CONTRIBUTIONS.md`（AI-Model trailer 完整规范）、`04-SOFT-COPYRIGHT-SOP.md`（软著 SOP）、`../PROJECT-RUN/`（新项目模板）。*
*下次更新：新机制落地时先改对应文件，再改本手册对应章节，保证单一真源。*
