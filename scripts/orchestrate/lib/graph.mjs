// 任务图公共库：受限 YAML 解析 + 写范围匹配 + 校验。零依赖。
import { readFileSync } from 'node:fs';

export const STATUSES = ['todo', 'ready', 'doing', 'review', 'done', 'blocked'];
export const REQUIRED = ['id', 'req', 'depends_on', 'write_scope', 'accept', 'budget', 'status'];

export class GraphError extends Error {}

function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function splitTop(s) {
  const out = [];
  let depth = 0, q = null, cur = '';
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseValue(raw, lineNo) {
  const v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) throw new GraphError(`第 ${lineNo} 行：数组没有闭合`);
    return splitTop(v.slice(1, -1)).map((x) => parseValue(x, lineNo));
  }
  if (v.startsWith('{')) {
    if (!v.endsWith('}')) throw new GraphError(`第 ${lineNo} 行：行内 map 没有闭合`);
    const obj = {};
    for (const part of splitTop(v.slice(1, -1))) {
      const m = part.match(/^([\w-]+)\s*:\s*(.*)$/);
      if (!m) throw new GraphError(`第 ${lineNo} 行：无法解析“${part}”`);
      obj[m[1]] = parseValue(m[2], lineNo);
    }
    return obj;
  }
  if (/^[|>]/.test(v) || /^[&*]/.test(v)) throw new GraphError(`第 ${lineNo} 行：不支持多行字符串或锚点`);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function parseGraph(text) {
  const root = {};
  let block = null;   // 当前顶层 key（值为对象或列表）
  let item = null;    // tasks 里当前项
  const lines = text.split(/\r?\n/);
  lines.forEach((orig, idx) => {
    const n = idx + 1;
    const line = stripComment(orig).replace(/\s+$/, '');
    if (!line.trim()) return;
    if (/\t/.test(line.match(/^\s*/)[0])) throw new GraphError(`第 ${n} 行：缩进不能用 Tab`);
    const indent = line.match(/^ */)[0].length;
    const body = line.trim();
    if (indent === 0) {
      const m = body.match(/^([\w-]+)\s*:\s*(.*)$/);
      if (!m) throw new GraphError(`第 ${n} 行：顶层只能是 key: value`);
      item = null;
      if (m[2] === '') { block = m[1]; root[block] = undefined; }
      else { block = null; root[m[1]] = parseValue(m[2], n); }
      return;
    }
    if (!block) throw new GraphError(`第 ${n} 行：缩进内容不属于任何顶层 key`);
    if (body.startsWith('- ')) {
      if (root[block] === undefined) root[block] = [];
      if (!Array.isArray(root[block])) throw new GraphError(`第 ${n} 行：${block} 里混用了列表和 map`);
      item = { __line: n };
      root[block].push(item);
      const rest = body.slice(2);
      const m = rest.match(/^([\w-]+)\s*:\s*(.*)$/);
      if (!m) throw new GraphError(`第 ${n} 行：列表项要写成 "- key: value"`);
      item[m[1]] = parseValue(m[2], n);
      return;
    }
    const m = body.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) throw new GraphError(`第 ${n} 行：无法解析“${body}”`);
    if (Array.isArray(root[block])) {
      if (!item) throw new GraphError(`第 ${n} 行：字段不属于任何列表项`);
      item[m[1]] = parseValue(m[2], n);
    } else {
      if (root[block] === undefined) root[block] = {};
      root[block][m[1]] = parseValue(m[2], n);
    }
  });
  if (!Array.isArray(root.tasks)) throw new GraphError('缺少 tasks 列表');
  return root;
}

export function loadGraph(file) {
  return parseGraph(readFileSync(file, 'utf8'));
}

