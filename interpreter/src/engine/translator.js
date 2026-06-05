export const PROVIDER_CONFIGS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    protocol: 'openai',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    protocol: 'openai',
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-4-5-20251001',
    protocol: 'anthropic',
  },
  custom: {
    baseUrl: '',
    model: 'gpt-3.5-turbo',
    protocol: 'openai',
  },
};

export function buildContext(subtitles, windowSize = 6) {
  return subtitles
    .slice(-windowSize)
    .map((subtitle) => `EN: ${subtitle.en}\nZH: ${subtitle.zh}`)
    .join('\n---\n');
}

export function buildGlossaryPrompt(glossary) {
  return glossary
    .filter((term) => term.enabled)
    .map((term) => `${term.source} => ${term.target}${term.note ? ` (${term.note})` : ''}`)
    .join('\n');
}

export function buildCorrectionMemoryPrompt(correctionHistory, subtitles) {
  return correctionHistory
    .slice(-6)
    .map((record) => {
      const subtitle = subtitles.find((item) => item.id === record.subtitleId);
      if (!subtitle?.en || !record.afterZh) return '';
      return `EN: ${subtitle.en}\n用户确认译文: ${record.afterZh}`;
    })
    .filter(Boolean)
    .join('\n---\n');
}

export async function* streamTranslate({
  text,
  context = '',
  glossary = '',
  correctionMemory = '',
  targetLanguage = 'zh-CN',
  translationStyle = 'formal',
  provider = 'deepseek',
  apiKey = '',
  baseUrl = '',
  model,
  onToken,
}) {
  const config = resolveProviderConfig({ provider, baseUrl, model });
  const useServerProxy = !apiKey && provider === 'openai';
  if (!apiKey) {
    if (!useServerProxy) throw new Error('Missing API key for translation provider.');
  }
  if (config.protocol !== 'openai') {
    throw new Error('This browser client currently supports OpenAI-compatible streaming only.');
  }

  const response = await fetch(useServerProxy ? '/api/translate' : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      ...(useServerProxy ? {} : { Authorization: `Bearer ${apiKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt({ context, glossary, correctionMemory, targetLanguage, translationStyle }) },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Translation request failed: ${response.status} ${detail}`);
  }

  yield* parseOpenAIStream(response, onToken);
}

export function resolveProviderConfig({ provider, baseUrl, model }) {
  const preset = PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.deepseek;
  return {
    ...preset,
    baseUrl: provider === 'custom' ? baseUrl : preset.baseUrl,
    model: model || preset.model,
  };
}

export function buildSystemPrompt({
  context,
  glossary,
  correctionMemory = '',
  targetLanguage = 'zh-CN',
  translationStyle = 'formal',
}) {
  const styleLabel = {
    formal: '正式、适合会议和学术场景',
    casual: '自然口语、适合访谈和直播',
    technical: '技术准确、适合产品发布和工程分享',
  }[translationStyle] ?? translationStyle;

  return [
    '你是一名专业同声传译员。将用户提供的英文片段翻译成自然流畅的中文。',
    '',
    '规则：',
    '1. 直接输出译文，不加任何解释或前缀。',
    '2. 保持专业术语准确性。',
    `3. 目标语言：${targetLanguage}。翻译风格：${styleLabel}。`,
    '4. 如果术语表中出现匹配项，必须优先使用指定中文译法。',
    '5. 如果用户修正记忆中出现相似表达，优先沿用用户确认过的表达方式。',
    '',
    '上下文参考：',
    context || '无',
    '',
    '当前术语表：',
    glossary || '无',
    '',
    '用户修正记忆：',
    correctionMemory || '无',
  ].join('\n');
}

async function* parseOpenAIStream(response, onToken) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') return;

      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content ?? '';
        if (token) {
          onToken?.(token);
          yield token;
        }
      } catch (error) {
        console.warn('[translator] failed to parse stream chunk:', error);
      }
    }
  }
}
