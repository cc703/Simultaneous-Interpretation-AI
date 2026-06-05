const baseUrls = [
  ['translation', readEnv('OPENAI_TRANSLATION_BASE_URL', readEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1'))],
  ['asr', getAsrBaseUrl()],
];

for (const [name, baseUrl] of baseUrls) {
  const target = `${baseUrl.replace(/\/$/, '')}/models`;
  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: buildHeaders(name),
      signal: AbortSignal.timeout(12000),
    });
    console.log(`${name}: ${response.status} ${response.statusText} ${redact(target)}`);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.log(`${name}: ${body.slice(0, 240)}`);
    }
  } catch (error) {
    console.log(`${name}: network_error ${redact(target)} ${error.message}`);
  }
}

function buildHeaders(name) {
  const apiKey = name === 'asr'
    ? getAsrApiKey()
    : readEnv('OPENAI_TRANSLATION_API_KEY', readEnv('OPENAI_API_KEY', ''));
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function getAsrBaseUrl() {
  const provider = readEnv('ASR_PROVIDER', 'dashscope');
  if (provider === 'dashscope') {
    return readEnv('DASHSCOPE_ASR_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  }
  return readEnv('OPENAI_ASR_BASE_URL', 'https://api.openai.com/v1');
}

function getAsrApiKey() {
  const provider = readEnv('ASR_PROVIDER', 'dashscope');
  if (provider === 'dashscope') return readEnv('DASHSCOPE_API_KEY', readEnv('OPENAI_ASR_API_KEY', readEnv('OPENAI_API_KEY', '')));
  return readEnv('OPENAI_ASR_API_KEY', readEnv('OPENAI_API_KEY', ''));
}

function readEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function redact(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return 'invalid-url';
  }
}
