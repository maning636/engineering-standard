#!/usr/bin/env node
// 需求追踪表门禁：优先级为“必须”的需求，追踪链不能断。
// 用法：node scripts/orchestrate/trace-check.mjs <TRACE-MATRIX.md> [--stage release]
// 退出码：0 通过；1 有空格子；2 用法或格式错误。
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const stageIdx = args.indexOf('--stage');
let stage = 'build';
if (stageIdx !== -1) {
  stage = args[stageIdx + 1];
  args.splice(stageIdx, 2);
}
if (args.length !== 1 || !['build', 'release'].includes(stage)) {
  console.error('用法：trace-check.mjs <TRACE-MATRIX.md> [--stage release]');
  process.exit(2);
}
const file = args[0];
if (!existsSync(file)) {
  console.error(`找不到文件：${file}`);
  process.exit(2);
}

const EMPTY = new Set(['', '-', '—', '待定', 'tbd', 'todo', '无']);
const isEmpty = (v) => EMPTY.has((v ?? '').trim().toLowerCase());

const BUILD_COLS = ['设计位置', 'BuildSpec 阶段', '任务/PR', '测试或评估用例', '证据路径'];
const RELEASE_COLS = [...BUILD_COLS, '验收结论'];
const required = stage === 'release' ? RELEASE_COLS : BUILD_COLS;

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

const lines = readFileSync(file, 'utf8').split(/\r?\n/);
let header = null;
let headerLine = -1;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (l.startsWith('|') && l.includes('需求编号') && l.includes('优先级')) {
    header = splitRow(l);
    headerLine = i;
    break;
  }
}
if (!header) {
  console.error('没找到表头（需要包含“需求编号”“优先级”两列）');
  process.exit(2);
}
const col = (name) => header.indexOf(name);
const missingCols = ['需求编号', '优先级', ...RELEASE_COLS].filter((c) => col(c) === -1);
if (missingCols.length) {
  console.error(`表头缺列：${missingCols.join('、')}`);
  process.exit(2);
}

const problems = [];
let checked = 0;
for (let i = headerLine + 1; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!l.startsWith('|')) break;
  if (/^\|[\s:|-]+\|?$/.test(l)) continue;
  const cells = splitRow(l);
  const id = cells[col('需求编号')] || `(第 ${i + 1} 行)`;
  const pri = cells[col('优先级')] || '';
  const verdict = cells[col('验收结论')] || '';
  if (pri !== '必须') continue;
  if (verdict.includes('作废')) continue;
  checked++;
  const empty = required.filter((c) => isEmpty(cells[col(c)]));
  if (empty.length) problems.push(`第 ${i + 1} 行 ${id}：空 ${empty.join('、')}`);
  if (stage === 'release' && !isEmpty(verdict) && !/^(通过|有条件通过)/.test(verdict)) {
    problems.push(`第 ${i + 1} 行 ${id}：验收结论“${verdict}”不是通过/有条件通过`);
  }
}

if (checked === 0) {
  console.error('没有优先级为“必须”的需求行，检查表格是否填写');
  process.exit(1);
}
if (problems.length) {
  console.log(`FAIL（stage=${stage}）追踪链断开 ${problems.length} 处：`);
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}
console.log(`PASS（stage=${stage}）检查“必须”需求 ${checked} 条`);
