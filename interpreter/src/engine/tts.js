class TTSEngine {
  constructor() {
    this._queue = [];
    this._isSpeaking = false;
    this._enabled = false;
    this._rate = 1.1;
    this._voice = null;
    this._lang = 'zh-CN';
    this._keepAliveTimer = null;
    this._stats = {
      queued: 0,
      spoken: 0,
      dropped: 0,
      cancelled: 0,
      lastText: '',
      lastLang: '',
      lastRate: 0,
      status: 'idle',
    };
  }

  async init() {
    if (!this._isAvailable()) return;
    await this._waitForVoices();
    this._voice = this._selectBestChineseVoice();
    this._startKeepAlive();
  }

  enqueue(text) {
    if (!this._enabled || !text || !this._isAvailable()) {
      this._stats.status = this._enabled ? 'unavailable' : 'disabled';
      return;
    }

    if (this._queue.length > 3) {
      this._queue.shift();
      this._stats.dropped += 1;
      console.warn('[TTS] queue overflow, dropping oldest item');
    }

    const rate = this._queue.length > 1 ? Math.min(1.5, this._rate * 1.15) : this._rate;
    this._queue.push({ text, rate, lang: this._lang });
    this._stats.queued += 1;
    this._stats.lastText = text;
    this._stats.lastLang = this._lang;
    this._stats.lastRate = rate;
    this._stats.status = 'queued';
    if (!this._isSpeaking) this._processQueue();
  }

  cancel() {
    if (!this._isAvailable()) return;
    getSpeechSynthesis()?.cancel();
    this._queue = [];
    this._isSpeaking = false;
    this._stats.cancelled += 1;
    this._stats.status = 'cancelled';
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this.cancel();
  }

  setRate(rate) {
    this._rate = Number(rate) || 1.1;
  }

  setLanguage(lang) {
    this._lang = lang || 'zh-CN';
  }

  speakOnce(text, { lang = 'zh-CN', rate = this._rate, voice = null } = {}) {
    if (!text || !this._isAvailable()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice ?? (lang.startsWith('zh') ? this._voice : this._selectVoiceForLang(lang));
    utterance.lang = lang;
    utterance.rate = Number(rate) || this._rate;
    utterance.pitch = 1.0;
    this._stats.spoken += 1;
    this._stats.lastText = text;
    this._stats.lastLang = lang;
    this._stats.lastRate = utterance.rate;
    this._stats.status = 'speaking';
    getSpeechSynthesis()?.speak(utterance);
  }

  getStats() {
    return {
      ...this._stats,
      enabled: this._enabled,
      speaking: this._isSpeaking || Boolean(getSpeechSynthesis()?.speaking),
      queueLength: this._queue.length,
      available: this._isAvailable(),
    };
  }

  resetStats() {
    this._stats = {
      queued: 0,
      spoken: 0,
      dropped: 0,
      cancelled: 0,
      lastText: '',
      lastLang: '',
      lastRate: 0,
      status: 'idle',
    };
  }

  _processQueue() {
    if (!this._isAvailable()) return;
    if (this._queue.length === 0) {
      this._isSpeaking = false;
      return;
    }

    this._isSpeaking = true;
    const item = this._queue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.voice = item.lang.startsWith('zh') ? this._voice : this._selectVoiceForLang(item.lang);
    utterance.lang = item.lang;
    utterance.rate = item.rate;
    utterance.pitch = 1.0;
    this._stats.spoken += 1;
    this._stats.status = 'speaking';
    utterance.onend = () => {
      this._stats.status = this._queue.length ? 'queued' : 'idle';
      this._processQueue();
    };
    utterance.onerror = (event) => {
      console.warn('[TTS] error:', event.error);
      this._stats.status = 'error';
      this._processQueue();
    };

    getSpeechSynthesis()?.speak(utterance);
  }

  _selectBestChineseVoice() {
    const voices = getSpeechSynthesis()?.getVoices() ?? [];
    const priority = [
      (voice) => voice.name.includes('Microsoft') && voice.lang.startsWith('zh'),
      (voice) => voice.name.includes('Google') && voice.lang.startsWith('zh'),
      (voice) => voice.lang.startsWith('zh-CN'),
      (voice) => voice.lang.startsWith('zh'),
    ];

    for (const match of priority) {
      const found = voices.find(match);
      if (found) return found;
    }
    return null;
  }

  _selectVoiceForLang(lang) {
    const voices = getSpeechSynthesis()?.getVoices() ?? [];
    return voices.find((voice) => voice.lang === lang)
      ?? voices.find((voice) => voice.lang?.startsWith(lang.split('-')[0]))
      ?? null;
  }

  _waitForVoices() {
    return new Promise((resolve) => {
      const synth = getSpeechSynthesis();
      if (!synth) {
        resolve();
        return;
      }
      if (synth.getVoices().length > 0) {
        resolve();
        return;
      }
      synth.onvoiceschanged = () => resolve();
      getWindow()?.setTimeout?.(resolve, 800) ?? setTimeout(resolve, 800);
    });
  }

  _startKeepAlive() {
    if (this._keepAliveTimer) return;
    const timerHost = getWindow() ?? globalThis;
    this._keepAliveTimer = timerHost.setInterval(() => {
      if (getSpeechSynthesis()?.speaking) {
        getSpeechSynthesis()?.pause();
        getSpeechSynthesis()?.resume();
      }
    }, 10000);
  }

  _isAvailable() {
    return Boolean(getSpeechSynthesis()) && typeof SpeechSynthesisUtterance !== 'undefined';
  }
}

function getSpeechSynthesis() {
  return globalThis.speechSynthesis ?? globalThis.window?.speechSynthesis ?? null;
}

function getWindow() {
  return typeof window !== 'undefined' ? window : globalThis.window ?? null;
}

export const ttsEngine = new TTSEngine();

export function initTTS() {
  return ttsEngine.init();
}

export function enqueueTTS(text) {
  ttsEngine.enqueue(text);
}

export function cancelTTS() {
  ttsEngine.cancel();
}

export function setTTSEnabled(enabled) {
  ttsEngine.setEnabled(enabled);
}

export function setTTSRate(rate) {
  ttsEngine.setRate(rate);
}

export function setTTSLanguage(lang) {
  ttsEngine.setLanguage(lang);
}

export function speakOnce(text, options) {
  ttsEngine.speakOnce(text, options);
}

export function getTTSStats() {
  return ttsEngine.getStats();
}

export function resetTTSStats() {
  ttsEngine.resetStats();
}
