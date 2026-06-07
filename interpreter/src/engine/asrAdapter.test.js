import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { useStore } from '../store/index.js';
import { NoSpeechDetectedError, transcribeAudioBlob, translateTranscriptText } from './asrAdapter.js';
import { takeCompleteSentences } from './fileAsrStream.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  useStore.getState().resetSession();
});

describe('file stream sentence detection', () => {
  it('waits for sentence endings before emitting translation units', () => {
    const partial = takeCompleteSentences('Today was a simple but wonderful', false);
    assert.deepEqual(partial.sentences, []);
    assert.equal(partial.rest, 'Today was a simple but wonderful');

    const complete = takeCompleteSentences('Today was a simple but wonderful day. I got up late', false);
    assert.deepEqual(complete.sentences, ['Today was a simple but wonderful day.']);
    assert.equal(complete.rest, 'I got up late');

    const tooShort = takeCompleteSentences('Welcome to SampleLab.', false);
    assert.deepEqual(tooShort.sentences, []);
    assert.equal(tooShort.rest, 'Welcome to SampleLab.');

    const flushed = takeCompleteSentences('I got up late', true);
    assert.deepEqual(flushed.sentences, ['I got up late']);
    assert.equal(flushed.rest, '');
  });

  it('can flush soft boundaries when ASR omits punctuation', () => {
    const soft = takeCompleteSentences('I got up a little later than usual', true);

    assert.deepEqual(soft.sentences, ['I got up a little later than usual']);
    assert.equal(soft.rest, '');
  });
});

describe('ASR translation error handling', () => {
  it('marks no-speech ASR responses with a dedicated error', async () => {
    globalThis.fetch = async (url) => {
      if (url === '/api/transcribe') {
        return Response.json({ speechDetected: false, note: 'no clear speech' });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    await assert.rejects(
      transcribeAudioBlob({ blob: new Blob(['silence']) }),
      NoSpeechDetectedError,
    );
  });

  it('propagates translation failures instead of appending fallback subtitles', async () => {
    useStore.getState().startTranslation();
    globalThis.fetch = async (url) => {
      if (url === '/api/health') {
        return Response.json({ ok: true, hasTranslationKey: true });
      }
      if (url === '/api/translate') {
        return new Response('upstream unavailable', { status: 502 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    };

    await assert.rejects(
      translateTranscriptText('This sentence should fail translation.'),
      /Translation request failed: 502/,
    );
    assert.equal(useStore.getState().subtitles.length, 0);
  });
});
