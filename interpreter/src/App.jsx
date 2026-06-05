import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Captions,
  ClipboardCheck,
  FileAudio,
  Mic,
  Radio,
  Settings,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { mockGlossary } from './mock/subtitles.js';
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
import { copyBilingual, exportSRT } from './utils/export.js';

export default function App() {
  const isRunning = useStore((state) => state.isRunning);
  const latencyMs = useStore((state) => state.latencyMs);
  const currentInterim = useStore((state) => state.currentInterim);
  const waveformData = useStore((state) => state.waveformData);
  const sourceMode = useStore((state) => state.sourceMode);
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
  const voiceOutput = useStore((state) => state.voiceOutput);
  const ttsRate = useStore((state) => state.ttsRate);
  const ttsQuality = useStore((state) => state.ttsQuality);
  const captureStream = useStore((state) => state.captureStream);
  const captureSourceLabel = useStore((state) => state.captureSourceLabel);
  const isCapturing = useStore((state) => state.isCapturing);
  const subtitles = useStore((state) => state.subtitles);
  const glossary = useStore((state) => state.glossary);
  const correctionCount = useStore((state) => state.correctionCount);
  const selectedSubtitleId = useStore((state) => state.selectedSubtitleId);
  const setSourceMode = useStore((state) => state.setSourceMode);
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
  const setVoiceOutput = useStore((state) => state.setVoiceOutput);
  const setStoreTtsRate = useStore((state) => state.setTtsRate);
  const setTtsQuality = useStore((state) => state.setTtsQuality);
  const setUploadedFile = useStore((state) => state.setUploadedFile);
  const setCaptureStream = useStore((state) => state.setCaptureStream);
  const addGlossaryTerm = useStore((state) => state.addGlossaryTerm);
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
  const audioRef = useRef(null);
  const displaySubtitles = subtitles;
  const hasSubtitles = displaySubtitles.length > 0;
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
          <span className="brand-mark">SI</span>
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
                    : 'Global AI Product Launch'}
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

          <section className="panel-block">
            <h2>Provider</h2>
            <div className="field-line">
              <span>{provider}</span>
              <code>openai-compatible</code>
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
              placeholder="API key (memory only)"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <div className="secret-input">API key stays in memory and is not saved to localStorage</div>
          </section>

          <section className="panel-block">
            <h2>File ASR</h2>
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
              placeholder="OpenAI ASR key (memory only)"
              type="password"
              value={asrApiKey}
              onChange={(event) => setAsrApiKey(event.target.value)}
            />
            <div className="secret-input">File mode uses /audio/transcriptions when this key is present</div>
          </section>

          <section className="panel-block">
            <h2>Glossary</h2>
            <div className="glossary-list">
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
          </section>

          <section className="panel-block">
            <h2>Subtitle Settings</h2>
            <label className="toggle-line">
              <input type="checkbox" defaultChecked />
              <span>Bilingual captions</span>
            </label>
            <label className="toggle-line">
              <input type="checkbox" defaultChecked />
              <span>Auto correction</span>
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
            {isRunning ? 'Stop Interpreting' : 'Start Interpreting'}
          </button>
        </aside>

        <section className="right-panel" aria-label="Subtitle workspace">
          <div className="toolbar">
            <div className="mode-tabs">
              <button type="button" className="active">Bilingual</button>
              <button type="button">ZH only</button>
              <button type="button">EN only</button>
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
              <strong>{glossaryHitCount}</strong>
            </div>
            <div>
              <span>Corrections</span>
              <strong>{correctionCount}</strong>
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
                <p className="source-text">
                  Click Start Interpreting to play the built-in English voice stream.
                </p>
                <p className="translated-text">点击开始后，系统会模拟外语音频输入，并流式生成中文字幕。</p>
              </article>
            )}
            {currentInterim.en && (
              <article className="subtitle-card interim">
                <div className="subtitle-meta">
                  <time>live</time>
                  <span>识别中</span>
                </div>
                <p className="source-text">{currentInterim.en}</p>
                <p className="translated-text">{currentInterim.zh || '等待最终识别...'}</p>
              </article>
            )}
            {displaySubtitles.map((subtitle) => (
              <article
                className={`subtitle-card ${subtitle.correctionType ?? ''} ${subtitle.id === selectedSubtitle?.id ? 'selected' : ''}`}
                key={subtitle.id}
                onClick={() => selectSubtitle(subtitle.id)}
              >
                <div className="subtitle-meta">
                  <time>{subtitle.timeLabel}</time>
                  {subtitle.correctionType && (
                    <span>{correctionLabel(subtitle.correctionType)}</span>
                  )}
                </div>
                <p className="source-text">{subtitle.en}</p>
                <p className="translated-text">{subtitle.zh}</p>
                {subtitle.termsApplied.length > 0 && (
                  <div className="term-hits">
                    {subtitle.termsApplied.map((term) => <code key={term}>{term}</code>)}
                  </div>
                )}
              </article>
            ))}
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

          <div className="subtitle-banner">
            <span>Current Chinese Subtitle</span>
            <strong>{currentInterim.zh || selectedSubtitle.zh}</strong>
          </div>

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
