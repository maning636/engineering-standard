#!/usr/bin/env node
// AI 功能评估门禁。规范见 PROJECT-RUN/CRAFTS/EVAL.md。
// 用法：
//   eval-check.mjs lint <set.jsonl> [--min N]
//   eval-check.mjs export <set.jsonl> [--out tests.jsonl] [--refusal 话术]
//   eval-check.mjs summarize <promptfoo-results.jsonl|.json> [--set set.jsonl] [--out summary.json]
//   eval-check.mjs check <summary.json> --rules rules.json [--baseline base.json]
// 退出码：0 通过；1 不达标；2 用法或文件错误。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const TYPES = new Set(['常规', '边界', '对抗']);
const MIN_REFUSE_RATIO = 0.2;

function die(msg) {
  console.error(msg);
  process.exit(2);
}

function takeOpt(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) die(`${name} 缺少参数值`);
  args.splice(i, 2);
  return v;
}

function readText(file) {
  if (!existsSync(file)) die(`找不到文件：${file}`);
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (e) {
    die(`JSON 解析失败：${file}：${e.message}`);
  }
}

function readJsonl(file) {
  const rows = [];
  readText(file).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      rows.push({ line: i + 1, data: JSON.parse(line) });
    } catch (e) {
      die(`${file} 第 ${i + 1} 行不是合法 JSON：${e.message}`);
    }
  });
  return rows;
}

const isVoid = (c) => typeof c.note === 'string' && c.note.startsWith('作废');
const nonEmptyList = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.trim());

function lintSet(file, min) {
  const rows = readJsonl(file);
  const errors = [];
  const ids = new Set();
  let active = 0;
  let refuse = 0;
  for (const { line, data: c } of rows) {
    const at = `第 ${line} 行${c.id ? `（${c.id}）` : ''}`;
    for (const k of ['id', 'question', 'req']) {
      if (typeof c[k] !== 'string' || !c[k].trim()) errors.push(`${at}：缺少 ${k}`);
    }
    if (c.id) {
      if (ids.has(c.id)) errors.push(`${at}：id 重复`);
      ids.add(c.id);
    }
    if (!TYPES.has(c.type)) errors.push(`${at}：type 必须是 常规/边界/对抗`);
    if (typeof c.should_refuse !== 'boolean') {
      errors.push(`${at}：should_refuse 必须是 true 或 false`);
    } else if (!c.should_refuse) {
      if (!nonEmptyList(c.expected)) errors.push(`${at}：不拒答的题要有 expected（非空字符串数组）`);
      if (!nonEmptyList(c.sources)) errors.push(`${at}：不拒答的题要有 sources（非空字符串数组）`);
    }
    if (isVoid(c)) continue;
    active += 1;
    if (c.should_refuse === true) refuse += 1;
  }
  const ratio = active ? refuse / active : 0;
  if (active === 0) errors.push('没有有效题目');
  else if (ratio < MIN_REFUSE_RATIO) {
    errors.push(`拒答题占比 ${(ratio * 100).toFixed(1)}%，低于 ${MIN_REFUSE_RATIO * 100}%`);
  }
  if (min !== undefined && active < min) errors.push(`有效题目 ${active} 条，少于 --min ${min}`);
  return { rows, errors, active, refuse, ratio };
}

function cmdLint(args) {
  const minRaw = takeOpt(args, '--min');
  if (args.length !== 1) die('用法：eval-check.mjs lint <set.jsonl> [--min N]');
  const min = minRaw === undefined ? undefined : Number(minRaw);
  if (min !== undefined && !Number.isInteger(min)) die('--min 必须是整数');
  const r = lintSet(args[0], min);
  for (const e of r.errors) console.log(`FAIL ${e}`);
  console.log(`${r.errors.length ? 'FAIL' : 'PASS'} 有效题目 ${r.active} 条，拒答题 ${r.refuse} 条（${(r.ratio * 100).toFixed(1)}%）`);
  process.exit(r.errors.length ? 1 : 0);
}

