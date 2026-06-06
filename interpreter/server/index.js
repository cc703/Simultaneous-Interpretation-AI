import http from 'node:http';

const DEFAULT_PORT = 8787;
const OPENAI_BASE_URL = readEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
const OPENAI_TRANSLATION_BASE_URL = readEnv('OPENAI_TRANSLATION_BASE_URL', OPENAI_BASE_URL);
const OPENAI_ASR_BASE_URL = readEnv('OPENAI_ASR_BASE_URL', 'https://api.openai.com/v1');
const OPENAI_API_KEY = readEnv('OPENAI_API_KEY', '');
const OPENAI_TRANSLATION_API_KEY = readEnv('OPENAI_TRANSLATION_API_KEY', OPENAI_API_KEY);
const OPENAI_ASR_API_KEY = readEnv('OPENAI_ASR_API_KEY', OPENAI_API_KEY);
const OPENAI_TRANSLATION_MODEL = readEnv('OPENAI_TRANSLATION_MODEL', 'gpt-4o-mini');
const OPENAI_ASR_MODEL = readEnv('OPENAI_ASR_MODEL', 'gpt-4o-mini-transcribe');
const ASR_PROVIDER = readEnv('ASR_PROVIDER', 'dashscope');
const DASHSCOPE_API_KEY = readEnv('DASHSCOPE_API_KEY', OPENAI_ASR_API_KEY);
const DASHSCOPE_ASR_BASE_URL = readEnv('DASHSCOPE_ASR_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
const DASHSCOPE_ASR_MODEL = readEnv('DASHSCOPE_ASR_MODEL', 'qwen3-asr-flash');
const DASHSCOPE_MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        gateway: 'ai-interpreter-gateway',
        hasOpenAIKey: Boolean(OPENAI_TRANSLATION_API_KEY || OPENAI_ASR_API_KEY),
        hasTranslationKey: Boolean(OPENAI_TRANSLATION_API_KEY),
        hasAsrKey: Boolean(getAsrApiKey()),
        asrProvider: ASR_PROVIDER,
        translationModel: OPENAI_TRANSLATION_MODEL,
        asrModel: getAsrModel(),
        translationBaseUrl: redactBaseUrl(OPENAI_TRANSLATION_BASE_URL),
        asrBaseUrl: redactBaseUrl(getAsrBaseUrl()),
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/api/translate') {
      await proxyTranslation(request, response);
      return;
    }

    if (request.method === 'POST' && request.url === '/api/transcribe') {
      await proxyTranscription(request, response);
      return;
    }

    sendError(response, 404, {
      code: 'route_not_found',
      error: 'Not found.',
    });
  } catch (error) {
    console.error('[server] request failed:', error);
    if (!response.headersSent) {
      sendError(response, 500, {
        code: 'gateway_internal_error',
        error: error.message || 'Server error.',
      });
    } else {
      response.end();
    }
  }
});

server.listen(Number(process.env.PORT ?? DEFAULT_PORT), () => {
  const { port } = server.address();
  console.log(`[server] AI interpreter API listening on http://localhost:${port}`);
});

function readEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

