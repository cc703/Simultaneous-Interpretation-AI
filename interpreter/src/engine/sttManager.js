import { useStore } from '../store/index.js';
import { STTEngine } from './stt.js';
import { translateTranscriptText } from './asrAdapter.js';
import { cancelTTS } from './tts.js';

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
  cancelTTS();
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
    .onFinal(async (text) => {
      try {
        await translateTranscriptText(text);
      } catch (error) {
        console.warn('[translator] translation failed:', error);
        useStore.getState().updateCurrentInterim({
          en: text,
          zh: error.message || '翻译请求失败，请检查 Provider、Key 或网络。',
        });
      }
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