function cmdExport(args) {
  const out = takeOpt(args, '--out');
  const refusal = takeOpt(args, '--refusal') ?? '未在资料中找到';
  if (args.length !== 1) die('用法：eval-check.mjs export <set.jsonl> [--out tests.jsonl] [--refusal 话术]');
  const r = lintSet(args[0]);
  if (r.errors.length) {
    for (const e of r.errors) console.log(`FAIL ${e}`);
    die('题目文件没有通过 lint，先修正再导出');
  }
  const lines = [];
  for (const { data: c } of r.rows) {
    if (isVoid(c)) continue;
    const assert = c.should_refuse
      ? [{ type: 'icontains', value: refusal, metric: 'refusal_correct' }]
      : [
          { type: 'contains-all', value: c.expected, metric: 'answer_correct' },
          { type: 'contains-any', value: c.sources, metric: 'citation_correct' },
        ];
    lines.push(JSON.stringify({
      description: c.id,
      vars: { id: c.id, question: c.question },
      assert,
      metadata: { id: c.id, req: c.req, type: c.type, should_refuse: c.should_refuse },
    }));
  }
  const text = lines.join('\n') + '\n';
  if (out) {
    writeFileSync(out, text);
    console.log(`PASS 导出 ${lines.length} 条到 ${out}`);
  } else {
    process.stdout.write(text);
  }
}

function loadResultRows(file) {
  if (file.endsWith('.jsonl')) return readJsonl(file).map((r) => r.data);
  const j = readJson(file);
  const rows = j?.results?.results ?? j?.results?.outputs ?? j?.outputs ?? j?.results;
  if (!Array.isArray(rows)) die(`认不出结果格式：${file}（需要 promptfoo --output 的 .jsonl 或 .json）`);
  return rows;
}

function caseIdOf(row) {
  return row?.testCase?.metadata?.id ?? row?.metadata?.id ?? row?.vars?.id
    ?? row?.testCase?.vars?.id ?? row?.testCase?.description ?? row?.description;
}

function cmdSummarize(args) {
  const setFile = takeOpt(args, '--set');
  const out = takeOpt(args, '--out');
  const promptIdx = takeOpt(args, '--prompt-idx');
  if (args.length !== 1) die('用法：eval-check.mjs summarize <results> [--set set.jsonl] [--out summary.json] [--prompt-idx N]');
  let rows = loadResultRows(args[0]);
  const idxs = new Set(rows.map((r) => r.promptIdx ?? 0));
  if (promptIdx !== undefined) rows = rows.filter((r) => String(r.promptIdx ?? 0) === promptIdx);
  else if (idxs.size > 1) die(`结果里有 ${idxs.size} 组提示词或模型，用 --prompt-idx 指定一组`);

  const perCase = new Map();
  let errors = 0;
  rows.forEach((row, i) => {
    const id = caseIdOf(row) ?? `#${row.testIdx ?? i}`;
    const comps = row?.gradingResult?.componentResults;
    const m = perCase.get(id) ?? {};
    if (!Array.isArray(comps) || comps.length === 0) {
      errors += 1;
      m.__error = true;
    } else {
      for (const c of comps) {
        const name = c?.assertion?.metric ?? c?.assertion?.type ?? 'unnamed';
        m[name] = (m[name] ?? true) && c.pass === true;
      }
    }
    perCase.set(id, m);
  });

  let set = null;
  if (setFile) {
    const r = lintSet(setFile);
    set = new Map(r.rows.filter((x) => !isVoid(x.data)).map((x) => [x.data.id, x.data]));
  }
  const metrics = {};
  const add = (name, pass) => {
    metrics[name] ??= { pass: 0, total: 0, rate: 0 };
    metrics[name].total += 1;
    if (pass) metrics[name].pass += 1;
  };
  for (const [id, m] of perCase) {
    const expectedNames = set?.has(id)
      ? (set.get(id).should_refuse ? ['refusal_correct'] : ['answer_correct', 'citation_correct'])
      : [];
    const names = new Set([...Object.keys(m).filter((k) => k !== '__error'), ...(m.__error ? expectedNames : [])]);
    for (const name of names) add(name, m[name] === true);
  }
  for (const v of Object.values(metrics)) v.rate = v.total ? Number((v.pass / v.total).toFixed(4)) : 0;

  const missing = set ? [...set.keys()].filter((id) => !perCase.has(id)) : [];
  const setName = setFile ? basename(setFile).replace(/\.jsonl$/, '') : undefined;
  const summary = { eval_set: setName, cases: perCase.size, errors, missing, metrics };
  const text = JSON.stringify(summary, null, 2) + '\n';
  if (out) writeFileSync(out, text);
  process.stdout.write(text);
  if (missing.length) console.error(`注意：评估集里有 ${missing.length} 题没有出现在结果中：${missing.slice(0, 10).join(', ')}`);
}

