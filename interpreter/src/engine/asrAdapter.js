import { useStore } from '../store/index.js';
import {
  buildContext,
  buildCorrectionMemoryPrompt,
  buildGlossaryPrompt,
  streamTranslate,
} from './translator.js';
import { enqueueTTS } from './tts.js';

const MAX_BROWSER_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function transcribeAudioFile({
  file,
  apiKey,
  baseUrl = 'https://api.openai.com/v1',
  model = 'gpt-4o-mini-transcribe',
  language = 'en',
}) {
  if (!file) throw new Error('请选择音频或视频文件。');
  return transcribeAudioBlob({
    blob: file,
    filename: file.name || 'audio.webm',
    apiKey,
    baseUrl,
    model,
    language,
  });
}

export async function transcribeAudioBlob({
  blob,
  filename = 'audio.webm',
  apiKey,
  baseUrl = 'https://api.openai.com/v1',
  model = 'gpt-4o-mini-transcribe',
  language = 'en',
}) {
  if (!blob) throw new Error('缺少可转写的音频片段。');
  if (!apiKey) throw new Error('请先填写 OpenAI ASR API Key。');
  if (blob.size > MAX_BROWSER_UPLOAD_BYTES) {
    throw new Error('当前浏览器直传限制为 25MB，请换更短的音频或接入后端分片。');
  }

  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model', model);
  form.append('language', language);
  form.append('response_format', 'json');

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ASR 转写失败：${response.status} ${detail}`);
  }

  const json = await response.json();
  const text = json.text?.trim();
  if (!text) throw new Error('ASR 未返回可用英文文本。');
  return text;
}

export async function translateTranscriptText(text) {
  const store = useStore.getState();
  const sentences = splitTranscript(text);

  for (const sentence of sentences) {
    const startedAt = performance.now();
    let translatedText = '';
    useStore.getState().updateCurrentInterim({
      en: sentence,
      zh: '正在翻译真实转写文本...',
    });

    try {
      for await (const token of streamTranslate({
        text: sentence,
        context: buildContext(useStore.getState().subtitles, store.contextWindow),
        glossary: store.terminologyBoost ? buildGlossaryPrompt(useStore.getState().glossary) : '',
        correctionMemory: buildCorrectionMemoryPrompt(
          useStore.getState().correctionHistory,
          useStore.getState().subtitles,
        ),
        targetLanguage: store.targetLanguage,
        translationStyle: store.translationStyle,
        provider: store.provider,
        apiKey: store.apiKey,
        baseUrl: store.baseUrl,
        onToken: (tokenText) => {
          translatedText += tokenText;
          useStore.getState().updateCurrentInterim({ en: sentence, zh: translatedText });
        },
      })) {
        void token;
      }
    } catch (error) {
      console.warn('[file-asr] translation skipped:', error);
      translatedText = store.apiKey
        ? '翻译请求失败，请检查 Provider、Key 或网络。'
        : '真实 ASR 已完成；请填写翻译 API Key 后接入中文翻译。';
    }

    useStore.getState().appendSubtitle({
      timestamp: Date.now(),
      en: sentence,
      zh: translatedText,
      corrected: false,
      correctionType: null,
      termsApplied: findTerms(sentence, useStore.getState().glossary),
    });
    if (useStore.getState().voiceOutput) enqueueTTS(translatedText);
    useStore.setState({ latencyMs: Math.round(performance.now() - startedAt) });
  }
}

export function splitTranscript(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function findTerms(sentence, glossary) {
  const lower = sentence.toLowerCase();
  return glossary
    .filter((term) => term.enabled && lower.includes(term.source.toLowerCase()))
    .map((term) => term.source);
}
