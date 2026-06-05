import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyzeSubtitleQuality,
  buildCorrectionMemory,
  summarizeQuality,
} from './quality.js';

const subtitles = [
  {
    id: 's1',
    timeLabel: '00:00:01',
    en: 'Our pitch deck explains the latency budget for the launch.',
    zh: '我们的演示解释了延迟。',
    corrected: false,
    termsApplied: [],
  },
  {
    id: 's2',
    timeLabel: '00:00:05',
    en: 'The glossary correction is now saved.',
    zh: '术语表中的人工修正结果现在已经保存。',
    corrected: true,
    termsApplied: ['glossary'],
  },
];

const glossary = [
  { source: 'pitch deck', target: '融资演示文稿', enabled: true },
  { source: 'latency budget', target: '延迟预算', enabled: true },
];

describe('quality diagnostics', () => {
  it('flags missing glossary terms and short translations', () => {
    const result = analyzeSubtitleQuality(subtitles[0], glossary);

    assert.equal(result.riskLevel, 'risk');
    assert.ok(result.issues.some((issue) => issue.type === 'missing-term'));
    assert.ok(result.missingTerms.some((term) => term.source === 'pitch deck'));
  });

  it('summarizes risk, correction, and glossary hit counts', () => {
    const summary = summarizeQuality(subtitles, glossary);

    assert.equal(summary.riskCount, 1);
    assert.equal(summary.correctedCount, 1);
    assert.equal(summary.glossaryHitRate, 50);
  });

  it('builds correction memory from recent correction records', () => {
    const memory = buildCorrectionMemory([
      {
        id: 'c1',
        subtitleId: 's2',
        beforeZh: '旧译文',
        afterZh: '术语表中的人工修正结果现在已经保存。',
        type: 'manual',
      },
    ], subtitles);

    assert.equal(memory.length, 1);
    assert.equal(memory[0].en, subtitles[1].en);
    assert.equal(memory[0].afterZh, '术语表中的人工修正结果现在已经保存。');
  });
});
