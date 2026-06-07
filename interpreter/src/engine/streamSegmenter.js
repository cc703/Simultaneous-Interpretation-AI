const MIN_SOFT_SENTENCE_WORDS = 8;
const MIN_SOFT_SENTENCE_CHARS = 34;
const NOISE_UTTERANCES = new Set([
  '啊',
  '嗯',
  '呃',
  '哦',
  'ah',
  'uh',
  'um',
  'oh',
  'i',
  'me',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'shh',
  'ssh',
  'hush',
  'yes',
  'yeah',
  'yep',
  'no',
  'this',
  'that',
  'idontknow',
  'idonotknow',
  'imsorry',
  'thankyou',
  'thanks',
  'damn',
  'shit',
  'hell',
  'moodangry',
  'moodangryoh',
  'emotionangry',
  'emotionangryoh',
]);

export function normalizeBufferedText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

export function repairAsrTextArtifacts(text) {
  let normalized = normalizeBufferedText(text);
  if (!normalized) return '';

  normalized = normalized.replace(
    /\bdot\s+(com|org|net|io|ai)\b/gi,
    '.$1',
  );
  normalized = normalized.replace(/\s+([.,!?])/g, '$1');
  normalized = normalized.replace(
    /\b([A-Z][\w-]{2,})\.\s*\.(com|org|net|io|ai)\b/gi,
    '$1.$2',
  );
  normalized = normalized.replace(
    /\bfree\s+online\s+re([.!?。！？]|$)/gi,
    'free online resource$1',
  );

  const suffixFirstMatch = normalized.match(
    /^(\.(?:com|org|net|io|ai),?\s+[^.!?。！？]+[.!?。！？]?)\s+(Welcome to\s+([A-Z][\w-]+(?:\s+[A-Z][\w-]+){0,3})[.!?。！？]?)(.*)$/i,
  );
  if (suffixFirstMatch) {
    const suffixClause = suffixFirstMatch[1]
      .replace(/^\.(com|org|net|io|ai),?\s+/i, '.$1, ')
      .replace(/[.!?。！？]\s*$/g, '');
    const leadIn = suffixFirstMatch[2].replace(/[.!?。！？]\s*$/g, '');
    const rest = normalizeBufferedText(suffixFirstMatch[4] ?? '');
    normalized = normalizeBufferedText(`${leadIn}${suffixClause}. ${rest}`);
  }

  return normalized;
}

export function takeInterpretationUnits(text, { force = false, softBoundary = false, requireMeaningful = false } = {}) {
  const normalized = normalizeBufferedText(text);
  if (!normalized) return { units: [], rest: '' };

  const units = [];
  let consumed = 0;
  const matches = [...normalized.matchAll(/[^.!?。！？]+[.!?。！？]+/g)];

  for (const match of matches) {
    const unit = match[0].trim();
    if (!force && !isReadyInterpretationUnit(unit, { requireMeaningful })) break;
    units.push(unit);
    consumed = Math.max(consumed, match.index + match[0].length);
  }

  let rest = normalized.slice(consumed).trim();
  if ((force || softBoundary) && rest && isReadyInterpretationUnit(rest, { allowFragment: true, requireMeaningful })) {
    units.push(rest);
    rest = '';
  }

  return { units, rest };
}

export function shouldFlushSoftBoundary(buffer, latestTranscript = '', { requireMeaningful = false } = {}) {
  const normalizedBuffer = repairAsrTextArtifacts(buffer);
  const normalizedLatest = normalizeBufferedText(latestTranscript);
  if (!normalizedBuffer) return false;
  if (requireMeaningful && !hasMeaningfulSpeechContent(normalizedBuffer)) return false;
  if (requireMeaningful && startsWithDomainSuffixFragment(normalizedBuffer)) return false;
  if (requireMeaningful && hasIncompleteEnglishTail(normalizedBuffer)) return false;
  if (/[.!?。！？]\s*$/.test(normalizedBuffer) && isReadyInterpretationUnit(normalizedBuffer)) return true;
  if (normalizedLatest.length >= MIN_SOFT_SENTENCE_CHARS) return true;
  const words = normalizedBuffer.split(/\s+/).filter(Boolean);
  if (words.length >= MIN_SOFT_SENTENCE_WORDS) return true;
  if (/[\u4e00-\u9fff]/.test(normalizedBuffer) && normalizedBuffer.length >= 14) return true;
  return false;
}

