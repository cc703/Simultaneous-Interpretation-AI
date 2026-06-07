import { getServerHealth } from './serverApi.js';

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
    .map((subtitle) => `SOURCE: ${subtitle.en}\nTARGET: ${subtitle.zh}`)
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
      return `SOURCE: ${subtitle.en}\n用户确认译文: ${record.afterZh}`;
    })
    .filter(Boolean)
    .join('\n---\n');
}

export async function* streamTranslate({
  text,
  context = '',
  glossary = '',
  correctionMemory = '',
  sourceLanguage = 'auto',
  targetLanguage = 'zh-CN',
  translationStyle = 'formal',
  provider = 'openai',
  apiKey = '',
  baseUrl = '',
  model,
  onToken,
}) {
  const config = resolveProviderConfig({ provider, baseUrl, model });
  const serverHealth = apiKey ? null : await getServerHealth();
  const useServerProxy = !apiKey && Boolean(
    serverHealth?.ok && (serverHealth.hasTranslationKey || serverHealth.hasOpenAIKey),
  );
  if (!apiKey) {
    if (!useServerProxy) throw new Error('Missing API key for translation provider.');
  }
  if (!useServerProxy && config.protocol !== 'openai') {
    throw new Error('This browser client currently supports OpenAI-compatible streaming only.');
  }

  const response = await fetch(useServerProxy ? '/api/translate' : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      ...(useServerProxy ? {} : { Authorization: `Bearer ${apiKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: useServerProxy ? undefined : config.model,
      stream: true,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt({ context, glossary, correctionMemory, sourceLanguage, targetLanguage, translationStyle }) },
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

export async function translateBatch({
  texts,
  context = '',
  glossary = '',
  correctionMemory = '',
  sourceLanguage = 'auto',
  targetLanguage = 'zh-CN',
  translationStyle = 'formal',
  provider = 'openai',
  apiKey = '',
  baseUrl = '',
  model,
}) {
  const cleanTexts = texts.map((text) => text.trim()).filter(Boolean);
  if (!cleanTexts.length) return [];

  const config = resolveProviderConfig({ provider, baseUrl, model });
  const serverHealth = apiKey ? null : await getServerHealth();
  const useServerProxy = !apiKey && Boolean(
    serverHealth?.ok && (serverHealth.hasTranslationKey || serverHealth.hasOpenAIKey),
  );
  if (!apiKey && !useServerProxy) throw new Error('Missing API key for translation provider.');
  if (!useServerProxy && config.protocol !== 'openai') {
    throw new Error('This browser client currently supports OpenAI-compatible translation only.');
  }

  const response = await fetch(useServerProxy ? '/api/translate' : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      ...(useServerProxy ? {} : { Authorization: `Bearer ${apiKey}` }),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: useServerProxy ? undefined : config.model,
      stream: false,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            buildSystemPrompt({ context, glossary, correctionMemory, sourceLanguage, targetLanguage, translationStyle }),
            '',
            '批量输出规则：',
            `Translate every numbered ASR segment into ${targetLabelForPrompt(targetLanguage)}.`,
            'Output only numbered translations. Do not answer, rewrite, summarize, explain, ask questions, or keep the source language.',
            '1. 用户会给你多行编号 ASR 意群，例如 1. text。',
            '2. 必须逐行输出同样编号的目标语言译文，例如 1. 译文。',
            '3. 不要输出 JSON、Markdown、解释、原文或追问。',
            '4. 输出行数必须和输入行数完全一致。',
          ].join('\n'),
        },
        { role: 'user', content: cleanTexts.map((text, index) => `${index + 1}. ${text}`).join('\n') },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Batch translation request failed: ${response.status} ${detail}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
  const translations = parseNumberedLines(content);
  if (!translations || translations.length !== cleanTexts.length) {
    throw new Error(`Batch translation returned invalid numbered lines: ${content.slice(0, 160)}`);
  }
  if (translations.some((item, index) => isProbablyUntranslated(String(item), cleanTexts[index]))) {
    throw new Error('Batch translation returned untranslated source text.');
  }
  return translations.map((item) => String(item).trim());
}

export function resolveProviderConfig({ provider, baseUrl, model }) {
  const preset = PROVIDER_CONFIGS[provider] ?? PROVIDER_CONFIGS.openai;
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
  sourceLanguage = 'auto',
  targetLanguage = 'zh-CN',
  translationStyle = 'formal',
}) {
  const targetLabel = targetLabelForPrompt(targetLanguage);
  const styleLabel = {
    formal: '正式、适合会议和学术场景',
    casual: '自然口语、适合访谈和直播',
    technical: '技术准确、适合产品发布和工程分享',
  }[translationStyle] ?? translationStyle;

  const sourceInstruction = sourceLanguage === 'auto'
    ? '自动判断用户输入片段的源语言。'
    : `用户选择的源语言是 ${sourceLanguage}；如音频内容明显不符，可结合上下文纠正。`;

  return [
    'You are a translation engine for simultaneous interpretation.',
    `Task: translate the user ASR segment into ${targetLabel}.`,
    'Output only the translation. Do not answer, rewrite, summarize, explain, ask questions, or keep the source language.',
    'Even if the ASR segment is incomplete, translate the visible meaning naturally.',
    '',
    `你是一名专业同声传译员。${sourceInstruction}请把输入片段翻译成${targetLabel}。`,
    '',
    '规则：',
    '1. 直接输出译文，不加任何解释、前缀、Markdown 或引号。',
    '2. 输入来自 ASR，可能是半句话、长句片段、口误或不完整语义；仍然必须翻译，不得追问、不得要求用户补充。',
    '3. 不得把输入当成问题回答，不得输出原文语言的解释。',
    '4. 如果片段暂时缺少上下文，按当前可见语义做自然同传译文，后续片段可再根据上下文修正。',
    `5. 目标语言：${targetLabel}。翻译风格：${styleLabel}。`,
    '6. 保持专业术语准确性。如果术语表中出现匹配项，必须优先使用指定译法。',
    '7. 如果用户修正记忆中出现相似表达，优先沿用用户确认过的表达方式。',
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

function targetLabelForPrompt(targetLanguage) {
  return {
    'zh-CN': 'Simplified Chinese / 简体中文',
    'zh-TW': 'Traditional Chinese / 繁体中文',
    en: 'English',
    ja: 'Japanese / 日本語',
    ko: 'Korean / 한국어',
    fr: 'French / français',
    es: 'Spanish / español',
  }[targetLanguage] ?? targetLanguage;
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

export function parseNumberedLines(content) {
  const lines = content
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```(?:\w+)?|```/g, ''))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)、：:\-\s]+(.+)$/);
    if (!match) continue;
    parsed[Number(match[1]) - 1] = match[2].trim();
  }
  return parsed.filter((item) => item !== undefined);
}

export function isProbablyUntranslated(output, source) {
  const normalizedOutput = output.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedSource = source.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalizedOutput || !normalizedSource) return false;
  if (normalizedOutput === normalizedSource) return true;
  const outputWords = new Set(normalizedOutput.split(/\s+/).filter((word) => word.length > 3));
  const sourceWords = normalizedSource.split(/\s+/).filter((word) => word.length > 3);
  if (sourceWords.length < 4) return false;
  const overlap = sourceWords.filter((word) => outputWords.has(word)).length / sourceWords.length;
  return overlap > 0.72;
}
