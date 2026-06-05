import { useStore } from '../store/index.js';
import { demoTranscript } from '../mock/demoTranscript.js';

let timers = [];

export function startDemoStream({ speed = 0.45 } = {}) {
  stopDemoStream();

  const store = useStore.getState();
  store.startTranslation();
  store.setSourceMode('demo');

  demoTranscript.forEach((entry, index) => {
    const timer = window.setTimeout(() => {
      const timestamp = Date.now();
      useStore.getState().appendSubtitle({
        timestamp,
        en: entry.en,
        zh: entry.zh,
        corrected: Boolean(entry.termsApplied?.length),
        correctionType: entry.termsApplied?.length ? 'glossary' : null,
        termsApplied: entry.termsApplied ?? [],
      });

      if (index === demoTranscript.length - 1) {
        useStore.getState().stopTranslation();
      }
    }, Math.round(entry.startMs * speed));

    timers.push(timer);
  });
}

export function stopDemoStream() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
}

export function getDemoTranscript() {
  return demoTranscript;
}
