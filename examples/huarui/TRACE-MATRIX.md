# 需求追踪表 · REQ-2026-0001 · 华锐精密（示例，开发中途状态）

> 机判：`node scripts/orchestrate/trace-check.mjs examples/huarui/TRACE-MATRIX.md`
> 这一份处在开发中途：前几列已填，验收结论还空着，所以 build 阶段通过、`--stage release` 不通过，这是预期结果。

| 需求编号 | 优先级 | 设计位置 | BuildSpec 阶段 | 任务/PR | 测试或评估用例 | 证据路径 | 验收结论 |
|---|---|---|---|---|---|---|---|
| REQ-2026-0001-F01 | 必须 | ARCH-MAP#materials | S1 | T-002 | tests/materials.import.spec.ts | docs/evidence/v0.1/F01.md | |
| REQ-2026-0001-F02 | 必须 | ARCH-MAP#materials | S1 | T-003, T-006, T-007 | tests/materials.query.spec.ts | docs/evidence/v0.1/F02.md | |
| REQ-2026-0001-F03 | 必须 | ARCH-MAP#kb, contracts/retriever.ts | S2 | T-004, T-005, T-006, T-007 | evals/kb-qa.yaml; F03-A01, F03-A02 | docs/evidence/v0.2/F03.md | |
| REQ-2026-0001-F04 | 应该 | ARCH-MAP#web | S2 | T-008 | tests/e2e/admin.spec.ts | docs/evidence/v0.2/F04.md | |
| REQ-2026-0001-F05 | 本期不做 | | | | | | 出范围（见 scope.md） |
