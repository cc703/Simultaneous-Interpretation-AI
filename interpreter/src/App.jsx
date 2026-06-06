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
  Upload,
  Wand2,
} from 'lucide-react';
import { mockGlossary } from './mock/subtitles.js';
import { demoScenarios, getDemoScenario } from './mock/demoTranscript.js';
import {
  isSTTSupported,
  startDemoStream,
  startElementAnalyser,
  startFileDemoStream,
  startStreamAnalyser,
  startSTTSession,
  startSystemAudioCapture,
  startLiveASR,
  stopAudioAnalyser,
  stopDemoStream,
  stopLiveASR,
  stopSTTSession,
  transcribeAudioFile,
  translateTranscriptText,
  stopSystemAudioCapture,
  initTTS,
  cancelTTS,
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
    ready: '待开始',
    readyBadge: '等待输入',
    readySource: 'Click Start Interpreting to play or capture English audio.',
    readyZh: '选择文件或直播源后点击开始，字幕会按时间逐句出现。',
    recognizing: '识别中',
    correction: '翻译修正',
    saveCorrection: '保存修正',
    retranslate: '术语重译',
    currentSubtitle: '当前字幕',
    translated: '字幕',
    corrections: '修正',
    glossary: '术语',
    provider: '引擎',
    liveBoundary: 'Live 默认 1 秒低延迟分片；处理耗时按毫秒统计，但端到端仍受 ASR、翻译和网络影响。',
    liveUse: '适用于网页直播、社交直播、媒体直播和线上会议。',
    overlayHint: '打开字幕浮窗后，可以切到直播/会议页面观看，字幕会继续同步。',
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
    ready: 'Ready',
    readyBadge: 'Waiting',
    readySource: 'Click Start Interpreting to play or capture English audio.',
    readyZh: 'Select a file or live source, then captions will appear line by line.',
    recognizing: 'Recognizing',
    correction: 'Correction',
    saveCorrection: 'Save',
    retranslate: 'Retranslate',
    currentSubtitle: 'Current subtitle',
    translated: 'Captions',
    corrections: 'Corrections',
    glossary: 'Glossary',
    provider: 'Provider',
    liveBoundary: 'Live defaults to 1s low-latency chunks. Processing is tracked in milliseconds, while end-to-end delay still depends on ASR, translation, and network.',
    liveUse: 'For web streams, social live rooms, media streams, and online meetings.',
    overlayHint: 'Open the caption overlay, then switch back to the stream tab. Captions keep syncing.',
    advancedSettings: 'Advanced settings',
    advancedHint: 'These settings affect later recognition, translation, and voice output.',
    close: 'Close',
  },
};

