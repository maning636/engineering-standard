# 需求追踪表 · <业务ID> · <项目名>

> 规范见 `PROJECT-RUN/REQUIREMENTS.md` 第 6 节。放在 `docs/requirements/TRACE-MATRIX.md`。
> 机判：`node scripts/orchestrate/trace-check.mjs docs/requirements/TRACE-MATRIX.md`（发版前），验收后加 `--stage release`。
> 填写规则：没有内容的格子留空或写 `-`，不要写“待定”“TBD”（会被当作空）。作废的需求在“验收结论”列写 `作废 CP-xx`，这一行保留。

| 需求编号 | 优先级 | 设计位置 | BuildSpec 阶段 | 任务/PR | 测试或评估用例 | 证据路径 | 验收结论 |
|---|---|---|---|---|---|---|---|
| REQ-2026-0001-F01 | 必须 | ARCH-MAP#materials | S1 | T-003, T-004 | tests/materials.import.spec.ts | docs/evidence/v0.1/F01.md | |
| REQ-2026-0001-F03 | 必须 | ARCH-MAP#kb, contracts/retriever.ts | S2 | T-014 | evals/kb-qa.yaml; F03-A01, F03-A02 | docs/evidence/v0.2/F03.md | |
| REQ-2026-0001-F05 | 本期不做 | | | | | | 出范围（见 scope.md） |
