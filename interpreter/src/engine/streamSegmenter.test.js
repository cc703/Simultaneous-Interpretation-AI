import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hasMeaningfulSpeechContent,
  hasIncompleteEnglishTail,
  isNoiseUtterance,
  repairAsrTextArtifacts,
  startsWithDomainSuffixFragment,
  shouldFlushSoftBoundary,
  takeInterpretationUnits,
} from './streamSegmenter.js';

describe('shared live interpretation segmenter', () => {
  it('holds incomplete fragments until a real-time boundary appears', () => {
    const partial = takeInterpretationUnits('Today we are discussing latency budgets', { force: false });
    assert.deepEqual(partial.units, []);
    assert.equal(partial.rest, 'Today we are discussing latency budgets');

    const ready = takeInterpretationUnits(
      'Today we are discussing latency budgets for international meetings. Later we will review',
      { force: false },
    );
    assert.deepEqual(ready.units, ['Today we are discussing latency budgets for international meetings.']);
    assert.equal(ready.rest, 'Later we will review');
  });

  it('releases long unpunctuated ASR fragments for low-latency media streams', () => {
    const buffer = 'The speaker is explaining how live captions should stay close to the audio stream';
    assert.equal(shouldFlushSoftBoundary(buffer, buffer), true);

    const ready = takeInterpretationUnits(buffer, { softBoundary: true });
    assert.deepEqual(ready.units, [buffer]);
    assert.equal(ready.rest, '');
  });

  it('filters common filler utterances before translation', () => {
    assert.equal(isNoiseUtterance('um'), true);
    assert.equal(isNoiseUtterance('you'), true);
    assert.equal(isNoiseUtterance('I do not know.'), true);
    assert.equal(isNoiseUtterance('This.'), true);
    assert.equal(isNoiseUtterance('Yes.'), true);
    assert.equal(isNoiseUtterance("I'm sorry."), true);
    assert.equal(isNoiseUtterance('Thank you.'), true);
    assert.equal(isNoiseUtterance('Mood: angry. Oh.'), true);
    assert.equal(hasMeaningfulSpeechContent('code function Screen 1 Shit.'), false);
    assert.equal(hasMeaningfulSpeechContent('user language English emotion Angry <asr_text>Thank you.'), false);
    assert.equal(isNoiseUtterance('dot com, a free online resource'), false);
    assert.equal(isNoiseUtterance('Latency budget'), false);
  });

  it('does not release low-information ASR hallucinations as final interpretation units', () => {
    assert.equal(hasMeaningfulSpeechContent('I do not know.'), false);
    assert.equal(hasMeaningfulSpeechContent('This.'), false);
    assert.equal(hasMeaningfulSpeechContent('Yes.'), false);
    assert.equal(shouldFlushSoftBoundary('I do not know.', 'I do not know.'), false);

    const ready = takeInterpretationUnits('I do not know.', { softBoundary: true, requireMeaningful: true });
    assert.deepEqual(ready.units, []);
    assert.equal(ready.rest, 'I do not know.');
  });

  it('repairs ASR domain suffix fragments before translation', () => {
    const repaired = repairAsrTextArtifacts(
      'dot com, a free online resource for downloading sample files in a wide variety of. Welcome to SampleLab.',
    );

    assert.equal(
      repaired,
      'Welcome to SampleLab.com, a free online resource for downloading sample files in a wide variety of.',
    );
    assert.equal(
      repairAsrTextArtifacts('Welcome to SampleLab. dot com, a free online resource for downloading sample files in a wide variety of.'),
      'Welcome to SampleLab.com, a free online resource for downloading sample files in a wide variety of.',
    );
    assert.equal(
      repairAsrTextArtifacts('Welcome to SampleLab.com, a free online re.'),
      'Welcome to SampleLab.com, a free online resource.',
    );
    assert.equal(startsWithDomainSuffixFragment('dot com, a free online resource'), true);
    assert.equal(startsWithDomainSuffixFragment(repaired), false);
  });

  it('holds incomplete English noun phrases in live semantic mode', () => {
    assert.equal(hasIncompleteEnglishTail('Welcome to SampleLab.com, a free online.'), true);
    assert.equal(hasIncompleteEnglishTail('a free online resource for downloading sample files in a wide variety of.'), true);
    assert.equal(hasIncompleteEnglishTail('Welcome to SampleLab.com, a free online resource.'), false);

    const held = takeInterpretationUnits('Welcome to SampleLab.com, a free online.', {
      softBoundary: true,
      requireMeaningful: true,
    });
    assert.deepEqual(held.units, []);
    assert.equal(held.rest, 'Welcome to SampleLab.com, a free online.');
  });
});
