export class STTEngine {
  constructor({ lang = 'en-US', continuous = true, restartDelayMs = 300 } = {}) {
    this.lang = lang;
    this.continuous = continuous;
    this.restartDelayMs = restartDelayMs;
    this.recognition = null;
    this._shouldRun = false;
    this._restartTimer = null;
    this._interimCb = null;
    this._finalCb = null;
    this._errorCb = null;
    this._endCb = null;
  }

  static isSupported() {
    return Boolean(STTEngine.getRecognitionConstructor());
  }

  static getRecognitionConstructor() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  onInterim(cb) {
    this._interimCb = cb;
    return this;
  }

  onFinal(cb) {
    this._finalCb = cb;
    return this;
  }

  onError(cb) {
    this._errorCb = cb;
    return this;
  }

  onEnd(cb) {
    this._endCb = cb;
    return this;
  }

  start() {
    const Recognition = STTEngine.getRecognitionConstructor();
    if (!Recognition) {
      const error = new Error('Web Speech API is not available in this browser.');
      this._errorCb?.(error);
      throw error;
    }

    this._shouldRun = true;
    this._clearRestartTimer();

    if (!this.recognition) {
      this.recognition = this._createRecognition(Recognition);
    }

    this._safeStart();
  }

  stop() {
    this._shouldRun = false;
    this._clearRestartTimer();

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        this._errorCb?.(error);
      }
    }
  }

  _createRecognition(Recognition) {
    const recognition = new Recognition();
    recognition.lang = this.lang;
    recognition.continuous = this.continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? '';
        if (!transcript) continue;

        if (result.isFinal) {
          this._finalCb?.(transcript);
        } else {
          this._interimCb?.(transcript);
        }
      }
    };

    recognition.onerror = (event) => {
      this._errorCb?.(event);
    };

    recognition.onend = () => {
      this._endCb?.();
      if (this._shouldRun && this.continuous) {
        this._autoRestart();
      }
    };

    return recognition;
  }

  _safeStart() {
    try {
      this.recognition.start();
    } catch (error) {
      if (!String(error?.message ?? '').includes('already started')) {
        this._errorCb?.(error);
      }
    }
  }

  _autoRestart() {
    this._clearRestartTimer();
    this._restartTimer = window.setTimeout(() => {
      if (this._shouldRun) this._safeStart();
    }, this.restartDelayMs);
  }

  _clearRestartTimer() {
    if (this._restartTimer) {
      window.clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
  }
}
