import { useEffect, useMemo, useState } from 'react';
import { mockGlossary, mockSubtitles } from './mock/subtitles.js';
import {
  isSTTSupported,
  startDemoStream,
  startSTTSession,
  stopDemoStream,
  stopSTTSession,
} from './engine/index.js';
import { useStore } from './store/index.js';
import { copyBilingual, exportSRT } from './utils/export.js';

export default function App() {
  const isRunning = useStore((state) => state.isRunning);
  const latencyMs = useStore((state) => state.latencyMs);
  const currentInterim = useStore((state) => state.currentInterim);
  const sourceMode = useStore((state) => state.sourceMode);
  const subtitles = useStore((state) => state.subtitles);
  const glossary = useStore((state) => state.glossary);
  const correctionCount = useStore((state) => state.correctionCount);
  const selectedSubtitleId = useStore((state) => state.selectedSubtitleId);
  const setSourceMode = useStore((state) => state.setSourceMode);
  const addGlossaryTerm = useStore((state) => state.addGlossaryTerm);
  const selectSubtitle = useStore((state) => state.selectSubtitle);
  const updateSubtitleTranslation = useStore((state) => state.updateSubtitleTranslation);
  const retranslateSubtitle = useStore((state) => state.retranslateSubtitle);
  const [draftZh, setDraftZh] = useState('');
  const [termSource, setTermSource] = useState('');
  const [termTarget, setTermTarget] = useState('');
  const displaySubtitles = subtitles.length > 0 ? subtitles : mockSubtitles;
  const selectedSubtitle = useMemo(() => (
    displaySubtitles.find((subtitle) => subtitle.id === selectedSubtitleId)
      ?? displaySubtitles.find((subtitle) => subtitle.isCurrent)
      ?? displaySubtitles.at(-1)
  ), [displaySubtitles, selectedSubtitleId]);

  useEffect(() => {
    if (glossary.length === 0) {
      mockGlossary.forEach((term) => addGlossaryTerm(term));
    }
  }, [addGlossaryTerm, glossary.length]);

  useEffect(() => {
    setDraftZh(selectedSubtitle?.zh ?? '');
  }, [selectedSubtitle?.id, selectedSubtitle?.zh]);

  const handleRunClick = () => {
    if (isRunning) {
      if (sourceMode === 'demo') {
        stopDemoStream();
        useStore.getState().stopTranslation();
      } else {
        stopSTTSession();
      }
      return;
    }

    if (sourceMode === 'mic') {
      startSTTSession();
      return;
    }

    startDemoStream();
  };

  const handleSaveCorrection = () => {
    if (!selectedSubtitle || !draftZh.trim()) return;
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
    exportSRT(displaySubtitles);
  };

  const handleCopy = async () => {
    await copyBilingual(displaySubtitles);
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
          {isRunning ? `${sourceMode} stream active` : 'Demo stream ready'}
        </div>
        <div className="top-actions" aria-label="Header actions">
          <button type="button" onClick={handleExport}>Export</button>
          <button type="button" onClick={handleCopy}>Copy</button>
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
              <button type="button" onClick={() => setSourceMode('file')}>File</button>
              <button type="button" onClick={() => setSourceMode('live')}>Live</button>
            </div>
            <div className="source-card">
              <strong>Global AI Product Launch</strong>
              <span>
                {sourceMode === 'demo'
                  ? 'Stable review demo · captions stream by timeline'
                  : (isSTTSupported()
                    ? 'Mic STT available · Demo fallback ready'
                    : 'Web Speech unavailable · Demo fallback ready')}
              </span>
            </div>
          </section>

          <section className="panel-block">
            <h2>Provider</h2>
            <div className="field-line">
              <span>DeepSeek</span>
              <code>openai-compatible</code>
            </div>
            <div className="secret-input">API key is local only</div>
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
              <input type="checkbox" />
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
                style={{ '--level': `${24 + ((index * 19) % 52)}%` }}
              />
            ))}
          </div>
          <div className="progress-track"><span /></div>

          <div className="subtitle-scroll">
            {displaySubtitles.length === 0 && !currentInterim.en && (
              <article className="subtitle-card empty-state">
                <div className="subtitle-meta">
                  <time>ready</time>
                  <span>演示待开始</span>
                </div>
                <p className="source-text">
                  Click Start Interpreting to play the built-in review transcript.
                </p>
                <p className="translated-text">点击开始后，字幕会按时间逐句出现。</p>
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
            <button type="button" onClick={handleSaveCorrection}>Save correction</button>
            <button type="button" onClick={() => retranslateSubtitle(selectedSubtitle.id)}>
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
            <span>Provider DeepSeek</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function correctionLabel(type) {
  return {
    manual: '用户修正',
    glossary: '术语命中',
    auto: '上下文修正',
  }[type] ?? '已修正';
}
