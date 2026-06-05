import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Captions,
  ClipboardCheck,
  AlertTriangle,
  FileAudio,
  Mic,
  Radio,
  Settings,
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
  setTTSRate,
} from './engine/index.js';
import { useStore } from './store/index.js';
import { copyBilingual, exportReviewReport, exportSRT } from './utils/export.js';
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
  const [configTab, setConfigTab] = useState('translate');
  const audioRef = useRef(null);
  const displaySubtitles = subtitles;
  const hasSubtitles = displaySubtitles.length > 0;
  const activeDemoScenario = getDemoScenario(demoScenarioId);
  const hasServerAsrKey = Boolean(serverHealth.ok && (serverHealth.hasAsrKey ?? serverHealth.hasOpenAIKey));
  const hasLiveAsr = Boolean(asrApiKey.trim() || hasServerAsrKey);
  const workflowSteps = buildWorkflowSteps({
    sourceMode,
    fileMeta,
    asrApiKey,
    serverHasApiKey: hasServerAsrKey,
    apiKey,
    provider,
    hasSubtitles,
    correctionCount,
  });
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
  const glossaryHitCount = displaySubtitles.filter((subtitle) => subtitle.termsApplied.length > 0).length;
  const readinessScore = workflowSteps.filter((step) => step.done).length;
  const qualitySummary = useMemo(
    () => summarizeQuality(displaySubtitles, glossary),
    [displaySubtitles, glossary],
  );
  const correctionMemory = useMemo(
    () => buildCorrectionMemory(correctionHistory, displaySubtitles),
    [correctionHistory, displaySubtitles],
  );
  const demoGuideItems = buildDemoGuideItems({
    sourceMode,
    activeDemoScenario,
    hasSubtitles,
    glossaryHitCount,
    correctionCount,
    correctionMemory,
    qualitySummary,
  });
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
    setTTSRate(ttsRate);
  }, [ttsRate]);

  useEffect(() => {
    setDraftZh(selectedSubtitle?.zh ?? '');
  }, [selectedSubtitle?.id, selectedSubtitle?.zh]);

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

  const handleExportReview = () => {
    if (!hasSubtitles) return;
    exportReviewReport({
      subtitles: displaySubtitles,
      glossary,
      correctionHistory,
      qualitySummary,
      sourceMode,
      provider,
    });
  };

  const handleCopy = async () => {
    if (!hasSubtitles) return;
    await copyBilingual(displaySubtitles);
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
            <p>Topic 2 · 实时英中同传工作台</p>
          </div>
        </div>
        <div className="status-pill">
          <span />
          {isRunning
            ? `${sourceMode} audio -> Chinese captions`
            : 'Interpreter console ready'}
        </div>
        <div className="top-actions" aria-label="Header actions">
          <button type="button" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} />
            Settings
          </button>
          <button type="button" disabled={!hasSubtitles} onClick={handleExport}>Export</button>
          <button type="button" disabled={!hasSubtitles} onClick={handleExportReview}>Review</button>
          <button type="button" disabled={!hasSubtitles} onClick={handleCopy}>Copy</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-panel" aria-label="Interpreter controls">
          <section className="panel-block product-guide">
            <h2>Workflow</h2>
            <div className="workflow-steps">
              {workflowSteps.map((step) => (
                <div className={`workflow-step ${step.done ? 'done' : ''}`} key={step.label}>
                  <step.icon size={15} />
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
            <div className="next-action">
              <PlayCircle size={16} />
              <span>{nextAction}</span>
            </div>
          </section>

          <section className="panel-block">
            <h2>Input Source</h2>
            <div className="segmented">
              <button
                type="button"
                className={sourceMode === 'demo' ? 'active' : ''}
                onClick={() => setSourceMode('demo')}
              >
                <Sparkles size={14} />
                Demo
              </button>
              <button
                type="button"
                className={sourceMode === 'mic' ? 'active' : ''}
                onClick={() => setSourceMode('mic')}
              >
                <Mic size={14} />
                Mic
              </button>
              <button
                type="button"
                className={sourceMode === 'file' ? 'active' : ''}
                onClick={() => setSourceMode('file')}
              >
                <FileAudio size={14} />
                File
              </button>
              <button
                type="button"
                className={sourceMode === 'live' ? 'active' : ''}
                onClick={() => setSourceMode('live')}
              >
                <Radio size={14} />
                Live
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
                    <strong>Ready without keys · {activeDemoScenario.transcript.length} captions</strong>
                    <span>选择一个场景后点击开始，系统会播放内置英文语音流，并按该场景术语生成中文字幕。</span>
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
                  {isSampleLoading ? 'Loading sample...' : 'Use sample audio'}
                </button>
                <label>
                  <span><Upload size={13} /> Upload media</span>
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
                  {getLivePrimaryAction({ isCapturing, liveStage, hasLiveAsr })}
                </button>
                <p>适用于网页直播、社交平台直播、媒体直播和线上会议。用户需要在浏览器共享弹窗中选择标签页或屏幕，并共享音频。</p>
                <div className="live-state-grid" aria-label="Live interpretation status">
                  <LiveStateItem label="Source" value={captureSourceLabel || 'Not selected'} state={captureSourceLabel ? 'ok' : 'idle'} />
                  <LiveStateItem label="Permission" value={isCapturing ? 'Audio captured' : liveStage === 'requesting' ? 'Requesting' : 'Required'} state={isCapturing ? 'ok' : liveStage === 'requesting' ? 'warn' : 'idle'} />
                  <LiveStateItem label="ASR" value={hasLiveAsr ? 'Provider ready' : 'Not configured'} state={hasLiveAsr ? 'ok' : 'warn'} />
                  <LiveStateItem label="Chunking" value={`${chunkSeconds}s chunks`} state="ok" />
                  <LiveStateItem label="Output" value={hasSubtitles ? 'Captions ready' : 'Waiting'} state={hasSubtitles ? 'ok' : 'idle'} />
                </div>
                <div className="live-boundary">
                  Live 是几秒级准实时分片；没有 ASR Key 时只展示捕获、波形和配置缺口，不生成直播假字幕。
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

          <section className="panel-block config-panel">
            <h2>Configuration</h2>
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
                  <option value="openai">OpenAI</option>
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
                  Browser key stays in memory. OpenAI can also use the local server proxy.
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
                  <option value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe</option>
                  <option value="gpt-4o-transcribe">gpt-4o-transcribe</option>
                  <option value="whisper-1">whisper-1</option>
                </select>
                <input
                  className="settings-control"
                  aria-label="ASR base URL"
                  placeholder="https://api.openai.com/v1"
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
                <div className="secret-input">File and Live modes use /audio/transcriptions</div>
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
          </section>

          <section className="panel-block">
            <h2>Subtitle Settings</h2>
            <label className="toggle-line">
              <input
                checked={showOriginal}
                type="checkbox"
                onChange={(event) => setShowOriginal(event.target.checked)}
              />
              <span>Show original English</span>
            </label>
            <label className="toggle-line">
              <input
                checked={showBanner}
                type="checkbox"
                onChange={(event) => setShowBanner(event.target.checked)}
              />
              <span>Bottom subtitle banner</span>
            </label>
            <label className="toggle-line">
              <input
                checked={autoCorrect}
                type="checkbox"
                onChange={(event) => setAutoCorrect(event.target.checked)}
              />
              <span>Auto correction memory</span>
            </label>
            <label className="toggle-line">
              <input
                checked={voiceOutput}
                type="checkbox"
                onChange={(event) => setVoiceOutput(event.target.checked)}
              />
              <span>Chinese voice output</span>
            </label>
          </section>

          <button className="run-button" type="button" onClick={handleRunClick}>
            {getRunButtonLabel({ isRunning, sourceMode, isCapturing })}
          </button>
        </aside>

        <section className="right-panel" aria-label="Subtitle workspace">
          <div className="toolbar">
            <div className="mode-tabs">
              <button
                type="button"
                className={subtitleMode === 'bilingual' ? 'active' : ''}
                onClick={() => setSubtitleMode('bilingual')}
              >
                Bilingual
              </button>
              <button
                type="button"
                className={subtitleMode === 'zh-only' ? 'active' : ''}
                onClick={() => setSubtitleMode('zh-only')}
              >
                ZH only
              </button>
              <button
                type="button"
                className={subtitleMode === 'en-only' ? 'active' : ''}
                onClick={() => setSubtitleMode('en-only')}
              >
                EN only
              </button>
            </div>
            <div className="toolbar-note">
              Latency {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '1.8s'} · Context {contextWindow} · ASR {serverHealth.asrProvider ?? (serverHealth.hasOpenAIKey ? 'server' : 'browser')}
            </div>
          </div>

          <div className="quality-strip" aria-label="Session quality overview">
            <div>
              <span>Readiness</span>
              <strong>{readinessScore}/{workflowSteps.length}</strong>
            </div>
            <div>
              <span>Real Input</span>
              <strong>{sourceMode === 'file' && (asrApiKey || hasServerAsrKey) ? 'File ASR' : sourceMode === 'mic' ? 'Mic STT' : sourceMode === 'live' ? 'Live capture' : 'Demo'}</strong>
            </div>
            <div>
              <span>Glossary Hits</span>
              <strong>{glossaryHitCount} · {qualitySummary.glossaryHitRate}%</strong>
            </div>
            <div>
              <span>Risks</span>
              <strong>{qualitySummary.riskCount}</strong>
            </div>
          </div>

          <div className="demo-guide" aria-label="Demo guide">
            <div className="demo-guide-copy">
              <span>{sourceMode === 'demo' ? activeDemoScenario.badge : '实测模式'}</span>
              <strong>{sourceMode === 'demo' ? activeDemoScenario.title : 'Real input interpretation'}</strong>
              <p>{getDemoGuideHint({ sourceMode, hasSubtitles, correctionCount })}</p>
            </div>
            <div className="demo-proof-grid">
              {demoGuideItems.map((item) => (
                <div className={item.done ? 'done' : ''} key={item.label}>
                  <item.icon size={15} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>

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

          <div className="subtitle-scroll">
            {displaySubtitles.length === 0 && !currentInterim.en && (
              <article className="subtitle-card empty-state">
                <div className="subtitle-meta">
                  <time>ready</time>
                  <span>演示待开始</span>
                </div>
                {shouldShowOriginal(subtitleMode, showOriginal) && (
                  <p className="source-text">
                    Click Start Interpreting to play the built-in English voice stream.
                  </p>
                )}
                {shouldShowChinese(subtitleMode) && (
                  <p className="translated-text">点击开始后，系统会模拟外语音频输入，并流式生成中文字幕。</p>
                )}
              </article>
            )}
            {currentInterim.en && (
              <article className="subtitle-card interim">
                <div className="subtitle-meta">
                  <time>live</time>
                  <span>识别中</span>
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

          <div className="review-panel">
            <section>
              <h2><AlertTriangle size={15} /> Risk Review</h2>
              {qualitySummary.risky.length === 0 ? (
                <p className="review-empty">暂无高风险字幕。生成字幕后会自动检查漏译、术语和占位问题。</p>
              ) : (
                <div className="review-list">
                  {qualitySummary.risky.slice(0, 3).map((item) => (
                    <button type="button" key={item.subtitle.id} onClick={() => selectSubtitle(item.subtitle.id)}>
                      <strong>{item.subtitle.timeLabel}</strong>
                      <span>{item.issues.find((issue) => !issue.positive)?.detail}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2><BadgeCheck size={15} /> Correction Memory</h2>
              {correctionMemory.length === 0 ? (
                <p className="review-empty">保存人工修正后，这里会沉淀为后续翻译参考。</p>
              ) : (
                <div className="memory-list">
                  {correctionMemory.slice(-3).map((record) => (
                    <div key={record.id}>
                      <span>{record.en}</span>
                      <strong>{record.afterZh}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="correction-editor">
            <div>
              <h2>Correction Desk</h2>
              <p>{selectedSubtitle.en}</p>
            </div>
            <textarea
              className="editor-preview"
              aria-label="Corrected Chinese subtitle"
              value={draftZh}
              onChange={(event) => setDraftZh(event.target.value)}
            />
            <button type="button" disabled={!hasSelectedSubtitle} onClick={handleSaveCorrection}>
              <ClipboardCheck size={15} />
              Save correction
            </button>
            <button
              type="button"
              disabled={!hasSelectedSubtitle}
              onClick={() => retranslateSubtitle(selectedSubtitle.id)}
            >
              <Wand2 size={15} />
              Retranslate with glossary
            </button>
          </div>

          {showBanner && (
            <div className="subtitle-banner">
              <span>{subtitleMode === 'en-only' ? 'Current English Subtitle' : 'Current Chinese Subtitle'}</span>
              <strong>{subtitleMode === 'en-only' ? (currentInterim.en || selectedSubtitle.en) : (currentInterim.zh || selectedSubtitle.zh)}</strong>
            </div>
          )}

          <footer className="stats-bar">
            <span>Translated {displaySubtitles.length}</span>
            <span>Corrections {correctionCount}</span>
            <span>Glossary {glossary.length}</span>
            <span>Provider {provider}</span>
          </footer>
        </section>
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="settings-modal" aria-label="Advanced settings">
            <header>
              <div>
                <h2>Advanced Settings</h2>
                <p>实时影响后续翻译，不需要重启会话。</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}>Close</button>
            </header>
            <label>
              <span>翻译语言</span>
              <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                <option value="zh-CN">{'英语 -> 中文（简体）'}</option>
                <option value="zh-TW">{'英语 -> 中文（繁体）'}</option>
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
              <span>音频分片长度：{chunkSeconds}s</span>
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

function buildWorkflowSteps({ sourceMode, fileMeta, asrApiKey, serverHasApiKey, apiKey, provider, hasSubtitles, correctionCount }) {
  const inputReady = sourceMode === 'demo'
    || sourceMode === 'mic'
    || sourceMode === 'live'
    || Boolean(fileMeta);
  const recognitionReady = sourceMode === 'file' || sourceMode === 'live'
    ? Boolean(asrApiKey || serverHasApiKey)
    : true;

  return [
    { label: 'Input', icon: sourceMode === 'file' ? FileAudio : sourceMode === 'mic' ? Mic : sourceMode === 'live' ? Radio : Sparkles, done: inputReady },
    { label: 'ASR', icon: Captions, done: recognitionReady },
    { label: 'Translate', icon: Wand2, done: Boolean(apiKey) || (provider === 'openai' && serverHasApiKey) || sourceMode === 'demo' || hasSubtitles },
    { label: 'Correct', icon: BadgeCheck, done: correctionCount > 0 },
    { label: 'Export', icon: ClipboardCheck, done: hasSubtitles },
  ];
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
  if (!apiKey && !(provider === 'openai' && serverHasApiKey) && sourceMode !== 'demo') return '填写翻译 Provider Key，或启动带 OPENAI_API_KEY 的后端并选择 OpenAI Provider。';
  if (!hasSubtitles) return '点击 Start Interpreting，开始生成第一批双语字幕。';
  if (correctionCount === 0) return '点击一条字幕，在 Correction Desk 里保存一次人工修正。';
  return '当前闭环已跑通，可以导出 SRT 或继续添加术语重译。';
}

function buildDemoGuideItems({
  sourceMode,
  activeDemoScenario,
  hasSubtitles,
  glossaryHitCount,
  correctionCount,
  correctionMemory,
  qualitySummary,
}) {
  return [
    {
      label: '输入流',
      value: sourceMode === 'demo' ? activeDemoScenario.label : sourceMode,
      icon: sourceMode === 'demo' ? Sparkles : sourceMode === 'file' ? FileAudio : sourceMode === 'live' ? Radio : Mic,
      done: hasSubtitles,
    },
    {
      label: '术语',
      value: glossaryHitCount > 0 ? `${glossaryHitCount} hits` : `${activeDemoScenario.terms.length} ready`,
      icon: Languages,
      done: glossaryHitCount > 0,
    },
    {
      label: '修正',
      value: correctionCount > 0 ? `${correctionCount} saved` : '待修正',
      icon: BadgeCheck,
      done: correctionMemory.length > 0,
    },
    {
      label: '复盘',
      value: hasSubtitles ? `${qualitySummary.riskCount} risks` : '待导出',
      icon: ClipboardCheck,
      done: hasSubtitles,
    },
  ];
}

function getDemoGuideHint({ sourceMode, hasSubtitles, correctionCount }) {
  if (sourceMode !== 'demo') return '真实输入模式会复用同一套字幕、修正、术语和导出工作台。';
  if (!hasSubtitles) return '先选择一个场景并点击开始，观察英文语音流如何逐句变成中文字幕。';
  if (correctionCount === 0) return '下一步点击一条字幕，在 Correction Desk 保存一次人工修正。';
  return '闭环已跑通，可以导出 SRT 或 Review 报告作为演示证据。';
}

function getRunButtonLabel({ isRunning, sourceMode, isCapturing }) {
  if (isRunning) return 'Stop Interpreting';
  if (sourceMode === 'demo') return 'Start Demo Interpretation';
  if (sourceMode === 'mic') return 'Start Mic STT';
  if (sourceMode === 'file') return 'Transcribe Uploaded File';
  if (sourceMode === 'live') return isCapturing ? 'Stop Live Capture' : 'Choose Live Audio';
  return 'Start Interpreting';
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
