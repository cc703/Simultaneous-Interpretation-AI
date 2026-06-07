import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Captions,
  ClipboardCheck,
  FileAudio,
  Mic,
  Radio,
  Settings,
  Sparkles,
  Languages,
  ListChecks,
  PlayCircle,
  ChevronDown,
  Upload,
  Wand2,
} from 'lucide-react';
import { mockGlossary } from './mock/subtitles.js';
import { demoScenarios, getDemoScenario } from './mock/demoTranscript.js';
import {
  isSTTSupported,
  startDemoStream,
  startElementAnalyser,
  startStreamAnalyser,
  startSTTSession,
  startSystemAudioCapture,
  startLiveASR,
  stopAudioAnalyser,
  stopDemoStream,
  stopLiveASR,
  stopSTTSession,
  transcribeAudioFile,
  translateTranscriptTimed,
  stopFileASRStream,
  stopSystemAudioCapture,
  initTTS,
  cancelTTS,
  getTTSStats,
  resetTTSStats,
  setTTSEnabled,
  setTTSLanguage,
  setTTSRate,
} from './engine/index.js';
import { useStore } from './store/index.js';
import { copyBilingual, exportSRT } from './utils/export.js';
import { buildCorrectionMemory, summarizeQuality } from './utils/quality.js';
import { getServerHealth } from './engine/serverApi.js';

const SAMPLE_FILE = {
  name: 'sample-english-speech.wav',
  type: 'audio/wav',
  path: '/demo-media/sample-english-speech.wav',
};

const SAMPLE_TRANSCRIPT = [
  'Good morning everyone, welcome to our global AI product launch.',
  'Today we will show how real-time translation reduces the latency budget for online meetings.',
  'If a phrase is translated incorrectly, the user can correct it immediately.',
  'At the end, the bilingual transcript can be exported for review.',
].join(' ');

function createLiveStats() {
  return {
    queued: 0,
    processed: 0,
    skipped: 0,
    duplicates: 0,
    lastLatencyMs: 0,
    speechRateWpm: 0,
    speechRateLevel: 'normal',
    windowDurationSec: 0,
    lastWords: 0,
    overloads: 0,
    backlog: 0,
    asrUnstable: 0,
  };
}

const TARGET_LANGUAGES = [
  { value: 'zh-CN', zh: '中文', en: 'Chinese' },
  { value: 'zh-TW', zh: '繁体中文', en: 'Traditional Chinese' },
  { value: 'en', zh: '英文', en: 'English' },
  { value: 'ja', zh: '日文', en: 'Japanese' },
  { value: 'ko', zh: '韩文', en: 'Korean' },
  { value: 'fr', zh: '法文', en: 'French' },
  { value: 'es', zh: '西班牙文', en: 'Spanish' },
];

const SOURCE_LANGUAGES = [
  { value: 'auto', zh: '自动检测', en: 'Auto detect' },
  { value: 'en', zh: '英文', en: 'English' },
  { value: 'zh-CN', zh: '中文', en: 'Chinese' },
  { value: 'ja', zh: '日文', en: 'Japanese' },
  { value: 'ko', zh: '韩文', en: 'Korean' },
  { value: 'fr', zh: '法文', en: 'French' },
  { value: 'es', zh: '西班牙文', en: 'Spanish' },
];

const UI_COPY = {
  zh: {
    productSubtitle: '题目二 · AI 同声传译助手',
    engineChecking: '引擎检查中',
    engineOnline: 'AI 引擎在线',
    settings: '设置',
    export: '导出',
    copy: '复制',
    overlay: '浮窗',
    source: '输入源',
    demoPreset: '演示场景 / 术语预设',
    demoPresetHint: '仅用于内置演示：切换样本内容与场景术语。',
    demo: '演示',
    mic: '麦克风',
    file: '文件',
    live: '直播',
    start: '开始同传',
    stop: '停止同传',
    sample: '加载样本',
    sampleLoading: '样本加载中',
    upload: '上传音频/视频',
    chooseLive: '选择直播音频',
    stopLive: '停止直播捕获',
    subtitles: '字幕',
    sourceLanguage: '源语言',
    autoDetect: '自动检测',
    targetLanguage: '目标语言',
    bilingual: '双语',
    targetOnly: '目标语言',
    sourceOnly: '检测语言',
    latency: '延迟',
    context: '上下文',
    asr: 'ASR',
    workflowListen: '听音接入',
    workflowSegment: '语音切分',
    workflowUnderstand: '语义理解',
    workflowReformulate: '转译重组',
    workflowOutput: '字幕输出',
    workflowCorrect: '修正沉淀',
    ready: '待开始',
    readyBadge: '等待输入',
    readySource: 'Click Start Interpreting to play or capture English audio.',
    readyZh: '选择文件或直播源后点击开始，字幕会按时间逐句出现。',
    liveNoAsrTitle: '直播音频已就绪，但 ASR 未配置。',
    liveNoAsrBody: '请在设置中配置 ASR Key，或启动带 DASHSCOPE_API_KEY / OPENAI_API_KEY 的本地后端；系统不会生成假字幕。',
    liveNeedAudioTitle: '请选择带音频的直播标签页或屏幕。',
    liveNeedAudioBody: '点击“选择直播音频”，在浏览器弹窗中勾选共享标签页音频；如果只共享画面，系统会明确提示并不会伪装翻译。',
    recognizing: '识别中',
    correction: '翻译修正',
    saveCorrection: '保存修正',
    correctionSaved: '已保存到人工确认记忆',
    retranslate: '术语重译',
    currentSubtitle: '当前字幕',
    translated: '字幕',
    corrections: '修正',
    glossary: '术语',
    provider: '引擎',
    liveBoundary: 'Live 默认 2-3 秒低延迟语音窗；处理耗时按毫秒统计，但端到端仍受 ASR、翻译和网络影响。',
    liveUse: '适用于网页直播、社交直播、媒体直播和线上会议。',
    overlayHint: '打开字幕浮窗后，可以切到直播/会议页面观看，字幕会继续同步。',
    controlDesk: '同传控制台',
    streamInput: '实时音频流',
    segmentEngine: '语义分段',
    autoRevision: '自动回修',
    accuracyFeedback: '同传质量',
    noFormatRisk: '未发现格式风险',
    speechRate: '语速检测',
    fastSpeech: '语速偏快',
    speechOverload: '语速过快',
    unstableAsr: 'ASR 不稳定',
    humanMemory: '人工确认',
    advancedSettings: '高级设置',
    advancedHint: '这些配置会影响后续识别、翻译和播报。',
    close: '关闭',
  },
  en: {
    productSubtitle: 'Topic 2 · AI simultaneous interpretation assistant',
    engineChecking: 'Checking engine',
    engineOnline: 'AI engine online',
    settings: 'Settings',
    export: 'Export',
    copy: 'Copy',
    overlay: 'Overlay',
    source: 'Source',
    demoPreset: 'Demo scene / glossary preset',
    demoPresetHint: 'For built-in demo only: switches sample content and scenario terms.',
    demo: 'Demo',
    mic: 'Mic',
    file: 'File',
    live: 'Live',
    start: 'Start',
    stop: 'Stop',
    sample: 'Load sample',
    sampleLoading: 'Loading',
    upload: 'Upload audio/video',
    chooseLive: 'Choose live audio',
    stopLive: 'Stop live capture',
    subtitles: 'Captions',
    sourceLanguage: 'Source',
    autoDetect: 'Auto detect',
    targetLanguage: 'Target',
    bilingual: 'Bilingual',
    targetOnly: 'Target',
    sourceOnly: 'Detected',
    latency: 'Latency',
    context: 'Context',
    asr: 'ASR',
    workflowListen: 'Listen',
    workflowSegment: 'Segment',
    workflowUnderstand: 'Understand',
    workflowReformulate: 'Reformulate',
    workflowOutput: 'Caption',
    workflowCorrect: 'Correct',
    ready: 'Ready',
    readyBadge: 'Waiting',
    readySource: 'Click Start Interpreting to play or capture English audio.',
    readyZh: 'Select a file or live source, then captions will appear line by line.',
    liveNoAsrTitle: 'Live audio is ready, but ASR is not configured.',
    liveNoAsrBody: 'Configure an ASR key in Settings or start the local gateway with DASHSCOPE_API_KEY / OPENAI_API_KEY. The app will not generate fake captions.',
    liveNeedAudioTitle: 'Choose a stream tab or screen with audio.',
    liveNeedAudioBody: 'Click Choose live audio, then enable tab audio sharing in the browser picker. If only video is shared, the app reports the gap instead of pretending to translate.',
    recognizing: 'Recognizing',
    correction: 'Correction',
    saveCorrection: 'Save',
    correctionSaved: 'Saved to human memory',
    retranslate: 'Retranslate',
    currentSubtitle: 'Current subtitle',
    translated: 'Captions',
    corrections: 'Corrections',
    glossary: 'Glossary',
    provider: 'Provider',
    liveBoundary: 'Live defaults to 1s low-latency chunks. Processing is tracked in milliseconds, while end-to-end delay still depends on ASR, translation, and network.',
    liveUse: 'For web streams, social live rooms, media streams, and online meetings.',
    overlayHint: 'Open the caption overlay, then switch back to the stream tab. Captions keep syncing.',
    controlDesk: 'Interpretation control',
    streamInput: 'Live audio stream',
    segmentEngine: 'Semantic segmentation',
    autoRevision: 'Auto revision',
    accuracyFeedback: 'Quality feedback',
    noFormatRisk: 'No detected format risk',
    speechRate: 'Speech rate',
    fastSpeech: 'Fast speech',
    speechOverload: 'Speech overload',
    unstableAsr: 'Unstable ASR',
    humanMemory: 'Human memory',
    advancedSettings: 'Advanced settings',
    advancedHint: 'These settings affect later recognition, translation, and voice output.',
    close: 'Close',
  },
};

