export function analyzeSubtitleQuality(subtitle, glossary = []) {
  const issues = [];
  const en = subtitle.en ?? '';
  const zh = subtitle.zh ?? '';
  const enabledTerms = glossary.filter((term) => term.enabled);
  const expectedTerms = enabledTerms.filter((term) => en.toLowerCase().includes(term.source.toLowerCase()));
  const missingTerms = expectedTerms.filter((term) => !zh.includes(term.target));

  if (en.length > 120) {
    issues.push({
      type: 'long-source',
      label: '长句',
      detail: '英文片段较长，建议拆句或复核遗漏。',
    });
  }

  if (zh.length < Math.max(8, en.length * 0.25)) {
    issues.push({
      type: 'short-translation',
      label: '疑似漏译',
      detail: '中文长度明显偏短，可能存在漏译。',
    });
  }

  if (missingTerms.length > 0) {
    issues.push({
      type: 'missing-term',
      label: '术语未命中',
      detail: missingTerms.map((term) => `${term.source} -> ${term.target}`).join('；'),
    });
  }

  if (/等待填写|请求失败|ASR 失败|未返回/.test(zh)) {
    issues.push({
      type: 'placeholder',
      label: '待完成',
      detail: '当前字幕仍是占位或错误提示，需要重新翻译。',
    });
  }

  if (subtitle.corrected) {
    issues.push({
      type: 'corrected',
      label: '已修正',
      detail: '这条字幕已经有人工作业记录。',
      positive: true,
    });
  }

  return {
    issues,
    riskLevel: issues.some((issue) => !issue.positive) ? 'risk' : 'ok',
    missingTerms,
    expectedTerms,
  };
}

export function summarizeQuality(subtitles, glossary) {
  const analyses = subtitles.map((subtitle) => ({
    subtitle,
    ...analyzeSubtitleQuality(subtitle, glossary),
  }));
  const risky = analyses.filter((item) => item.riskLevel === 'risk');
  const corrected = subtitles.filter((subtitle) => subtitle.corrected);
  const glossaryHits = subtitles.filter((subtitle) => subtitle.termsApplied.length > 0);

  return {
    analyses,
    risky,
    corrected,
    glossaryHits,
    riskCount: risky.length,
    correctedCount: corrected.length,
    glossaryHitRate: subtitles.length ? Math.round((glossaryHits.length / subtitles.length) * 100) : 0,
  };
}

export function buildCorrectionMemory(correctionHistory, subtitles) {
  return correctionHistory
    .slice(-6)
    .map((record) => {
      const subtitle = subtitles.find((item) => item.id === record.subtitleId);
      return {
        ...record,
        en: subtitle?.en ?? '',
      };
    })
    .filter((record) => record.en && record.afterZh);
}
