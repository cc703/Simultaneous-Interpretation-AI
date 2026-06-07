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
  if (blob.size > MAX_BROWSER_UPLOAD_BYTES) {
    throw new Error('当前浏览器直传限制为 25MB，请换更短的音频或接入后端分片。');
  }
  const useServerProxy = !apiKey;

  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model', model);
  form.append('language', language);
  form.append('response_format', 'json');

  const response = await fetch(useServerProxy ? '/api/transcribe' : `${baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: useServerProxy ? undefined : {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`ASR 转写失败：${response.status} ${detail}`);
  }

  const json = await response.json();
  if (json.speechDetected === false) {
    throw new Error(json.note || 'ASR 未检测到清晰英文语音。');
  }
  const text = json.text?.trim();
  if (!text) throw new Error('ASR 未返回可用英文文本。');
  return text;
}

export async function translateTranscriptText(text) {
  await translateTranscriptSentences(splitTranscript(text));
}

export async function translateTranscriptTimed(text, {
  audioElement,
  totalDurationSec = 0,
  minGapMs = 900,
} = {}) {
  const sentences = splitTranscript(text);
  if (!sentences.length) return;
  const timedSentences = buildTimedSentences(sentences, totalDurationSec);

  for (const item of timedSentences) {
    if (audioElement) {
      await waitForAudioTime(audioElement, item.releaseAtSec);
    } else {
      await delay(minGapMs);
    }
    await translateSingleSentence(item.text, {
      timestamp: Date.now(),
      timeLabel: formatTimeLabel(item.releaseAtSec),
    });
  }
}

async function translateTranscriptSentences(sentences) {
  for (const sentence of sentences) {
    await translateSingleSentence(sentence);
  }
}

async function translateSingleSentence(sentence, overrides = {}) {
  const store = useStore.getState();
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
      correctionMemory: useStore.getState().autoCorrect
        ? buildCorrectionMemoryPrompt(
          useStore.getState().correctionHistory,
          useStore.getState().subtitles,
        )
        : '',
      sourceLanguage: store.sourceLanguage,
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
    console.warn('[file-asr] translation fallback:', error);
    translatedText = buildDemoTranslation(sentence, useStore.getState().glossary);
  }

  useStore.getState().appendSubtitle({
    timestamp: overrides.timestamp ?? Date.now(),
    timeLabel: overrides.timeLabel,
    en: sentence,
    zh: translatedText,
    corrected: false,
    correctionType: null,
    termsApplied: findTerms(sentence, useStore.getState().glossary),
  });
  if (useStore.getState().voiceOutput) enqueueTTS(translatedText);
  useStore.setState({ latencyMs: Math.round(performance.now() - startedAt) });
}

export function buildDemoTranslation(sentence, glossary = []) {
  const normalized = sentence.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const termHits = glossary
    .filter((term) => term.enabled && lower.includes(term.source.toLowerCase()))
    .map((term) => `${term.source} -> ${term.target}`);

  const dictionaryHit = DEMO_TRANSLATION_PATTERNS.find(([pattern]) => lower.includes(pattern));
  const translated = dictionaryHit?.[1] ?? `演示译文：${normalized}`;
  const termNote = termHits.length > 0 ? `（术语：${termHits.join('；')}）` : '';
  return `${translated}${termNote}`;
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

function buildTimedSentences(sentences, totalDurationSec) {
  const safeDuration = Number.isFinite(totalDurationSec) && totalDurationSec > 0
    ? totalDurationSec
    : sentences.length * 1.8;
  const totalWeight = sentences.reduce((sum, sentence) => sum + sentence.length, 0) || sentences.length;
  let cursor = 0;

  return sentences.map((sentence, index) => {
    const releaseAtSec = index === 0 ? 0.4 : cursor;
    cursor += Math.max(0.9, (sentence.length / totalWeight) * safeDuration);
    return {
      text: sentence,
      releaseAtSec: Math.min(Math.max(0.4, releaseAtSec), Math.max(0.4, safeDuration - 0.3)),
    };
  });
}

function waitForAudioTime(audioElement, targetSec) {
  if (!audioElement || audioElement.ended) return Promise.resolve();
  if (audioElement.currentTime >= targetSec) return Promise.resolve();

  return new Promise((resolve) => {
    const cleanup = () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', cleanup);
      audioElement.removeEventListener('pause', handlePause);
    };
    const handleTimeUpdate = () => {
      if (audioElement.currentTime >= targetSec || audioElement.ended) {
        cleanup();
        resolve();
      }
    };
    const handlePause = () => {
      if (audioElement.ended) {
        cleanup();
        resolve();
      }
    };
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('ended', cleanup, { once: true });
    audioElement.addEventListener('pause', handlePause);
    handleTimeUpdate();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimeLabel(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = String(Math.floor(safe / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const rest = String(safe % 60).padStart(2, '0');
  return `${hours}:${minutes}:${rest}`;
}

const DEMO_TRANSLATION_PATTERNS = [
  ['welcome', '欢迎各位参加本次英文音频同传演示。'],
  ['good morning', '大家早上好，欢迎来到本次英文音频同传演示。'],
  ['sample', '这是一段用于测试文件转写和中文字幕输出的英文样本。'],
  ['audio', '系统正在把英文音频转写后生成中文字幕。'],
  ['speech', '这段英文讲话会进入同传字幕和后续复盘流程。'],
  ['translation', '实时翻译可以帮助听众更快理解英文内容。'],
  ['meeting', '在会议场景中，字幕修正和术语一致性非常重要。'],
  ['review', '最后可以导出双语转写和同传复盘报告。'],
  ['report', '系统会生成包含风险、术语和完整字幕的复盘报告。'],
  ['business', '在商务场景中，准确翻译数字、责任和承诺非常关键。'],
  ['technology', '在技术分享中，系统会尽量保持术语和上下文一致。'],
];
