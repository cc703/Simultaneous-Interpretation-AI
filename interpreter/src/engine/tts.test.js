import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  cancelTTS,
  enqueueTTS,
  getTTSStats,
  resetTTSStats,
  setTTSEnabled,
  setTTSLanguage,
  setTTSRate,
} from './tts.js';

const originalWindow = globalThis.window;
const originalSpeechSynthesis = globalThis.speechSynthesis;
const originalUtterance = globalThis.SpeechSynthesisUtterance;

let spoken = [];

beforeEach(() => {
  spoken = [];
  globalThis.window = {
    setInterval: () => 0,
    setTimeout,
  };
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
      this.voice = null;
      this.onend = null;
      this.onerror = null;
    }
  };
  globalThis.speechSynthesis = {
    speaking: false,
    getVoices: () => [{ name: 'Microsoft Xiaoxiao', lang: 'zh-CN' }],
    speak: (utterance) => {
      spoken.push({
        text: utterance.text,
        lang: utterance.lang,
        rate: utterance.rate,
      });
      utterance.onend?.();
    },
    cancel: () => {},
    pause: () => {},
    resume: () => {},
  };
  resetTTSStats();
  setTTSEnabled(false);
});

afterEach(() => {
  cancelTTS();
  globalThis.window = originalWindow;
  globalThis.speechSynthesis = originalSpeechSynthesis;
  globalThis.SpeechSynthesisUtterance = originalUtterance;
});

describe('TTS output queue', () => {
  it('speaks queued Chinese interpretation when voice output is enabled', () => {
    setTTSEnabled(true);
    setTTSLanguage('zh-CN');
    setTTSRate(1.2);

    enqueueTTS('欢迎访问 SampleLab。');

    assert.deepEqual(spoken, [{
      text: '欢迎访问 SampleLab。',
      lang: 'zh-CN',
      rate: 1.2,
    }]);
    assert.equal(getTTSStats().queued, 1);
    assert.equal(getTTSStats().spoken, 1);
    assert.equal(getTTSStats().lastText, '欢迎访问 SampleLab。');
  });

  it('does not enqueue speech when voice output is disabled', () => {
    setTTSEnabled(false);

    enqueueTTS('这句不应播报。');

    assert.equal(spoken.length, 0);
    assert.equal(getTTSStats().queued, 0);
    assert.equal(getTTSStats().status, 'disabled');
  });
});