async function proxyTranslation(request, response) {
  if (!ensureApiKey(response, OPENAI_TRANSLATION_API_KEY, 'translation')) return;
  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    sendError(response, 400, {
      code: 'invalid_json',
      error: error.message || 'Invalid JSON request body.',
      purpose: 'translation',
    });
    return;
  }
  let upstream;
  try {
    upstream = await fetch(`${OPENAI_TRANSLATION_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_TRANSLATION_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: payload.model || OPENAI_TRANSLATION_MODEL,
        stream: true,
        temperature: 0.2,
        messages: payload.messages,
      }),
    });
  } catch (error) {
    sendError(response, 502, {
      error: error.message || 'Translation upstream network error.',
      code: 'translation_network_error',
      purpose: 'translation',
      provider: 'openai-compatible',
      upstreamBaseUrl: redactBaseUrl(OPENAI_TRANSLATION_BASE_URL),
    });
    return;
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    sendError(response, upstream.status, {
      error: `Translation failed: ${detail}`,
      code: 'translation_upstream_error',
      purpose: 'translation',
      provider: 'openai-compatible',
      upstreamStatus: upstream.status,
      upstreamBaseUrl: redactBaseUrl(OPENAI_TRANSLATION_BASE_URL),
    });
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  for await (const chunk of upstream.body) {
    response.write(chunk);
  }
  response.end();
}

async function proxyTranscription(request, response) {
  if (!ensureApiKey(response, getAsrApiKey(), 'asr')) return;
  const body = await readRawBody(request);
  const contentType = request.headers['content-type'];
  if (!contentType?.includes('multipart/form-data')) {
    sendError(response, 400, {
      error: 'Expected multipart/form-data audio upload.',
      code: 'invalid_audio_upload',
      purpose: 'asr',
      provider: ASR_PROVIDER,
    });
    return;
  }

  if (!['dashscope', 'openai'].includes(ASR_PROVIDER)) {
    sendError(response, 400, {
      error: `Unsupported ASR provider: ${ASR_PROVIDER}.`,
      code: 'unsupported_provider',
      purpose: 'asr',
      provider: ASR_PROVIDER,
    });
    return;
  }

  if (ASR_PROVIDER === 'dashscope') {
    await proxyDashScopeTranscription({ body, contentType, response });
    return;
  }

  await proxyOpenAITranscription({ body, contentType, response });
}

async function proxyOpenAITranscription({ body, contentType, response }) {
  let upstream;
  try {
    upstream = await fetch(`${OPENAI_ASR_BASE_URL.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_ASR_API_KEY}`,
        'Content-Type': contentType,
      },
      body,
    });
  } catch (error) {
    sendError(response, 502, {
      error: error.message || 'ASR upstream network error.',
      code: 'asr_network_error',
      purpose: 'asr',
      provider: 'openai',
      upstreamBaseUrl: redactBaseUrl(OPENAI_ASR_BASE_URL),
    });
    return;
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    sendError(response, upstream.status, {
      error: `ASR failed: ${text}`,
      code: 'asr_upstream_error',
      purpose: 'asr',
      provider: 'openai',
      upstreamStatus: upstream.status,
      upstreamBaseUrl: redactBaseUrl(OPENAI_ASR_BASE_URL),
    });
    return;
  }
  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
  });
  response.end(text);
}

async function proxyDashScopeTranscription({ body, contentType, response }) {
  let parsed;
  try {
    parsed = parseMultipartFile(body, contentType);
  } catch (error) {
    sendError(response, 400, {
      error: error.message,
      code: 'invalid_audio_upload',
      purpose: 'asr',
      provider: 'dashscope',
    });
    return;
  }

  if (parsed.file.length > DASHSCOPE_MAX_AUDIO_BYTES) {
    sendError(response, 413, {
      error: 'DashScope Qwen-ASR inline audio limit is 10MB. Use a shorter sample or switch to an object-storage URL workflow.',
      code: 'file_too_large',
      purpose: 'asr',
      provider: 'dashscope',
      limitBytes: DASHSCOPE_MAX_AUDIO_BYTES,
    });
    return;
  }

  const dataUrl = `data:${parsed.contentType};base64,${parsed.file.toString('base64')}`;
  let upstream;
  try {
    upstream = await fetch(`${DASHSCOPE_ASR_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DASHSCOPE_ASR_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'input_audio', input_audio: { data: dataUrl } },
              { type: 'text', text: '请将这段英文音频完整转写为英文文本，只输出转写内容。' },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    sendError(response, 502, {
      error: error.message || 'DashScope ASR upstream network error.',
      code: 'asr_network_error',
      purpose: 'asr',
      provider: 'dashscope',
      upstreamBaseUrl: redactBaseUrl(DASHSCOPE_ASR_BASE_URL),
    });
    return;
  }

  const bodyText = await upstream.text();
  if (!upstream.ok) {
    sendError(response, upstream.status, {
      error: `DashScope ASR failed: ${bodyText}`,
      code: 'asr_upstream_error',
      purpose: 'asr',
      provider: 'dashscope',
      upstreamStatus: upstream.status,
      upstreamBaseUrl: redactBaseUrl(DASHSCOPE_ASR_BASE_URL),
    });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    sendError(response, 502, {
      error: `DashScope ASR returned non-JSON response: ${bodyText.slice(0, 240)}`,
      code: 'asr_invalid_response',
      purpose: 'asr',
      provider: 'dashscope',
    });
    return;
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    sendError(response, 502, {
      error: `DashScope ASR returned no text: ${bodyText.slice(0, 240)}`,
      code: 'asr_empty_response',
      purpose: 'asr',
      provider: 'dashscope',
    });
    return;
  }

  sendJson(response, 200, { text });
}

function getAsrApiKey() {
  return ASR_PROVIDER === 'dashscope' ? DASHSCOPE_API_KEY : OPENAI_ASR_API_KEY;
}

function getAsrBaseUrl() {
  return ASR_PROVIDER === 'dashscope' ? DASHSCOPE_ASR_BASE_URL : OPENAI_ASR_BASE_URL;
}

function getAsrModel() {
  return ASR_PROVIDER === 'dashscope' ? DASHSCOPE_ASR_MODEL : OPENAI_ASR_MODEL;
}

function ensureApiKey(response, apiKey, purpose) {
  if (!apiKey) {
    sendError(response, 503, {
      error: `Missing ${purpose} API key. Configure OPENAI_API_KEY or purpose-specific key in .env.`,
      code: 'missing_server_key',
      purpose,
      provider: purpose === 'asr' ? ASR_PROVIDER : 'openai-compatible',
    });
    return false;
  }
  return true;
}

function redactBaseUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

function parseMultipartFile(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) throw new Error('Missing multipart boundary.');
  const boundary = Buffer.from(`--${boundaryMatch[1].replace(/^"|"$/g, '')}`);
  const parts = splitMultipart(body, boundary);

  for (const part of parts) {
    const separator = part.indexOf('\r\n\r\n');
    if (separator === -1) continue;
    const headerText = part.subarray(0, separator).toString('utf8');
    if (!/name="file"/.test(headerText)) continue;
    const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    let file = part.subarray(separator + 4);
    if (file.subarray(-2).toString() === '\r\n') file = file.subarray(0, -2);
    return {
      file,
      contentType: contentTypeMatch?.[1]?.trim() || 'application/octet-stream',
    };
  }

  throw new Error('Missing file part in multipart upload.');
}

function splitMultipart(body, boundary) {
  const parts = [];
  let cursor = 0;

  while (cursor < body.length) {
    const start = body.indexOf(boundary, cursor);
    if (start === -1) break;
    const next = body.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    let partStart = start + boundary.length;
    if (body.subarray(partStart, partStart + 2).toString() === '\r\n') partStart += 2;
    let part = body.subarray(partStart, next);
    if (part.subarray(-2).toString() === '\r\n') part = part.subarray(0, -2);
    if (part.length > 0 && part.subarray(0, 2).toString() !== '--') parts.push(part);
    cursor = next;
  }

  return parts;
}

async function readJson(request) {
  const chunks = await readChunks(request);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readRawBody(request) {
  return Buffer.concat(await readChunks(request));
}

async function readChunks(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks;
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, payload) {
  sendJson(response, status, {
    ok: false,
    ...payload,
  });
}