const hasWild = (g) => /[*?[]/.test(g);
const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');

export function globToRegExp(glob) {
  let re = '';
  const g = norm(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      i++;
      if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

export const inScope = (file, scopes) => scopes.some((g) => globToRegExp(g).test(norm(file)));

const staticPrefix = (g) => { const i = norm(g).search(/[*?[]/); return i === -1 ? norm(g) : norm(g).slice(0, i); };

// 保守判断：宁可多报重叠，不漏报
export function scopesOverlap(a, b) {
  for (const x of a) for (const y of b) {
    const wx = hasWild(x), wy = hasWild(y);
    if (!wx && !wy) { if (norm(x) === norm(y)) return [x, y]; continue; }
    if (wx && !wy) { if (globToRegExp(x).test(norm(y))) return [x, y]; continue; }
    if (!wx && wy) { if (globToRegExp(y).test(norm(x))) return [x, y]; continue; }
    const px = staticPrefix(x), py = staticPrefix(y);
    if (px.startsWith(py) || py.startsWith(px)) return [x, y];
  }
  return null;
}

export function ancestors(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map();
  const visit = (id, stack = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (stack.has(id)) return new Set();
    stack.add(id);
    const set = new Set();
    for (const d of byId.get(id)?.depends_on || []) {
      set.add(d);
      for (const x of visit(d, stack)) set.add(x);
    }
    stack.delete(id);
    memo.set(id, set);
    return set;
  };
  return (id) => visit(id);
}

export function findCycle(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const color = new Map();
  const path = [];
  const dfs = (id) => {
    color.set(id, 1); path.push(id);
    for (const d of byId.get(id)?.depends_on || []) {
      if (!byId.has(d)) continue;
      if (color.get(d) === 1) return [...path.slice(path.indexOf(d)), d];
      if (!color.get(d)) { const c = dfs(d); if (c) return c; }
    }
    color.set(id, 2); path.pop();
    return null;
  };
  for (const t of tasks) if (!color.get(t.id)) { const c = dfs(t.id); if (c) return c; }
  return null;
}

export function validateGraph(g) {
  const errs = [];
  const ids = new Set();
  for (const t of g.tasks) {
    const where = `${t.id || '(无 id)'}（第 ${t.__line} 行）`;
    for (const f of REQUIRED) if (t[f] === undefined) errs.push(`${where} 缺字段 ${f}`);
    if (t.id) { if (ids.has(t.id)) errs.push(`${where} id 重复`); ids.add(t.id); }
    for (const f of ['req', 'depends_on', 'write_scope']) if (t[f] !== undefined && !Array.isArray(t[f])) errs.push(`${where} ${f} 要写成数组`);
    if (Array.isArray(t.req) && t.req.length === 0) errs.push(`${where} req 不能为空（架构类任务写 [ARCH]）`);
    if (Array.isArray(t.write_scope) && t.write_scope.length === 0) errs.push(`${where} write_scope 不能为空`);
    if (t.status !== undefined && !STATUSES.includes(t.status)) errs.push(`${where} status“${t.status}”不合法`);
    if (t.status === 'doing' && !t.owner) errs.push(`${where} 状态为 doing 时 owner 必填`);
    if (t.budget !== undefined && (typeof t.budget !== 'object' || typeof t.budget.files !== 'number')) errs.push(`${where} budget 要写成 { files: N, retries: N }`);
  }
  for (const t of g.tasks) for (const d of t.depends_on || []) if (!ids.has(d)) errs.push(`${t.id} 依赖的 ${d} 不存在`);
  const cyc = findCycle(g.tasks);
  if (cyc) errs.push(`依赖有环：${cyc.join(' → ')}`);
  if (!cyc) {
    const anc = ancestors(g.tasks);
    const ts = g.tasks.filter((t) => Array.isArray(t.write_scope));
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const a = ts[i], b = ts[j];
      if (anc(a.id).has(b.id) || anc(b.id).has(a.id)) continue;
      const hit = scopesOverlap(a.write_scope, b.write_scope);
      if (hit) errs.push(`${a.id} 和 ${b.id} 没有依赖关系，但写范围重叠：${hit[0]} / ${hit[1]}`);
    }
  }
  return errs;
}
