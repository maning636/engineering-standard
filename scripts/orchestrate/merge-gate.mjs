#!/usr/bin/env node
// 合并门：一个任务能不能合进集成分支，由本脚本的退出码决定。
// 用法：node scripts/orchestrate/merge-gate.mjs <任务id> --graph <TASK-GRAPH.yaml> [--base <分支或提交>]
// 在任务分支（或 worktree）的仓库根目录运行。
// 退出码：0 通过；1 不通过（可重做）；2 用法或环境错误；3 第 N 次失败，任务应标记为 blocked。
// 只判定，不改任务图，不执行合并。失败次数记在 .orchestrate/attempts.json。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { loadGraph, inScope, GraphError } from './lib/graph.mjs';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const taskId = argv[0];
const graphFile = opt('--graph');
if (!taskId || taskId.startsWith('--') || !graphFile) {
  console.error('用法：merge-gate.mjs <任务id> --graph <TASK-GRAPH.yaml> [--base <分支或提交>]');
  process.exit(2);
}

let g;
try { g = loadGraph(graphFile); } catch (e) {
  console.error(e instanceof GraphError ? `任务图解析失败：${e.message}` : String(e));
  process.exit(2);
}
const t = g.tasks.find((x) => x.id === taskId);
if (!t) { console.error(`任务 ${taskId} 不存在`); process.exit(2); }
if (t.status === 'done') { console.error(`任务 ${taskId} 已经是 done`); process.exit(2); }
if (t.status === 'blocked') { console.error(`任务 ${taskId} 是 blocked，先由人处理并把状态改回 doing`); process.exit(3); }
const base = opt('--base') || g.integration_branch || 'integration';

const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`git ${args.join(' ')} 失败：${(r.stderr || '').trim()}`); process.exit(2); }
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
};

const top = git('rev-parse', '--show-toplevel')[0];
const graphRel = relative(top, resolve(graphFile)).replace(/\\/g, '/');
const changed = new Set([
  ...git('diff', '--name-only', `${base}...HEAD`),
  ...git('diff', '--name-only', 'HEAD'),
  ...git('ls-files', '--others', '--exclude-standard'),
].filter((f) => !f.startsWith('.orchestrate/') && f !== graphRel));

const stateDir = '.orchestrate';
const attemptsFile = join(stateDir, 'attempts.json');
const attempts = existsSync(attemptsFile) ? JSON.parse(readFileSync(attemptsFile, 'utf8')) : {};
const limit = (t.budget?.retries ?? 2) + 1;

const fails = [];
const report = [];

if (changed.size === 0) fails.push('没有任何改动');
const outside = [...changed].filter((f) => !inScope(f, t.write_scope));
if (outside.length) fails.push(`改动超出 write_scope：${outside.join(', ')}`);
const cdir = (g.contracts_dir || 'contracts').replace(/\/+$/, '') + '/';
const touchedContracts = [...changed].filter((f) => f.startsWith(cdir));
if (touchedContracts.length && t.contract_change !== true) {
  fails.push(`改动了契约目录但任务没有 contract_change: true：${touchedContracts.join(', ')}（契约变更要走 CONTRACT-CHANGE）`);
}
if (typeof t.budget?.files === 'number' && changed.size > t.budget.files) {
  fails.push(`改动 ${changed.size} 个文件，超过预算 ${t.budget.files}`);
}
report.push(`改动文件 ${changed.size} 个：${[...changed].join(', ') || '（无）'}`);

if (!fails.length) {
  const gate = g.gate || {};
  const steps = [
    ['accept', t.accept],
    ['contract_test', gate.contract_test],
    ['full_test', gate.full_test],
    ['lint', gate.lint],
  ].filter(([, c]) => c);
  for (const [name, command] of steps) {
    const r = spawnSync(command, { shell: true, encoding: 'utf8' });
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    if (r.status !== 0) {
      fails.push(`${name} 失败（退出码 ${r.status}）：${command}`);
      report.push(`--- ${name} 输出（末尾 40 行）---\n${out.split(/\r?\n/).slice(-40).join('\n')}`);
      break;
    }
    report.push(`${name} 通过：${command}`);
  }
}

for (const line of report) console.log(line);

if (!fails.length) {
  if (attempts[taskId]) { delete attempts[taskId]; mkdirSync(stateDir, { recursive: true }); writeFileSync(attemptsFile, JSON.stringify(attempts, null, 2)); }
  console.log(`PASS ${taskId} 可以合并进 ${base}。合并后把任务状态改为 done，并在追踪表登记。`);
  process.exit(0);
}

const n = (attempts[taskId]?.count || 0) + 1;
attempts[taskId] = { count: n, last: new Date().toISOString(), reasons: fails };
mkdirSync(stateDir, { recursive: true });
writeFileSync(attemptsFile, JSON.stringify(attempts, null, 2));

console.log(`FAIL ${taskId} 第 ${n}/${limit} 次：`);
for (const f of fails) console.log('  - ' + f);
if (n >= limit) {
  console.log(`BLOCKED ${taskId} 已失败 ${n} 次，把任务状态改为 blocked，交给人处理。`);
  process.exit(3);
}
console.log('把以上输出原样交给子代理重做。');
process.exit(1);
