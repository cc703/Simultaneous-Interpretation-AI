import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { useStore } from '../store/index.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  useStore.getState().resetSession();
});

describe('automatic context correction', () => {
  it('revises recent non-manual captions when later context clarifies meaning', async () => {
    const { reviseRecentSubtitle } = await import('./correctionEngine.js');
    const store = useStore.getState();
    store.startTranslation();
    store.appendSubtitle({
      en: 'The latency budget is tight.',
      zh: '延迟预算很紧。',
    });
    store.appendSubtitle({
      en: 'It must stay under one second.',
      zh: '它必须保持在一秒以内。',
    });

    globalThis.fetch = async (url) => {
      if (url === '/api/health') {
        return Response.json({ ok: true, hasTranslationKey: true });
      }
      if (url === '/api/translate') {
        return Response.json({
          choices: [{ message: { content: '1. 留给延迟的时间预算非常紧张。' } }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    const result = await reviseRecentSubtitle({ triggerText: 'It must stay under one second.' });

    assert.equal(result.subtitleId, useStore.getState().subtitles[0].id);
    assert.equal(useStore.getState().subtitles[0].zh, '留给延迟的时间预算非常紧张。');
    assert.equal(useStore.getState().subtitles[0].correctionType, 'auto');
    assert.equal(useStore.getState().correctionHistory[0].type, 'auto');
  });

  it('does not overwrite user-confirmed manual corrections', async () => {
    const { reviseRecentSubtitle } = await import('./correctionEngine.js');
    const store = useStore.getState();
    store.startTranslation();
    store.appendSubtitle({
      en: 'The pitch deck is ready.',
      zh: '演示材料已经准备好。',
    });
    store.appendSubtitle({
      en: 'Investors will see it today.',
      zh: '投资人今天会看到它。',
    });
    store.updateSubtitleTranslation(
      useStore.getState().subtitles[0].id,
      '融资路演材料已经准备好。',
      'manual',
      '用户确认术语',
    );

    globalThis.fetch = async () => {
      throw new Error('Manual corrections should not trigger revision fetches.');
    };

    const result = await reviseRecentSubtitle({ triggerText: 'Investors will see it today.' });

    assert.equal(result, null);
    assert.equal(useStore.getState().subtitles[0].zh, '融资路演材料已经准备好。');
    assert.equal(useStore.getState().subtitles[0].correctionType, 'manual');
  });

  it('waits for at least one previous stable caption before auto revision', async () => {
    const { reviseRecentSubtitle } = await import('./correctionEngine.js');
    const store = useStore.getState();
    store.startTranslation();
    store.appendSubtitle({
      en: 'Only one caption exists.',
      zh: '目前只有一条字幕。',
    });

    globalThis.fetch = async () => {
      throw new Error('Single caption should not trigger revision fetches.');
    };

    const result = await reviseRecentSubtitle({ triggerText: 'New context is not yet appended.' });

    assert.equal(result, null);
    assert.equal(useStore.getState().subtitles[0].zh, '目前只有一条字幕。');
  });
});
