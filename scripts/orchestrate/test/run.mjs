#!/usr/bin/env node
// 编排脚本回归测试。在临时 git 仓库里跑，结束后删除。
// 用法：node scripts/orchestrate/test/run.mjs   退出码 0 表示全部通过。
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const scripts = resolve(here, '..');
const NEXT = join(scripts, 'next-tasks.mjs');
const GATE = join(scripts, 'merge-gate.mjs');
const TRACE = join(scripts, 'trace-check.mjs');
const EVAL = join(scripts, 'eval-check.mjs');

const repo = mkdtempSync(join(tmpdir(), 'orch-test-'));
const results = [];
const sh = (cmd, args) => spawnSync(cmd, args, { cwd: repo, encoding: 'utf8' });
const node = (...args) => sh(process.execPath, args);
const git = (...args) => { const r = sh('git', args); if (r.status !== 0) throw new Error(`git ${args.join(' ')}：${r.stderr}`); return r; };
const write = (rel, text) => { const p = join(repo, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const check = (name, r, expect, mustInclude) => {
  const out = `${r.stdout}${r.stderr}`;
  const ok = r.status === expect && (!mustInclude || out.includes(mustInclude));
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}（期望退出码 ${expect}，实际 ${r.status}）`);
  if (!ok) console.log(out.split('\n').map((l) => '      ' + l).join('\n'));
};

const graph = (contractCmd, extraTasks = '') => `version: 1
project: TEST
integration_branch: integration
contracts_dir: contracts
gate:
  contract_test: "${contractCmd}"
  full_test: "node -e \\"process.exit(0)\\""
  lint: "node -e \\"process.exit(0)\\""
tasks:
  - id: T-001
    req: [ARCH]
    depends_on: []
    write_scope: [src/a/**]
    accept: "node -e \\"process.exit(0)\\""
    budget: { files: 3, retries: 2 }
    status: doing
    owner: "agent-1"
  - id: T-002
    req: [REQ-TEST-F01]
    depends_on: []
    write_scope: [src/b/**]
    accept: "node -e \\"process.exit(0)\\""
    budget: { files: 3, retries: 2 }
    status: ready
    owner: ""
${extraTasks}`;

const resetBranch = (name) => {
  git('checkout', '-q', 'integration');
  git('checkout', '-q', '-B', name);
  git('checkout', '-q', '--', '.');
  git('clean', '-fdq');
  rmSync(join(repo, '.orchestrate'), { recursive: true, force: true });
};

try {
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'orch-test');
  git('config', 'core.autocrlf', 'false');
  write('.gitignore', '.orchestrate/\n');
  write('contracts/a.ts', 'export interface A { x: number }\n');
  write('src/a/index.ts', 'export const a = 1;\n');
  write('src/b/index.ts', 'export const b = 1;\n');
  write('fail.mjs', 'process.exit(1);\n');
  write('docs/arch/TASK-GRAPH.yaml', graph('node -e \\"process.exit(0)\\"'));
  git('add', '-A');
  git('commit', '-q', '-m', 'init');
  git('branch', '-M', 'integration');

  const G = 'docs/arch/TASK-GRAPH.yaml';

  // 1. 范围内改动通过
  resetBranch('task/T-001');
  write('src/a/index.ts', 'export const a = 2;\n');
  git('commit', '-qam', 'T-001: change a');
  check('范围内改动通过合并门', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 0, 'PASS');

  // 2. 越界改动被拒
  resetBranch('task/T-001-out');
  write('src/a/index.ts', 'export const a = 3;\n');
  write('src/b/index.ts', 'export const b = 9;\n');
  check('改动超出 write_scope 被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, 'src/b/index.ts');
  git('checkout', '-q', '--', '.');

  // 3. 未声明 contract_change 改契约被拒
  resetBranch('task/T-001-contract');
  write('contracts/a.ts', 'export interface A { x: string }\n');
  write('src/a/index.ts', 'export const a = 4;\n');
  check('未声明 contract_change 改契约被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, 'contract_change');
  git('checkout', '-q', '--', '.');

  // 4. 契约测试失败被拒；5. 第 3 次失败变 BLOCKED
  git('checkout', '-q', 'integration');
  write(G, graph('node fail.mjs'));
  git('commit', '-qam', 'test: trusted failing contract');
  resetBranch('task/T-001-ct');
  write('src/a/index.ts', 'export const a = 5;\n');
  check('契约测试失败被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, 'contract_test 失败');
  check('第 2 次失败仍可重做', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, '第 2/3 次');
  check('第 3 次失败变 BLOCKED', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 3, 'BLOCKED');
  git('checkout', '-q', 'integration');
  write(G, graph('node -e \\"process.exit(0)\\"'));
  git('commit', '-qam', 'test: restore trusted contract');

  const editGraph = (fn) => write(G, fn(git('show', `HEAD:${G}`).stdout));

  resetBranch('task/T-001-tamper-scope');
  editGraph((text) => text.replace('write_scope: [src/a/**]', 'write_scope: ["**"]'));
  write('src/a/index.ts', 'export const a = 6;\n');
  write('src/b/index.ts', 'export const b = 10;\n');
  check('工作分支扩大 write_scope 被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, '受保护字段');

  resetBranch('task/T-001-tamper-accept');
  editGraph((text) => text.replace(/accept: "node -e .*"/, 'accept: "node --version"'));
  write('src/a/index.ts', 'export const a = 7;\n');
  check('工作分支替换 accept 被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, '受保护字段');

  resetBranch('task/T-001-tamper-budget');
  editGraph((text) => text.replace('budget: { files: 3, retries: 2 }', 'budget: { files: 99, retries: 99 }'));
  write('src/a/index.ts', 'export const a = 8;\n');
  check('工作分支提高预算被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, '受保护字段');

  resetBranch('task/T-001-tamper-contract');
  editGraph((text) => text.replace('accept: "node -e \\"process.exit(0)\\""', 'contract_change: true\n    accept: "node -e \\"process.exit(0)\\""'));
  write('contracts/a.ts', 'export interface A { x: boolean }\n');
  write('src/a/index.ts', 'export const a = 9;\n');
  check('工作分支自批契约变更被拒', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 1, '受保护字段');

  resetBranch('task/T-001-unregistered');
  editGraph((text) => text.replace('id: T-001', 'id: T-NEW'));
  write('src/a/index.ts', 'export const a = 10;\n');
  check('未在可信基线登记的新任务被拒', node(GATE, 'T-NEW', '--graph', G, '--base', 'integration'), 1, '未在可信基线');

  resetBranch('task/T-001-status');
  editGraph((text) => text.replace('status: doing', 'status: review').replace('owner: "agent-1"', 'owner: "agent-2"'));
  write('src/a/index.ts', 'export const a = 11;\n');
  check('合法 status 和 owner 更新通过', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 0, 'PASS');

  resetBranch('task/T-001-attempts');
  write('.orchestrate/attempts.json', '{not-json');
  write('src/a/index.ts', 'export const a = 12;\n');
  check('损坏 attempts JSON 返回环境错误', node(GATE, 'T-001', '--graph', G, '--base', 'integration'), 2, 'attempts.json');

  resetBranch('task/T-001-outside-graph');
  write('../orchestrate-outside.yaml', graph('x'));
  write('src/a/index.ts', 'export const a = 13;\n');
  check('仓库外任务图返回环境错误', node(GATE, 'T-001', '--graph', '../orchestrate-outside.yaml', '--base', 'integration'), 2, '仓库外');

  // 6. 有环被拒
  write('cyc.yaml', graph('x', `  - id: T-003
    req: [ARCH]
    depends_on: [T-004]
    write_scope: [src/c/**]
    accept: "x"
    budget: { files: 1, retries: 2 }
    status: todo
  - id: T-004
    req: [ARCH]
    depends_on: [T-003]
    write_scope: [src/d/**]
    accept: "x"
    budget: { files: 1, retries: 2 }
    status: todo
`));
  check('依赖有环被 validate 拒绝', node(NEXT, 'validate', 'cyc.yaml'), 1, '依赖有环');

  // 7. 无依赖任务写范围重叠被拒
  write('overlap.yaml', graph('x', `  - id: T-005
    req: [ARCH]
    depends_on: []
    write_scope: [src/a/sub/**]
    accept: "x"
    budget: { files: 1, retries: 2 }
    status: todo
`));
  check('无依赖任务写范围重叠被拒绝', node(NEXT, 'validate', 'overlap.yaml'), 1, '写范围重叠');

  // 8. list 暂缓与进行中任务冲突的任务
  write('hold.yaml', graph('x', `  - id: T-006
    req: [ARCH]
    depends_on: [T-001]
    write_scope: [src/a/sub/**]
    accept: "x"
    budget: { files: 1, retries: 2 }
    status: todo
`));
  check('list 只列出依赖已完成的任务', node(NEXT, 'list', 'hold.yaml'), 0, 'T-002');

  // 9. 解析错误返回 2
  write('tab.yaml', 'tasks:\n\t- id: T-1\n');
  check('Tab 缩进返回解析错误', node(NEXT, 'validate', 'tab.yaml'), 2, 'Tab');

  // 10. trace-check 空列返回非零
  write('trace.md', `| 需求编号 | 优先级 | 设计位置 | BuildSpec 阶段 | 任务/PR | 测试或评估用例 | 证据路径 | 验收结论 |
|---|---|---|---|---|---|---|---|
| REQ-TEST-F01 | 必须 | ARCH-MAP#a | S1 | T-001 | | docs/e.md | |
| REQ-TEST-F02 | 必须 | - | | | | | 作废 CP-TEST-01 |
`);
  check('trace-check 空列返回 1', node(TRACE, 'trace.md'), 1, '测试或评估用例');

  // 11～15. eval-check：题库 lint、汇总 promptfoo 结果、阈值与基线
  const q = (id, refuse, extra = {}) => JSON.stringify({
    id, question: `问题 ${id}`, req: 'F03-A01', type: refuse ? '对抗' : '常规', should_refuse: refuse,
    ...(refuse ? {} : { expected: ['要点'], sources: ['SOP-01 第1页'] }), ...extra,
  });
  write('evals/set.jsonl', [q('K1', false), q('K2', false), q('K3', false), q('K4', true)].join('\n') + '\n');
  check('eval lint 合格题库通过', node(EVAL, 'lint', 'evals/set.jsonl'), 0, '25.0%');

  write('evals/bad.jsonl', [q('K1', false), q('K1', false, { sources: [] }), q('K3', false), q('K4', false)].join('\n') + '\n');
  check('eval lint 抓出重复 id、缺出处、拒答题不足', node(EVAL, 'lint', 'evals/bad.jsonl'), 1, '拒答题占比');

  const row = (id, comps) => JSON.stringify({
    testIdx: 0, promptIdx: 0, success: comps.every((c) => c[1]),
    testCase: { metadata: { id } },
    gradingResult: { componentResults: comps.map(([metric, pass]) => ({ pass, score: pass ? 1 : 0, assertion: { type: 'contains', metric } })) },
  });
  write('evals/results.jsonl', [
    row('K1', [['answer_correct', true], ['citation_correct', true]]),
    row('K2', [['answer_correct', false], ['citation_correct', true]]),
    row('K3', [['answer_correct', true], ['citation_correct', true]]),
    JSON.stringify({ testIdx: 3, promptIdx: 0, success: false, testCase: { metadata: { id: 'K4' } }, gradingResult: null }),
  ].join('\n') + '\n');
  const sum = node(EVAL, 'summarize', 'evals/results.jsonl', '--set', 'evals/set.jsonl', '--out', 'evals/summary.json');
  check('eval summarize 按 metric 聚合，出错题计入失败', sum, 0, '"errors": 1');

  write('evals/rules.json', JSON.stringify({ max_drop_pp: 2, metrics: { answer_correct: { min: 0.6 } } }));
  write('evals/ok.json', JSON.stringify({ eval_set: 'set', cases: 4, metrics: { answer_correct: { pass: 3, total: 4, rate: 0.75 } } }));
  write('evals/base.json', JSON.stringify({ eval_set: 'set', cases: 4, metrics: { answer_correct: { pass: 4, total: 4, rate: 0.76 } } }));
  check('eval check 达标且下降不超过 2pp 通过', node(EVAL, 'check', 'evals/ok.json', '--rules', 'evals/rules.json', '--baseline', 'evals/base.json'), 0, 'PASS 全部达标');

  write('evals/base2.json', JSON.stringify({ eval_set: 'set', cases: 4, metrics: { answer_correct: { pass: 4, total: 4, rate: 1 } } }));
  check('eval check 比基线下降超过 2pp 返回 1', node(EVAL, 'check', 'evals/ok.json', '--rules', 'evals/rules.json', '--baseline', 'evals/base2.json'), 1, '比基线下降');

  check('eval summarize 记录评估集哈希', sum, 0, '"eval_set_hash"');

  const validRows = [
    row('K1', [['answer_correct', true], ['citation_correct', true]]),
    row('K2', [['answer_correct', true], ['citation_correct', true]]),
    row('K3', [['answer_correct', true], ['citation_correct', true]]),
    row('K4', [['refusal_correct', true]]),
  ];
  write('evals/duplicate.jsonl', [...validRows, validRows[0]].join('\n') + '\n');
  const duplicate = node(EVAL, 'summarize', 'evals/duplicate.jsonl', '--set', 'evals/set.jsonl', '--out', 'evals/duplicate-summary.json');
  check('eval summarize 重复 ID 计入错误', duplicate, 0, '"errors": 1');
  check('eval check 重复 ID 阻断', node(EVAL, 'check', 'evals/duplicate-summary.json', '--rules', 'evals/rules.json'), 1, '评估结果错误');

  write('evals/extra.jsonl', [...validRows, row('X1', [['answer_correct', true]])].join('\n') + '\n');
  const extra = node(EVAL, 'summarize', 'evals/extra.jsonl', '--set', 'evals/set.jsonl', '--out', 'evals/extra-summary.json');
  check('eval summarize 集合外 ID 计入错误', extra, 0, '"errors": 1');
  check('eval check 集合外 ID 阻断', node(EVAL, 'check', 'evals/extra-summary.json', '--rules', 'evals/rules.json'), 1, '评估结果错误');

  write('evals/missing.jsonl', validRows.slice(0, 3).join('\n') + '\n');
  const missing = node(EVAL, 'summarize', 'evals/missing.jsonl', '--set', 'evals/set.jsonl', '--out', 'evals/missing-summary.json');
  check('eval summarize 缺题进入 missing', missing, 0, '"K4"');
  check('eval check 缺题阻断', node(EVAL, 'check', 'evals/missing-summary.json', '--rules', 'evals/rules.json'), 1, '没有结果');

  write('evals/okhash.json', JSON.stringify({ eval_set: 'set', eval_set_hash: 'aaa', cases: 4, errors: 0, missing: [], metrics: { answer_correct: { pass: 3, total: 4, rate: 0.75 } } }));
  write('evals/basehash.json', JSON.stringify({ eval_set: 'set', eval_set_hash: 'bbb', cases: 4, errors: 0, missing: [], metrics: { answer_correct: { pass: 4, total: 4, rate: 0.76 } } }));
  check('eval check 同名不同内容评估集哈希不匹配', node(EVAL, 'check', 'evals/okhash.json', '--rules', 'evals/rules.json', '--baseline', 'evals/basehash.json'), 1, '哈希');
} catch (e) {
  results.push({ name: '测试环境', ok: false });
  console.log('FAIL  测试环境出错：' + e.message);
} finally {
  rmSync(repo, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
