import { useStore } from '../store/index.js';
import { NoSpeechDetectedError, transcribeAudioBlob, translateTranscriptText } from './asrAdapter.js';
import {
  isNoiseUtterance,
  isInstructionOrCodeArtifact,
  normalizeBufferedText,
  repairAsrTextArtifacts,
  shouldFlushSoftBoundary,
  takeInterpretationUnits,
} from './streamSegmenter.js';

let recorder = null;
let chunkIndex = 0;
let active = false;
let stats = createEmptyStats();
let lastTranscript = '';
let sessionId = 0;
let isProcessing = false;
let pendingChunks = [];
let sentenceBuffer = '';
let lastUnreleasedTranscript = '';
let adaptiveBlobParts = [];
let adaptiveWindowStartedAt = 0;
let adaptiveWindowBytes = 0;
let adaptiveWindowFirstIndex = 0;
let noSignalStreak = 0;
let liveStartedAt = 0;

const DEFAULT_CHUNK_MS = 3000;
const SILENCE_BYTES_THRESHOLD = 700;
const MIN_ADAPTIVE_WINDOW_MS = 6500;
const MAX_ADAPTIVE_WINDOW_MS = 11000;
const MIN_ADAPTIVE_BYTES = 24000;
const MIN_AUDIO_PEAK = 4;
const MIN_AUDIO_AVERAGE = 0.8;
const AUDIO_SIGNAL_GRACE_MS = 9000;
const FAST_SPEECH_WPM = 190;
const OVERLOAD_SPEECH_WPM = 240;
const FAST_SPEECH_GRACE_MS = 16000;
const FAST_WINDOW_TARGETS = {
  normal: { minMs: MIN_ADAPTIVE_WINDOW_MS, maxMs: MAX_ADAPTIVE_WINDOW_MS, minBytes: MIN_ADAPTIVE_BYTES },
  fast: { minMs: 4600, maxMs: 8200, minBytes: 18000 },
  overload: { minMs: 3200, maxMs: 6200, minBytes: 12000 },
  unstable: { minMs: 3200, maxMs: 6200, minBytes: 12000 },
};

export function isLiveASRSupported() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

