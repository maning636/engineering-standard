# 接口契约 · <契约名> · v<版本>

> 规范见 `PROJECT-RUN/ORCHESTRATION.md`。放在 `docs/arch/contracts/<契约名>.md`，和 `contracts/<契约名>.ts`（或其他语言的接口定义文件）一一对应。
> 代码文件是准，本文件解释代码文件。两者不一致时以代码文件为准，并当作缺陷修。

| 项 | 内容 |
|---|---|
| 契约文件 | `contracts/retriever.ts` |
| 提供方模块 | kb |
| 使用方模块 | api |
| 关联需求 | REQ-2026-0001-F03 |
| 契约测试 | `contracts/__tests__/retriever.contract.test.ts` |
| 当前版本 | v1（变更记录见末尾） |

## 1. 接口清单

| 名称 | 输入 | 输出 | 错误 |
|---|---|---|---|
| `search(query, opts)` | `query: string`（1～500 字），`opts.topK: number`（默认 5，最大 20） | `Citation[]`，按相关度降序 | `E_EMPTY_QUERY`、`E_INDEX_NOT_READY` |

## 2. 行为约定

- 幂等性：`search` 无副作用，可重试。
- 性能：P95 延迟 ≤ ____ ms（数据规模 ____ 条）。
- 空结果：返回空数组，不抛错。
- 编码、时区、金额单位等约定：________

## 3. 契约测试必须覆盖

- [ ] 正常输入返回结构符合类型
- [ ] 每个错误码至少一个用例
- [ ] 边界值（空串、最大长度、topK 上限）

## 4. 变更记录

| 版本 | 日期 | 变更提案 | 内容 |
|---|---|---|---|
| v1 | YYYY-MM-DD | - | 初版 |
