import { useStore } from '../store/index.js';
import { STTEngine } from './stt.js';

let sttEngine = null;

export function getSTTEngine() {
  if (!sttEngine) {
    sttEngine = new STTEngine({ lang: 'en-US', continuous: true });
    wireEngineToStore(sttEngine);
  }
  return sttEngine;
}

export function startSTTSession() {
  const store = useStore.getState();
  store.startTranslation();

  try {
    getSTTEngine().start();
  } catch (error) {
    store.stopTranslation();
    throw error;
  }
}

export function stopSTTSession() {
  getSTTEngine().stop();
  useStore.getState().stopTranslation();
}

export function isSTTSupported() {
  return STTEngine.isSupported();
}

function wireEngineToStore(engine) {
  engine
    .onInterim((text) => {
      useStore.getState().updateCurrentInterim({ en: text });
    })
    .onFinal((text) => {
      const now = Date.now();
      useStore.getState().appendSubtitle({
        timestamp: now,
        en: text,
        zh: '等待翻译引擎接入...',
        corrected: false,
        correctionType: null,
        termsApplied: [],
      });
    })
    .onError((error) => {
      console.warn('[STT] recognition error:', error);
    })
    .onEnd(() => {
      const { isRunning } = useStore.getState();
      if (!isRunning) {
        useStore.getState().updateCurrentInterim({ en: '', zh: '' });
      }
    });
}
