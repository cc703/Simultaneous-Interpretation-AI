import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitTranscript } from './asrAdapter.js';
import { isProbablyUntranslated, parseNumberedLines } from './translator.js';

describe('simultaneous interpretation chunking', () => {
  it('splits long ASR sentences into shorter interpretation units', () => {
    const chunks = splitTranscript(
      'Whether you are a software developer testing file upload functionality, a quality assurance engineer validating media players, a student learning about digital formats, or simply someone who needs a quick test file, SampleLab provides ready-to-use files that you can download instantly, completely free of charge.',
    );

    assert.ok(chunks.length > 2);
    assert.ok(chunks.every((chunk) => chunk.length <= 120));
  });

  it('parses numbered batch translations and detects untranslated echoes', () => {
    const parsed = parseNumberedLines([
      '1. 无论您是正在测试文件上传功能的软件开发人员，',
      '2. 还是学习数字格式的学生，SampleLab 都提供即下即用的示例文件。',
    ].join('\n'));

    assert.deepEqual(parsed, [
      '无论您是正在测试文件上传功能的软件开发人员，',
      '还是学习数字格式的学生，SampleLab 都提供即下即用的示例文件。',
    ]);
    assert.equal(
      isProbablyUntranslated(
        'Whether you are a software developer testing file upload functionality',
        'Whether you are a software developer testing file upload functionality',
      ),
      true,
    );
  });
});
