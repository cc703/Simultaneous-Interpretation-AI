import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const url = process.env.API_BASE_URL ?? 'http://localhost:8787';
const reportPath = process.env.MEDIA_SMOKE_REPORT ?? 'docs/media-scenario-smoke.md';
const cases = [
  {
    name: 'english-speech-wav',
    file: 'test-media/sample-english-speech.wav',
    expectation: 'speech',
  },
  {
    name: 'music-only-wav',
    file: 'test-media/sample-music-tone.wav',
    expectation: 'nonSpeech',
  },
  {
    name: 'english-video-mp4',
    file: 'test-media/sample-english-video.mp4',
    expectation: 'speech',
  },
  {
    name: 'live-chunk-wav',
    file: 'test-media/sample-live-chunk.wav',
    expectation: 'speech',
  },
];

const results = [];

for (const testCase of cases) {
  const audioPath = resolve(testCase.file);
  if (!existsSync(audioPath)) {
    results.push({ ...testCase, status: 'missing', detail: `Missing ${testCase.file}` });
    continue;
  }

  const startedAt = Date.now();
  const form = new FormData();
  const bytes = await readFileBytes(audioPath);
  form.append('file', new Blob([bytes], { type: inferMimeType(audioPath) }), basename(audioPath));
  form.append('language', 'en');
  form.append('response_format', 'json');

  const response = await fetch(`${url.replace(/\/$/, '')}/api/transcribe`, {
    method: 'POST',
    body: form,
  });
  const latencyMs = Date.now() - startedAt;
  const bodyText = await response.text();
  const payload = safeJson(bodyText);

  if (!response.ok) {
    results.push({
      ...testCase,
      status: 'fail',
      httpStatus: response.status,
      latencyMs,
      detail: payload.error ?? bodyText.slice(0, 240),
    });
    continue;
  }

  const text = payload.text?.trim() ?? '';
  const charCount = text.length;
  const pass = testCase.expectation === 'speech'
    ? charCount > 0
    : payload.speechDetected === false || charCount === 0;
  results.push({
    ...testCase,
    status: pass ? 'pass' : 'fail',
    httpStatus: response.status,
    latencyMs,
    charCount,
    preview: text.slice(0, 80),
    detail: pass ? (payload.speechDetected === false ? 'no speech detected' : 'ok') : 'Unexpected speech-detection result.',
  });
}

for (const result of results) {
  const charText = typeof result.charCount === 'number' ? ` chars=${result.charCount}` : '';
  const statusText = result.httpStatus ? ` http=${result.httpStatus}` : '';
  console.log(`${result.status.toUpperCase()} ${result.name}${statusText}${charText} ${result.detail}`);
}

writeReport(results);

if (results.some((result) => result.status === 'fail' || result.status === 'missing')) {
  process.exitCode = 1;
}

function writeReport(items) {
  const now = `${new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  })} +08:00`;
  const rows = items
    .map((item) => {
      const preview = item.preview ? item.preview.replace(/\s+/g, ' ') : '';
      return `| ${item.name} | ${item.file} | ${item.status} | ${item.httpStatus ?? '-'} | ${item.charCount ?? '-'} | ${item.latencyMs ?? '-'} | ${preview} |`;
    })
    .join('\n');
  const body = `# 多媒体场景烟测记录

测试时间：${now}

本记录用于验证题目二“AI 同声传译助手”的多输入能力。真实 Key 只保存在本地 \`.env\`，报告只记录脱敏状态、字符数和短预览。

| 场景 | 文件 | 状态 | HTTP | 字符数 | 延迟 ms | 脱敏预览 |
| --- | --- | --- | --- | --- | --- | --- |
${rows}

## 结论

- 英文语音音频用于验证 File 主线：音频进入 ASR 后返回英文转写。
- 音乐/非语音音频用于验证边界：系统可以上传并明确返回未检测到可转写语音，演示时不承诺音乐内容可被翻译成有效字幕。
- 视频文件用于验证上传视频类素材后，Gateway 可以先提取音轨再发送给 ASR Provider。
- Live 分片样本用于近似验证直播分片 ASR：真实 Live 仍需要浏览器 \`getDisplayMedia\` 权限和用户主动共享音频。
`;
  mkdirSync(resolve(reportPath, '..'), { recursive: true });
  writeFileSync(reportPath, body);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function inferMimeType(path) {
  const ext = extname(path).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.webm') return 'audio/webm';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.m4a') return 'audio/mp4';
  return 'application/octet-stream';
}

async function readFileBytes(path) {
  const chunks = [];
  for await (const chunk of createReadStream(path)) chunks.push(chunk);
  return Buffer.concat(chunks);
}
