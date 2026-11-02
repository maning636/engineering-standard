#!/usr/bin/env node
// 调度脚本。
// 用法：
//   node scripts/orchestrate/next-tasks.mjs validate <TASK-GRAPH.yaml>
//   node scripts/orchestrate/next-tasks.mjs list <TASK-GRAPH.yaml>
//   node scripts/orchestrate/next-tasks.mjs dispatch <TASK-GRAPH.yaml> <任务id>
// 退出码：0 正常；1 校验失败 / 任务不可派发；2 用法或解析错误。
import { existsSync } from 'node:fs';
import { loadGraph, validateGraph, scopesOverlap, GraphError } from './lib/graph.mjs';

const [cmd, file, taskId] = process.argv.slice(2);
const usage = () => {
  console.error('用法：next-tasks.mjs validate|list <TASK-GRAPH.yaml>  或  next-tasks.mjs dispatch <TASK-GRAPH.yaml> <任务id>');
  process.exit(2);
};
if (!['validate', 'list', 'dispatch'].includes(cmd) || !file) usage();
if (cmd === 'dispatch' && !taskId) usage();
if (!existsSync(file)) { console.error(`找不到文件：${file}`); process.exit(2); }

let g;
try { g = loadGraph(file); } catch (e) {
  if (e instanceof GraphError) { console.error(`解析失败：${e.message}`); process.exit(2); }
  throw e;
}

const errs = validateGraph(g);
if (cmd === 'validate') {
  if (errs.length) {
    console.log(`FAIL 任务图有 ${errs.length} 处问题：`);
    for (const e of errs) console.log('  - ' + e);
    process.exit(1);
  }
  const count = (s) => g.tasks.filter((t) => t.status === s).length;
  console.log(`PASS ${g.tasks.length} 个任务（done ${count('done')} / doing ${count('doing')} / blocked ${count('blocked')}）`);
  process.exit(0);
}
if (errs.length) {
  console.error('任务图校验不通过，先运行 validate 修好再调度。');
  process.exit(1);
}

const byId = new Map(g.tasks.map((t) => [t.id, t]));
const depsDone = (t) => (t.depends_on || []).every((d) => byId.get(d)?.status === 'done');
const doing = g.tasks.filter((t) => t.status === 'doing' || t.status === 'review');
const conflictWith = (t) => doing.find((d) => d.id !== t.id && scopesOverlap(t.write_scope, d.write_scope));

if (cmd === 'list') {
  const cands = g.tasks.filter((t) => ['todo', 'ready'].includes(t.status) && depsDone(t));
  const ok = [], held = [];
  for (const t of cands) { const c = conflictWith(t); (c ? held : ok).push([t, c]); }
  if (!ok.length) console.log('当前没有可派发的任务。');
  else {
    console.log(`可派发 ${ok.length} 个：`);
    for (const [t] of ok) console.log(`  ${t.id}  ${t.title || ''}  [${t.req.join(', ')}]  写：${t.write_scope.join(', ')}`);
  }
  for (const [t, c] of held) console.log(`  暂缓 ${t.id}：写范围和进行中的 ${c.id} 冲突`);
  const blocked = g.tasks.filter((t) => t.status === 'blocked');
  for (const t of blocked) console.log(`  需要人处理 ${t.id}（blocked）`);
  if (!ok.length && !doing.length && g.tasks.every((t) => t.status === 'done')) console.log('全部任务已完成。');
  process.exit(0);
}

const t = byId.get(taskId);
if (!t) { console.error(`任务 ${taskId} 不存在`); process.exit(1); }
if (!['todo', 'ready'].includes(t.status)) { console.error(`任务 ${taskId} 状态是 ${t.status}，不能派发`); process.exit(1); }
if (!depsDone(t)) {
  const left = t.depends_on.filter((d) => byId.get(d)?.status !== 'done');
  console.error(`任务 ${taskId} 的依赖还没完成：${left.join(', ')}`);
  process.exit(1);
}
const c = conflictWith(t);
if (c) { console.error(`任务 ${taskId} 的写范围和进行中的 ${c.id} 冲突，等它合并后再派发`); process.exit(1); }

const list = (a) => (a && a.length ? a.map((x) => `- \`${x}\``).join('\n') : '- （无）');
const gate = g.gate || {};
const retries = t.budget.retries ?? 2;
console.log(`# 工作包 · ${t.id}${t.title ? ' · ' + t.title : ''}

> 由 \`next-tasks.mjs dispatch\` 从 \`${file}\` 生成。段落标题按 AGENT-DISPATCH 五段式，若与 AGENT-DISPATCH.md 原文段名不同，以原文为准。

## 1. 目标

完成任务 ${t.id}，对应需求：${t.req.join('、')}。需求原文见 \`docs/requirements/\`，追踪表见 \`docs/requirements/TRACE-MATRIX.md\`。

## 2. 范围

只能改这些路径（合并门会逐个文件检查）：

${list(t.write_scope)}

改动文件数上限：${t.budget.files} 个。${t.contract_change ? '\n\n本任务是契约变更任务，可以改契约目录。' : `\n\n不能改契约目录 \`${g.contracts_dir || 'contracts'}/\`。`}

## 3. 输入

只读参考：

${list(t.read_scope)}

必须遵守的接口契约：

${list(t.contracts)}

架构边界和术语以 \`docs/arch/ARCH-MAP.md\` 为准。

## 4. 验收

提交前在本地依次跑通，全部退出码为 0：

\`\`\`bash
${t.accept}
${[gate.contract_test, gate.full_test, gate.lint].filter(Boolean).join('\n')}
\`\`\`

合并门命令：\`node scripts/orchestrate/merge-gate.mjs ${t.id} --graph ${file} --base ${g.integration_branch || 'integration'}\`

## 5. 约束

- 契约不够用时停手，写 \`docs/arch/contract-changes/CC-xx.md\`，不要自己改契约。
- 不删除、不跳过已有测试，不放宽断言。
- 新增运行时依赖要先有 ADR。
- 合并门打回后最多重做 ${retries} 次，第 ${retries + 1} 次失败任务会变成 blocked，交给人处理。
- 只提交和本任务有关的改动，提交信息以 \`${t.id}:\` 开头。`);
