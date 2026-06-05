import { mockGlossary, mockSubtitles } from './mock/subtitles.js';
import { isSTTSupported, startSTTSession, stopSTTSession } from './engine/index.js';
import { useStore } from './store/index.js';

export default function App() {
  const isRunning = useStore((state) => state.isRunning);
  const latencyMs = useStore((state) => state.latencyMs);
  const currentInterim = useStore((state) => state.currentInterim);
  const liveSubtitles = useStore((state) => state.subtitles);
  const activeSubtitle = mockSubtitles.find((subtitle) => subtitle.isCurrent) ?? mockSubtitles.at(-1);
  const displaySubtitles = liveSubtitles.length > 0 ? liveSubtitles : mockSubtitles;
  const latestSubtitle = displaySubtitles.find((subtitle) => subtitle.isCurrent)
    ?? displaySubtitles.at(-1)
    ?? activeSubtitle;

  const handleRunClick = () => {
    if (isRunning) {
      stopSTTSession();
      return;
    }

    startSTTSession();
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
          {isRunning ? 'Mic stream active' : 'Demo stream active'}
        </div>
        <div className="top-actions" aria-label="Header actions">
          <button type="button">Export</button>
          <button type="button">Copy</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="left-panel" aria-label="Interpreter controls">
          <section className="panel-block">
            <h2>Input Source</h2>
            <div className="segmented">
              <button type="button" className="active">Demo</button>
              <button type="button">Mic</button>
              <button type="button">File</button>
              <button type="button">Live</button>
            </div>
            <div className="source-card">
              <strong>Global AI Product Launch</strong>
              <span>
                {isSTTSupported()
                  ? 'Mic STT available · Demo fallback ready'
                  : 'Web Speech unavailable · Demo fallback ready'}
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
              {mockGlossary.map((term) => (
                <div className={term.enabled ? 'term enabled' : 'term'} key={term.source}>
                  <span>{term.source}</span>
                  <strong>{term.target}</strong>
                </div>
              ))}
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
              <article className={`subtitle-card ${subtitle.correctionType ?? ''}`} key={subtitle.id}>
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
              <p>{latestSubtitle.en}</p>
            </div>
            <div className="editor-preview">{latestSubtitle.zh}</div>
            <button type="button">Save correction</button>
            <button type="button">Retranslate with glossary</button>
          </div>

          <div className="subtitle-banner">
            <span>Current Chinese Subtitle</span>
            <strong>{currentInterim.zh || latestSubtitle.zh}</strong>
          </div>

          <footer className="stats-bar">
            <span>Translated {displaySubtitles.length}</span>
            <span>Corrections 3</span>
            <span>Glossary 3</span>
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
