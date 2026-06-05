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
  Sparkles,
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
  const [liveStatus, setLiveStatus] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configTab, setConfigTab] = useState('translate');
  const audioRef = useRef(null);
  const displaySubtitles = subtitles;
  const hasSubtitles = displaySubtitles.length > 0;
  const activeDemoScenario = getDemoScenario(demoScenarioId);
  const workflowSteps = buildWorkflowSteps({
    sourceMode,
    fileMeta,
    asrApiKey,
    apiKey,
    hasSubtitles,
    correctionCount,
  });
  const nextAction = getNextAction({
    sourceMode,
    fileMeta,
    asrApiKey,
    apiKey,
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
      return;
    }

    if (!asrApiKey.trim()) {
      setFileStatus('未填写 ASR Key，已降级为演示转写流。');
      startFileDemoStream(audioRef.current);
      return;
    }

    const audio = audioRef.current;
    audio?.play().catch((error) => console.warn('[file] preview playback failed:', error));
    useStore.getState().startTranslation();
    setFileStatus('正在调用真实 ASR 转写文件音频...');
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
      setFileStatus('真实 ASR 转写完成，正在进入中文同传翻译。');
      await translateTranscriptText(transcript);
      setFileStatus('文件真实 ASR 与翻译流程完成。');
    } catch (error) {
      console.warn('[file-asr] failed:', error);
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

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
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
    setFileStatus('');
    setSourceMode('file');
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
      setLiveStatus('直播捕获已停止。');
      useStore.getState().stopTranslation();
      return;
    }

    setSourceMode('live');
    setLiveStatus('正在请求标签页或屏幕音频权限...');
    const result = await startSystemAudioCapture({
      onAudioStream: ({ audioStream, label }) => {
        setCaptureStream(audioStream, label);
        startStreamAnalyser(audioStream);
      },
      onError: (error) => {
        console.warn('[live-capture] failed:', error);
        setLiveStatus(error.message || '直播捕获失败。');
      },
    });
    setCaptureStream(result.audioStream, result.label);
    startStreamAnalyser(result.audioStream);
    startLiveAsrIfReady(result.audioStream);
  };

  const startLiveAsrIfReady = (audioStream) => {
    if (!asrApiKey.trim()) {
      setLiveStatus('已捕获直播音频。填写 File ASR Key 后可启动真实直播转写。');
      return;
    }

    try {
      startLiveASR(audioStream, {
        apiKey: asrApiKey,
        baseUrl: asrBaseUrl,
        model: asrModel,
        chunkMs: chunkSeconds * 1000,
        onStatus: setLiveStatus,
      });
    } catch (error) {
      console.warn('[live-asr] start failed:', error);
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
            <p>Topic 2 · AI 同声传译助手</p>
          </div>
        </div>
        <div className="status-pill">
          <span />
          {isRunning
            ? `${sourceMode} audio -> Chinese live`
            : 'Demo audio stream ready'}
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
              <Sparkles size={16} />
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
                  ? (asrApiKey ? 'Real file ASR enabled · audio transcriptions API' : 'Add ASR key for real file transcription')
                  : sourceMode === 'live'
                    ? (asrApiKey ? 'Live ASR chunks enabled · MediaRecorder' : 'Capture audio first · add ASR key for real transcription')
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
                {fileStatus && <div className="file-status">{fileStatus}</div>}
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
                <button type="button" onClick={handleLiveCapture}>
                  {isCapturing ? 'Stop live capture' : 'Choose tab audio'}
                </button>
                <p>
                  {isCapturing
                    ? '已捕获直播音频。若已填写 ASR Key，系统会按设置的分片长度持续转写。'
                    : '选择带英文音频的标签页或屏幕，浏览器会显示共享权限提示。'}
                </p>
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
                  <code>{apiKey ? 'key ready' : 'key needed'}</code>
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
                <div className="secret-input">Translation key is memory only</div>
              </div>
            )}

            {configTab === 'asr' && (
              <div className="config-body">
                <div className="field-line compact">
                  <span>{asrModel}</span>
                  <code>{asrApiKey ? 'key ready' : 'key needed'}</code>
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
              Latency {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '1.8s'} · Context window {contextWindow}
            </div>
          </div>

          <div className="quality-strip" aria-label="Session quality overview">
            <div>
              <span>Readiness</span>
              <strong>{readinessScore}/{workflowSteps.length}</strong>
            </div>
            <div>
              <span>Real Input</span>
              <strong>{sourceMode === 'file' && asrApiKey ? 'File ASR' : sourceMode === 'mic' ? 'Mic STT' : sourceMode === 'live' ? 'Live capture' : 'Demo'}</strong>
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

function buildWorkflowSteps({ sourceMode, fileMeta, asrApiKey, apiKey, hasSubtitles, correctionCount }) {
  const inputReady = sourceMode === 'demo'
    || sourceMode === 'mic'
    || sourceMode === 'live'
    || Boolean(fileMeta);
  const recognitionReady = sourceMode === 'file' || sourceMode === 'live'
    ? Boolean(asrApiKey)
    : true;

  return [
    { label: 'Input', icon: sourceMode === 'file' ? FileAudio : sourceMode === 'mic' ? Mic : sourceMode === 'live' ? Radio : Sparkles, done: inputReady },
    { label: 'ASR', icon: Captions, done: recognitionReady },
    { label: 'Translate', icon: Wand2, done: Boolean(apiKey) || sourceMode === 'demo' || hasSubtitles },
    { label: 'Correct', icon: BadgeCheck, done: correctionCount > 0 },
    { label: 'Export', icon: ClipboardCheck, done: hasSubtitles },
  ];
}

function getNextAction({
  sourceMode,
  fileMeta,
  asrApiKey,
  apiKey,
  hasSubtitles,
  correctionCount,
  isRunning,
}) {
  if (isRunning) return '正在同传处理中，等待下一条稳定字幕后可修正或导出。';
  if (sourceMode === 'file' && !fileMeta) return '先上传一段英文音频或视频，再开始真实文件转写。';
  if (sourceMode === 'file' && !asrApiKey) return '填写 File ASR Key 后，文件模式会走真实音频转写。';
  if (!apiKey && sourceMode !== 'demo') return '填写翻译 Provider Key 后，ASR 结果会继续生成中文字幕。';
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

function shouldShowOriginal(subtitleMode, showOriginal) {
  if (subtitleMode === 'zh-only') return false;
  if (subtitleMode === 'en-only') return true;
  return showOriginal;
}

function shouldShowChinese(subtitleMode) {
  return subtitleMode !== 'en-only';
}
