import { useEffect, useMemo, useRef, useState } from 'react';
import { mockGlossary } from './mock/subtitles.js';
import {
  isSTTSupported,
  startDemoStream,
  startElementAnalyser,
  startFileDemoStream,
  startStreamAnalyser,
  startSTTSession,
  startSystemAudioCapture,
  stopAudioAnalyser,
  stopDemoStream,
  stopSTTSession,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const audioRef = useRef(null);
  const displaySubtitles = subtitles;
  const hasSubtitles = displaySubtitles.length > 0;
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

  const handleRunClick = () => {
    if (isRunning) {
      if (sourceMode === 'demo' || sourceMode === 'file') {
        stopDemoStream();
        stopAudioAnalyser();
        cancelTTS();
        useStore.getState().stopTranslation();
      } else {
        stopAudioAnalyser();
        cancelTTS();
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
      startFileDemoStream(audioRef.current);
      return;
    }

    startDemoStream();
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
      stopSystemAudioCapture(captureStream);
      setCaptureStream(null, '');
      return;
    }

    setSourceMode('live');
    const result = await startSystemAudioCapture({
      onAudioStream: ({ audioStream, label }) => {
        setCaptureStream(audioStream, label);
        startStreamAnalyser(audioStream);
      },
      onError: (error) => {
        console.warn('[live-capture] failed:', error);
      },
    });
    setCaptureStream(result.audioStream, result.label);
    startStreamAnalyser(result.audioStream);
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
          <button type="button" onClick={() => setSettingsOpen(true)}>Settings</button>
          <button type="button" disabled={!hasSubtitles} onClick={handleExport}>Export</button>
          <button type="button" disabled={!hasSubtitles} onClick={handleCopy}>Copy</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-panel" aria-label="Interpreter controls">
          <section className="panel-block">
            <h2>Input Source</h2>
            <div className="segmented">
              <button
                type="button"
                className={sourceMode === 'demo' ? 'active' : ''}
                onClick={() => setSourceMode('demo')}
              >
                Demo
              </button>
              <button
                type="button"
                className={sourceMode === 'mic' ? 'active' : ''}
                onClick={() => setSourceMode('mic')}
              >
                Mic
              </button>
              <button
                type="button"
                className={sourceMode === 'file' ? 'active' : ''}
                onClick={() => setSourceMode('file')}
              >
                File
              </button>
              <button
                type="button"
                className={sourceMode === 'live' ? 'active' : ''}
                onClick={() => setSourceMode('live')}
              >
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
                  ? 'File playback drives the same timestamped caption stream'
                  : sourceMode === 'live'
                    ? 'Captured system audio is ready for ASR adapter expansion'
                  : sourceMode === 'demo'
                  ? 'Built-in English voice + streaming Chinese captions'
                  : (isSTTSupported()
                    ? 'Mic STT available · Demo fallback ready'
                    : 'Web Speech unavailable · Demo fallback ready')}
              </span>
            </div>
            <div className="file-uploader">
              <label>
                <span>Upload media</span>
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
                    ? '已捕获直播音频。当前 MVP 展示捕获与释放能力，直接 ASR 识别预留给 ASR Adapter。'
                    : '选择带英文音频的标签页或屏幕，浏览器会显示共享权限提示。'}
                </p>
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
              Latency {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : '1.8s'} · Context window 6
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
            <button type="button" disabled={!hasSelectedSubtitle} onClick={handleSaveCorrection}>Save correction</button>
            <button
              type="button"
              disabled={!hasSelectedSubtitle}
              onClick={() => retranslateSubtitle(selectedSubtitle.id)}
            >
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
