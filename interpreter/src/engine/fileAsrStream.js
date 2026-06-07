import { useStore } from '../store/index.js';
import { transcribeAudioBlob, translateTranscriptText } from './asrAdapter.js';
import {
  isNoiseUtterance,
  normalizeBufferedText,
  shouldFlushSoftBoundary,
  takeInterpretationUnits,
} from './streamSegmenter.js';

let recorder = null;
let activeSession = 0;
let sentenceBuffer = '';
let processingQueue = Promise.resolve();

const DEFAULT_CHUNK_MS = 2200;
const SILENCE_BYTES_THRESHOLD = 700;

export function isFileASRStreamSupported(audioElement) {
  return Boolean(
    typeof window !== 'undefined'
      && 'MediaRecorder' in window
      && audioElement
      && (audioElement.captureStream || audioElement.mozCaptureStream),
  );
}

export async function startFileASRStream(audioElement, {
  apiKey,
  baseUrl,
  model,
  chunkMs = DEFAULT_CHUNK_MS,
  onStatus,
} = {}) {
  stopFileASRStream();
  if (!audioElement) throw new Error('缺少文件音频播放器。');
  if (!isFileASRStreamSupported(audioElement)) {
    throw new Error('当前浏览器不支持从文件播放器实时捕获音频流。');
  }

  const stream = audioElement.captureStream?.() || audioElement.mozCaptureStream?.();
  if (!stream) throw new Error('无法捕获文件音频流。');

  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  activeSession += 1;
  const session = activeSession;
  sentenceBuffer = '';
  processingQueue = Promise.resolve();

  recorder.ondataavailable = (event) => {
    if (!isCurrentSession(session) || !event.data || event.data.size < SILENCE_BYTES_THRESHOLD) return;
    processingQueue = processingQueue.then(() => processChunk({
      blob: event.data,
      session,
      apiKey,
      baseUrl,
      model,
      onStatus,
    }));
  };

  recorder.onerror = (event) => {
    onStatus?.(`文件流式 ASR 录制失败：${event.error?.message ?? '未知错误'}`);
  };

  recorder.start(normalizeChunkMs(chunkMs));
  audioElement.currentTime = 0;
  await audioElement.play();
  onStatus?.('正在播放文件，并按语句结束实时识别和翻译。');

  await waitForAudioEnd(audioElement, session);
  await requestFinalChunk();
  await processingQueue;
  await flushSentenceBuffer({ session, force: true, onStatus });
}

export function stopFileASRStream() {
  activeSession += 1;
  sentenceBuffer = '';
  processingQueue = Promise.resolve();
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  recorder = null;
}

async function processChunk({ blob, session, apiKey, baseUrl, model, onStatus }) {
  if (!isCurrentSession(session)) return;
  onStatus?.('正在识别当前播放片段...');

  const transcript = await transcribeAudioBlob({
    blob,
    filename: 'file-stream-chunk.webm',
    apiKey,
    baseUrl,
    model,
  });
  if (!isCurrentSession(session) || !transcript.trim()) return;

  const normalizedTranscript = normalizeBufferedText(transcript);
  if (isNoiseUtterance(normalizedTranscript)) {
    onStatus?.('当前片段像语气词或噪声，已跳过。');
    return;
  }

  sentenceBuffer = normalizeBufferedText(`${sentenceBuffer} ${normalizedTranscript}`);
  useStore.getState().updateCurrentInterim({
    en: sentenceBuffer,
    zh: '已捕获语音片段，正在判断语句边界...',
  });
  await flushSentenceBuffer({
    session,
    force: false,
    softBoundary: shouldFlushSoftBoundary(sentenceBuffer, normalizedTranscript),
    onStatus,
  });
}

async function flushSentenceBuffer({ session, force, softBoundary = false, onStatus }) {
  if (!isCurrentSession(session)) return;
  const ready = takeInterpretationUnits(sentenceBuffer, { force, softBoundary });
  sentenceBuffer = ready.rest;

  for (const sentence of ready.units) {
    if (!isCurrentSession(session)) return;
    onStatus?.(`检测到语句结束，正在同传：${sentence.slice(0, 48)}`);
    await translateTranscriptText(sentence);
  }

  if (!sentenceBuffer) {
    useStore.getState().updateCurrentInterim({ en: '', zh: '' });
  }
}

export function takeCompleteSentences(text, force = false) {
  const ready = takeInterpretationUnits(text, { force });
  return { sentences: ready.units, rest: ready.rest };
}

function isCurrentSession(session) {
  return session === activeSession;
}

function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function normalizeChunkMs(chunkMs) {
  const next = Number(chunkMs);
  if (!Number.isFinite(next)) return DEFAULT_CHUNK_MS;
  return Math.max(1000, Math.min(5000, Math.round(next)));
}

function waitForAudioEnd(audioElement, session) {
  if (!isCurrentSession(session)) return Promise.resolve();
  if (audioElement.ended) return Promise.resolve();

  return new Promise((resolve) => {
    const cleanup = () => {
      audioElement.removeEventListener('ended', handleDone);
      audioElement.removeEventListener('pause', handlePause);
    };
    const handleDone = () => {
      cleanup();
      resolve();
    };
    const handlePause = () => {
      if (!isCurrentSession(session)) {
        cleanup();
        resolve();
      }
    };
    audioElement.addEventListener('ended', handleDone, { once: true });
    audioElement.addEventListener('pause', handlePause);
  });
}

function requestFinalChunk() {
  return new Promise((resolve) => {
    if (!recorder || recorder.state === 'inactive') {
      resolve();
      return;
    }
    const currentRecorder = recorder;
    const handleStop = () => resolve();
    currentRecorder.addEventListener('stop', handleStop, { once: true });
    currentRecorder.requestData();
    currentRecorder.stop();
  });
}
