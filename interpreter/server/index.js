import http from 'node:http';

const DEFAULT_PORT = 8787;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? 'gpt-4o-mini';
const OPENAI_ASR_MODEL = process.env.OPENAI_ASR_MODEL ?? 'gpt-4o-mini-transcribe';

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        hasOpenAIKey: Boolean(OPENAI_API_KEY),
        translationModel: OPENAI_TRANSLATION_MODEL,
        asrModel: OPENAI_ASR_MODEL,
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

    sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error('[server] request failed:', error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: error.message || 'Server error.' });
    } else {
      response.end();
    }
  }
});

server.listen(Number(process.env.PORT ?? DEFAULT_PORT), () => {
  const { port } = server.address();
  console.log(`[server] AI interpreter API listening on http://localhost:${port}`);
});

async function proxyTranslation(request, response) {
  if (!ensureOpenAIKey(response)) return;
  const payload = await readJson(request);
  const upstream = await fetch(`${OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: payload.model || OPENAI_TRANSLATION_MODEL,
      stream: true,
      temperature: 0.2,
      messages: payload.messages,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    sendJson(response, upstream.status, { error: `Translation failed: ${detail}` });
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
  if (!ensureOpenAIKey(response)) return;
  const body = await readRawBody(request);
  const contentType = request.headers['content-type'];
  if (!contentType?.includes('multipart/form-data')) {
    sendJson(response, 400, { error: 'Expected multipart/form-data audio upload.' });
    return;
  }

  const upstream = await fetch(`${OPENAI_BASE_URL.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': contentType,
    },
    body,
  });

  const text = await upstream.text();
  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
  });
  response.end(text);
}

function ensureOpenAIKey(response) {
  if (!OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: 'Missing OPENAI_API_KEY. Copy .env.example to .env and configure a server-side key.',
      code: 'missing_server_key',
    });
    return false;
  }
  return true;
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
