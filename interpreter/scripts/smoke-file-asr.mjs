import { createReadStream, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const target = process.argv[2] ?? 'test-media/sample-english-speech.wav';
const url = process.env.API_BASE_URL ?? 'http://localhost:8787';
const audioPath = resolve(target);

if (!existsSync(audioPath)) {
  throw new Error(`Missing audio sample: ${audioPath}`);
}

const form = new FormData();
form.append('file', new Blob([await readFileBytes(audioPath)]), basename(audioPath));
form.append('model', process.env.OPENAI_ASR_MODEL ?? 'gpt-4o-mini-transcribe');
form.append('language', 'en');
form.append('response_format', 'json');

const response = await fetch(`${url.replace(/\/$/, '')}/api/transcribe`, {
  method: 'POST',
  body: form,
});

const bodyText = await response.text();
let payload = {};
try {
  payload = JSON.parse(bodyText);
} catch {
  payload = { raw: bodyText };
}

if (response.status === 503 && payload.code === 'missing_server_key') {
  console.log('PASS missing_server_key: backend is reachable and correctly refuses ASR without OPENAI_API_KEY.');
  process.exit(0);
}

if (!response.ok) {
  throw new Error(`ASR smoke failed: ${response.status} ${bodyText}`);
}

if (!payload.text?.trim()) {
  throw new Error(`ASR smoke returned no text: ${bodyText}`);
}

console.log(`PASS transcribed ${payload.text.trim().length} characters.`);

async function readFileBytes(path) {
  const chunks = [];
  for await (const chunk of createReadStream(path)) chunks.push(chunk);
  return Buffer.concat(chunks);
}
