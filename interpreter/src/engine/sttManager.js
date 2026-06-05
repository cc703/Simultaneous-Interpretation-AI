import { useStore } from '../store/index.js';
import { STTEngine } from './stt.js';
import {
  buildContext,
  buildCorrectionMemoryPrompt,
  buildGlossaryPrompt,
  streamTranslate,
} from './translator.js';
import { cancelTTS, enqueueTTS } from './tts.js';

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
      const now = Date.now();
      const startedAt = performance.now();
      const store = useStore.getState();
      let translatedText = '';

      try {
        for await (const token of streamTranslate({
          text,
          context: buildContext(store.subtitles, store.contextWindow),
          glossary: store.terminologyBoost ? buildGlossaryPrompt(store.glossary) : '',
          correctionMemory: store.autoCorrect
            ? buildCorrectionMemoryPrompt(store.correctionHistory, store.subtitles)
            : '',
          targetLanguage: store.targetLanguage,
          translationStyle: store.translationStyle,
          provider: store.provider,
          apiKey: store.apiKey,
          baseUrl: store.baseUrl,
          onToken: (tokenText) => {
            translatedText += tokenText;
            useStore.getState().updateCurrentInterim({ en: text, zh: translatedText });
          },
        })) {
          void token;
        }
      } catch (error) {
        console.warn('[translator] translation skipped:', error);
        translatedText = store.apiKey
          ? '翻译请求失败，请检查 Provider、Key 或网络。'
          : '等待填写 API Key 后接入实时中文翻译。';
      }

      useStore.getState().appendSubtitle({
        timestamp: now,
        en: text,
        zh: translatedText,
        corrected: false,
        correctionType: null,
        termsApplied: [],
      });
      if (useStore.getState().voiceOutput) enqueueTTS(translatedText);
      useStore.setState({ latencyMs: Math.round(performance.now() - startedAt) });
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