export default function App() {
  const isRunning = useStore((state) => state.isRunning);
  const latencyMs = useStore((state) => state.latencyMs);
  const currentInterim = useStore((state) => state.currentInterim);
  const sourceMode = useStore((state) => state.sourceMode);
  const demoScenarioId = useStore((state) => state.demoScenarioId);
  const asrApiKey = useStore((state) => state.asrApiKey);
  const asrBaseUrl = useStore((state) => state.asrBaseUrl);
  const asrModel = useStore((state) => state.asrModel);
  const sourceLanguage = useStore((state) => state.sourceLanguage);
  const targetLanguage = useStore((state) => state.targetLanguage);
  const translationStyle = useStore((state) => state.translationStyle);
  const contextWindow = useStore((state) => state.contextWindow);
  const chunkSeconds = useStore((state) => state.chunkSeconds);
  const terminologyBoost = useStore((state) => state.terminologyBoost);
  const subtitleMode = useStore((state) => state.subtitleMode);
  const showBanner = useStore((state) => state.showBanner);
  const showOriginal = useStore((state) => state.showOriginal);
  const autoCorrect = useStore((state) => state.autoCorrect);
  const voiceOutput = useStore((state) => state.voiceOutput);
  const ttsRate = useStore((state) => state.ttsRate);
  const ttsQuality = useStore((state) => state.ttsQuality);
  const captureStream = useStore((state) => state.captureStream);
  const captureSourceLabel = useStore((state) => state.captureSourceLabel);
  const isCapturing = useStore((state) => state.isCapturing);
  const subtitles = useStore((state) => state.subtitles);
  const glossary = useStore((state) => state.glossary);
  const correctionCount = useStore((state) => state.correctionCount);
  const correctionHistory = useStore((state) => state.correctionHistory);
  const selectedSubtitleId = useStore((state) => state.selectedSubtitleId);
  const setSourceMode = useStore((state) => state.setSourceMode);
  const setDemoScenarioId = useStore((state) => state.setDemoScenarioId);
  const setAsrApiKey = useStore((state) => state.setAsrApiKey);
  const setAsrBaseUrl = useStore((state) => state.setAsrBaseUrl);
  const setAsrModel = useStore((state) => state.setAsrModel);
  const setSourceLanguage = useStore((state) => state.setSourceLanguage);
  const setTargetLanguage = useStore((state) => state.setTargetLanguage);
  const setTranslationStyle = useStore((state) => state.setTranslationStyle);
  const setContextWindow = useStore((state) => state.setContextWindow);
  const setChunkSeconds = useStore((state) => state.setChunkSeconds);
  const setTerminologyBoost = useStore((state) => state.setTerminologyBoost);
  const setSubtitleMode = useStore((state) => state.setSubtitleMode);
  const setShowBanner = useStore((state) => state.setShowBanner);
  const setShowOriginal = useStore((state) => state.setShowOriginal);
  const setAutoCorrect = useStore((state) => state.setAutoCorrect);
  const setVoiceOutput = useStore((state) => state.setVoiceOutput);
  const setStoreTtsRate = useStore((state) => state.setTtsRate);
  const setTtsQuality = useStore((state) => state.setTtsQuality);
  const setUploadedFile = useStore((state) => state.setUploadedFile);
  const setCaptureStream = useStore((state) => state.setCaptureStream);
  const addGlossaryTerm = useStore((state) => state.addGlossaryTerm);
  const replaceGlossaryTerms = useStore((state) => state.replaceGlossaryTerms);
  const selectSubtitle = useStore((state) => state.selectSubtitle);
  const updateSubtitleTranslation = useStore((state) => state.updateSubtitleTranslation);
  const retranslateSubtitle = useStore((state) => state.retranslateSubtitle);
  const [draftZh, setDraftZh] = useState('');
  const [termSource, setTermSource] = useState('');
  const [termTarget, setTermTarget] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileMeta, setFileMeta] = useState(null);
  const [fileStatus, setFileStatus] = useState('');
  const [fileStage, setFileStage] = useState('idle');
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [liveStage, setLiveStage] = useState('idle');
  const [liveStats, setLiveStats] = useState(createLiveStats);
  const [serverHealth, setServerHealth] = useState({ ok: false, hasOpenAIKey: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captionOverlayOpen, setCaptionOverlayOpen] = useState(false);
  const [correctionSavedMessage, setCorrectionSavedMessage] = useState('');
  const [configTab, setConfigTab] = useState('translate');
  const [uiLanguage, setUiLanguage] = useState('zh');
  const audioRef = useRef(null);
  const testLiveAudioRef = useRef(null);
  const testLiveAudioContextRef = useRef(null);
  const captionWindowRef = useRef(null);
  const subtitleScrollRef = useRef(null);
  const copy = UI_COPY[uiLanguage];
  const displaySubtitles = subtitles;
  const visibleSubtitles = useMemo(() => [...displaySubtitles].reverse(), [displaySubtitles]);
  const hasSubtitles = displaySubtitles.length > 0;
  const activeDemoScenario = getDemoScenario(demoScenarioId);
  const hasServerAsrKey = Boolean(serverHealth.ok && (serverHealth.hasAsrKey ?? serverHealth.hasOpenAIKey));
  const hasServerTranslationKey = Boolean(serverHealth.ok && (serverHealth.hasTranslationKey ?? serverHealth.hasOpenAIKey));
  const hasLiveAsr = Boolean(asrApiKey.trim() || hasServerAsrKey);
  const effectiveChunkSeconds = Math.max(2, Number(chunkSeconds) || 3);
  const interimIsDiagnostic = isDiagnosticInterim(currentInterim);
  const nextAction = getNextAction({
    sourceMode,
    fileMeta,
    asrApiKey,
    serverHasApiKey: hasServerAsrKey,
    serverHasTranslationKey: hasServerTranslationKey,
    hasSubtitles,
    correctionCount,
    isRunning,
  });
  const qualitySummary = useMemo(
    () => summarizeQuality(displaySubtitles, glossary),
    [displaySubtitles, glossary],
  );
  const correctionMemory = useMemo(
    () => buildCorrectionMemory(correctionHistory, displaySubtitles),
    [correctionHistory, displaySubtitles],
  );
  const autoRevisionCount = useMemo(
    () => displaySubtitles.filter((subtitle) => subtitle.correctionType === 'auto').length,
    [displaySubtitles],
  );
  const emptySubtitleState = useMemo(() => getEmptySubtitleState({
    copy,
    sourceMode,
    fileMeta,
    liveStage,
    liveStatus,
    hasLiveAsr,
    isCapturing,
  }), [copy, sourceMode, fileMeta, liveStage, liveStatus, hasLiveAsr, isCapturing]);
  const selectedSubtitle = useMemo(() => (
    displaySubtitles.find((subtitle) => subtitle.id === selectedSubtitleId)
      ?? displaySubtitles.find((subtitle) => subtitle.isCurrent)
      ?? displaySubtitles.at(-1)
      ?? {
        id: 'empty',
        en: 'No subtitle selected yet.',
        zh: '点击 Start Interpreting 后，字幕会按时间逐句出现。',
        termsApplied: [],
      }
  ), [displaySubtitles, selectedSubtitleId]);
  const hasSelectedSubtitle = selectedSubtitle.id !== 'empty';
  const subtitlePreviewText = subtitleMode === 'en-only'
    ? (currentInterim.en || (hasSelectedSubtitle ? selectedSubtitle.en : ''))
    : (!interimIsDiagnostic && currentInterim.zh
      ? currentInterim.zh
      : (hasSelectedSubtitle ? selectedSubtitle.zh : ''));
  const showSubtitlePreview = showBanner
    && Boolean(subtitlePreviewText)
    && (hasSubtitles || !interimIsDiagnostic || subtitleMode === 'en-only');
  const latestSubtitle = useMemo(() => (
    displaySubtitles.find((subtitle) => subtitle.isCurrent)
      ?? displaySubtitles.at(-1)
      ?? null
  ), [displaySubtitles]);
  const captionOverlayPayload = useMemo(() => buildCaptionOverlayPayload({
    copy,
    currentInterim,
    latestSubtitle,
    subtitleMode,
    sourceLanguage,
    targetLanguage,
    sourceMode,
    captureSourceLabel,
    liveStage,
    liveStats,
    isCapturing,
  }), [
    copy,
    currentInterim,
    latestSubtitle,
    subtitleMode,
    sourceLanguage,
    targetLanguage,
    sourceMode,
    captureSourceLabel,
    liveStage,
    liveStats,
    isCapturing,
  ]);

  useEffect(() => {
    if (glossary.length === 0) {
      mockGlossary.forEach((term) => addGlossaryTerm(term));
    }
  }, [addGlossaryTerm, glossary.length]);

  useEffect(() => {
    initTTS();
  }, []);

  useEffect(() => {
    if (!latestSubtitle?.id) return;
    selectSubtitle(latestSubtitle.id);
    window.requestAnimationFrame(() => {
      const activeCard = subtitleScrollRef.current?.querySelector('[data-current-subtitle="true"]');
      activeCard?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [latestSubtitle?.id, selectSubtitle]);

  useEffect(() => {
    getServerHealth({ refresh: true }).then(setServerHealth);
  }, []);

  useEffect(() => {
    setTTSEnabled(voiceOutput);
  }, [voiceOutput]);

  useEffect(() => {
    setTTSLanguage(targetLanguage);
  }, [targetLanguage]);

  useEffect(() => {
    setTTSRate(ttsRate);
  }, [ttsRate]);

  useEffect(() => {
    setDraftZh(selectedSubtitle?.zh ?? '');
  }, [selectedSubtitle?.id, selectedSubtitle?.zh]);

  useEffect(() => {
    updateCaptionOverlay(captionWindowRef.current, captionOverlayPayload);
  }, [captionOverlayPayload]);

  useEffect(() => () => {
    if (captionWindowRef.current && !captionWindowRef.current.closed) {
      captionWindowRef.current.close();
    }
  }, []);

  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const handleRunClick = async () => {
    if (isRunning) {
      if (sourceMode === 'demo' || sourceMode === 'file') {
        stopDemoStream();
        stopFileASRStream();
        stopAudioAnalyser();
        cancelTTS();
        audioRef.current?.pause();
        useStore.getState().stopTranslation();
      } else {
        stopAudioAnalyser();
        cancelTTS();
        stopLiveASR();
        stopSystemAudioCapture(captureStream);
        setCaptureStream(null, '');
        setLiveStage('paused');
        setLiveStatus('直播捕获已停止，正在收尾处理最后一段字幕。');
        setLiveStats(createLiveStats());
        stopSTTSession();
      }
      return;
    }

    if (sourceMode === 'mic') {
      startSTTSession();
      return;
    }

    if (sourceMode === 'file') {
      startElementAnalyser(audioRef.current);
      await startFileInterpretation();
      return;
    }

    if (sourceMode === 'live') {
      await handleLiveCapture();
      return;
    }

    startDemoStream();
  };

  const handleDemoScenarioChange = (scenario) => {
    if (isRunning) return;
    setSourceMode('demo');
    setDemoScenarioId(scenario.id);
    replaceGlossaryTerms(scenario.terms);
  };

  const startFileInterpretation = async () => {
    const file = useStore.getState().uploadedFile;
    if (!file) {
      setFileStatus('请先上传一个音频或视频文件。');
      setFileStage('error');
      return;
    }

    const hasServerAsr = hasServerAsrKey;
    const isBundledSample = file.name === SAMPLE_FILE.name;
    if (!asrApiKey.trim() && !hasServerAsr && isBundledSample) {
      audioRef.current?.play().catch((error) => console.warn('[file] preview playback failed:', error));
      useStore.getState().startTranslation();
      setFileStage('asr');
      setFileStatus('同传流程：听音接入完成，正在读取内置样本转写。');
      useStore.getState().updateCurrentInterim({
        en: SAMPLE_FILE.name,
        zh: '正在读取内置样本英文转写...',
      });
      await new Promise((resolve) => setTimeout(resolve, 450));
      setFileStage('translate');
      setFileStatus('语音切分完成，正在按播放进度进行理解、转译和字幕输出。');
      await translateTranscriptTimed(SAMPLE_TRANSCRIPT, {
        audioElement: audioRef.current,
        totalDurationSec: audioRef.current?.duration || 8,
      });
      setFileStage('done');
      setFileStatus('同传闭环完成：听音 -> 切分 -> 理解 -> 转译 -> 字幕 -> 修正导出。');
      useStore.getState().stopTranslation();
      return;
    }

    if (!asrApiKey.trim() && !hasServerAsr) {
      setFileStatus('未配置 ASR Key，普通上传文件无法真实转写。请填写 ASR API Key，或启动带 DASHSCOPE_API_KEY / OPENAI_API_KEY 的后端。');
      setFileStage('error');
      return;
    }

    const audio = audioRef.current;
    useStore.getState().startTranslation();
    setFileStage('asr');
    setFileStatus(hasServerAsr && !asrApiKey.trim()
      ? '听音接入中：正在通过本地后端代理调用真实 ASR...'
      : '听音接入中：正在调用真实 ASR 转写文件音频...');
    useStore.getState().updateCurrentInterim({
      en: file.name,
      zh: '正在听音并切分源语言音频...',
    });

    try {
      setFileStage('translate');
      setFileStatus('正在对媒体音频做真实 ASR 预处理；完成后会按播放进度同步释放中文字幕，保证同传体验连续。');
      const transcript = await transcribeAudioFile({
        file,
        apiKey: asrApiKey,
        baseUrl: asrBaseUrl,
        model: asrModel,
      });
      setFileStatus('真实 ASR 已完成，正在播放媒体并按时间轴输出同传字幕。');
      if (audio) {
        audio.currentTime = 0;
        await audio.play();
      }
      await translateTranscriptTimed(transcript, {
        audioElement: audio,
        totalDurationSec: audio?.duration || 0,
      });
      setFileStage('done');
      setFileStatus('同传闭环完成：听音 -> 切分 -> 理解 -> 转译 -> 字幕 -> 修正导出。');
    } catch (error) {
      console.warn('[file-asr] failed:', error);
      setFileStage('error');
      setFileStatus(error.message || '真实 ASR 失败，请检查 Key、模型或网络。');
      useStore.getState().updateCurrentInterim({
        en: file.name,
        zh: error.message || '真实 ASR 失败，请检查 Key、模型或网络。',
      });
    } finally {
      stopFileASRStream();
      useStore.getState().stopTranslation();
    }
  };

  const handleSaveCorrection = () => {
    if (!hasSelectedSubtitle || !draftZh.trim()) return;
    updateSubtitleTranslation(
      selectedSubtitle.id,
      draftZh.trim(),
      'manual',
      '用户在修正编辑器中保存译文',
    );
    setCorrectionSavedMessage(copy.correctionSaved);
    window.setTimeout(() => setCorrectionSavedMessage(''), 2200);
  };

  const handleAddTerm = () => {
    if (!termSource.trim() || !termTarget.trim()) return;
    addGlossaryTerm({
      source: termSource.trim(),
      target: termTarget.trim(),
      note: '用户添加',
    });
    setTermSource('');
    setTermTarget('');
  };

  const handleExport = () => {
    if (!hasSubtitles) return;
    exportSRT(displaySubtitles);
  };

  const handleCopy = async () => {
    if (!hasSubtitles) return;
    await copyBilingual(displaySubtitles);
  };

  const handleCaptionOverlay = async () => {
    const existingWindow = captionWindowRef.current;
    if (existingWindow && !existingWindow.closed) {
      existingWindow.close();
      captionWindowRef.current = null;
      setCaptionOverlayOpen(false);
      return;
    }

    try {
      const overlayWindow = await openCaptionOverlayWindow();
      captionWindowRef.current = overlayWindow;
      setCaptionOverlayOpen(true);
      mountCaptionOverlay(overlayWindow, () => {
        captionWindowRef.current = null;
        setCaptionOverlayOpen(false);
      });
      updateCaptionOverlay(overlayWindow, captionOverlayPayload);
    } catch (error) {
      console.warn('[caption-overlay] failed:', error);
    }
  };

  const loadFile = (file, status = '') => {
    if (!file) return;

    stopDemoStream();
    stopAudioAnalyser();
    cancelTTS();
    useStore.getState().stopTranslation();
    useStore.setState({
      subtitles: [],
      currentInterim: { en: '', zh: '' },
      selectedSubtitleId: null,
      totalSentences: 0,
      totalChars: 0,
      latencyMs: 0,
    });
    audioRef.current?.pause();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const nextUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setFileUrl(nextUrl);
    setFileMeta({
      name: file.name,
      type: file.type || 'unknown',
      size: file.size,
      duration: 0,
    });
    setFileStatus(status);
    setFileStage('ready');
    setSourceMode('file');
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleFileChange = (event) => {
    loadFile(event.target.files?.[0]);
  };

  const handleLoadSampleFile = async () => {
    if (isRunning || isSampleLoading) return;

    setIsSampleLoading(true);
    setSourceMode('file');
    setFileStatus('正在加载内置英文样本...');

    try {
      const response = await fetch(SAMPLE_FILE.path);
      if (!response.ok) throw new Error(`样本音频加载失败：${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], SAMPLE_FILE.name, {
        type: blob.type || SAMPLE_FILE.type,
      });
      loadFile(file, '已加载内置英文样本。点击开始同传后，系统会按“听音-切分-理解-转译-输出”的同传流程逐句出字幕。');
    } catch (error) {
      console.warn('[file-sample] failed:', error);
      setFileStage('error');
      setFileStatus(error.message || '内置英文样本加载失败。');
    } finally {
      setIsSampleLoading(false);
    }
  };

  const handleAudioMetadata = () => {
    const duration = audioRef.current?.duration;
    if (!Number.isFinite(duration)) return;
    setFileMeta((current) => current ? { ...current, duration } : current);
  };

  const handleLiveCapture = async () => {
    if (captureStream) {
      stopAudioAnalyser();
      stopLiveASR();
      stopSystemAudioCapture(captureStream);
      setCaptureStream(null, '');
      setLiveStage('paused');
      setLiveStatus('直播捕获已停止。');
      setLiveStats(createLiveStats());
      useStore.getState().stopTranslation();
      return;
    }

    setSourceMode('live');
    setLiveStage('requesting');
    setLiveStats(createLiveStats());
    setLiveStatus('正在请求标签页或屏幕音频权限...');
    const result = await startSystemAudioCapture({
      onAudioStream: ({ audioStream, label }) => {
        setCaptureStream(audioStream, label);
        startStreamAnalyser(audioStream);
      },
      onError: (error) => {
        console.warn('[live-capture] failed:', error);
        setLiveStage('error');
        setLiveStatus(error.message || '直播捕获失败。');
      },
    });
    setCaptureStream(result.audioStream, result.label);
    setLiveStage(hasLiveAsr ? 'asr-ready' : 'captured');
    startStreamAnalyser(result.audioStream);
    startLiveAsrIfReady(result.audioStream);
  };

  const startLiveAsrIfReady = (audioStream, options = {}) => {
    if (!hasLiveAsr) {
      setLiveStage('captured');
      setLiveStatus('Audio captured · ASR not configured。已捕获直播音频，但未配置 ASR Key，不生成直播假字幕。');
      return;
    }

    try {
      setLiveStage('running');
      startLiveASR(audioStream, {
        apiKey: asrApiKey,
        baseUrl: asrBaseUrl,
        model: asrModel,
        chunkMs: effectiveChunkSeconds * 1000,
        forceNoAudioSignal: options.forceNoAudioSignal,
        assumeAudibleSignal: options.assumeAudibleSignal,
        onStatus: setLiveStatus,
        onStats: setLiveStats,
      });
    } catch (error) {
      console.warn('[live-asr] start failed:', error);
      setLiveStage('error');
      setLiveStatus(error.message || 'Live ASR 启动失败。');
    }
  };

  useEffect(() => {
    if (!shouldExposeTestHooks()) return undefined;

    const startInjectedLiveSample = async ({ playbackRate = 1, label, status }) => {
      if (!hasLiveAsr) throw new Error('Live sample test requires ASR key or server ASR key.');
      stopAudioAnalyser();
      stopLiveASR();
      if (testLiveAudioRef.current) {
        testLiveAudioRef.current.pause();
        testLiveAudioRef.current = null;
      }
      if (testLiveAudioContextRef.current) {
        await testLiveAudioContextRef.current.close();
        testLiveAudioContextRef.current = null;
      }

      const audio = new Audio('/demo-media/sample-english-speech.wav');
      audio.crossOrigin = 'anonymous';
      audio.loop = false;
      audio.playbackRate = playbackRate;
      testLiveAudioRef.current = audio;
      await waitForMediaReady(audio);
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);
      testLiveAudioContextRef.current = audioContext;
      const stream = destination.stream;
      if (!stream.getAudioTracks().length) throw new Error('Browser cannot create the sample live audio stream.');

      setSourceMode('live');
      setCaptureStream(stream, label);
      setLiveStage('running');
      setLiveStats(createLiveStats());
      setLiveStatus(status);
      startStreamAnalyser(stream);
      startLiveAsrIfReady(stream, { assumeAudibleSignal: true });
      await audio.play();
      return true;
    };

    window.__SIMULCAST_TEST__ = {
      startLiveSample: () => startInjectedLiveSample({
        label: 'Test-only injected sample media stream / 测试样本音频流',
        status: '正在用样本音频流验证 Live 同传链路...',
      }),
      startFastLiveSample: () => startInjectedLiveSample({
        playbackRate: 2.4,
        label: 'Test-only fast injected sample media stream / 测试快语速样本音频流',
        status: '正在用快语速样本验证 Live 语速检测...',
      }),
      getCaptionOverlayText: () => {
        const overlayWindow = captionWindowRef.current;
        if (!overlayWindow || overlayWindow.closed) return '';
        return overlayWindow.document.getElementById('caption-overlay-root')?.innerText ?? '';
      },
      setFastDiagnosticInterim: () => {
        const diagnostic = '语速过快（260 WPM），正在合并下一语义窗追赶当前讲话。';
        setSourceMode('live');
        setLiveStage('running');
        setLiveStats({
          ...createLiveStats(),
          speechRateWpm: 260,
          speechRateLevel: 'overload',
          asrUnstable: 3,
        });
        setLiveStatus('直播片段 #2-4 音频存在，但语速过快（260 WPM）导致 ASR 未稳定捕获。系统会继续合并下一语义窗并保留上下文，不会按“无音频”处理。');
        useStore.setState({
          isRunning: true,
          currentInterim: {
            en: 'I saw many people taking walks or chatting happily.',
            zh: diagnostic,
          },
          subtitles: [],
          selectedSubtitleId: null,
          sessionStartTime: Date.now(),
        });
        return true;
      },
      getTTSStats,
      resetTTSStats,
      startSilentLiveSample: async () => {
        if (!hasLiveAsr) throw new Error('Silent live sample test requires ASR key or server ASR key.');
        stopAudioAnalyser();
        stopLiveASR();
        if (testLiveAudioContextRef.current) {
          await testLiveAudioContextRef.current.close();
          testLiveAudioContextRef.current = null;
        }

        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        testLiveAudioContextRef.current = audioContext;
        const stream = destination.stream;

        setSourceMode('live');
        setCaptureStream(stream, 'Test-only silent media stream / 测试静音音频流');
        setLiveStage('running');
        setLiveStats(createLiveStats());
        setLiveStatus('正在用静音样本验证 Live 无音频输入提示...');
        startStreamAnalyser(stream);
        startLiveAsrIfReady(stream, { forceNoAudioSignal: true });
        return true;
      },
      stopLiveSample: () => {
        stopAudioAnalyser();
        stopLiveASR();
        if (testLiveAudioRef.current) {
          testLiveAudioRef.current.pause();
          testLiveAudioRef.current = null;
        }
        if (testLiveAudioContextRef.current) {
          testLiveAudioContextRef.current.close();
          testLiveAudioContextRef.current = null;
        }
        const stream = useStore.getState().captureStream;
        stopSystemAudioCapture(stream);
        setCaptureStream(null, '');
        setLiveStage('paused');
        useStore.getState().stopTranslation();
      },
    };

    return () => {
      delete window.__SIMULCAST_TEST__;
    };
  }, [effectiveChunkSeconds, hasLiveAsr, setCaptureStream, setSourceMode]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <img src="/brand-mark.svg" alt="" />
          </span>
          <div>
            <h1>Simulcast Interpreter</h1>
            <p>{copy.productSubtitle}</p>
          </div>
        </div>
        <div className="language-switcher" aria-label="Language switch">
          <button
            type="button"
            className={uiLanguage === 'zh' ? 'active' : ''}
            onClick={() => setUiLanguage('zh')}
          >
            中
          </button>
          <button
            type="button"
            className={uiLanguage === 'en' ? 'active' : ''}
            onClick={() => setUiLanguage('en')}
          >
            EN
          </button>
        </div>
        <div className="status-pill">
          <span />
          {serverHealth.ok ? `${copy.engineOnline} · ${serverHealth.asrProvider ?? 'gateway'}` : copy.engineChecking}
        </div>
        <div className="top-actions" aria-label="Header actions">
          <button type="button" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} />
            {copy.settings}
          </button>
          <button
            type="button"
            className={captionOverlayOpen ? 'active' : ''}
            onClick={handleCaptionOverlay}
          >
            <Captions size={15} />
            {captionOverlayOpen ? copy.close : copy.overlay}
          </button>
          <button type="button" disabled={!hasSubtitles} onClick={handleExport}>{copy.export}</button>
          <button type="button" disabled={!hasSubtitles} onClick={handleCopy}>{copy.copy}</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-panel" aria-label="Interpreter controls">
          <section className="panel-block">
            <h2>{copy.source}</h2>
            <div className="segmented">
              <button
                type="button"
                className={sourceMode === 'demo' ? 'active' : ''}
                disabled={(isRunning || isCapturing) && sourceMode !== 'demo'}
                onClick={() => setSourceMode('demo')}
              >
                <Sparkles size={14} />
                {copy.demo}
              </button>
              <button
                type="button"
                className={sourceMode === 'mic' ? 'active' : ''}
                disabled={(isRunning || isCapturing) && sourceMode !== 'mic'}
                onClick={() => setSourceMode('mic')}
              >
                <Mic size={14} />
                {copy.mic}
              </button>
              <button
                type="button"
                className={sourceMode === 'file' ? 'active' : ''}
                disabled={(isRunning || isCapturing) && sourceMode !== 'file'}
                onClick={() => setSourceMode('file')}
              >
                <FileAudio size={14} />
                {copy.file}
              </button>
              <button
                type="button"
                className={sourceMode === 'live' ? 'active' : ''}
                disabled={(isRunning || isCapturing) && sourceMode !== 'live'}
                onClick={() => setSourceMode('live')}
              >
                <Radio size={14} />
                {copy.live}
              </button>
            </div>
            <div className="source-card">
              <strong>
                {sourceMode === 'file'
                  ? (fileMeta?.name ?? 'Upload an audio/video file')
                  : sourceMode === 'live'
                    ? (captureSourceLabel || 'Select a tab or screen')
                    : sourceMode === 'demo'
                      ? activeDemoScenario.title
                      : 'Browser microphone input'}
              </strong>
              <span>
                {sourceMode === 'file'
                  ? fileMeta
                    ? (asrApiKey || hasServerAsrKey ? 'Real media ASR ready · synced caption release' : 'Use sample audio for stable demo · add ASR key for real transcription')
                    : (asrApiKey || hasServerAsrKey ? 'ASR provider ready · upload audio/video to transcribe' : 'Upload media · configure ASR for real transcription')
                  : sourceMode === 'live'
                    ? (asrApiKey || hasServerAsrKey ? 'Media stream ASR enabled · semantic chunks' : 'Capture audio first · add ASR key or server key')
                  : sourceMode === 'demo'
                  ? 'Built-in English voice + streaming Chinese captions'
                  : (isSTTSupported()
                    ? 'Mic STT available · Demo fallback ready'
                    : 'Web Speech unavailable · Demo fallback ready')}
              </span>
            </div>
            {sourceMode === 'demo' && (
              <div className="demo-scenarios" aria-label="Demo scenario presets">
                <div className="demo-preset-heading">
                  <strong>{copy.demoPreset}</strong>
                  <span>{copy.demoPresetHint}</span>
                </div>
                {demoScenarios.map((scenario) => (
                  <button
                    type="button"
                    className={scenario.id === demoScenarioId ? 'active' : ''}
                    disabled={isRunning}
                    key={scenario.id}
                    onClick={() => handleDemoScenarioChange(scenario)}
                  >
                    <span>{scenario.badge}</span>
                    <strong>{scenario.label}</strong>
                    <small>{scenario.summary}</small>
                  </button>
                ))}
                <div className="mode-help-card">
                  <Sparkles size={16} />
                  <div>
                    <strong>{activeDemoScenario.terms.length} terms · {activeDemoScenario.transcript.length} captions</strong>
                    <span>{copy.demoPresetHint}</span>
                  </div>
                </div>
              </div>
            )}
            {sourceMode === 'mic' && (
              <div className="mode-help-card">
                <Mic size={16} />
                <div>
                  <strong>Browser microphone STT</strong>
                  <span>点击开始后授权麦克风；英文 final 结果会进入翻译链路。</span>
                </div>
              </div>
            )}
            {sourceMode === 'file' && (
              <div className="file-uploader">
                <button
                  className="sample-file-button"
                  type="button"
                  disabled={isRunning || isSampleLoading}
                  onClick={handleLoadSampleFile}
                >
                  <FileAudio size={15} />
                  {isSampleLoading ? copy.sampleLoading : copy.sample}
                </button>
                <label>
                  <span><Upload size={13} /> {copy.upload}</span>
                  <input
                    accept=".mp3,.mp4,.wav,.m4a,.webm,.ogg,audio/*,video/*"
                    type="file"
                    onChange={handleFileChange}
                  />
                </label>
                {fileMeta && (
                  <div className="file-meta">
                    <span>{formatBytes(fileMeta.size)}</span>
                    <span>{fileMeta.duration ? formatDuration(fileMeta.duration) : 'duration pending'}</span>
                    <span>{fileMeta.type}</span>
                  </div>
                )}
                {fileMeta && (
                  <StageRail
                    activeStage={fileStage}
                    stages={buildFileInterpretationStages(copy)}
                  />
                )}
                {fileStatus && <div className="file-status">{fileStatus}</div>}
                {fileStage === 'error' && fileMeta && (
                  <button className="retry-button" type="button" onClick={startFileInterpretation}>
                    Retry file ASR
                  </button>
                )}
                {fileUrl && isVideoFile(fileMeta) && (
                  <video
                    ref={audioRef}
                    controls
                    src={fileUrl}
                    onLoadedMetadata={handleAudioMetadata}
                  >
                    <track kind="captions" />
                  </video>
                )}
                {fileUrl && !isVideoFile(fileMeta) && (
                  <audio
                    ref={audioRef}
                    controls
                    src={fileUrl}
                    onLoadedMetadata={handleAudioMetadata}
                  >
                    <track kind="captions" />
                  </audio>
                )}
              </div>
            )}
            {sourceMode === 'live' && (
              <div className="live-capture-card">
                <LiveWorkflow copy={copy} stage={liveStage} hasSubtitles={hasSubtitles} />
                <button type="button" onClick={handleLiveCapture}>
                  {isCapturing ? copy.stopLive : copy.chooseLive}
                </button>
                <p>{copy.liveUse} 直播路径会持续读取当前共享标签页或屏幕的音频流，不注入第三方页面。</p>
                <div className="live-state-grid" aria-label="Live interpretation status">
                  <LiveStateItem label="Source" value={captureSourceLabel || 'Not selected'} state={captureSourceLabel ? 'ok' : 'idle'} />
                  <LiveStateItem label="Permission" value={isCapturing ? 'Audio captured' : liveStage === 'requesting' ? 'Requesting' : 'Required'} state={isCapturing ? 'ok' : liveStage === 'requesting' ? 'warn' : 'idle'} />
                  <LiveStateItem label="ASR" value={hasLiveAsr ? 'Provider ready' : 'Not configured'} state={hasLiveAsr ? 'ok' : 'warn'} />
                  <LiveStateItem label="Chunking" value={`${effectiveChunkSeconds}s + semantic`} state="ok" />
                  <LiveStateItem label={copy.speechRate} value={formatSpeechRate(liveStats)} state={getSpeechRateState(liveStats)} />
                  <LiveStateItem label="Output" value={getLiveOutputStateLabel({ hasSubtitles, liveStatus })} state={getLiveOutputState({ hasSubtitles, liveStatus })} />
                </div>
                <div className="live-boundary">
                  {copy.liveBoundary}
                </div>
                <div className="live-boundary overlay-note">
                  {copy.overlayHint}
                </div>
                <div className="live-stats" aria-label="Live ASR queue statistics">
                  <span><strong>{liveStats.queued}</strong> Queued</span>
                  <span><strong>{liveStats.processed}</strong> Done</span>
                  <span><strong>{liveStats.skipped}</strong> Skip</span>
                  <span><strong>{liveStats.duplicates}</strong> Dup</span>
                  <span><strong>{formatSpeechRate(liveStats)}</strong> Rate</span>
                  <span><strong>{liveStats.backlog ?? 0}</strong> Backlog</span>
                  <span><strong>{liveStats.lastLatencyMs ? `${liveStats.lastLatencyMs}ms` : '-'}</strong> Latency</span>
                </div>
                {liveStatus && <div className="file-status">{liveStatus}</div>}
              </div>
            )}
          </section>

          <button className="run-button" type="button" onClick={handleRunClick}>
            <PlayCircle size={16} />
            {isRunning ? copy.stop : getRunButtonLabel({ isRunning, sourceMode, isCapturing, copy })}
          </button>
          <div className="next-action compact-next">
            <span>{nextAction}</span>
          </div>
        </aside>

        <section className="right-panel" aria-label="Subtitle workspace">
          <div className="toolbar">
            <div className="workspace-title">
              <span>{copy.subtitles}</span>
              <strong>{sourceMode === 'file' ? copy.file : sourceMode === 'live' ? copy.live : sourceMode === 'mic' ? copy.mic : copy.demo}</strong>
            </div>
            <div className="language-route" aria-label="Language route">
              <label>
                <span>{copy.sourceLanguage}</span>
                <select
                  value={sourceLanguage}
                  onChange={(event) => setSourceLanguage(event.target.value)}
                >
                  {SOURCE_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language[uiLanguage]}
                    </option>
                  ))}
                </select>
              </label>
              <span aria-hidden="true">→</span>
              <label>
                <span>{copy.targetLanguage}</span>
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                >
                  {TARGET_LANGUAGES.map((language) => (
                    <option key={language.value} value={language.value}>
                      {language[uiLanguage]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mode-tabs">
              <button
                type="button"
                className={subtitleMode === 'bilingual' ? 'active' : ''}
                onClick={() => setSubtitleMode('bilingual')}
              >
                {copy.bilingual}
              </button>
              <button
                type="button"
                className={subtitleMode === 'zh-only' ? 'active' : ''}
                onClick={() => setSubtitleMode('zh-only')}
              >
                {copy.targetOnly}
              </button>
              <button
                type="button"
                className={subtitleMode === 'en-only' ? 'active' : ''}
                onClick={() => setSubtitleMode('en-only')}
              >
                {copy.sourceOnly}
              </button>
            </div>
            <div className="toolbar-note">
              {copy.latency} {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '1.8s'} · {copy.context} {contextWindow} · {copy.asr} {serverHealth.asrProvider ?? (serverHealth.hasOpenAIKey ? 'server' : 'browser')}
            </div>
          </div>

          <div className="quality-strip" aria-label="Real-time interpretation proof">
            <div>
              <span>{copy.controlDesk}</span>
              <strong>{isRunning || isCapturing ? 'On air' : 'Ready'}</strong>
            </div>
            <div>
              <span>{copy.streamInput}</span>
              <strong>{sourceMode === 'live' ? (isCapturing ? 'Media stream' : 'Tab/screen') : sourceMode === 'file' ? 'Audio element' : sourceMode === 'mic' ? 'Microphone' : 'Demo stream'}</strong>
            </div>
            <div>
              <span>{copy.segmentEngine}</span>
              <strong>{sourceMode === 'live' || sourceMode === 'file' ? `${effectiveChunkSeconds}s + sentence` : 'final ASR units'}</strong>
            </div>
            <div>
              <span>{copy.autoRevision}</span>
              <strong>{autoCorrect ? `${autoRevisionCount} revised` : 'Off'}</strong>
            </div>
            <div>
              <span>{copy.accuracyFeedback}</span>
              <strong>{getQualityFeedbackLabel({ copy, qualitySummary, hasSubtitles, sourceMode, liveStats })}</strong>
            </div>
            <div>
              <span>{copy.humanMemory}</span>
              <strong>{correctionMemory.length ? `${correctionMemory.length} confirmed` : 'No entries'}</strong>
            </div>
          </div>

          <div className="subtitle-scroll" ref={subtitleScrollRef}>
            {displaySubtitles.length === 0 && !currentInterim.en && (
              <article className="subtitle-card empty-state">
                <div className="subtitle-meta">
                  <time>{copy.ready}</time>
                  <span>{copy.readyBadge}</span>
                </div>
                {shouldShowOriginal(subtitleMode, showOriginal) && (
                  <p className="source-text">{emptySubtitleState.source}</p>
                )}
                {shouldShowChinese(subtitleMode) && (
                  <p className="translated-text">{emptySubtitleState.target}</p>
                )}
              </article>
            )}
            {currentInterim.en && (
              <article
                className={`subtitle-card interim ${interimIsDiagnostic ? 'diagnostic' : ''}`}
                data-diagnostic-interim={interimIsDiagnostic ? 'true' : undefined}
              >
                <div className="subtitle-meta">
                  <time>live</time>
                  <span>{interimIsDiagnostic ? getInterimDiagnosticLabel(currentInterim) : copy.recognizing}</span>
                </div>
                {shouldShowOriginal(subtitleMode, showOriginal) && (
                  <p className="source-text">{currentInterim.en}</p>
                )}
                {shouldShowChinese(subtitleMode) && (
                  <p className="translated-text">{currentInterim.zh || '等待最终识别...'}</p>
                )}
              </article>
            )}
            {visibleSubtitles.map((subtitle) => (
              <SubtitleCard
                analysis={qualitySummary.analyses.find((item) => item.subtitle.id === subtitle.id)}
                isCurrent={subtitle.isCurrent}
                isSelected={subtitle.id === selectedSubtitle?.id}
                key={subtitle.id}
                onSelect={() => selectSubtitle(subtitle.id)}
                showOriginal={shouldShowOriginal(subtitleMode, showOriginal)}
                showChinese={shouldShowChinese(subtitleMode)}
                subtitle={subtitle}
              />
            ))}
          </div>

          {hasSelectedSubtitle && (
            <div className="correction-editor">
              <div>
                <h2>{copy.correction}</h2>
                <p>{selectedSubtitle.en}</p>
              </div>
              <textarea
                className="editor-preview"
                aria-label="Corrected Chinese subtitle"
                value={draftZh}
                onChange={(event) => setDraftZh(event.target.value)}
              />
              <button type="button" onClick={handleSaveCorrection}>
                <ClipboardCheck size={15} />
                {copy.saveCorrection}
              </button>
              {correctionSavedMessage && <span className="correction-saved">{correctionSavedMessage}</span>}
              <button
                type="button"
                onClick={() => retranslateSubtitle(selectedSubtitle.id)}
              >
                <Wand2 size={15} />
                {copy.retranslate}
              </button>
            </div>
          )}

          {showSubtitlePreview && (
            <div className={`subtitle-banner ${interimIsDiagnostic ? 'diagnostic' : ''}`}>
              <span>{subtitleMode === 'en-only' ? copy.sourceOnly : copy.targetOnly}</span>
              <strong>{subtitlePreviewText}</strong>
            </div>
          )}

          <footer className="stats-bar">
            <span>{copy.translated} {displaySubtitles.length}</span>
            <span>{copy.corrections} {correctionCount}</span>
            <span>{copy.glossary} {glossary.length}</span>
            <span>{copy.provider} {serverHealth.translationModel ?? 'gateway'}</span>
          </footer>
        </section>
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="settings-modal" aria-label="Advanced settings">
            <header>
              <div>
                <h2>{copy.advancedSettings}</h2>
                <p>{copy.advancedHint}</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}>{copy.close}</button>
            </header>
            <div className="config-tabs" aria-label="Configuration sections">
              <button
                type="button"
                className={configTab === 'translate' ? 'active' : ''}
                onClick={() => setConfigTab('translate')}
              >
                <Languages size={14} />
                Translate
              </button>
              <button
                type="button"
                className={configTab === 'asr' ? 'active' : ''}
                onClick={() => setConfigTab('asr')}
              >
                <Captions size={14} />
                ASR
              </button>
              <button
                type="button"
                className={configTab === 'glossary' ? 'active' : ''}
                onClick={() => setConfigTab('glossary')}
              >
                <ListChecks size={14} />
                Terms
              </button>
            </div>

            {configTab === 'translate' && (
              <div className="config-body">
                <div className="field-line compact">
                  <span>{serverHealth.translationModel ?? 'qwen-plus'}</span>
                  <code>{hasServerTranslationKey ? 'server key' : 'key needed'}</code>
                </div>
                <div className="secret-input">
                  翻译统一走本地后端 /api/translate；后端默认使用 DashScope 兼容网关和 .env 中的 DASHSCOPE_API_KEY。
                </div>
              </div>
            )}

            {configTab === 'asr' && (
              <div className="config-body">
                <div className="field-line compact">
                  <span>{asrModel}</span>
                  <code>{asrApiKey ? 'browser key' : hasServerAsrKey ? 'server key' : 'key needed'}</code>
                </div>
                <select
                  className="settings-control"
                  aria-label="ASR model"
                  value={asrModel}
                  onChange={(event) => setAsrModel(event.target.value)}
                >
                  <option value="qwen3-asr-flash">qwen3-asr-flash</option>
                  <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option>
                  <option value="gpt-4o-transcribe">gpt-4o-transcribe</option>
                  <option value="whisper-1">whisper-1</option>
                </select>
                <input
                  className="settings-control"
                  aria-label="ASR base URL"
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                  value={asrBaseUrl}
                  onChange={(event) => setAsrBaseUrl(event.target.value)}
                />
                <input
                  className="settings-control"
                  aria-label="ASR API key"
                  placeholder="ASR API key (memory only)"
                  type="password"
                  value={asrApiKey}
                  onChange={(event) => setAsrApiKey(event.target.value)}
                />
                <div className="secret-input">File and Live modes use the backend ASR gateway when server key is present.</div>
              </div>
            )}

            {configTab === 'glossary' && (
              <div className="config-body">
                <div className="glossary-list compact-list">
                  {glossary.map((term) => (
                    <div className={term.enabled ? 'term enabled' : 'term'} key={term.id ?? term.source}>
                      <span>{term.source}</span>
                      <strong>{term.target}</strong>
                    </div>
                  ))}
                </div>
                <div className="term-form">
                  <input
                    aria-label="Glossary source"
                    placeholder="source term"
                    value={termSource}
                    onChange={(event) => setTermSource(event.target.value)}
                  />
                  <input
                    aria-label="Glossary target"
                    placeholder="中文译法"
                    value={termTarget}
                    onChange={(event) => setTermTarget(event.target.value)}
                  />
                  <button type="button" onClick={handleAddTerm}>Add term</button>
                </div>
              </div>
            )}
            <label>
              <span>{copy.sourceLanguage}</span>
              <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
                {SOURCE_LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language[uiLanguage]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.targetLanguage}</span>
              <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                {TARGET_LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language[uiLanguage]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>翻译风格</span>
              <select value={translationStyle} onChange={(event) => setTranslationStyle(event.target.value)}>
                <option value="formal">正式（学术/会议）</option>
                <option value="casual">口语（访谈/直播）</option>
                <option value="technical">技术（发布会/工程）</option>
              </select>
            </label>
            <label>
              <span>上下文窗口：{contextWindow}</span>
              <input
                min="2"
                max="12"
                type="number"
                value={contextWindow}
                onChange={(event) => setContextWindow(event.target.value)}
              />
            </label>
            <label>
                <span>音频分片长度：{chunkSeconds}s（同传建议 2-3s）</span>
                <input
                min="2"
                max="10"
                type="number"
                value={chunkSeconds}
                onChange={(event) => setChunkSeconds(event.target.value)}
              />
            </label>
            <label className="modal-toggle">
              <input
                checked={terminologyBoost}
                type="checkbox"
                onChange={(event) => setTerminologyBoost(event.target.checked)}
              />
              <span>专业词汇增强</span>
            </label>
            <label>
              <span>语音播报速度：{ttsRate.toFixed(1)}x</span>
              <input
                max="1.5"
                min="0.8"
                step="0.1"
                type="range"
                value={ttsRate}
                onChange={(event) => setStoreTtsRate(event.target.value)}
              />
            </label>
            <label>
              <span>语音音质</span>
              <select value={ttsQuality} onChange={(event) => setTtsQuality(event.target.value)}>
                <option value="browser">浏览器原生</option>
                <option value="openai">OpenAI TTS（预留）</option>
              </select>
            </label>
            <div className="settings-toggles">
              <label className="modal-toggle">
                <input
                  checked={showOriginal}
                  type="checkbox"
                  onChange={(event) => setShowOriginal(event.target.checked)}
                />
                <span>Show original English</span>
              </label>
              <label className="modal-toggle">
                <input
                  checked={showBanner}
                  type="checkbox"
                  onChange={(event) => setShowBanner(event.target.checked)}
                />
                <span>Bottom subtitle banner</span>
              </label>
              <label className="modal-toggle">
                <input
                  checked={autoCorrect}
                  type="checkbox"
                  onChange={(event) => setAutoCorrect(event.target.checked)}
                />
                <span>Auto correction memory</span>
              </label>
              <label className="modal-toggle">
                <input
                  checked={voiceOutput}
                  type="checkbox"
                  onChange={(event) => setVoiceOutput(event.target.checked)}
                />
                <span>Chinese voice output</span>
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function waitForMediaReady(mediaElement) {
  if (mediaElement.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      mediaElement.removeEventListener('canplay', handleReady);
      mediaElement.removeEventListener('loadeddata', handleReady);
      mediaElement.removeEventListener('error', handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('Sample media failed to load for live stream test.'));
    };
    mediaElement.addEventListener('canplay', handleReady, { once: true });
    mediaElement.addEventListener('loadeddata', handleReady, { once: true });
    mediaElement.addEventListener('error', handleError, { once: true });
    mediaElement.load();
  });
}

function shouldExposeTestHooks() {
  return typeof window !== 'undefined'
    && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_HOOKS === '1');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const rest = String(safe % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function isVideoFile(fileMeta) {
  return String(fileMeta?.type ?? '').startsWith('video/');
}

function getEmptySubtitleState({
  copy,
  sourceMode,
  fileMeta,
  liveStage,
  liveStatus,
  hasLiveAsr,
  isCapturing,
}) {
  if (sourceMode === 'live') {
    if (!hasLiveAsr) {
      return {
        source: copy.liveNoAsrTitle,
        target: copy.liveNoAsrBody,
      };
    }
    if (liveStage === 'error' || liveStatus) {
      return {
        source: liveStatus || copy.liveNeedAudioTitle,
        target: copy.liveNeedAudioBody,
      };
    }
    if (!isCapturing) {
      return {
        source: copy.liveNeedAudioTitle,
        target: copy.liveNeedAudioBody,
      };
    }
  }

  if (sourceMode === 'file' && !fileMeta) {
    return {
      source: 'Upload audio or video to start real ASR.',
      target: '上传音频或视频后，系统会提取音频轨并按播放进度输出同传字幕。',
    };
  }

  return {
    source: copy.readySource,
    target: copy.readyZh,
  };
}

function correctionLabel(type) {
  return {
    manual: '用户修正',
    glossary: '术语命中',
    auto: '上下文修正',
  }[type] ?? '已修正';
}

function LiveWorkflow({ copy, stage, hasSubtitles }) {
  const activeIndex = {
    idle: 0,
    requesting: 0,
    captured: 1,
    'asr-ready': 2,
    running: 3,
    paused: hasSubtitles ? 5 : 1,
    error: 0,
  }[stage] ?? 0;
  const steps = [
    `1 ${copy.workflowListen}`,
    `2 ${copy.workflowSegment}`,
    `3 ${copy.workflowUnderstand}`,
    `4 ${copy.workflowReformulate}`,
    `5 ${copy.workflowOutput}`,
    `6 ${copy.workflowCorrect}`,
  ];

  return (
    <div className="live-workflow" aria-label="Live interpretation workflow">
      {steps.map((step, index) => (
        <span className={index <= activeIndex || (hasSubtitles && index >= 4) ? 'done' : ''} key={step}>
          {step}
        </span>
      ))}
    </div>
  );
}

function LiveStateItem({ label, value, state = 'idle' }) {
  return (
    <div className={`live-state-item ${state}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isDiagnosticInterim(interim) {
  const text = `${interim?.en ?? ''}\n${interim?.zh ?? ''}`;
  return /语速过快|语速偏快|ASR 暂未稳定|ASR 未稳定|合并下一语义窗|等待真实语音输入|没有实际音量|未检测到实际音量|共享标签页音频|最后一段语音信息不足/i.test(text);
}

function getInterimDiagnosticLabel(interim) {
  const text = `${interim?.en ?? ''}\n${interim?.zh ?? ''}`;
  if (/语速过快/i.test(text)) return '语速过快';
  if (/语速偏快/i.test(text)) return '语速偏快';
  if (/没有实际音量|未检测到实际音量|共享标签页音频/i.test(text)) return '音频输入提示';
  if (/ASR 暂未稳定|ASR 未稳定|合并下一语义窗/i.test(text)) return 'ASR 追赶中';
  return '状态提示';
}

function SubtitleCard({ subtitle, analysis, isCurrent, isSelected, onSelect, showOriginal, showChinese }) {
  const [expanded, setExpanded] = useState(false);
  const visibleIssues = analysis?.issues ?? [];
  const isLong = (subtitle.en?.length ?? 0) > 90 || (subtitle.zh?.length ?? 0) > 48;

  return (
    <article
      className={`subtitle-card ${subtitle.correctionType ?? ''} ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${analysis?.riskLevel === 'risk' ? 'risk' : ''} ${expanded ? 'expanded' : 'collapsed'}`}
      data-current-subtitle={isCurrent ? 'true' : undefined}
      onClick={onSelect}
    >
      <div className="subtitle-meta">
        <time>{subtitle.timeLabel}</time>
        <div className="subtitle-badges">
          {isCurrent && <span className="current-badge">当前同传</span>}
          {subtitle.correctionType && (
            <span>{correctionLabel(subtitle.correctionType)}</span>
          )}
          {visibleIssues.slice(0, 2).map((issue) => (
            <span className={issue.positive ? 'positive' : 'risk'} key={issue.type}>{issue.label}</span>
          ))}
        </div>
      </div>
      {showOriginal && <p className="source-text">{subtitle.en}</p>}
      {showChinese && <p className="translated-text">{subtitle.zh}</p>}
      {isLong && (
        <button
          aria-label={expanded ? 'Collapse subtitle' : 'Expand subtitle'}
          className="subtitle-expand"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((current) => !current);
            onSelect();
          }}
        >
          <ChevronDown size={14} />
        </button>
      )}
      {subtitle.termsApplied.length > 0 && (
        <div className="term-hits">
          {subtitle.termsApplied.map((term) => <code key={term}>{term}</code>)}
        </div>
      )}
    </article>
  );
}

function StageRail({ activeStage, stages }) {
  const isError = activeStage === 'error';
  const activeIndex = getFileWorkflowIndex(activeStage, stages.length);

  return (
    <div className={`stage-rail ${isError ? 'error' : ''}`} aria-label="File processing stages">
      {stages.map(([id, label], index) => (
        <span className={index <= activeIndex && !isError ? 'done' : ''} key={id}>
          {label}
        </span>
      ))}
    </div>
  );
}

function buildFileInterpretationStages(copy) {
  return [
    ['listen', copy.workflowListen],
    ['segment', copy.workflowSegment],
    ['understand', copy.workflowUnderstand],
    ['reformulate', copy.workflowReformulate],
    ['output', copy.workflowOutput],
    ['correct', copy.workflowCorrect],
  ];
}

function getFileWorkflowIndex(activeStage, stageCount) {
  const maxIndex = Math.max(0, stageCount - 1);
  const mapped = {
    idle: 0,
    ready: 0,
    asr: 1,
    fallback: 1,
    translate: 3,
    done: maxIndex,
    error: 0,
  }[activeStage];

  return Math.min(maxIndex, Math.max(0, mapped ?? 0));
}

function getNextAction({
  sourceMode,
  fileMeta,
  asrApiKey,
  serverHasApiKey,
  serverHasTranslationKey,
  hasSubtitles,
  correctionCount,
  isRunning,
}) {
  if (isRunning) return '正在同传处理中，等待下一条稳定字幕后可修正或导出。';
  if (sourceMode === 'file' && !fileMeta) return '点击“加载样本”或上传音视频，再开始文件同传主线。';
  if (sourceMode === 'file' && !asrApiKey && !serverHasApiKey) return '填写 File ASR Key，或启动带 ASR Key 的后端；无 Key 时会明确降级为演示转写流。';
  if (!serverHasTranslationKey && sourceMode !== 'demo') return '启动带 DASHSCOPE_API_KEY 的后端，翻译会统一走本地 /api/translate 网关。';
  if (!hasSubtitles) return '点击“开始同传”，系统会按听音、切分、理解、转译、输出的顺序逐句出字幕。';
  if (correctionCount === 0) return '点击一条字幕，在修正区保存一次人工修正，让术语和表达沉淀下来。';
  return '当前闭环已跑通，可以导出 SRT 或继续添加术语重译。';
}

function getRunButtonLabel({ isRunning, sourceMode, isCapturing, copy }) {
  if (isRunning) return 'Stop Interpreting';
  if (sourceMode === 'live') return isCapturing ? copy.stopLive : copy.chooseLive;
  return copy.start;
}

function formatSpeechRate(liveStats) {
  const wpm = Number(liveStats?.speechRateWpm ?? 0);
  return wpm > 0 ? `${wpm} WPM` : 'Listening';
}

function getSpeechRateState(liveStats) {
  if (liveStats?.speechRateLevel === 'overload') return 'danger';
  if (liveStats?.speechRateLevel === 'fast' || liveStats?.speechRateLevel === 'unstable' || liveStats?.asrUnstable > 0) return 'warn';
  return liveStats?.speechRateWpm ? 'ok' : 'idle';
}

function getQualityFeedbackLabel({ copy, qualitySummary, hasSubtitles, sourceMode, liveStats }) {
  if (sourceMode === 'live' && liveStats?.speechRateLevel === 'overload') {
    return `${copy.speechOverload} ${liveStats.speechRateWpm || ''} WPM`.trim();
  }
  if (sourceMode === 'live' && liveStats?.speechRateLevel === 'fast') {
    return `${copy.fastSpeech} ${liveStats.speechRateWpm || ''} WPM`.trim();
  }
  if (sourceMode === 'live' && liveStats?.asrUnstable > 0) {
    return `${copy.unstableAsr} ${liveStats.asrUnstable}`;
  }
  if (qualitySummary.riskCount) return `${qualitySummary.riskCount} risk`;
  if (hasSubtitles) return copy.noFormatRisk;
  return 'Waiting';
}

function getLiveOutputStateLabel({ hasSubtitles, liveStatus }) {
  if (hasSubtitles) return 'Captions ready';
  if (/没有实际音量|无有效音量|未检测到实际音量|共享标签页音频|audio is empty/i.test(liveStatus ?? '')) {
    return 'No audible input';
  }
  if (/语速过快|语速偏快|ASR 未稳定捕获|音频存在/i.test(liveStatus ?? '')) return 'Speech overload';
  if (/未检测到清晰语音/i.test(liveStatus ?? '')) return 'ASR unstable';
  return 'Waiting';
}

function getLiveOutputState({ hasSubtitles, liveStatus }) {
  if (hasSubtitles) return 'ok';
  if (/语速过快|语速偏快/i.test(liveStatus ?? '')) return 'danger';
  if (/ASR 未稳定捕获|音频存在|未检测到清晰语音/i.test(liveStatus ?? '')) return 'warn';
  if (/没有实际音量|无有效音量|未检测到实际音量|共享标签页音频|audio is empty/i.test(liveStatus ?? '')) {
    return 'warn';
  }
  return 'idle';
}

function getLivePrimaryAction({ isCapturing, liveStage, hasLiveAsr }) {
  if (isCapturing && hasLiveAsr && liveStage === 'running') return 'Stop live capture';
  if (isCapturing && !hasLiveAsr) return 'Audio captured · ASR not configured';
  if (isCapturing) return 'Stop live capture';
  return 'Choose live audio';
}

function shouldShowOriginal(subtitleMode, showOriginal) {
  if (subtitleMode === 'zh-only') return false;
  if (subtitleMode === 'en-only') return true;
  return showOriginal;
}

function shouldShowChinese(subtitleMode) {
  return subtitleMode !== 'en-only';
}

async function openCaptionOverlayWindow() {
  if ('documentPictureInPicture' in window) {
    return window.documentPictureInPicture.requestWindow({
      width: 760,
      height: 240,
    });
  }

  const popup = window.open('', 'simulcast-caption-overlay', 'popup,width=760,height=240');
  if (!popup) {
    throw new Error('Caption overlay popup was blocked by the browser.');
  }
  return popup;
}

function mountCaptionOverlay(overlayWindow, onClose) {
  const documentRef = overlayWindow.document;
  documentRef.open();
  documentRef.write(`<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Simulcast Captions</title>
      </head>
      <body>
        <main id="caption-overlay-root" class="caption-overlay-window"></main>
      </body>
    </html>`);
  documentRef.close();
  const style = documentRef.createElement('style');
  style.textContent = `
    :root {
      color-scheme: dark;
      --overlay-bg: rgba(3, 7, 18, 0.88);
      --overlay-border: rgba(148, 163, 184, 0.22);
      --overlay-text: #f8fafc;
      --overlay-muted: #94a3b8;
      --overlay-accent: #60a5fa;
      --overlay-green: #34d399;
    }
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      min-height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
      font-family: "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif;
    }
    .caption-overlay-window {
      min-height: 100vh;
      display: grid;
      align-content: center;
      gap: 10px;
      padding: 16px 18px;
      border: 1px solid var(--overlay-border);
      border-radius: 18px;
      color: var(--overlay-text);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.9), var(--overlay-bg));
      box-shadow: 0 28px 90px rgba(0, 0, 0, 0.55);
    }
    .caption-overlay-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: var(--overlay-muted);
      font: 700 12px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .caption-overlay-meta strong {
      color: var(--overlay-green);
      font-weight: 800;
    }
    .caption-overlay-source {
      margin: 0;
      color: #cbd5e1;
      font-size: 18px;
      line-height: 1.45;
    }
    .caption-overlay-target {
      margin: 0;
      color: #ffffff;
      font-size: clamp(28px, 6vw, 48px);
      font-weight: 850;
      line-height: 1.22;
      text-wrap: balance;
    }
    .caption-overlay-target.only-source {
      color: #dbeafe;
      font-size: clamp(24px, 5vw, 40px);
    }
    .caption-overlay-empty {
      color: var(--overlay-muted);
      font-size: 20px;
      font-weight: 750;
    }
  `;
  documentRef.head.appendChild(style);
  overlayWindow.addEventListener('pagehide', onClose, { once: true });
  overlayWindow.addEventListener('beforeunload', onClose, { once: true });
}

function updateCaptionOverlay(overlayWindow, payload) {
  if (!overlayWindow || overlayWindow.closed) return;
  const root = overlayWindow.document.getElementById('caption-overlay-root');
  if (!root) return;

  const sourceHtml = payload.showSource && payload.source
    ? `<p class="caption-overlay-source">${escapeHtml(payload.source)}</p>`
    : '';
  const targetClass = payload.showTarget ? '' : ' only-source';
  const targetText = payload.showTarget ? payload.target : payload.source;
  const captionHtml = targetText
    ? `<p class="caption-overlay-target${targetClass}">${escapeHtml(targetText)}</p>`
    : `<p class="caption-overlay-empty">${escapeHtml(payload.emptyText)}</p>`;
  root.innerHTML = `
    <div class="caption-overlay-meta">
      <span>${escapeHtml(payload.modeLabel)}</span>
      <strong>${escapeHtml(payload.statusLabel)}</strong>
    </div>
    ${sourceHtml}
    ${captionHtml}
  `;
}

function buildCaptionOverlayPayload({
  copy,
  currentInterim,
  latestSubtitle,
  subtitleMode,
  sourceLanguage,
  targetLanguage,
  sourceMode,
  captureSourceLabel,
  liveStage,
  liveStats,
  isCapturing,
}) {
  const interimIsDiagnostic = isDiagnosticInterim(currentInterim);
  const source = currentInterim.en || latestSubtitle?.en || '';
  const target = !interimIsDiagnostic && currentInterim.zh
    ? currentInterim.zh
    : latestSubtitle?.zh || '';
  const modeLabel = `${formatLanguageCode(sourceLanguage)} -> ${formatLanguageCode(targetLanguage)} · ${copy.subtitles}`;
  const liveStatus = sourceMode === 'live'
    ? `${captureSourceLabel || copy.live} · ${isCapturing ? liveStage : 'idle'} · Done ${liveStats.processed}${interimIsDiagnostic ? ' · ' + getInterimDiagnosticLabel(currentInterim) : ''}`
    : `${sourceMode.toUpperCase()} · ${target ? 'captions ready' : 'waiting'}`;

  return {
    source,
    target,
    showSource: shouldShowOriginal(subtitleMode, true),
    showTarget: shouldShowChinese(subtitleMode),
    modeLabel,
    statusLabel: liveStatus,
    emptyText: copy.readyZh,
  };
}

function formatLanguageCode(value) {
  return value === 'auto' ? 'auto' : value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
