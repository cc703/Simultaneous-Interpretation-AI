import { useStore } from '../store/index.js';
import { transcribeAudioBlob, translateTranscriptText } from './asrAdapter.js';

let recorder = null;
let chunkIndex = 0;
let active = false;
let processing = Promise.resolve();

export function isLiveASRSupported() {
  return typeof window !== 'undefined' && 'MediaRecorder' in window;
}

export function startLiveASR(stream, {
  apiKey,
  baseUrl,
  model,
  chunkMs = 4000,
  onStatus,
} = {}) {
  stopLiveASR();

  if (!stream) throw new Error('缺少直播音频流。');
  if (!isLiveASRSupported()) throw new Error('当前浏览器不支持 MediaRecorder 直播切片。');
  if (!apiKey?.trim()) throw new Error('请先填写 File ASR / Live ASR Key。');

  const mimeType = pickMimeType();
  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  active = true;
  chunkIndex = 0;
  useStore.getState().startTranslation();
  onStatus?.('Live ASR 已启动，正在按音频片段转写。');

  recorder.ondataavailable = (event) => {
    if (!active || !event.data || event.data.size < 800) return;
    const index = ++chunkIndex;
    processing = processing.then(() => processChunk(event.data, {
      index,
      apiKey,
      baseUrl,
      model,
      onStatus,
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

async function processChunk(blob, { index, apiKey, baseUrl, model, onStatus }) {
  if (!active) return;
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
