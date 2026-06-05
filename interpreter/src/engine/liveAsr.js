import { useStore } from '../store/index.js';
import { transcribeAudioBlob, translateTranscriptText } from './asrAdapter.js';

let recorder = null;
let chunkIndex = 0;
let active = false;
let processing = Promise.resolve();
let stats = { queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 };
let lastTranscript = '';

export function isLiveASRSupported() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

export function startLiveASR(stream, {
  apiKey,
  baseUrl,
  model,
  chunkMs = 4000,
  onStatus,
  onStats,
} = {}) {
  stopLiveASR();

  if (!stream) throw new Error('缺少直播音频流。');
  if (!isLiveASRSupported()) throw new Error('当前浏览器不支持 MediaRecorder 直播切片。');

  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  active = true;
  chunkIndex = 0;
  stats = { queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 };
  lastTranscript = '';
  useStore.getState().startTranslation();
  emitStats(onStats);
  onStatus?.('Live ASR 已启动，正在按音频片段转写。');

  recorder.ondataavailable = (event) => {
    if (!active || !event.data) return;
    const index = ++chunkIndex;
    if (event.data.size < 1200) {
      stats.skipped += 1;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 过短或静音，已跳过。`);
      return;
    }
    stats.queued += 1;
    emitStats(onStats);
    processing = processing.then(() => processChunk(event.data, {
      index,
      apiKey,
      baseUrl,
      model,
      onStatus,
      onStats,
    }));
  };

  recorder.onerror = (event) => {
    onStatus?.(`Live ASR 录制失败：${event.error?.message ?? '未知错误'}`);
  };

  recorder.onstop = () => {
    active = false;
  };

  recorder.start(Number(chunkMs) || 4000);
}

export function stopLiveASR() {
  active = false;
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  recorder = null;
}

async function processChunk(blob, { index, apiKey, baseUrl, model, onStatus, onStats }) {
  if (!active) return;
  const startedAt = performance.now();
  onStatus?.(`正在转写直播片段 #${index}...`);
  useStore.getState().updateCurrentInterim({
    en: `Live chunk #${index}`,
    zh: '正在对直播音频做真实 ASR...',
  });

  try {
    const transcript = await transcribeAudioBlob({
      blob,
      filename: `live-chunk-${index}.webm`,
      apiKey,
      baseUrl,
      model,
    });
    if (!transcript.trim()) return;
    if (isDuplicateTranscript(transcript, lastTranscript)) {
      stats.duplicates += 1;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 与上一片段重复，已跳过。`);
      return;
    }
    lastTranscript = transcript;
    stats.processed += 1;
    stats.lastLatencyMs = Math.round(performance.now() - startedAt);
    emitStats(onStats);
    onStatus?.(`直播片段 #${index} 已转写，正在翻译。`);
    await translateTranscriptText(transcript);
  } catch (error) {
    console.warn('[live-asr] chunk failed:', error);
    onStatus?.(error.message || `直播片段 #${index} 转写失败。`);
    useStore.getState().updateCurrentInterim({
      en: `Live chunk #${index}`,
      zh: error.message || '直播 ASR 失败，请检查 Key、网络或浏览器权限。',
    });
  }
}

function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function emitStats(onStats) {
  onStats?.({ ...stats });
}

function isDuplicateTranscript(current, previous) {
  if (!current || !previous) return false;
  const normalizedCurrent = normalizeTranscript(current);
  const normalizedPrevious = normalizeTranscript(previous);
  if (!normalizedCurrent || !normalizedPrevious) return false;
  if (normalizedCurrent === normalizedPrevious) return true;
  const shorter = normalizedCurrent.length < normalizedPrevious.length ? normalizedCurrent : normalizedPrevious;
  const longer = normalizedCurrent.length >= normalizedPrevious.length ? normalizedCurrent : normalizedPrevious;
  return shorter.length > 20 && longer.includes(shorter);
}

function normalizeTranscript(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
