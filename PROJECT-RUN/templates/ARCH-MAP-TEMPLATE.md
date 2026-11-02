# 架构图 · <业务ID> · <项目名>

> 规范见 `PROJECT-RUN/ORCHESTRATION.md` 第 2 节①。放在 `docs/arch/ARCH-MAP.md`。
> 确认人：________  确认日期：YYYY-MM-DD  版本：v1
> 本文件是模块边界的唯一依据。MODULE-OWNERS、DESIGN 与本文件冲突时，以本文件为准。

## 1. 模块列表

| 模块 | 职责（一句话） | 负责目录 | 对外接口（契约文件） |
|---|---|---|---|
| shared | 公共类型、错误码、工具函数 | `src/shared/**` | `contracts/types.ts` |
| materials | 物料清单导入、查询 | `src/materials/**` | `contracts/materials.ts` |
| kb | 图纸知识库：解析、检索、问答 | `src/kb/**` | `contracts/retriever.ts` |
| api | HTTP 路由、鉴权 | `src/api/**` | `contracts/http.ts` |
| web | 前端页面 | `web/**` | `contracts/http.ts`（只读） |

## 2. 依赖方向

```
web ──► api ──► materials ──► shared
               └──► kb ──────► shared
```

规则：只能沿箭头方向依赖，禁止反向（例如 shared 不能 import kb）。模块之间只能通过 `contracts/` 里的接口调用，不能 import 对方的内部文件。

## 3. 数据结构

| 实体 | 定义位置 | 存储 |
|---|---|---|
| Material | `contracts/types.ts` | 表 materials |
| DrawingChunk | `contracts/types.ts` | 向量库集合 drawing_chunks |

## 4. 命名约定与术语表

| 业务说法 | 代码里统一叫 | 不要叫 |
|---|---|---|
| 物料 | material | item, part |
| 图纸 | drawing | blueprint, doc |
| 来源引用 | citation | source, ref |

文件名、函数名、接口字段的大小写规则：________

## 5. 技术选型

| 决策 | 选择 | ADR |
|---|---|---|
| 后端语言 / 框架 | | `docs/adr/0001-*.md` |
| 数据库 | | |
| 向量检索 | | |
| 大模型调用方式 | | |

新增任何运行时依赖都要补 ADR，否则漂移检查会标出来。

## 6. 环境

一条命令起好环境：

```bash
<例如：npm ci && npm run db:seed && cp .env.example .env>
```

测试数据来源：________（是否脱敏：是 / 否）
