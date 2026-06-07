import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { useStore } from '../store/index.js';
import { estimateSpeechRate, startLiveASR, stopLiveASR } from './liveAsr.js';

const originalFetch = globalThis.fetch;
const originalMediaRecorder = globalThis.MediaRecorder;
const originalWindow = globalThis.window;
const originalPerformance = globalThis.performance;

let recorders = [];
let now = 0;

beforeEach(() => {
  recorders = [];
  now = 0;
  useStore.getState().resetSession();
  globalThis.window = { MediaRecorder: MockMediaRecorder };
  globalThis.MediaRecorder = MockMediaRecorder;
  globalThis.performance = {
    now: () => now,
  };
});

afterEach(() => {
  stopLiveASR();
  globalThis.fetch = originalFetch;
  globalThis.MediaRecorder = originalMediaRecorder;
  globalThis.window = originalWindow;
  globalThis.performance = originalPerformance;
  useStore.getState().resetSession();
});

describe('live ASR speech-rate detection', () => {
  it('estimates normal, fast, and overloaded speech windows', () => {
    assert.deepEqual(
      estimateSpeechRate('one two three four five six seven eight nine ten', 5000),
      { words: 10, wpm: 120, level: 'normal', windowDurationSec: 5 },
    );
    assert.equal(
      estimateSpeechRate('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen', 5000).level,
      'fast',
    );
    assert.equal(
      estimateSpeechRate('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty one', 5000).level,
      'overload',
    );
  });

  it('marks audible fast speech as overload instead of no-audio or no-clear-speech', async () => {
    const statuses = [];
    const statsEvents = [];
    let transcribeCalls = 0;
    globalThis.fetch = async (url, init = {}) => {
      if (url === '/api/transcribe') {
        transcribeCalls += 1;
        return Response.json({
          text: [
            'The keynote speaker is rapidly explaining live translation latency budgets adaptive chunking semantic buffers',
            'domain terminology correction memory audience comprehension and caption synchronization during a crowded international product launch.',
          ].join(' '),
        });
      }
      if (url === '/api/health') return Response.json({ ok: true, hasTranslationKey: true });
      if (url === '/api/translate') {
        const body = String(init.body ?? '');
        if (/批量输出规则/.test(body)) {
          return Response.json({
            choices: [{ message: { content: '1. 这是快速语音同传。' } }],
          });
        }
        return new Response(
          'data: {"choices":[{"delta":{"content":"这是快速语音同传。"}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    useStore.setState({ waveformData: [0, 9, 14, 8, 3] });

    startLiveASR(createFakeStream(), {
      onStatus: (status) => statuses.push(status),
      onStats: (stats) => statsEvents.push(stats),
    });

    await emitChunk({ size: 12000, advanceMs: 0 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await waitFor(() => statsEvents.some((item) => item.speechRateLevel === 'overload' && item.processed >= 1));

    const joined = statuses.join('\n');
    assert.equal(transcribeCalls, 1);
    assert.match(joined, /语速过快|overload/i);
    assert.doesNotMatch(joined, /没有实际音量|未检测到实际音量|No audible input/);
    assert.doesNotMatch(joined, /未检测到清晰语音，已跳过/);
    assert.ok(useStore.getState().subtitles.length >= 1);
  });

  it('reports no-audio feedback without calling ASR when the shared stream is silent', async () => {
    const statuses = [];
    const statsEvents = [];
    let transcribeCalls = 0;
    globalThis.fetch = async (url) => {
      if (url === '/api/transcribe') {
        transcribeCalls += 1;
        return Response.json({ text: 'This should not be called.' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    useStore.setState({ waveformData: [0, 0, 0.2, 0.3] });

    startLiveASR(createFakeStream(), {
      forceNoAudioSignal: true,
      onStatus: (status) => statuses.push(status),
      onStats: (stats) => statsEvents.push(stats),
    });

    await emitChunk({ size: 20000, advanceMs: 3000 });
    await emitChunk({ size: 20000, advanceMs: 3000 });

    const joined = statuses.join('\n');
    assert.equal(transcribeCalls, 0);
    assert.match(joined, /当前没有实际音量/);
    assert.match(joined, /检测到共享音频轨道，但没有实际音量/);
    assert.doesNotMatch(joined, /未检测到清晰语音/);
    assert.equal(statsEvents.at(-1).skipped, 2);
  });

  it('reports audible ASR instability separately from silent input', async () => {
    const statuses = [];
    const statsEvents = [];
    globalThis.fetch = async (url) => {
      if (url === '/api/transcribe') {
        return Response.json({ speechDetected: false, note: 'no clear speech' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    useStore.setState({ waveformData: [0, 8, 11, 6] });

    startLiveASR(createFakeStream(), {
      onStatus: (status) => statuses.push(status),
      onStats: (stats) => statsEvents.push(stats),
    });

    await emitChunk({ size: 12000, advanceMs: 0 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await waitFor(() => statsEvents.some((item) => item.queued >= 1 && item.skipped === 0 && item.asrUnstable >= 1));

    const joined = statuses.join('\n');
    assert.match(joined, /音频存在，但 ASR 未稳定捕获/);
    assert.match(joined, /不会按“无音频”处理/);
    assert.match(useStore.getState().currentInterim.en, /Live audio window #1-3/);
    assert.match(useStore.getState().currentInterim.zh, /合并下一窗|继续追踪/);
    assert.doesNotMatch(joined, /没有实际音量|未检测到实际音量/);
    assert.equal(statsEvents.at(-1).queued, 1);
    assert.equal(statsEvents.at(-1).skipped, 0);
  });

  it('keeps audible no-speech audio and merges it into the next retry window', async () => {
    const statuses = [];
    const statsEvents = [];
    let transcribeCalls = 0;
    globalThis.fetch = async (url, init = {}) => {
      if (url === '/api/transcribe') {
        transcribeCalls += 1;
        return transcribeCalls === 1
          ? Response.json({ speechDetected: false, note: 'no clear speech' })
          : Response.json({ text: 'I saw many people taking walks or chatting happily.' });
      }
      if (url === '/api/health') return Response.json({ ok: true, hasTranslationKey: true });
      if (url === '/api/translate') {
        const body = String(init.body ?? '');
        if (/批量输出规则/.test(body)) {
          return Response.json({
            choices: [{ message: { content: '1. 我看到许多人散步或愉快地聊天。' } }],
          });
        }
        return new Response(
          'data: {"choices":[{"delta":{"content":"我看到许多人散步或愉快地聊天。"}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    useStore.setState({ waveformData: [0, 9, 15, 8] });

    startLiveASR(createFakeStream(), {
      onStatus: (status) => statuses.push(status),
      onStats: (stats) => statsEvents.push(stats),
    });

    await emitChunk({ size: 12000, advanceMs: 0 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await waitFor(() => statsEvents.some((item) => item.asrUnstable >= 1 && item.skipped === 0));

    await emitChunk({ size: 12000, advanceMs: 3300 });
    await waitFor(() => statsEvents.some((item) => item.queued >= 2 && item.processed >= 1));

    const joined = statuses.join('\n');
    assert.equal(transcribeCalls, 2);
    assert.match(joined, /直播片段 #1-3 音频存在/);
    assert.match(joined, /正在转写直播片段 #1-4/);
    assert.doesNotMatch(joined, /#1-3 未检测到清晰语音，已跳过/);
    assert.equal(statsEvents.at(-1).skipped, 0);
    assert.ok(useStore.getState().subtitles.some((subtitle) => /许多人散步/.test(subtitle.zh)));
  });

  it('flushes the final live buffer into a stable subtitle when capture stops', async () => {
    const statuses = [];
    const statsEvents = [];
    globalThis.fetch = async (url, init = {}) => {
      if (url === '/api/transcribe') {
        return Response.json({ text: 'The closing thought matters.' });
      }
      if (url === '/api/health') return Response.json({ ok: true, hasTranslationKey: true });
      if (url === '/api/translate') {
        const body = String(init.body ?? '');
        if (/批量输出规则/.test(body)) {
          return Response.json({
            choices: [{ message: { content: '1. 结束语很重要。' } }],
          });
        }
        return new Response(
          'data: {"choices":[{"delta":{"content":"结束语很重要。"}}]}\n\ndata: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };
    useStore.setState({ waveformData: [0, 8, 10, 6] });

    startLiveASR(createFakeStream(), {
      onStatus: (status) => statuses.push(status),
      onStats: (stats) => statsEvents.push(stats),
    });

    await emitChunk({ size: 12000, advanceMs: 0 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await emitChunk({ size: 12000, advanceMs: 3300 });
    await waitFor(() => (
      statsEvents.some((item) => item.queued >= 1 && item.processed === 0)
      && /已转写/.test(statuses.join('\n'))
      && /The closing thought matters/.test(useStore.getState().currentInterim.en)
    ));

    stopLiveASR();
    await waitFor(() => useStore.getState().subtitles.some((subtitle) => /结束语很重要/.test(subtitle.zh)));

    assert.match(statuses.join('\n'), /已转写/);
    const subtitle = useStore.getState().subtitles.at(-1);
    assert.equal(subtitle.en, 'The closing thought matters.');
    assert.equal(subtitle.zh, '结束语很重要。');
  });
});

class MockMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onerror = null;
    this.onstop = null;
    recorders.push(this);
  }

  start(chunkMs) {
    this.chunkMs = chunkMs;
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

function createFakeStream() {
  return {
    getAudioTracks: () => [{ enabled: true }],
  };
}

async function emitChunk({ size, advanceMs }) {
  now += advanceMs;
  const recorder = recorders.at(-1);
  assert.ok(recorder, 'MediaRecorder should be active');
  recorder.ondataavailable?.({
    data: new Blob([new Uint8Array(size)], { type: 'audio/webm' }),
  });
  await Promise.resolve();
}

async function waitFor(predicate, timeoutMs = 1500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Timed out waiting for live ASR condition.');
}
