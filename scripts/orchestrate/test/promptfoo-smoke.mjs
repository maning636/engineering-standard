#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const orchestrate = resolve(here, '..');
const repo = resolve(here, '../../..');
const evalCheck = join(orchestrate, 'eval-check.mjs');
const setFile = join(repo, 'examples/huarui/evals/kb-qa.jsonl');
const rulesFile = join(repo, 'examples/huarui/evals/kb-qa.rules.json');
const baselineFile = join(repo, 'examples/huarui/evals/baselines/kb-qa-v0.1.json');
const configTemplate = join(repo, 'examples/huarui/evals/kb-qa.smoke.yaml');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

async function run(command, args) {
  const options = {
    cwd: repo,
    env: { ...process.env, PROMPTFOO_DISABLE_TELEMETRY: '1', PROMPTFOO_CACHE_PATH: join(temp, 'promptfoo-cache'), NO_COLOR: '1', CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  let child;
  if (command === npx && process.platform === 'win32') {
    const quote = (value) => /\s/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const commandLine = ['npx', ...args].map(quote).join(' ');
    child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], options);
  } else {
    child = spawn(command, args, options);
  }
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    else child.kill('SIGKILL');
  }, 240000);
  try {
    const status = await new Promise((resolveStatus, rejectStatus) => {
      child.once('error', rejectStatus);
      child.once('close', resolveStatus);
    });
    const output = `${stdout}${stderr}`.trim();
    if (status !== 0) {
      const reason = timedOut ? '执行超时' : `退出码 ${status}`;
      throw new Error(`${command} ${args.join(' ')} ${reason}\n${output.split(/\r?\n/).slice(-50).join('\n')}`);
    }
    return output;
  } finally {
    clearTimeout(timer);
  }
}

const cases = readFileSync(setFile, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const answers = new Map(cases.map((item) => [item.question,
  item.should_refuse ? '未在资料中找到' : [...item.expected, ...item.sources].join('；'),
]));

let temp;
let server;
try {
  temp = mkdtempSync(join(tmpdir(), 'promptfoo-smoke-'));
  server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/api/qa') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let answer = '未在资料中找到';
      try {
        const question = JSON.parse(body).question;
        answer = answers.get(question) ?? answer;
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ answer }));
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });

  const port = server.address().port;
  const config = readFileSync(configTemplate, 'utf8').replaceAll('43197', String(port));
  const configFile = join(temp, 'kb-qa.smoke.yaml');
  const testsFile = join(temp, 'kb-qa.smoke.tests.jsonl');
  const resultsFile = join(temp, 'results.jsonl');
  const summaryFile = join(temp, 'summary.json');
  writeFileSync(configFile, config);

  await run(process.execPath, [evalCheck, 'lint', setFile]);
  await run(process.execPath, [evalCheck, 'export', setFile, '--out', testsFile]);
  await run(npx, ['--yes', 'promptfoo@0.125.1', 'eval', '-c', configFile, '--output', resultsFile]);
  await run(process.execPath, [evalCheck, 'summarize', resultsFile, '--set', setFile, '--out', summaryFile]);
  await run(process.execPath, [evalCheck, 'check', summaryFile, '--rules', rulesFile, '--baseline', baselineFile]);

  const summary = JSON.parse(readFileSync(summaryFile, 'utf8'));
  if (summary.cases !== 10 || summary.errors !== 0 || summary.missing.length || !summary.eval_set_hash) {
    throw new Error(`真实 summary 不符合预期：${JSON.stringify(summary)}`);
  }
  for (const metric of ['answer_correct', 'citation_correct', 'refusal_correct', 'latency']) {
    if (summary.metrics[metric]?.rate !== 1) throw new Error(`${metric} 未达到 100%：${JSON.stringify(summary.metrics[metric])}`);
  }
  console.log(`promptfoo smoke: PASS ${summary.cases}/${summary.cases}（真实 npx promptfoo@0.125.1，本地 HTTP 假服务）`);
} catch (error) {
  console.error(`promptfoo smoke: FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  if (server?.listening) {
    server.closeAllConnections?.();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
  if (temp) rmSync(temp, { recursive: true, force: true });
}
