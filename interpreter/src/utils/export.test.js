import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBilingualText,
  buildReviewReport,
  buildSRT,
  msToSRT,
} from './export.js';
import { summarizeQuality } from './quality.js';

const baseTime = Date.UTC(2026, 5, 5, 0, 0, 0);
const subtitles = [
  {
    id: 's1',
    timestamp: baseTime,
    timeLabel: '00:00:00',
    en: 'Good morning and welcome to the summit.',
    zh: '大家早上好，欢迎来到峰会。',
    corrected: false,
    termsApplied: [],
  },
  {
    id: 's2',
    timestamp: baseTime + 4200,
    timeLabel: '00:00:04',
    en: 'The pitch deck includes the latency budget.',
    zh: '融资演示文稿包含延迟预算。',
    corrected: true,
    termsApplied: ['pitch deck', 'latency budget'],
  },
];

const glossary = [
  { source: 'pitch deck', target: '融资演示文稿', enabled: true },
  { source: 'latency budget', target: '延迟预算', enabled: true },
];

describe('export builders', () => {
  it('formats SRT timestamps and bilingual content', () => {
    assert.equal(msToSRT(4200), '00:00:04,200');

    const srt = buildSRT(subtitles, baseTime);
    assert.match(srt, /1\n00:00:00,000 --> 00:00:04,200/);
    assert.match(srt, /Good morning and welcome to the summit\./);
    assert.match(srt, /融资演示文稿包含延迟预算。/);
  });

  it('builds bilingual text for copy fallback', () => {
    const text = buildBilingualText(subtitles);

    assert.match(text, /\[1\] 00:00:00/);
    assert.match(text, /EN: Good morning/);
    assert.match(text, /ZH: 大家早上好/);
  });

  it('builds a review report with risk, glossary, correction, and transcript sections', () => {
    const qualitySummary = summarizeQuality(subtitles, glossary);
    const report = buildReviewReport({
      subtitles,
      glossary,
      correctionHistory: [{
        subtitleId: 's2',
        beforeZh: '旧译文',
        afterZh: '融资演示文稿包含延迟预算。',
        type: 'manual',
        reason: '用户修正',
      }],
      qualitySummary,
      sourceMode: 'demo',
      provider: 'deepseek',
    });

    assert.match(report, /# AI 同声传译复盘报告/);
    assert.match(report, /## 质量诊断/);
    assert.match(report, /## 术语表/);
    assert.match(report, /pitch deck -> 融资演示文稿/);
    assert.match(report, /## 修正记录/);
    assert.match(report, /After: 融资演示文稿包含延迟预算。/);
    assert.match(report, /## 完整双语转写/);
  });
});
