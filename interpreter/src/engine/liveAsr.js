import { useStore } from '../store/index.js';
import { transcribeAudioBlob, translateTranscriptText } from './asrAdapter.js';

let recorder = null;
let chunkIndex = 0;
let active = false;
let stats = { queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 };
let lastTranscript = '';
let sessionId = 0;
let isProcessing = false;
let pendingChunk = null;

const DEFAULT_CHUNK_MS = 1000;
const SILENCE_BYTES_THRESHOLD = 700;

export function isLiveASRSupported() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

export function startLiveASR(stream, {
  apiKey,
  baseUrl,
  model,
  chunkMs = DEFAULT_CHUNK_MS,
  onStatus,
  onStats,
} = {}) {
  stopLiveASR();

  if (!stream) throw new Error('缺少直播音频流。');
  if (!isLiveASRSupported()) throw new Error('当前浏览器不支持 MediaRecorder 直播切片。');

  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  active = true;
  sessionId += 1;
  const currentSessionId = sessionId;
  chunkIndex = 0;
  stats = { queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 };
  lastTranscript = '';
  isProcessing = false;
  pendingChunk = null;
  useStore.getState().startTranslation();
  emitStats(onStats);
  onStatus?.('Live ASR 低延迟模式已启动，正在按 1 秒级音频片段转写。');

  recorder.ondataavailable = (event) => {
    if (!active || !event.data) return;
    const index = ++chunkIndex;
    if (event.data.size < SILENCE_BYTES_THRESHOLD) {
      stats.skipped += 1;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 过短或静音，已跳过。`);
      return;
    }
    scheduleChunk({
      blob: event.data,
      index,
      sessionId: currentSessionId,
      apiKey,
      baseUrl,
      model,
      onStatus,
      onStats,
      queuedAt: performance.now(),
    });
  };

  recorder.onerror = (event) => {
    onStatus?.(`Live ASR 录制失败：${event.error?.message ?? '未知错误'}`);
  };

  recorder.onstop = () => {
    active = false;
  };

  recorder.start(normalizeChunkMs(chunkMs));
}

export function stopLiveASR() {
  active = false;
  sessionId += 1;
  isProcessing = false;
  pendingChunk = null;
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  recorder = null;
}

function scheduleChunk(job) {
  if (!active || !isCurrentSession(job.sessionId)) return;
  if (isProcessing) {
    if (pendingChunk) stats.skipped += 1;
    pendingChunk = job;
    emitStats(job.onStats);
    job.onStatus?.(`直播片段 #${job.index} 已进入低延迟缓冲；旧缓冲片段会被跳过。`);
    return;
  }

  void processChunkLoop(job);
}

async function processChunkLoop(initialJob) {
  let job = initialJob;
  isProcessing = true;
  try {
    while (job && active && isCurrentSession(job.sessionId)) {
      await processChunk(job);
      job = pendingChunk;
      pendingChunk = null;
    }
  } finally {
    isProcessing = false;
    if (pendingChunk && active && isCurrentSession(pendingChunk.sessionId)) {
      const nextJob = pendingChunk;
      pendingChunk = null;
      void processChunkLoop(nextJob);
    }
  }
}

async function processChunk({ blob, index, sessionId: chunkSessionId, apiKey, baseUrl, model, onStatus, onStats, queuedAt }) {
  if (!isCurrentSession(chunkSessionId)) return;
  const startedAt = performance.now();
  stats.queued += 1;
  emitStats(onStats);
  onStatus?.(`正在转写直播片段 #${index}...`);
  useStore.getState().updateCurrentInterim({
    en: `Live chunk #${index}`,
    zh: '正在低延迟转写直播音频...',
  });

  try {
    const transcript = await transcribeAudioBlob({
      blob,
      filename: `live-chunk-${index}.webm`,
      apiKey,
      baseUrl,
      model,
    });
    if (!isCurrentSession(chunkSessionId)) return;
    if (!transcript.trim()) return;
    if (isDuplicateTranscript(transcript, lastTranscript)) {
      stats.duplicates += 1;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 与上一片段重复，已跳过。`);
      return;
    }
    lastTranscript = transcript;
    const asrLatencyMs = Math.round(performance.now() - (queuedAt ?? startedAt));
    emitStats(onStats);
    onStatus?.(`直播片段 #${index} 已转写，ASR 耗时 ${asrLatencyMs}ms，正在翻译。`);
    if (!isCurrentSession(chunkSessionId)) return;
    await translateTranscriptText(transcript);
    if (!isCurrentSession(chunkSessionId)) return;
    stats.processed += 1;
    stats.lastLatencyMs = Math.round(performance.now() - (queuedAt ?? startedAt));
    emitStats(onStats);
    onStatus?.(`直播片段 #${index} 字幕已生成，端到端片段处理耗时 ${stats.lastLatencyMs}ms。`);
  } catch (error) {
    if (!isCurrentSession(chunkSessionId)) return;
    console.warn('[live-asr] chunk failed:', error);
    onStatus?.(error.message || `直播片段 #${index} 转写失败。`);
    useStore.getState().updateCurrentInterim({
      en: `Live chunk #${index}`,
      zh: error.message || '直播 ASR 失败，请检查 Key、网络或浏览器权限。',
    });
  }
}

function isCurrentSession(chunkSessionId) {
  return active && chunkSessionId === sessionId;
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

function normalizeChunkMs(chunkMs) {
  const next = Number(chunkMs);
  if (!Number.isFinite(next)) return DEFAULT_CHUNK_MS;
  return Math.max(1000, Math.min(10000, Math.round(next)));
}
