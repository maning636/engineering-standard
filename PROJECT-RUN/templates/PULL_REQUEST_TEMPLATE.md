<!--
# [DORMANT - TEAM MODE]
# 激活方式：TEAM 模式下复制本文件到 .github/pull_request_template.md（GitHub 会自动加载为 PR 正文骨架）。
# 单人（SOLO）阶段保留本 DORMANT 注释块，仅作格式参考。
# 参见 templates/DORMANT-SWITCHES-TEMPLATE.md 第 1 项。
-->

## 1. 改了什么

<!-- 一句话说清：本 PR 完成了什么、没完成什么。 -->
-

## 2. 为什么这么改

<!-- 引用 Issue / ADR / 决策台账条目。避免「为了更好」类空话。 -->
- Closes #<issue-number>
- 参见 ADR-<编号> 或决策台账条目 <编号>

## 3. 影响范围

- 触及模块（多选，按目录）：
  - [ ] `src/`
  - [ ] `backend/`
  - [ ] `frontend/`
  - [ ] `docs/`
  - [ ] `scripts/`
  - [ ] `tests/`
  - [ ] `infra/`
  - [ ] 其他：______

## 4. 是否触及架构 / 门禁

- [ ] 触及架构层（模块边界、公共接口、数据模型、加密/授权）
- [ ] 触及发布门禁（CI / release script / branch protection）
- [ ] 触及对外契约（API / DB schema / 前端路由）
- 若勾选任一，请附 ADR 链接：`docs/architecture/decisions/ADR-NNNN.md`

## 5. 测试证据

<!-- 逐条列出你怎么验证的。命令 + 输出摘要。禁止「应该可以了」类表述。 -->

**本地四步**：
- [ ] 1. 单元测试全绿（`pytest -x -q` / `npm test` / 项目当前口径）
- [ ] 2. Lint 全绿（`ruff` / `eslint` / 项目当前口径）
- [ ] 3. 类型检查全绿（`mypy --strict` / `tsc --noEmit` / 项目当前口径）
- [ ] 4. Smoke test 通过（应用启动 + 关键路径一次走完）

```
$ <command>
<输出摘要 / passed / failed 数量>
```

**CI 结果**（PR 合并前必须全绿）：
- [ ] `lint` 硬门通过
- [ ] `test` 硬门通过
- [ ] `deps-gate` 硬门通过（如涉及依赖）
- [ ] `security.yml` 全部通过（如涉及依赖/代码）

**新增/修改的测试文件**：
- `<路径>`

## 6. 坑清单

<!-- 引用 docs/pitfalls.md 的编号（P-NNN）。 -->
- 触及：`P-<编号>`
- [ ] 本 PR 未新增坑
- [ ] 本 PR 新增坑，条目草案：

```
### P-<编号>: <一句话现象>
- 现象：<报错/异常表现>
- 根因：<真正的原因>
- 修法：<怎么修的 + 文件位置>
- 日期：<YYYY-MM-DD>｜Commit：<hash>
```

## 7. 文档同步

- [ ] 不涉及文档同步
- [ ] 已更新 `README.md` / `CONTRIBUTING.md` / `SECURITY.md`
- [ ] 已更新 `CHANGELOG.md`
- [ ] 已新增/更新 ADR（`docs/architecture/decisions/`）
- [ ] 已更新 `docs/pitfalls.md`

## 8. AI 参与记录

<!-- AI 参与的 commit 必须带 AI-Model trailer。 -->
- [ ] 本 PR 全部由人完成
- [ ] 本 PR 有 AI 参与，commit 均带 `AI-Model:` trailer
- AI 参与范围（如有）：<哪些 commit / 哪些文件>

## 9. 团队模式专属（TEAM 模式必填）

- [ ] 若本 PR 由 AI Agent 创建或主要撰写，人类已在下方声明「已人工复核关键逻辑」

> 已人工复核关键逻辑：<@GitHub username> @ <YYYY-MM-DD>
> 复核范围：<哪些文件/函数被复核过，以及发现并修正了什么>

## 10. Reviewer 请确认

- [ ] 改动范围与 PR 描述一致
- [ ] 测试证据可复现
- [ ] 坑清单条目已勾选
- [ ] 文档同步项已勾选
- [ ] 无敏感信息（凭据 / 账号 / 本机路径）泄漏
