class TTSEngine {
  constructor() {
    this._queue = [];
    this._isSpeaking = false;
    this._enabled = false;
    this._rate = 1.1;
    this._voice = null;
    this._keepAliveTimer = null;
  }

  async init() {
    if (!this._isAvailable()) return;
    await this._waitForVoices();
    this._voice = this._selectBestChineseVoice();
    this._startKeepAlive();
  }

  enqueue(text) {
    if (!this._enabled || !text || !this._isAvailable()) return;

    if (this._queue.length > 3) {
      this._queue.shift();
      console.warn('[TTS] queue overflow, dropping oldest item');
    }

    const rate = this._queue.length > 1 ? Math.min(1.5, this._rate * 1.15) : this._rate;
    this._queue.push({ text, rate });
    if (!this._isSpeaking) this._processQueue();
  }

  cancel() {
    if (!this._isAvailable()) return;
    speechSynthesis.cancel();
    this._queue = [];
    this._isSpeaking = false;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) this.cancel();
  }

  setRate(rate) {
    this._rate = Number(rate) || 1.1;
  }

  speakOnce(text, { lang = 'zh-CN', rate = this._rate, voice = null } = {}) {
    if (!text || !this._isAvailable()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice ?? (lang.startsWith('zh') ? this._voice : this._selectVoiceForLang(lang));
    utterance.lang = lang;
    utterance.rate = Number(rate) || this._rate;
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
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
    utterance.voice = this._voice;
    utterance.lang = 'zh-CN';
    utterance.rate = item.rate;
    utterance.pitch = 1.0;
    utterance.onend = () => this._processQueue();
    utterance.onerror = (event) => {
      console.warn('[TTS] error:', event.error);
      this._processQueue();
    };

    speechSynthesis.speak(utterance);
  }

  _selectBestChineseVoice() {
    const voices = speechSynthesis.getVoices();
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
    const voices = speechSynthesis.getVoices();
    return voices.find((voice) => voice.lang === lang)
      ?? voices.find((voice) => voice.lang?.startsWith(lang.split('-')[0]))
      ?? null;
  }

  _waitForVoices() {
    return new Promise((resolve) => {
      if (speechSynthesis.getVoices().length > 0) {
        resolve();
        return;
      }
      speechSynthesis.onvoiceschanged = () => resolve();
      window.setTimeout(resolve, 800);
    });
  }

  _startKeepAlive() {
    if (this._keepAliveTimer) return;
    this._keepAliveTimer = window.setInterval(() => {
      if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 10000);
  }

  _isAvailable() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }
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

export function speakOnce(text, options) {
  ttsEngine.speakOnce(text, options);
}
