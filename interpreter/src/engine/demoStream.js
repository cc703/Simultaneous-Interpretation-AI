import { useStore } from '../store/index.js';
import { demoTranscript } from '../mock/demoTranscript.js';
import { enqueueTTS, speakOnce } from './tts.js';

let timers = [];
let fileStopper = null;

export function startDemoStream({ speed = 0.45 } = {}) {
  stopDemoStream();

  const store = useStore.getState();
  store.startTranslation();
  store.setSourceMode('demo');

  demoTranscript.forEach((entry, index) => {
    const timer = window.setTimeout(() => {
      releaseDemoCaption(entry, {
        onDone: () => {
          if (index === demoTranscript.length - 1) {
            useStore.getState().stopTranslation();
          }
        },
      });
    }, Math.round(entry.startMs * speed));

    timers.push(timer);
  });
}

export function stopDemoStream() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
  if (fileStopper) {
    fileStopper();
    fileStopper = null;
  }
}

export function getDemoTranscript() {
  return demoTranscript;
}

export function startFileDemoStream(audioElement) {
  stopDemoStream();

  if (!audioElement) {
    throw new Error('Missing audio element for file demo stream.');
  }

  const store = useStore.getState();
  store.startTranslation();
  store.setSourceMode('file');

  const emitted = new Set();
  const releaseDueCaptions = () => {
    const currentMs = audioElement.currentTime * 1000;

    demoTranscript.forEach((entry, index) => {
      if (emitted.has(index) || currentMs < entry.startMs) return;
      emitted.add(index);
      releaseDemoCaption(entry);
    });
  };

  const handleEnded = () => {
    releaseDueCaptions();
    useStore.getState().stopTranslation();
  };

  audioElement.addEventListener('timeupdate', releaseDueCaptions);
  audioElement.addEventListener('ended', handleEnded);
  audioElement.currentTime = 0;
  audioElement.play().catch((error) => {
    console.warn('[demoStream] audio playback failed:', error);
  });

  fileStopper = () => {
    audioElement.pause();
    audioElement.removeEventListener('timeupdate', releaseDueCaptions);
    audioElement.removeEventListener('ended', handleEnded);
  };
}

function releaseDemoCaption(entry, { onDone } = {}) {
  const startedAt = performance.now();
  speakOnce(entry.en, { lang: 'en-US', rate: 1.05 });
  useStore.getState().updateCurrentInterim({
    en: entry.en,
    zh: '正在生成中文同传...',
  });

  const chunks = splitChineseChunks(entry.zh);
  let partial = '';

  chunks.forEach((chunk, index) => {
    const timer = window.setTimeout(() => {
      partial += chunk;
      useStore.getState().updateCurrentInterim({
        en: entry.en,
        zh: partial,
      });

      if (index === chunks.length - 1) {
        useStore.getState().appendSubtitle({
          timestamp: Date.now(),
          en: entry.en,
          zh: entry.zh,
          corrected: Boolean(entry.termsApplied?.length),
          correctionType: entry.termsApplied?.length ? 'glossary' : null,
          termsApplied: entry.termsApplied ?? [],
        });
        if (useStore.getState().voiceOutput) enqueueTTS(entry.zh);
        useStore.setState({ latencyMs: Math.round(performance.now() - startedAt) });
        onDone?.();
      }
    }, 180 + index * 110);
    timers.push(timer);
  });
}

function splitChineseChunks(text) {
  const chunks = text.match(/.{1,4}/gu);
  return chunks?.length ? chunks : [text];
}
