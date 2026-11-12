# answer-me-with-html 使用规范（laoma 定制版）

> 适用：所有「分析报告 / 评审 / 方案对比 / 架构讲解」类 HTML 页面产出。
> 基础 skill：[QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html)（MIT），
> 已装入 `C:/Users/Administrator/.agents/skills/answer-me-with-html/`，CLI 随 skill 自带，需 Node.js 20+。

## 1. 主题：用 `laoma`，不用默认 blueprint

自建主题 `~/.answer-me-with-html/themes/laoma.json`（宣纸白 + 墨字 + 印泥红 #C9252D，
与标书产品正红品牌同源）。已过 `am theme check`（WCAG AA，light/dark 双套 0 警告）。

- 稿件 frontmatter 写 `theme: laoma`，或渲染时 `--theme laoma`
- 主题 CSS 已内置两条强调机制：
  - **加粗文字自动带红底衬线**（`linear-gradient` 下 38% 红衬）——关键数字、关键结论必须加粗
  - panel 编号、callout 左边框统一印泥红
- 改主题色值后必须跑 `am theme check laoma`，0 errors 0 warnings 才算过

## 2. 模板选择：分析类一律 `doc`，概览类才用 `sheet`

| 场景 | 模板 | 理由 |
|---|---|---|
| 报告深读 / 评审 / 调研结论（≥10 节） | `template: doc` + `outline: left` | 侧栏目录 + 线性长读，细节放得下 |
| 一屏速览 / 会议片头 / 日常结论 | `template: sheet`（默认） | 2~4 面板格子 |

教训（2026-11-12）：16-18 KB 的报告压进 sheet 的 7 个格子，用户评价
「层次够、构图够，但重点不突出、要点分析不细致」——深度内容必须用 doc。

## 3. 内容写法：重点突出的四条硬规则

1. **结论前置**：lead 一句话给结论 + 加粗关键数字；第一节是 callout 结论，不是背景。
2. **每节有钩子**：长节末尾放一个 `callout`（info/warn/err）说「所以呢」；
   纯表格节至少在表后留一行判断句。
3. **关键数字全部加粗**：星标数、金额、比例、天数、测试通过数——让扫读的人
   只看加粗字也能拿到全部重点。
4. **评审类必带「原文没写的部分」**：分析别人文档时，最后一节是评审者自己的
   增量判断（缺口/风险/排期建议），不是复述原文。

## 4. STE 与渲染纪律

- 渲染输出 `STE 0 warnings` 才算交付；警告按 CLI 给的行号修稿重渲（最多 2 轮）
- 中文句长：描述句 ≤45 字，步骤句 ≤35 字；一段 ≤6 句
- 敏感词自动拦截：闭环、方法论、赋能、综上所述等套话会报 cliché，改成具体事实
- 产物路径：标书项目一律 `-o "D:/dim开发/_bidmaster/网页/<名称>.html"`；
  稿件存 `~/.answer-me-with-html/drafts/`，不混进项目目录

## 5. 迭代已产出的页面

只改一节用 patch，不要整页重写：

```bash
node ~/.agents/skills/answer-me-with-html/scripts/am.mjs patch <page.html> --panel "B 仓库事实" <<'AM_EOF'
## B 仓库事实
（新的面板内容）
AM_EOF
```

## 6. 上游更新

skill 有新版时对 Agent 说「更新一下 answer-me-with-html」；`laoma.json` 是本地文件，
`am theme update` 不会覆盖用户自建主题，升级安全。
