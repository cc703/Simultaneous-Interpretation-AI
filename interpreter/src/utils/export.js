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
