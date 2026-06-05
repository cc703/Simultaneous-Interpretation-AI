import { nanoid } from 'nanoid';
import { create } from 'zustand';

const formatTimeLabel = (timestamp, sessionStartTime) => {
  const elapsed = Math.max(0, Math.floor((timestamp - sessionStartTime) / 1000));
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const normalizeSubtitle = (entry, state) => {
  const timestamp = entry.timestamp ?? Date.now();

  return {
    id: entry.id ?? nanoid(),
    timestamp,
    timeLabel: entry.timeLabel ?? formatTimeLabel(timestamp, state.sessionStartTime),
    en: entry.en ?? '',
    zh: entry.zh ?? '',
    corrected: entry.corrected ?? false,
    correctionType: entry.correctionType ?? null,
    termsApplied: entry.termsApplied ?? [],
    isCurrent: entry.isCurrent ?? true,
  };
};

export const useStore = create((set, get) => ({
  // 音频源
  sourceMode: 'demo',
  uploadedFile: null,
  isCapturing: false,
  demoEnabled: false,

  // AI Provider 配置
  provider: 'deepseek',
  apiKey: '',
  baseUrl: '',

  // 运行状态
  isRunning: false,
  sessionStartTime: Date.now(),
  elapsedTime: 0,
  latencyMs: 0,

  // 字幕数据
  subtitles: [],
  currentInterim: { en: '', zh: '' },

  // 翻译修正能力
  glossary: [],
  correctionHistory: [],
  selectedSubtitleId: null,

  // 字幕显示设置
  subtitleMode: 'bilingual',
  showBanner: true,
  showOriginal: true,
  autoCorrect: true,
  voiceOutput: false,

  // 统计
  totalSentences: 0,
  totalChars: 0,
  correctionCount: 0,

  setSourceMode: (sourceMode) => set({
    sourceMode,
    demoEnabled: sourceMode === 'demo',
  }),
  setUploadedFile: (uploadedFile) => set({ uploadedFile }),
  setIsCapturing: (isCapturing) => set({ isCapturing }),

  setProvider: (provider) => set({ provider }),
  setApiKey: (apiKey) => set({ apiKey }),
  setBaseUrl: (baseUrl) => set({ baseUrl }),

  startTranslation: () => set({
    isRunning: true,
    sessionStartTime: Date.now(),
    elapsedTime: 0,
    latencyMs: 0,
    subtitles: [],
    currentInterim: { en: '', zh: '' },
    selectedSubtitleId: null,
  }),
  stopTranslation: () => set({
    isRunning: false,
    isCapturing: false,
    currentInterim: { en: '', zh: '' },
  }),

  appendSubtitle: (entry) => set((state) => {
    const subtitle = normalizeSubtitle(entry, state);
    const subtitles = state.subtitles.map((item) => ({ ...item, isCurrent: false }));

    return {
      subtitles: [...subtitles, subtitle],
      currentInterim: { en: '', zh: '' },
      totalSentences: state.totalSentences + 1,
      totalChars: state.totalChars + subtitle.en.length + subtitle.zh.length,
    };
  }),

  updateCurrentInterim: (nextInterim) => set((state) => ({
    currentInterim: {
      ...state.currentInterim,
      ...nextInterim,
    },
  })),

  correctLastSubtitle: (newZh, type = 'auto', reason = '上下文自动修正') => {
    const last = [...get().subtitles].reverse().find((subtitle) => subtitle.zh);
    if (!last) return;
    get().updateSubtitleTranslation(last.id, newZh, type, reason);
  },

  updateSubtitleTranslation: (
    id,
    newZh,
    type = 'manual',
    reason = '用户手动修正',
    termsApplied = undefined,
  ) => set((state) => {
    const target = state.subtitles.find((subtitle) => subtitle.id === id);
    if (!target) return state;

    return {
      subtitles: state.subtitles.map((subtitle) => (
        subtitle.id === id
          ? {
            ...subtitle,
            zh: newZh,
            corrected: true,
            correctionType: type,
            termsApplied: termsApplied ?? subtitle.termsApplied,
          }
          : subtitle
      )),
      correctionCount: state.correctionCount + 1,
      correctionHistory: [
        ...state.correctionHistory,
        {
          id: nanoid(),
          subtitleId: id,
          beforeZh: target.zh,
          afterZh: newZh,
          type,
          reason,
          createdAt: Date.now(),
        },
      ],
    };
  }),

  selectSubtitle: (id) => set({ selectedSubtitleId: id }),

  retranslateSubtitle: (id) => {
    const state = get();
    const subtitle = state.subtitles.find((item) => item.id === id);
    if (!subtitle) return;

    const hits = state.glossary.filter((term) => (
      term.enabled && subtitle.en.toLowerCase().includes(term.source.toLowerCase())
    ));
    const hitLabels = hits.map((term) => term.source);

    const glossaryNote = hits.length > 0
      ? `\n\n术语已应用：${hits.map((term) => `${term.source} -> ${term.target}`).join('；')}`
      : '\n\n当前没有命中的启用术语。';

    get().updateSubtitleTranslation(
      id,
      `${subtitle.zh.replace(/\n\n术语已应用：.*$/s, '')}${glossaryNote}`,
      hits.length > 0 ? 'glossary' : 'manual',
      hits.length > 0 ? '使用当前术语表重译' : '尝试术语重译但没有命中术语',
      hitLabels,
    );
    set({ selectedSubtitleId: id });
  },

  addGlossaryTerm: ({ source, target, note = '' }) => set((state) => ({
    glossary: [
      ...state.glossary,
      {
        id: nanoid(),
        source,
        target,
        note,
        enabled: true,
        createdAt: Date.now(),
      },
    ],
  })),

  updateGlossaryTerm: (id, updates) => set((state) => ({
    glossary: state.glossary.map((term) => (
      term.id === id ? { ...term, ...updates } : term
    )),
  })),

  removeGlossaryTerm: (id) => set((state) => ({
    glossary: state.glossary.filter((term) => term.id !== id),
  })),

  applyDemoTranscript: (entries = []) => set((state) => {
    const subtitles = entries.map((entry) => normalizeSubtitle(entry, state));
    const totalChars = subtitles.reduce((sum, item) => sum + item.en.length + item.zh.length, 0);

    return {
      sourceMode: 'demo',
      demoEnabled: true,
      subtitles,
      glossary: state.glossary,
      selectedSubtitleId: subtitles.find((subtitle) => subtitle.isCurrent)?.id ?? subtitles.at(-1)?.id ?? null,
      totalSentences: subtitles.length,
      totalChars,
      currentInterim: { en: '', zh: '' },
    };
  }),

  setSubtitleMode: (subtitleMode) => set({ subtitleMode }),
  setShowBanner: (showBanner) => set({ showBanner }),
  setShowOriginal: (showOriginal) => set({ showOriginal }),
  setAutoCorrect: (autoCorrect) => set({ autoCorrect }),
  setVoiceOutput: (voiceOutput) => set({ voiceOutput }),

  resetSession: () => set({
    uploadedFile: null,
    isCapturing: false,
    demoEnabled: false,
    isRunning: false,
    sessionStartTime: Date.now(),
    elapsedTime: 0,
    latencyMs: 0,
    subtitles: [],
    currentInterim: { en: '', zh: '' },
    correctionHistory: [],
    selectedSubtitleId: null,
    totalSentences: 0,
    totalChars: 0,
    correctionCount: 0,
  }),
}));