export function startLiveASR(stream, {
  apiKey,
  baseUrl,
  model,
  chunkMs = DEFAULT_CHUNK_MS,
  forceNoAudioSignal = false,
  assumeAudibleSignal = false,
  onStatus,
  onStats,
} = {}) {
  stopLiveASR();

  if (!stream) throw new Error('缺少直播音频流。');
  if (!isLiveASRSupported()) throw new Error('当前浏览器不支持 MediaRecorder 直播切片。');

  const mimeType = pickMimeType();
  const recorderChunkMs = normalizeChunkMs(chunkMs);
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  active = true;
  sessionId += 1;
  const currentSessionId = sessionId;
  chunkIndex = 0;
  stats = createEmptyStats();
  lastTranscript = '';
  isProcessing = false;
  pendingChunks = [];
  sentenceBuffer = '';
  lastUnreleasedTranscript = '';
  adaptiveBlobParts = [];
  adaptiveWindowStartedAt = 0;
  adaptiveWindowBytes = 0;
  adaptiveWindowFirstIndex = 0;
  noSignalStreak = 0;
  liveStartedAt = performance.now();
  useStore.getState().startTranslation();
  emitStats(onStats);
  onStatus?.(`Live ASR 低延迟模式已启动，正在按 ${Math.round(recorderChunkMs / 1000)} 秒级音频片段转写。`);

  recorder.ondataavailable = (event) => {
    if (!active || !event.data) return;
    const index = ++chunkIndex;
    if (event.data.size < SILENCE_BYTES_THRESHOLD) {
      stats.skipped += 1;
      stats.backlog = pendingChunks.length;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 过短或静音，已跳过。`);
      return;
    }
    if (!hasAudibleSignal({ forceNoAudioSignal, assumeAudibleSignal })) {
      noSignalStreak += 1;
      stats.skipped += 1;
      stats.backlog = pendingChunks.length;
      emitStats(onStats);
      const hint = noSignalStreak >= 2
        ? '检测到共享音频轨道，但没有实际音量。请确认浏览器共享弹窗勾选“共享标签页音频”，抖音视频正在播放且未静音。'
        : `直播片段 #${index} 当前没有实际音量，等待真实语音输入。`;
      onStatus?.(hint);
      useStore.getState().updateCurrentInterim({
        en: '',
        zh: hint,
      });
      return;
    }
    noSignalStreak = 0;
    const adaptiveJob = buildAdaptiveChunkJob({
      blob: event.data,
      index,
      sessionId: currentSessionId,
      apiKey,
      baseUrl,
      model,
      forceNoAudioSignal,
      assumeAudibleSignal,
      chunkMs: recorderChunkMs,
      onStatus,
      onStats,
      queuedAt: performance.now(),
    });
    if (!adaptiveJob) {
      const speedHint = stats.speechRateLevel === 'overload'
        ? '当前语速过快，已缩短同传窗口并继续保留上下文。'
        : stats.speechRateLevel === 'fast'
          ? '当前语速偏快，正在缩短语义窗口。'
          : '等待更清晰的 ASR 输入。';
      stats.backlog = pendingChunks.length;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 已进入自适应语音窗，${speedHint}`);
      return;
    }
    scheduleChunk(adaptiveJob);
  };

  recorder.onerror = (event) => {
    onStatus?.(`Live ASR 录制失败：${event.error?.message ?? '未知错误'}`);
  };

  recorder.onstop = () => {
    active = false;
  };

  recorder.start(recorderChunkMs);
}

export function stopLiveASR() {
  const stoppingSessionId = sessionId;
  const finalSentence = sentenceBuffer || lastUnreleasedTranscript;
  active = false;
  sessionId += 1;
  isProcessing = false;
  pendingChunks = [];
  sentenceBuffer = '';
  lastUnreleasedTranscript = '';
  adaptiveBlobParts = [];
  adaptiveWindowStartedAt = 0;
  adaptiveWindowBytes = 0;
  adaptiveWindowFirstIndex = 0;
  noSignalStreak = 0;
  liveStartedAt = 0;
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  recorder = null;
  void flushFinalLiveBuffer({
    stoppedSessionId: stoppingSessionId,
    sentence: finalSentence,
  });
}

function buildAdaptiveChunkJob(job) {
  if (adaptiveBlobParts.length === 0) {
    adaptiveWindowStartedAt = job.queuedAt ?? performance.now();
    adaptiveWindowFirstIndex = job.index;
  }
  adaptiveBlobParts.push(job.blob);
  adaptiveWindowBytes += job.blob.size;

  const ageMs = (job.queuedAt ?? performance.now()) - adaptiveWindowStartedAt;
  const targets = getAdaptiveWindowTargets();
  const ready = (
    (ageMs >= targets.minMs && adaptiveWindowBytes >= targets.minBytes)
    || ageMs >= targets.maxMs
  );
  if (!ready) return null;

  const combinedBlob = new Blob(adaptiveBlobParts, { type: job.blob.type || 'audio/webm' });
  const firstQueuedAt = adaptiveWindowStartedAt;
  const firstIndex = adaptiveWindowFirstIndex || Math.max(1, job.index - adaptiveBlobParts.length + 1);
  const windowDurationMs = Math.max(ageMs, normalizeChunkMs(job.chunkMs ?? DEFAULT_CHUNK_MS));
  adaptiveBlobParts = [];
  adaptiveWindowStartedAt = 0;
  adaptiveWindowBytes = 0;
  adaptiveWindowFirstIndex = 0;
  return {
    ...job,
    blob: combinedBlob,
    index: `${firstIndex}-${job.index}`,
    queuedAt: firstQueuedAt,
    windowDurationMs,
  };
}

function scheduleChunk(job) {
  if (!active || !isCurrentSession(job.sessionId)) return;
  if (isProcessing) {
    pendingChunks.push(job);
    stats.backlog = pendingChunks.length;
    emitStats(job.onStats);
    job.onStatus?.(`直播片段 #${job.index} 已进入低延迟缓冲，等待按顺序同传。`);
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
      job = pendingChunks.shift() ?? null;
      stats.backlog = pendingChunks.length;
    }
  } finally {
    isProcessing = false;
    if (pendingChunks.length > 0 && active && isCurrentSession(pendingChunks[0].sessionId)) {
      const nextJob = pendingChunks.shift();
      void processChunkLoop(nextJob);
    }
  }
}

