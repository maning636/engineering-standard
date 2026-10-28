# START HERE

> 本库是**可执行的工程标准**，不是读物。  
> 无论你是人还是 AI Agent，从这里路由到你要做的事，只读那一份。

---

## 给 Agent 的一句话

```
你是执行 Agent。先读本文件，按下方路由表读对应文档，
再按 PROJECT-RUN/AGENT-PROTOCOL.md 的阶段状态机执行。
文档没覆盖的情况写 BLOCKED 等人，禁止自由发挥。
```

---

## 路由表：你要做什么 → 读哪份

| 你要做的事 | 先读 | 再读（按需） |
|---|---|---|
| **从零建一个新项目** | `PROJECT-RUN/AGENT-BOOTSTRAP.md`（填变量 → 先出计划 → 等人审） | `PROJECT-RUN/checklist.md`、`PROJECT-RUN/AGENT-PROTOCOL.md` P0/P1 |
| **给现有项目加功能** | `PROJECT-RUN/AGENT-PROTOCOL.md` P2 | `PROJECT-RUN/CRAFTS/TDD.md`（规划中）、`PROJECT-RUN/CRAFTS/REVIEW.md`（规划中） |
| **做设计 / 技术选型** | `PROJECT-RUN/CRAFTS/DESIGN.md`（规划中） | `PROJECT-RUN/templates/ADR-TEMPLATE.md` |
| **发版 / 打包 / 上线** | `PROJECT-RUN/RELEASE.md`（规划中） | `PROJECT-RUN/templates/DEPLOY/`（规划中） |
| **做注册码 / 授权 / 后台服务** | `PROJECT-RUN/LICENSING.md` | `PROJECT-RUN/templates/LICENSING/` |
| **派小模型子智能体干活** | `PROJECT-RUN/AGENT-DISPATCH.md` | — |
| **单人 ↔ 团队切换** | `PROJECT-RUN/DUAL-MODE.md` | `PROJECT-RUN/templates/DORMANT-SWITCHES-TEMPLATE.md` |
| **出事故了 / 要回滚** | `PROJECT-RUN/AGENT-PROTOCOL.md` P6 | `PROJECT-RUN/RELEASE.md`（规划中） 的撤回章节 |
| **想理解"为什么这样规定"** | `ENGINEERING-KIT/START-HERE.md` | `ENGINEERING-KIT/01-ENGINEERING-PLAYBOOK.md` |

> 表里没出现的事 = 本库未覆盖 → 在 `PROGRESS.md` 写 `BLOCKED: <问题>`，等人决定。

---

## 三份最小必读（10 分钟）

1. **`PROJECT-RUN/FLOW.md`** — P0–P6 一页流程图
2. **`PROJECT-RUN/AGENT-PROTOCOL.md`** — 各阶段做什么、怎么验证、什么时候算完 + 11 条红线
3. **`PROJECT-RUN/PROGRESS.md`** — 现成台账（复制到项目根，改模式行即开工）

---

## 库的结构（一眼看懂）

```
engineering-standard/
├── START-HERE.md              ← 你在这里（路由表）
├── README.md                  ← 人看的库介绍
├── PROJECT-RUN/               ← 执行包：直接拿去做项目
│   ├── AGENT-BOOTSTRAP.md     新项目完整启动指令（变量表 + 两段式 + 计划模板 + DoD）
│   ├── AGENT-PROTOCOL.md      P0–P6 阶段机 + 11 条红线
│   ├── AGENT-DISPATCH.md      派小模型的提示词规范
│   ├── DUAL-MODE.md           SOLO/TEAM 双模 + 休眠开关
│   ├── FLOW.md                一页流程图
│   ├── PROGRESS.md            台账（现成实例）
│   ├── checklist.md          30 项启动检查单
│   ├── RELEASE.md            发布 / 部署 / 撤回（规划中）
│   ├── LICENSING.md          注册码 / 授权服务 / 密钥红线
│   ├── CRAFTS/               工艺：设计 / TDD / 评审 / 验证（规划中）
│   └── templates/            模板（含 PROJECT-AGENT、ADR、CI、DEPLOY、LICENSING）
└── ENGINEERING-KIT/          教材：理解原理时读
```

---

## 用一句话把活交出去

```
读 https://github.com/maning636/engineering-standard 的 START-HERE.md，
按其中的路由执行。每个里程碑给验收命令和实际输出，没覆盖的写 BLOCKED。
```

---

## 许可

本库采用 **CC BY-NC-SA 4.0**（署名-非商业性使用-相同方式共享）许可：
可自由阅读、评审与在非商业项目中改编，**不得用于商业目的**。商业授权需另行取得。

完整条款见仓库根 `LICENSE`。
