# 契约变更提案 · CC-<两位>

> 规范见 `PROJECT-RUN/ORCHESTRATION.md` 第 4 节。放在 `docs/arch/contract-changes/CC-<两位>.md`。
> 子代理发现契约不够用时写本文件并停手，不要自己改契约。

| 项 | 内容 |
|---|---|
| 提出人 / 任务 | 子代理 owner / T-014 |
| 涉及契约 | `contracts/retriever.ts` v1 |
| 来源 | 实现中发现 / 需求变更（填 CP 编号） |
| 提出日期 | YYYY-MM-DD |

## 1. 改什么

改动前后的签名或字段对比，写成代码块：

```ts
// 改动前
search(query: string, opts?: { topK?: number }): Promise<Citation[]>
// 改动后
search(query: string, opts?: { topK?: number; drawingNo?: string }): Promise<Citation[]>
```

## 2. 为什么

不改会怎样；有没有不改契约的替代办法，为什么不用。

## 3. 影响范围

| 任务 | 当前状态 | 处理 |
|---|---|---|
| T-014 | doing | 等契约升版后继续 |
| T-020 | done | 回到 ready，重做受影响部分 |

是否向后兼容：是 / 否。

## 4. 决定（由人填写）

- [ ] 批准：契约升到 v__；改契约的任务编号 ______（带 `contract_change: true`）
- [ ] 驳回：原因 ______
- 决定人：______  日期：YYYY-MM-DD