async function processChunk({
  blob,
  index,
  sessionId: chunkSessionId,
  apiKey,
  baseUrl,
  model,
  onStatus,
  onStats,
  queuedAt,
  windowDurationMs,
}) {
  if (!isCurrentSession(chunkSessionId)) return;
  const startedAt = performance.now();
  stats.queued += 1;
  stats.backlog = pendingChunks.length;
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
    const normalizedTranscript = repairAsrTextArtifacts(transcript);
    if (!normalizedTranscript) return;
    const speechRate = estimateSpeechRate(normalizedTranscript, windowDurationMs);
    updateSpeechRateStats(speechRate);
    emitStats(onStats);
    if (isNoiseUtterance(normalizedTranscript)) {
      stats.skipped += 1;
      stats.backlog = pendingChunks.length;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 像语气词或噪声，已跳过。`);
      return;
    }
    if (isInstructionOrCodeArtifact(normalizedTranscript)) {
      stats.skipped += 1;
      stats.backlog = pendingChunks.length;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 像指令或代码污染，已跳过。`);
      return;
    }
    if (isDuplicateTranscript(normalizedTranscript, lastTranscript)) {
      stats.duplicates += 1;
      stats.backlog = pendingChunks.length;
      emitStats(onStats);
      onStatus?.(`直播片段 #${index} 与上一片段重复，已跳过。`);
      return;
    }
    lastTranscript = normalizedTranscript;
    lastUnreleasedTranscript = normalizedTranscript;
    const asrLatencyMs = Math.round(performance.now() - (queuedAt ?? startedAt));
    const rateHint = formatSpeechRateStatus(speechRate);
    emitStats(onStats);
    onStatus?.(`直播片段 #${index} 已转写，ASR 耗时 ${asrLatencyMs}ms，正在判断语义边界。${rateHint}`);
    if (!isCurrentSession(chunkSessionId)) return;
    sentenceBuffer = normalizeBufferedText(`${sentenceBuffer} ${normalizedTranscript}`);
    useStore.getState().updateCurrentInterim({
      en: sentenceBuffer,
      zh: speechRate.level === 'normal'
        ? '已捕获直播语音，正在等待可同传的语义边界...'
        : `${speechRate.level === 'overload' ? '语速过快' : '语速偏快'} ${speechRate.wpm} WPM，系统正在缩短语义窗口并保留上下文。`,
    });
    await flushLiveBuffer({
      sessionId: chunkSessionId,
      force: false,
      softBoundary: (
        speechRate.level !== 'normal'
        || shouldFlushSoftBoundary(sentenceBuffer, normalizedTranscript, { requireMeaningful: true })
      ),
      onStatus,
      onStats,
      queuedAt,
      startedAt,
    });
  } catch (error) {
    if (!isCurrentSession(chunkSessionId)) return;
    if (
      error instanceof NoSpeechDetectedError
      || error?.code === 'no_speech_detected'
      || /audio is empty|invalid_parameter_error/i.test(error?.message ?? '')
    ) {
      const audioPresent = hasAudibleSignal({ assumeAudibleSignal: true });
      if (!audioPresent) {
        stats.skipped += 1;
      }
      stats.backlog = pendingChunks.length;
      if (audioPresent) {
        markAsrUnstableOnAudibleInput();
        preserveFailedAudioForRetry({ blob, index, queuedAt, windowDurationMs });
      }
      emitStats(onStats);
      const hint = audioPresent
        ? buildAudibleAsrRecoveryHint(index)
        : `直播片段 #${index} 未检测到实际音量，已跳过。若持续出现，请重新共享并勾选标签页音频。`;
      onStatus?.(hint);
      useStore.getState().updateCurrentInterim({
        en: audioPresent ? buildLiveRecoverySource(index) : '',
        zh: audioPresent ? buildLiveRecoveryInterimHint() : hint,
      });
      return;
    }
    console.warn('[live-asr] chunk failed:', error);
    onStatus?.(error.message || `直播片段 #${index} 转写失败。`);
    useStore.getState().updateCurrentInterim({ en: '', zh: '' });
  }
}