export function isNoiseUtterance(text) {
  const normalized = compactSpeechToken(text);
  if (!normalized) return true;
  if (NOISE_UTTERANCES.has(normalized)) return true;

  const words = normalizeBufferedText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1 && words[0].length <= 2) return true;
  if (words.length <= 3 && words.every((word) => NOISE_UTTERANCES.has(compactSpeechToken(word)))) return true;
  return false;
}

export function isReadyInterpretationUnit(text, { allowFragment = false, requireMeaningful = false } = {}) {
  const stripped = normalizeBufferedText(text).replace(/[.!?。！？]+$/g, '').trim();
  if (!stripped) return false;
  if (requireMeaningful && !hasMeaningfulSpeechContent(stripped, { allowFragment })) return false;
  if (requireMeaningful && hasIncompleteEnglishTail(stripped)) return false;
  if (/[\u4e00-\u9fff]/.test(stripped)) return stripped.length >= (allowFragment ? 6 : 8);
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.length >= (allowFragment ? 4 : 5) || stripped.length >= (allowFragment ? 24 : 28);
}

export function hasMeaningfulSpeechContent(text, { allowFragment = false } = {}) {
  const normalized = repairAsrTextArtifacts(text);
  if (!normalized || isNoiseUtterance(normalized)) return false;
  if (isInstructionOrCodeArtifact(normalized)) return false;
  if (startsWithDomainSuffixFragment(normalized)) return false;
  if (/[\u4e00-\u9fff]/.test(normalized)) return normalized.length >= (allowFragment ? 6 : 8);

  const words = normalized
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^[.]+|[.]+$/g, ''))
    .filter(Boolean);
  const contentWords = words.filter((word) => word.length >= 3 && !NOISE_UTTERANCES.has(compactSpeechToken(word)));
  if (contentWords.some((word) => /[a-z]\.[a-z]|samplelab|resource|download|translation|meeting|launch|product|online/.test(word))) {
    return true;
  }
  return contentWords.length >= (allowFragment ? 3 : 4);
}

export function isInstructionOrCodeArtifact(text) {
  const normalized = normalizeBufferedText(text).toLowerCase();
  return [
    /代码函数/,
    /\bfunction\s+\w*\s*\(/,
    /\bcode\s+function\b/,
    /\bsay\s*\(/,
    /\bscreen\s+\d+\b/,
    /<\s*asr_text\s*>/,
    /\buser\s+language\b/,
    /\bemotion\s+(?:angry|sad|happy|neutral)\b/,
    /sorry,\s*i\s+(?:can'?t|cannot|am unable)/,
    /\bi['’]?m\s+sorry\b/,
    /抱歉[，,]?\s*我无法/,
    /i cannot execute this/,
    /unable to execute/,
  ].some((pattern) => pattern.test(normalized));
}

export function startsWithDomainSuffixFragment(text) {
  return /^[.,]?\s*(?:dot\s+)?(?:com|org|net|io|ai)\b[,\s]/i.test(normalizeBufferedText(text));
}

export function hasIncompleteEnglishTail(text) {
  const normalized = repairAsrTextArtifacts(text)
    .replace(/[.!?。！？]+$/g, '')
    .trim()
    .toLowerCase();
  if (!normalized || /[\u4e00-\u9fff]/.test(normalized)) return false;
  return [
    /\b(?:a|an|the)\s+(?:free\s+)?(?:online|digital|technical|global|real-time|sample)$/,
    /\b(?:of|for|to|in|on|at|with|from|by|and|or|but|because|while|whether|if|so|then)$/,
    /\bwide\s+variety\s+of$/,
    /\b(?:free\s+online\s+)?(?:re|res|reso|resou|resour|resourc)$/,
    /\b(?:free|online|digital|technical|global|real-time|sample)$/,
  ].some((pattern) => pattern.test(normalized));
}

function compactSpeechToken(text) {
  return normalizeBufferedText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '');
}