export default function App() {
  const isRunning = useStore((state) => state.isRunning);
  const latencyMs = useStore((state) => state.latencyMs);
  const currentInterim = useStore((state) => state.currentInterim);
  const waveformData = useStore((state) => state.waveformData);
  const sourceMode = useStore((state) => state.sourceMode);
  const demoScenarioId = useStore((state) => state.demoScenarioId);
  const provider = useStore((state) => state.provider);
  const apiKey = useStore((state) => state.apiKey);
  const baseUrl = useStore((state) => state.baseUrl);
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
  const setProvider = useStore((state) => state.setProvider);
  const setApiKey = useStore((state) => state.setApiKey);
  const setBaseUrl = useStore((state) => state.setBaseUrl);
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
  const [fileProgress, setFileProgress] = useState(0);
  const [fileStatus, setFileStatus] = useState('');
  const [fileStage, setFileStage] = useState('idle');
  const [isSampleLoading, setIsSampleLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [liveStage, setLiveStage] = useState('idle');
  const [liveStats, setLiveStats] = useState({ queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 });
  const [serverHealth, setServerHealth] = useState({ ok: false, hasOpenAIKey: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captionOverlayOpen, setCaptionOverlayOpen] = useState(false);
  const [configTab, setConfigTab] = useState('translate');
  const [uiLanguage, setUiLanguage] = useState('zh');
  const audioRef = useRef(null);
  const captionWindowRef = useRef(null);
  const copy = UI_COPY[uiLanguage];
  const displaySubtitles = subtitles;
  const hasSubtitles = displaySubtitles.length > 0;
  const activeDemoScenario = getDemoScenario(demoScenarioId);
  const hasServerAsrKey = Boolean(serverHealth.ok && (serverHealth.hasAsrKey ?? serverHealth.hasOpenAIKey));
  const hasLiveAsr = Boolean(asrApiKey.trim() || hasServerAsrKey);
  const hasSignal = isRunning || isCapturing || currentInterim.en || hasSubtitles || fileProgress > 0;
  const showSubtitlePreview = showBanner && (isRunning || currentInterim.en || hasSubtitles);
  const nextAction = getNextAction({
    sourceMode,
    fileMeta,
    asrApiKey,
    apiKey,
    serverHasApiKey: hasServerAsrKey,
    provider,
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
        stopAudioAnalyser();
        cancelTTS();
        audioRef.current?.pause();
        useStore.getState().stopTranslation();
      } else {
        stopAudioAnalyser();
        cancelTTS();
        stopLiveASR();
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
      setFileStatus('当前未配置 ASR Key，内置样本使用绑定英文转写文本继续演示 File 主线。');
      useStore.getState().updateCurrentInterim({
        en: SAMPLE_FILE.name,
        zh: '正在读取内置样本英文转写...',
      });
      await new Promise((resolve) => setTimeout(resolve, 450));
      setFileStage('translate');
      setFileStatus('样本英文转写已就绪，正在生成中文字幕。');
      await translateTranscriptText(SAMPLE_TRANSCRIPT);
      setFileStage('done');
      setFileStatus('File 主线完成：样本音频 -> 英文转写 -> 中文字幕 -> 可修正与导出。');
      useStore.getState().stopTranslation();
      return;
    }

    if (!asrApiKey.trim() && !hasServerAsr) {
      setFileStatus('未填写浏览器 ASR Key，后端也未配置 ASR Key，普通文件已降级为演示转写流。');
      setFileStage('fallback');
      startFileDemoStream(audioRef.current);
      return;
    }

    const audio = audioRef.current;
    audio?.play().catch((error) => console.warn('[file] preview playback failed:', error));
    useStore.getState().startTranslation();
    setFileStage('asr');
    setFileStatus(hasServerAsr && !asrApiKey.trim()
      ? '正在通过本地后端代理调用真实 ASR...'
      : '正在调用真实 ASR 转写文件音频...');
    useStore.getState().updateCurrentInterim({
      en: file.name,
      zh: '正在上传音频并进行英文转写...',
    });

    try {
      const transcript = await transcribeAudioFile({
        file,
        apiKey: asrApiKey,
        baseUrl: asrBaseUrl,
        model: asrModel,
      });
      setFileStage('translate');
      setFileStatus('真实 ASR 转写完成，正在进入中文同传翻译。');
      await translateTranscriptText(transcript);
      setFileStage('done');
      setFileStatus('文件真实 ASR 与翻译流程完成。');
    } catch (error) {
      console.warn('[file-asr] failed:', error);
      setFileStage('error');
      setFileStatus(error.message || '真实 ASR 失败，请检查 Key、模型或网络。');
      useStore.getState().updateCurrentInterim({
        en: file.name,
        zh: error.message || '真实 ASR 失败，请检查 Key、模型或网络。',
      });
    } finally {
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
    setFileProgress(0);
    setFileStatus(status);
    setFileStage('ready');
    setSourceMode('file');
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
      loadFile(file, '已加载内置英文样本。点击 Start Interpreting 进入 ASR -> Translate -> Done。');
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

  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration === 0) return;
    setFileProgress(audio.currentTime / audio.duration);
  };

  const handleLiveCapture = async () => {
    if (captureStream) {
      stopAudioAnalyser();
      stopLiveASR();
      stopSystemAudioCapture(captureStream);
      setCaptureStream(null, '');
      setLiveStage('paused');
      setLiveStatus('直播捕获已停止。');
      setLiveStats({ queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 });
      useStore.getState().stopTranslation();
      return;
    }

    setSourceMode('live');
    setLiveStage('requesting');
    setLiveStats({ queued: 0, processed: 0, skipped: 0, duplicates: 0, lastLatencyMs: 0 });
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

  const startLiveAsrIfReady = (audioStream) => {
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
        chunkMs: chunkSeconds * 1000,
        onStatus: setLiveStatus,
        onStats: setLiveStats,
      });
    } catch (error) {
      console.warn('[live-asr] start failed:', error);
      setLiveStage('error');
      setLiveStatus(error.message || 'Live ASR 启动失败。');
    }
  };

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
                onClick={() => setSourceMode('demo')}
              >
                <Sparkles size={14} />
                {copy.demo}
              </button>
              <button
                type="button"
                className={sourceMode === 'mic' ? 'active' : ''}
                onClick={() => setSourceMode('mic')}
              >
                <Mic size={14} />
                {copy.mic}
              </button>
              <button
                type="button"
                className={sourceMode === 'file' ? 'active' : ''}
                onClick={() => setSourceMode('file')}
              >
                <FileAudio size={14} />
                {copy.file}
              </button>
              <button
                type="button"
                className={sourceMode === 'live' ? 'active' : ''}
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
                  ? (asrApiKey || hasServerAsrKey ? 'Real file ASR enabled · audio transcriptions API' : 'Use sample audio for stable demo · add ASR key for real transcription')
                  : sourceMode === 'live'
                    ? (asrApiKey || hasServerAsrKey ? 'Live ASR chunks enabled · MediaRecorder' : 'Capture audio first · add ASR key or server key')
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
                    stages={[
                      ['ready', 'File'],
                      ['asr', 'ASR'],
                      ['translate', 'Translate'],
                      ['done', 'Done'],
                    ]}
                  />
                )}
                {fileStatus && <div className="file-status">{fileStatus}</div>}
                {fileStage === 'error' && fileMeta && (
                  <button className="retry-button" type="button" onClick={startFileInterpretation}>
                    Retry file ASR
                  </button>
                )}
                {fileUrl && (
                  <audio
                    ref={audioRef}
                    controls
                    src={fileUrl}
                    onLoadedMetadata={handleAudioMetadata}
                    onTimeUpdate={handleAudioTimeUpdate}
                  >
                    <track kind="captions" />
                  </audio>
                )}
              </div>
            )}
            {sourceMode === 'live' && (
              <div className="live-capture-card">
                <LiveWorkflow stage={liveStage} hasSubtitles={hasSubtitles} />
                <button type="button" onClick={handleLiveCapture}>
                  {isCapturing ? copy.stopLive : copy.chooseLive}
                </button>
                <p>{copy.liveUse}</p>
                <div className="live-state-grid" aria-label="Live interpretation status">
                  <LiveStateItem label="Source" value={captureSourceLabel || 'Not selected'} state={captureSourceLabel ? 'ok' : 'idle'} />
                  <LiveStateItem label="Permission" value={isCapturing ? 'Audio captured' : liveStage === 'requesting' ? 'Requesting' : 'Required'} state={isCapturing ? 'ok' : liveStage === 'requesting' ? 'warn' : 'idle'} />
                  <LiveStateItem label="ASR" value={hasLiveAsr ? 'Provider ready' : 'Not configured'} state={hasLiveAsr ? 'ok' : 'warn'} />
                  <LiveStateItem label="Chunking" value={`${chunkSeconds}s chunks`} state="ok" />
                  <LiveStateItem label="Output" value={hasSubtitles ? 'Captions ready' : 'Waiting'} state={hasSubtitles ? 'ok' : 'idle'} />
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
                  <span><strong>{liveStats.skipped}</strong> Silent</span>
                  <span><strong>{liveStats.duplicates}</strong> Dup</span>
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

          {hasSignal && (
            <>
              <div className="waveform" aria-label="Audio waveform">
                {Array.from({ length: 36 }).map((_, index) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={index}
                    style={{ '--level': `${getWaveformLevel(waveformData, index)}%` }}
                  />
                ))}
              </div>
              <div className="progress-track">
                <span style={{ width: sourceMode === 'file' ? `${Math.round(fileProgress * 100)}%` : undefined }} />
              </div>
            </>
          )}

          <div className="subtitle-scroll">
            {displaySubtitles.length === 0 && !currentInterim.en && (
              <article className="subtitle-card empty-state">
                <div className="subtitle-meta">
                  <time>{copy.ready}</time>
                  <span>{copy.readyBadge}</span>
                </div>
                {shouldShowOriginal(subtitleMode, showOriginal) && (
                  <p className="source-text">
                    {copy.readySource}
                  </p>
                )}
                {shouldShowChinese(subtitleMode) && (
                  <p className="translated-text">{copy.readyZh}</p>
                )}
              </article>
            )}
            {currentInterim.en && (
              <article className="subtitle-card interim">
                <div className="subtitle-meta">
                  <time>live</time>
                  <span>{copy.recognizing}</span>
                </div>
                {shouldShowOriginal(subtitleMode, showOriginal) && (
                  <p className="source-text">{currentInterim.en}</p>
                )}
                {shouldShowChinese(subtitleMode) && (
                  <p className="translated-text">{currentInterim.zh || '等待最终识别...'}</p>
                )}
              </article>
            )}
            {displaySubtitles.map((subtitle) => (
              <SubtitleCard
                analysis={qualitySummary.analyses.find((item) => item.subtitle.id === subtitle.id)}
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
            <div className="subtitle-banner">
              <span>{subtitleMode === 'en-only' ? copy.sourceOnly : copy.targetOnly}</span>
              <strong>{subtitleMode === 'en-only' ? (currentInterim.en || selectedSubtitle.en) : (currentInterim.zh || selectedSubtitle.zh)}</strong>
            </div>
          )}

          <footer className="stats-bar">
            <span>{copy.translated} {displaySubtitles.length}</span>
            <span>{copy.corrections} {correctionCount}</span>
            <span>{copy.glossary} {glossary.length}</span>
            <span>{copy.provider} {provider}</span>
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
                  <span>{provider}</span>
                  <code>{apiKey ? 'browser key' : provider === 'openai' && serverHealth.hasOpenAIKey ? 'server key' : 'key needed'}</code>
                </div>
                <select
                  className="settings-control"
                  aria-label="Provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">Server Gateway</option>
                  <option value="custom">Custom</option>
                </select>
                {provider === 'custom' && (
                  <input
                    className="settings-control"
                    aria-label="Custom base URL"
                    placeholder="https://api.example.com/v1"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                )}
                <input
                  className="settings-control"
                  aria-label="API key"
                  placeholder="Translation API key (memory only)"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <div className="secret-input">
                  Browser key stays in memory. Server Gateway uses keys from .env.
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
                <span>音频分片长度：{chunkSeconds}s（低延迟建议 1s）</span>
                <input
                min="1"
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

function correctionLabel(type) {
  return {
    manual: '用户修正',
    glossary: '术语命中',
    auto: '上下文修正',
  }[type] ?? '已修正';
}

function LiveWorkflow({ stage, hasSubtitles }) {
  const activeIndex = {
    idle: 0,
    requesting: 0,
    captured: 1,
    'asr-ready': 2,
    running: 2,
    paused: hasSubtitles ? 4 : 1,
    error: 0,
  }[stage] ?? 0;
  const steps = [
    '1 Select live source',
    '2 Capture browser audio',
    '3 Chunk ASR',
    '4 Chinese captions',
    '5 Correction & export',
  ];

  return (
    <div className="live-workflow" aria-label="Live interpretation workflow">
      {steps.map((step, index) => (
        <span className={index <= activeIndex || (index === 3 && hasSubtitles) || (index === 4 && hasSubtitles) ? 'done' : ''} key={step}>
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

function getWaveformLevel(waveformData, index) {
  if (!waveformData.length) return 24 + ((index * 19) % 52);
  const value = waveformData[index % waveformData.length] ?? 0;
  return Math.max(8, Math.round((value / 255) * 70));
}

function SubtitleCard({ subtitle, analysis, isSelected, onSelect, showOriginal, showChinese }) {
  const visibleIssues = analysis?.issues ?? [];

  return (
    <article
      className={`subtitle-card ${subtitle.correctionType ?? ''} ${isSelected ? 'selected' : ''} ${analysis?.riskLevel === 'risk' ? 'risk' : ''}`}
      onClick={onSelect}
    >
      <div className="subtitle-meta">
        <time>{subtitle.timeLabel}</time>
        <div className="subtitle-badges">
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
      {subtitle.termsApplied.length > 0 && (
        <div className="term-hits">
          {subtitle.termsApplied.map((term) => <code key={term}>{term}</code>)}
        </div>
      )}
    </article>
  );
}

function StageRail({ activeStage, stages }) {
  const activeIndex = Math.max(0, stages.findIndex(([id]) => id === activeStage));
  const isError = activeStage === 'error';

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

function getNextAction({
  sourceMode,
  fileMeta,
  asrApiKey,
  apiKey,
  serverHasApiKey,
  provider,
  hasSubtitles,
  correctionCount,
  isRunning,
}) {
  if (isRunning) return '正在同传处理中，等待下一条稳定字幕后可修正或导出。';
  if (sourceMode === 'file' && !fileMeta) return '点击 Use sample audio 加载内置英文样本，再开始文件同传主线。';
  if (sourceMode === 'file' && !asrApiKey && !serverHasApiKey) return '填写 File ASR Key，或启动带 ASR Key 的后端；无 Key 时会明确降级为演示转写流。';
  if (!apiKey && !(provider === 'openai' && serverHasApiKey) && sourceMode !== 'demo') return '填写翻译 Provider Key，或启动带 DASHSCOPE_API_KEY 的后端并选择 Server Gateway。';
  if (!hasSubtitles) return '点击 Start Interpreting，开始生成第一批双语字幕。';
  if (correctionCount === 0) return '点击一条字幕，在 Correction Desk 里保存一次人工修正。';
  return '当前闭环已跑通，可以导出 SRT 或继续添加术语重译。';
}

function getRunButtonLabel({ isRunning, sourceMode, isCapturing, copy }) {
  if (isRunning) return 'Stop Interpreting';
  if (sourceMode === 'live') return isCapturing ? copy.stopLive : copy.chooseLive;
  return copy.start;
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
  const source = currentInterim.en || latestSubtitle?.en || '';
  const target = currentInterim.zh || latestSubtitle?.zh || '';
  const modeLabel = `${formatLanguageCode(sourceLanguage)} -> ${formatLanguageCode(targetLanguage)} · ${copy.subtitles}`;
  const liveStatus = sourceMode === 'live'
    ? `${captureSourceLabel || copy.live} · ${isCapturing ? liveStage : 'idle'} · Done ${liveStats.processed}`
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