async function flushLiveBuffer({
  sessionId: chunkSessionId,
  force,
  softBoundary = false,
  onStatus,
  onStats,
  queuedAt,
  startedAt,
}) {
  if (!isCurrentSession(chunkSessionId)) return;
  const ready = takeInterpretationUnits(sentenceBuffer, { force, softBoundary, requireMeaningful: true });
  sentenceBuffer = ready.rest;

  for (const unit of ready.units) {
    if (!isCurrentSession(chunkSessionId)) return;
    onStatus?.(`检测到直播语义单元，正在同传：${unit.slice(0, 48)}`);
    await translateTranscriptText(unit, {
      shouldContinue: () => isCurrentSession(chunkSessionId),
    });
    if (!isCurrentSession(chunkSessionId)) return;
    stats.processed += 1;
    stats.lastLatencyMs = Math.round(performance.now() - (queuedAt ?? startedAt));
    lastUnreleasedTranscript = '';
    emitStats(onStats);
    onStatus?.(`直播字幕已生成，端到端处理耗时 ${stats.lastLatencyMs}ms。`);
  }

  if (!sentenceBuffer) {
    useStore.getState().updateCurrentInterim({ en: '', zh: '' });
  }
}

async function flushFinalLiveBuffer({ stoppedSessionId, sentence }) {
  const finalText = normalizeBufferedText(sentence);
  if (!finalText) return;

  const ready = takeInterpretationUnits(finalText, {
    force: true,
    softBoundary: true,
    requireMeaningful: false,
  });
  if (!ready.units.length) {
    useStore.getState().updateCurrentInterim({
      en: finalText,
      zh: '直播已停止，最后一段语音信息不足，未生成稳定字幕。',
    });
    return;
  }

  try {
    useStore.getState().updateCurrentInterim({
      en: ready.units.join(' '),
      zh: '直播已停止，正在收尾翻译最后一段语义单元...',
    });
    for (const unit of ready.units) {
      await translateTranscriptText(unit, {
        preserveSingleUnit: true,
        shouldContinue: () => sessionId === stoppedSessionId + 1 && !active,
      });
    }
    if (sessionId === stoppedSessionId + 1 && !active) {
      useStore.getState().updateCurrentInterim({ en: '', zh: '' });
    }
  } catch (error) {
    console.warn('[live-asr] final buffer flush failed:', error);
    if (sessionId === stoppedSessionId + 1 && !active) {
      useStore.getState().updateCurrentInterim({
        en: finalText,
        zh: error.message || '直播停止收尾翻译失败。',
      });
    }
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

function createEmptyStats() {
  return {
    queued: 0,
    processed: 0,
    skipped: 0,
    duplicates: 0,
    lastLatencyMs: 0,
    speechRateWpm: 0,
    speechRateLevel: 'normal',
    windowDurationSec: 0,
    lastWords: 0,
    overloads: 0,
    backlog: 0,
    asrUnstable: 0,
  };
}

export function estimateSpeechRate(text, windowDurationMs = MIN_ADAPTIVE_WINDOW_MS) {
  const words = countSpeechWords(text);
  const windowDurationSec = Math.max(1, Number(windowDurationMs || MIN_ADAPTIVE_WINDOW_MS) / 1000);
  const wpm = words > 0 ? Math.round(words / (windowDurationSec / 60)) : 0;
  const level = wpm >= OVERLOAD_SPEECH_WPM ? 'overload' : wpm >= FAST_SPEECH_WPM ? 'fast' : 'normal';
  return {
    words,
    wpm,
    level,
    windowDurationSec: Math.round(windowDurationSec * 10) / 10,
  };
}

function countSpeechWords(text) {
  const normalized = normalizeBufferedText(text);
  if (!normalized) return 0;
  const latinWords = normalized.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?/g) ?? [];
  const cjkChars = normalized.match(/[\u4e00-\u9fff]/g) ?? [];
  const cjkWordEstimate = Math.ceil(cjkChars.length / 2);
  return latinWords.length + cjkWordEstimate;
}

function updateSpeechRateStats(speechRate) {
  stats.speechRateWpm = speechRate.wpm;
  stats.speechRateLevel = speechRate.level;
  stats.windowDurationSec = speechRate.windowDurationSec;
  stats.lastWords = speechRate.words;
  stats.backlog = pendingChunks.length;
  if (speechRate.level !== 'normal') {
    stats.overloads += 1;
    stats.lastFastSpeechAt = performance.now();
  }
}

function formatSpeechRateStatus(speechRate) {
  if (speechRate.level === 'overload') {
    return ` 语速过快 ${speechRate.wpm} WPM，系统已缩短同传窗口；可能出现延迟或需要回修。`;
  }
  if (speechRate.level === 'fast') {
    return ` 语速偏快 ${speechRate.wpm} WPM，正在扩大上下文并更早释放字幕。`;
  }
  if (speechRate.wpm > 0) {
    return ` 当前语速 ${speechRate.wpm} WPM。`;
  }
  return '';
}

function getAdaptiveWindowTargets() {
  const level = stats.speechRateLevel;
  return FAST_WINDOW_TARGETS[level] ?? FAST_WINDOW_TARGETS.normal;
}

function markAsrUnstableOnAudibleInput() {
  stats.asrUnstable += 1;
  if (isInFastSpeechGraceWindow()) {
    stats.speechRateLevel = 'overload';
    stats.overloads += 1;
  } else if (stats.speechRateLevel === 'normal') {
    stats.speechRateLevel = 'unstable';
  }
}

function preserveFailedAudioForRetry({ blob, index, queuedAt, windowDurationMs }) {
  if (!blob?.size) return;
  adaptiveBlobParts = [blob];
  adaptiveWindowStartedAt = queuedAt ?? performance.now();
  adaptiveWindowBytes = blob.size;
  adaptiveWindowFirstIndex = parseFirstChunkIndex(index);
  stats.windowDurationSec = Math.max(
    stats.windowDurationSec || 0,
    Math.round((Number(windowDurationMs ?? 0) / 1000) * 10) / 10,
  );
}

function parseFirstChunkIndex(index) {
  const match = String(index ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function isInFastSpeechGraceWindow() {
  if (!stats.lastFastSpeechAt) return false;
  return performance.now() - stats.lastFastSpeechAt <= FAST_SPEECH_GRACE_MS;
}

function buildAudibleAsrRecoveryHint(index) {
  const rate = stats.speechRateWpm ? `${stats.speechRateWpm} WPM` : '未知语速';
  const prefix = stats.speechRateLevel === 'overload' || isInFastSpeechGraceWindow()
    ? `直播片段 #${index} 音频存在，但语速过快（${rate}）导致 ASR 未稳定捕获。`
    : `直播片段 #${index} 音频存在，但 ASR 未稳定捕获，疑似语速过快、背景声过重或平台音频采样异常。`;
  return `${prefix} 系统会继续合并下一语义窗并保留上下文，不会按“无音频”处理。`;
}

function buildLiveRecoverySource(index) {
  const buffered = normalizeBufferedText(sentenceBuffer || lastUnreleasedTranscript);
  if (buffered) return buffered;
  return `Live audio window #${index}`;
}

function buildLiveRecoveryInterimHint() {
  const rate = stats.speechRateWpm ? `${stats.speechRateWpm} WPM` : '语速待确认';
  if (stats.speechRateLevel === 'overload') {
    return `语速过快（${rate}），正在合并下一语义窗追赶当前讲话。`;
  }
  if (stats.speechRateLevel === 'fast' || stats.speechRateLevel === 'unstable') {
    return `ASR 暂未稳定，正在保留当前音频并合并下一窗重试。`;
  }
  return '音频存在，ASR 暂未稳定，正在继续追踪当前讲话。';
}

function hasAudibleSignal({ forceNoAudioSignal = false, assumeAudibleSignal = false } = {}) {
  if (forceNoAudioSignal) return false;
  if (assumeAudibleSignal) return true;
  const waveform = useStore.getState().waveformData ?? [];
  if (performance.now() - liveStartedAt <= AUDIO_SIGNAL_GRACE_MS) return true;
  if (!waveform.length) return true;
  const peak = Math.max(...waveform);
  const average = waveform.reduce((sum, value) => sum + value, 0) / waveform.length;
  return peak >= MIN_AUDIO_PEAK || average >= MIN_AUDIO_AVERAGE;
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
  return Math.max(2000, Math.min(10000, Math.round(next)));
}
