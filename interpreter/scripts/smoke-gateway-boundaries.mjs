import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.API_BASE_URL ?? 'http://localhost:8787';
const reportPath = process.env.GATEWAY_BOUNDARY_REPORT ?? 'docs/gateway-boundary-smoke.md';
const results = [];

await runCase('health-ready', async () => {
  const response = await fetch(`${url}/api/health`);
  const payload = await response.json();
  expect(response.status === 200, 'health must return 200');
  expect(payload.asrProvider === 'dashscope', 'ASR provider should default to dashscope');
  return {
    httpStatus: response.status,
    detail: `translationKey=${payload.hasTranslationKey} asrKey=${payload.hasAsrKey}`,
  };
});

await runCase('translate-success-sse', async () => {
  const response = await fetch(`${url}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Translate English into concise Simplified Chinese. Return only the translation.' },
        { role: 'user', content: 'The live keynote starts in five minutes.' },
      ],
    }),
  });
  const text = await response.text();
  expect(response.status === 200, `expected 200, got ${response.status}`);
  expect(text.includes('data:'), 'translation should stream SSE data');
  return { httpStatus: response.status, detail: `sseBytes=${text.length}` };
});

await runCase('translate-invalid-json', async () => {
  const response = await fetch(`${url}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  const payload = await response.json();
  expect(response.status === 400, `expected 400, got ${response.status}`);
  expect(payload.code === 'invalid_json', `expected invalid_json, got ${payload.code}`);
  return { httpStatus: response.status, code: payload.code };
});

await runCase('transcribe-invalid-content-type', async () => {
  const response = await fetch(`${url}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const payload = await response.json();
  expect(response.status === 400, `expected 400, got ${response.status}`);
  expect(payload.code === 'invalid_audio_upload', `expected invalid_audio_upload, got ${payload.code}`);
  return { httpStatus: response.status, code: payload.code };
});

await runCase('transcribe-empty-multipart', async () => {
  const form = new FormData();
  form.append('metadata', 'empty');
  const response = await fetch(`${url}/api/transcribe`, { method: 'POST', body: form });
  const payload = await response.json();
  expect(response.status === 400, `expected 400, got ${response.status}`);
  expect(payload.code === 'invalid_audio_upload', `expected invalid_audio_upload, got ${payload.code}`);
  return { httpStatus: response.status, code: payload.code };
});

await runCase('transcribe-oversize-inline-limit', async () => {
  const form = new FormData();
  const oversize = new Uint8Array(10 * 1024 * 1024 + 1);
  form.append('file', new Blob([oversize], { type: 'audio/wav' }), 'too-large.wav');
  const response = await fetch(`${url}/api/transcribe`, { method: 'POST', body: form });
  const payload = await response.json();
  expect(response.status === 413, `expected 413, got ${response.status}`);
  expect(payload.code === 'file_too_large', `expected file_too_large, got ${payload.code}`);
  return { httpStatus: response.status, code: payload.code };
});

writeReport(results);

for (const result of results) {
  console.log(`${result.status.toUpperCase()} ${result.name} http=${result.httpStatus ?? '-'} ${result.code ?? result.detail ?? ''}`);
}

if (results.some((result) => result.status !== 'pass')) process.exitCode = 1;

async function runCase(name, fn) {
  const startedAt = Date.now();
  try {
    const result = await fn();
    results.push({ name, status: 'pass', latencyMs: Date.now() - startedAt, ...result });
  } catch (error) {
    results.push({
      name,
      status: 'fail',
      latencyMs: Date.now() - startedAt,
      detail: error.message,
    });
  }
}

function writeReport(items) {
  const now = `${new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })} +08:00`;
  const rows = items
    .map((item) => `| ${item.name} | ${item.status} | ${item.httpStatus ?? '-'} | ${item.code ?? '-'} | ${item.latencyMs} | ${item.detail ?? '-'} |`)
    .join('\n');
  const body = `# Gateway 成功与边界烟测记录

测试时间：${now}

本记录验证本地 AI Gateway 的成功路径和错误边界。真实 Key 只保存在本地 \`.env\`，报告不包含任何密钥。

| 用例 | 状态 | HTTP | Code | 延迟 ms | 说明 |
| --- | --- | --- | --- | --- | --- |
${rows}

## 覆盖范围

- 成功：健康检查、DashScope 翻译 SSE。
- 边界：翻译坏 JSON、ASR 非 multipart、ASR 缺少文件、DashScope inline 音频大小限制。
- 这些边界用于确保演示时失败会被明确解释，而不是静默生成假字幕。
`;
  mkdirSync(resolve(reportPath, '..'), { recursive: true });
  writeFileSync(reportPath, body);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

if (!existsSync(resolve('.env'))) {
  console.warn('.env not found. Boundary smoke can still run, but success cases may fail without provider keys.');
}
