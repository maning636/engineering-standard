#!/usr/bin/env node
// 合并门：一个任务能不能合进集成分支，由本脚本的退出码决定。
// 用法：node scripts/orchestrate/merge-gate.mjs <任务id> --graph <TASK-GRAPH.yaml> [--base <分支或提交>]
// 在任务分支（或 worktree）的仓库根目录运行。
// 退出码：0 通过；1 不通过（可重做）；2 用法或环境错误；3 第 N 次失败，任务应标记为 blocked。
// 只判定，不改任务图，不执行合并。attempts.json 仅作本地重试提示，可信授权来自受保护 base。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { loadGraph, parseGraph, validateGraph, inScope, GraphError } from './lib/graph.mjs';

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

const gitText = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`git ${args.join(' ')} 失败：${(r.stderr || '').trim()}`); process.exit(2); }
  return r.stdout;
};
const git = (...args) => gitText(...args).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const top = git('rev-parse', '--show-toplevel')[0];
const graphRel = relative(top, resolve(graphFile)).replace(/\\/g, '/');
if (!graphRel || graphRel === '..' || graphRel.startsWith('../')) {
  console.error(`任务图必须位于当前 git 仓库内，不能是仓库外路径：${graphFile}`);
  process.exit(2);
}
let trustedGraph;
try {
  trustedGraph = parseGraph(gitText('show', `${base}:${graphRel}`));
} catch (e) {
  console.error(e instanceof GraphError ? `可信基线任务图解析失败：${e.message}` : String(e));
  process.exit(2);
}
const trustedErrors = validateGraph(trustedGraph);
if (trustedErrors.length) {
  console.error(`可信基线任务图校验失败：\n- ${trustedErrors.join('\n- ')}`);
  process.exit(2);
}
const trustedTask = trustedGraph.tasks.find((x) => x.id === taskId);
const fails = [];
const report = [];

if (!trustedTask) {
  fails.push(`任务 ${taskId} 未在可信基线 ${base} 登记，不能由工作分支自行新增授权`);
} else {
  const protectedFields = ['req', 'depends_on', 'write_scope', 'accept', 'budget', 'contract_change'];
  const changedFields = protectedFields.filter((field) => !same(trustedTask[field], t[field]));
  if (changedFields.length) fails.push(`任务受保护字段被工作分支修改：${changedFields.join(', ')}`);
}
const protectedRoot = ['gate', 'integration_branch', 'contracts_dir'];
const changedRoot = protectedRoot.filter((field) => !same(trustedGraph[field], g[field]));
if (changedRoot.length) fails.push(`任务图顶层受保护字段被修改：${changedRoot.join(', ')}`);
const graphErrors = validateGraph(g);
if (graphErrors.length) fails.push(`当前任务图校验失败：${graphErrors.join('；')}`);

const authorized = trustedTask || t;
const changed = new Set([
  ...git('diff', '--name-only', `${base}...HEAD`),
  ...git('diff', '--name-only', 'HEAD'),
  ...git('ls-files', '--others', '--exclude-standard'),
].filter((f) => !f.startsWith('.orchestrate/') && f !== graphRel));

const stateDir = '.orchestrate';
const attemptsFile = join(stateDir, 'attempts.json');
let attempts = {};
if (existsSync(attemptsFile)) {
  try {
    attempts = JSON.parse(readFileSync(attemptsFile, 'utf8'));
    if (!attempts || typeof attempts !== 'object' || Array.isArray(attempts)) throw new Error('顶层不是对象');
  } catch (e) {
    console.error(`无法解析 ${attemptsFile}：${e.message}`);
    process.exit(2);
  }
}
const limit = (authorized.budget?.retries ?? 2) + 1;

if (changed.size === 0) fails.push('没有任何改动');
const outside = [...changed].filter((f) => !inScope(f, authorized.write_scope));
if (outside.length) fails.push(`改动超出 write_scope：${outside.join(', ')}`);
const cdir = (trustedGraph.contracts_dir || 'contracts').replace(/\/+$/, '') + '/';
const touchedContracts = [...changed].filter((f) => f.startsWith(cdir));
if (touchedContracts.length && authorized.contract_change !== true) {
  fails.push(`改动了契约目录但任务没有 contract_change: true：${touchedContracts.join(', ')}（契约变更要走 CONTRACT-CHANGE）`);
}
if (typeof authorized.budget?.files === 'number' && changed.size > authorized.budget.files) {
  fails.push(`改动 ${changed.size} 个文件，超过预算 ${authorized.budget.files}`);
}
report.push(`改动文件 ${changed.size} 个：${[...changed].join(', ') || '（无）'}`);

if (!fails.length) {
  const gate = trustedGraph.gate || {};
  const steps = [
    ['accept', authorized.accept],
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
