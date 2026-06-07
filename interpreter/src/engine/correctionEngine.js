import { useStore } from '../store/index.js';
import {
  buildContext,
  buildCorrectionMemoryPrompt,
  buildGlossaryPrompt,
  translateBatch,
} from './translator.js';

export async function reviseRecentSubtitle({ triggerText = '', lookback = 2 } = {}) {
  const state = useStore.getState();
  if (!state.autoCorrect) return null;

  const candidates = state.subtitles
    .slice(0, -1)
    .filter((subtitle) => subtitle.zh && [null, 'auto'].includes(subtitle.correctionType))
    .slice(-lookback);
  const target = candidates.at(-1);
  if (!target || !triggerText) return null;

  try {
    const [revised] = await translateBatch({
      texts: [target.en],
      context: buildRevisionContext(state.subtitles, target, triggerText, state.contextWindow),
      glossary: state.terminologyBoost ? buildGlossaryPrompt(state.glossary) : '',
      correctionMemory: buildCorrectionMemoryPrompt(state.correctionHistory, state.subtitles),
      sourceLanguage: state.sourceLanguage,
      targetLanguage: state.targetLanguage,
      translationStyle: state.translationStyle,
      provider: state.provider,
      apiKey: state.apiKey,
      baseUrl: state.baseUrl,
    });

    if (!isMeaningfulRevision(target.zh, revised)) return null;
    useStore.getState().reviseSubtitleTranslation(
      target.id,
      revised,
      `根据后续音频上下文自动回修：${triggerText.slice(0, 80)}`,
    );
    return { subtitleId: target.id, revised };
  } catch (error) {
    console.warn('[correction] auto revision skipped:', error);
    return null;
  }
}

function buildRevisionContext(subtitles, target, triggerText, windowSize) {
  const context = buildContext(subtitles, windowSize);
  return [
    context,
    '',
    '自动回修任务：上一条字幕可能因同传上下文不足而不完整。',
    `需要回修的源文：${target.en}`,
    `当前译文：${target.zh}`,
    `后续新上下文：${triggerText}`,
    '只在后续上下文明显改变代词、术语、数字、否定或专业表达时修正。',
  ].join('\n');
}

function isMeaningfulRevision(previous, next) {
  const normalizedPrevious = normalizeComparable(previous);
  const normalizedNext = normalizeComparable(next);
  if (!normalizedPrevious || !normalizedNext) return false;
  if (normalizedPrevious === normalizedNext) return false;
  if (normalizedNext.includes('翻译服务暂不可用') || normalizedNext.includes('请求失败')) return false;
  return normalizedNext.length >= Math.max(4, normalizedPrevious.length * 0.45);
}

function normalizeComparable(text) {
  return String(text ?? '').replace(/\s+/g, '').replace(/[。！？.!?，,；;：:、]/g, '').trim();
}