const pct = (x) => (x === undefined ? '-' : `${(x * 100).toFixed(1)}%`);

function cmdCheck(args) {
  const rulesFile = takeOpt(args, '--rules');
  const baseFile = takeOpt(args, '--baseline');
  if (args.length !== 1 || !rulesFile) die('用法：eval-check.mjs check <summary.json> --rules rules.json [--baseline base.json]');
  const s = readJson(args[0]);
  const rules = readJson(rulesFile);
  const base = baseFile ? readJson(baseFile) : null;
  if (!s?.metrics || typeof s.metrics !== 'object') die(`${args[0]} 缺少 metrics`);
  if (!rules?.metrics || typeof rules.metrics !== 'object') die(`${rulesFile} 缺少 metrics`);
  const maxDrop = rules.max_drop_pp ?? 2;
  const fails = [];

  if (rules.min_cases !== undefined && (s.cases ?? 0) < rules.min_cases) {
    fails.push(`题数 ${s.cases ?? 0} 少于 min_cases ${rules.min_cases}`);
  }
  if (s.errors) fails.push(`有 ${s.errors} 题运行出错（没有判分结果）`);
  if (Array.isArray(s.missing) && s.missing.length) fails.push(`有 ${s.missing.length} 题没有结果`);
  if (base && base.eval_set && s.eval_set && base.eval_set !== s.eval_set) {
    console.log(`注意：基线评估集 ${base.eval_set} 和本次 ${s.eval_set} 不同`);
  }

  console.log('指标\t阈值\t基线\t本次\t变化(pp)\t结论');
  for (const [name, rule] of Object.entries(rules.metrics)) {
    const cur = s.metrics[name]?.rate;
    const prev = base?.metrics?.[name]?.rate;
    const reasons = [];
    if (cur === undefined) reasons.push('缺少该指标');
    else {
      if (rule.min !== undefined && cur < rule.min) reasons.push(`低于 ${pct(rule.min)}`);
      if (rule.max !== undefined && cur > rule.max) reasons.push(`高于 ${pct(rule.max)}`);
      if (prev !== undefined && (prev - cur) * 100 > maxDrop + 1e-9) {
        reasons.push(`比基线下降超过 ${maxDrop}pp`);
      }
    }
    const limit = rule.min !== undefined ? `≥${pct(rule.min)}` : rule.max !== undefined ? `≤${pct(rule.max)}` : '-';
    const delta = cur !== undefined && prev !== undefined ? ((cur - prev) * 100).toFixed(1) : '-';
    console.log(`${name}\t${limit}\t${pct(prev)}\t${pct(cur)}\t${delta}\t${reasons.length ? 'FAIL ' + reasons.join('；') : 'PASS'}`);
    for (const r of reasons) fails.push(`${name}：${r}`);
  }
  if (fails.length) {
    console.log(`FAIL ${fails.length} 项不达标`);
    for (const f of fails) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('PASS 全部达标');
}

const [cmd, ...rest] = process.argv.slice(2);
const cmds = { lint: cmdLint, export: cmdExport, summarize: cmdSummarize, check: cmdCheck };
if (!cmds[cmd]) die('用法：eval-check.mjs <lint|export|summarize|check> ...（详见文件头注释）');
cmds[cmd](rest);
