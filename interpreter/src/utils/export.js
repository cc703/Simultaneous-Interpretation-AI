export function exportSRT(subtitles, sessionStartTime = getSessionStart(subtitles)) {
  const content = buildSRT(subtitles, sessionStartTime);
  downloadText(`subtitles_${Date.now()}.srt`, content);
  return content;
}

export function exportBilingual(subtitles) {
  const content = buildBilingualText(subtitles);
  downloadText(`transcript_${Date.now()}.txt`, content);
  return content;
}

export function exportReviewReport({
  subtitles,
  glossary,
  correctionHistory,
  qualitySummary,
  sourceMode,
  provider,
}) {
  const content = buildReviewReport({
    subtitles,
    glossary,
    correctionHistory,
    qualitySummary,
    sourceMode,
    provider,
  });
  downloadText(`interpretation_review_${Date.now()}.md`, content);
  return content;
}

export async function copyBilingual(subtitles) {
  const content = buildBilingualText(subtitles);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return content;
  }
  downloadText(`transcript_${Date.now()}.txt`, content);
  return content;
}

export function buildSRT(subtitles, sessionStartTime = getSessionStart(subtitles)) {
  return subtitles
    .map((subtitle, index) => {
      const startMs = subtitle.timestamp - sessionStartTime;
      const next = subtitles[index + 1];
      const endMs = next ? next.timestamp - sessionStartTime : startMs + 5000;

      return [
        index + 1,
        `${msToSRT(startMs)} --> ${msToSRT(endMs)}`,
        subtitle.en,
        subtitle.zh,
      ].join('\n');
    })
    .join('\n\n');
}

export function buildBilingualText(subtitles) {
  return subtitles
    .map((subtitle, index) => [
      `[${index + 1}] ${subtitle.timeLabel}`,
      `EN: ${subtitle.en}`,
      `ZH: ${subtitle.zh}`,
    ].join('\n'))
    .join('\n\n');
}

export function buildReviewReport({
  subtitles,
  glossary,
  correctionHistory,
  qualitySummary,
  sourceMode,
  provider,
}) {
  const risky = qualitySummary?.risky ?? [];
  const analyses = qualitySummary?.analyses ?? [];
  const glossaryHits = qualitySummary?.glossaryHits ?? [];
  const corrected = qualitySummary?.corrected ?? [];

  return [
    '# AI 同声传译复盘报告',
    '',
    `- 输入模式：${sourceMode}`,
    `- 翻译 Provider：${provider}`,
    `- 字幕句数：${subtitles.length}`,
    `- 风险句数：${risky.length}`,
    `- 术语命中：${glossaryHits.length}`,
    `- 人工修正：${corrected.length}`,
    '',
    '## 质量诊断',
    risky.length
      ? risky.map((item, index) => [
        `### ${index + 1}. ${item.subtitle.timeLabel}`,
        `EN: ${item.subtitle.en}`,
        `ZH: ${item.subtitle.zh}`,
        `风险：${item.issues.filter((issue) => !issue.positive).map((issue) => `${issue.label} - ${issue.detail}`).join('；')}`,
      ].join('\n')).join('\n\n')
      : '暂无高风险字幕。',
    '',
    '## 术语表',
    glossary.length
      ? glossary.map((term) => `- ${term.source} -> ${term.target}${term.note ? `（${term.note}）` : ''}`).join('\n')
      : '暂无术语。',
    '',
    '## 修正记录',
    correctionHistory.length
      ? correctionHistory.map((record, index) => {
        const subtitle = subtitles.find((item) => item.id === record.subtitleId);
        return [
          `### ${index + 1}. ${record.type}`,
          subtitle?.en ? `EN: ${subtitle.en}` : '',
          `Before: ${record.beforeZh}`,
          `After: ${record.afterZh}`,
          `Reason: ${record.reason}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n')
      : '暂无人工修正记录。',
    '',
    '## 完整双语转写',
    buildBilingualText(subtitles),
    '',
    '## 逐句标签',
    analyses.length
      ? analyses.map((item, index) => {
        const labels = item.issues.map((issue) => issue.label).join('、') || '正常';
        return `- [${index + 1}] ${item.subtitle.timeLabel}：${labels}`;
      }).join('\n')
      : '暂无字幕。',
  ].join('\n');
}

export function msToSRT(ms) {
  const safeMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const milliseconds = safeMs % 1000;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + `,${String(milliseconds).padStart(3, '0')}`;
}

function getSessionStart(subtitles) {
  return subtitles[0]?.timestamp ?? Date.now();
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
