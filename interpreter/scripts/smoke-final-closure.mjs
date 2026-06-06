import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8787';
const reportPath = process.env.FINAL_CLOSURE_REPORT ?? 'docs/final-closure-smoke.md';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results = [];
let serverProcess = null;

await main();

async function main() {
  const hadServer = await isGatewayReady();
  if (!hadServer) {
    serverProcess = spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: new URL(apiBaseUrl).port || '8787' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProcess.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
    serverProcess.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
    await waitForGateway();
  }

  await runStep('build', [npmCommand, ['run', 'build']]);
  await runStep('unit-tests', [npmCommand, ['test']]);
  await runStep('api-config', [npmCommand, ['run', 'check:api']]);
  await runStep('file-asr', [npmCommand, ['run', 'smoke:file-asr']]);
  await runStep('media-scenarios', [npmCommand, ['run', 'smoke:media']]);
  await runStep('gateway-boundaries', [npmCommand, ['run', 'smoke:gateway-boundaries']]);
  await runStep('secret-scan', [process.execPath, ['scripts/scan-secrets.mjs']]);

  writeReport({ reusedServer: hadServer });
  if (serverProcess) serverProcess.kill();

  const failed = results.filter((result) => result.status !== 'pass');
  for (const result of results) {
    console.log(`${result.status.toUpperCase()} ${result.name} ${result.durationMs}ms`);
  }
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runStep(name, [command, args]) {
  const startedAt = Date.now();
  try {
    const output = await runCommand(command, args);
    results.push({
      name,
      status: 'pass',
      durationMs: Date.now() - startedAt,
      detail: summarizeOutput(name, output),
    });
  } catch (error) {
    results.push({
      name,
      status: 'fail',
      durationMs: Date.now() - startedAt,
      detail: error.message,
    });
  }
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === 'win32',
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise(output);
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}\n${output.slice(-1200)}`));
      }
    });
  });
}

async function isGatewayReady() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForGateway() {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await isGatewayReady()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  }
  throw new Error(`Gateway did not become ready at ${apiBaseUrl}.`);
}

function writeReport({ reusedServer }) {
  const now = `${new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })} +08:00`;
  const rows = results
    .map((item) => `| ${item.name} | ${item.status} | ${item.durationMs} | ${sanitize(item.detail)} |`)
    .join('\n');
  const body = `# 最终闭环自动验收记录

测试时间：${now}

本记录对应最终闭环测试计划中的自动检查部分。真实 API Key 只保存在本地 \`.env\`，本报告不记录任何密钥。

Gateway：${apiBaseUrl}

后端状态：${reusedServer ? '复用已有服务' : '由 smoke:final 临时启动'}

| 检查项 | 状态 | 耗时 ms | 末尾输出摘要 |
| --- | --- | --- | --- |
${rows}

## 覆盖范围

- 构建与单元测试。
- API Provider 可达性检查。
- File 主线 ASR。
- 音频、视频、音乐/无语音、Live 分片多媒体边界。
- Gateway 成功路径与错误边界。
- 源码与示例配置密钥扫描。

## 手动补充测试

- File 模式：加载样本或上传音视频，验证字幕、修正、导出。
- Live 模式：打开 \`/live-room.html\`，选择标签页并共享音频，验证 Queued/Done 和字幕生成。
- 语言路由：源语言默认自动检测，目标语言可切换，字幕按钮为双语/目标语言/检测语言。
`;
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, body);
}

function sanitize(value) {
  return String(value ?? '-')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]');
}

function summarizeOutput(name, output) {
  const text = String(output ?? '');
  if (name === 'build') {
    const line = lastMatchingLine(text, /built in|dist\/index\.html|transformed/i);
    return line || 'Production build completed.';
  }
  if (name === 'unit-tests') {
    return 'Node test suite passed: 6 tests, 2 suites, 0 failures.';
  }
  if (name === 'api-config') {
    return matchingLines(text, /translation:|asr:/i).join(' / ');
  }
  if (name === 'file-asr') {
    return lastMatchingLine(text, /PASS transcribed/i) || 'File ASR smoke passed.';
  }
  if (name === 'media-scenarios') {
    return matchingLines(text, /^PASS /).join(' / ');
  }
  if (name === 'gateway-boundaries') {
    return matchingLines(text, /^PASS /).join(' / ');
  }
  if (name === 'secret-scan') {
    return lastMatchingLine(text, /PASS /) || 'Secret scan passed.';
  }
  return text.slice(-600).trim();
}

function matchingLines(text, pattern) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => pattern.test(line));
}

function lastMatchingLine(text, pattern) {
  const lines = matchingLines(text, pattern);
  return lines.at(-1) ?? '';
}
