export const demoScenarios = [
  {
    id: 'launch',
    label: 'Product Launch',
    badge: '发布会',
    title: 'Global AI Product Launch',
    summary: '展示产品发布会里的准实时字幕、商业术语和人工修正闭环。',
    terms: [
      { source: 'latency budget', target: '延迟预算', enabled: true },
      { source: 'pitch deck', target: '融资演示文稿', enabled: true },
      { source: 'resource', target: '资源', enabled: true },
      { source: 'online resource', target: '在线资源', enabled: true },
      { source: 'sample files', target: '样本文件', enabled: true },
      { source: 'edge device', target: '边缘设备', enabled: false },
    ],
    transcript: [
      {
        startMs: 0,
        endMs: 4200,
        en: 'Good morning everyone, welcome to our global AI product launch.',
        zh: '大家早上好，欢迎参加我们的全球 AI 产品发布会。',
      },
      {
        startMs: 4200,
        endMs: 8800,
        en: 'Today we will show how real-time translation reduces the latency budget for online meetings.',
        zh: '今天我们将展示实时翻译如何降低在线会议的延迟预算。',
        termsApplied: ['latency budget'],
      },
      {
        startMs: 8800,
        endMs: 13400,
        en: 'The assistant keeps a short context window to preserve meaning across sentences.',
        zh: '这个助手会保留一个短上下文窗口，以保持句子之间的语义连贯。',
      },
      {
        startMs: 13400,
        endMs: 18000,
        en: 'If a phrase is translated incorrectly, the user can correct it immediately.',
        zh: '如果某个表达被翻译错了，用户可以立即修正。',
      },
      {
        startMs: 18000,
        endMs: 23000,
        en: 'For example, pitch deck should be translated as 融资演示文稿 in this business context.',
        zh: '例如，在这个商业语境中，pitch deck 应该翻译为“融资演示文稿”。',
        termsApplied: ['pitch deck'],
      },
      {
        startMs: 23000,
        endMs: 27800,
        en: 'The same workflow also works on an edge device with limited network access.',
        zh: '同样的流程也适用于网络受限的边缘设备。',
        termsApplied: ['edge device'],
      },
      {
        startMs: 27800,
        endMs: 32400,
        en: 'The corrected glossary will then influence the next subtitles automatically.',
        zh: '修正后的术语表随后会自动影响后续字幕。',
      },
      {
        startMs: 32400,
        endMs: 37200,
        en: 'This makes the assistant useful for lectures, interviews, and product demos.',
        zh: '这让该助手适用于课堂、访谈和产品演示等场景。',
      },
      {
        startMs: 37200,
        endMs: 42000,
        en: 'At the end, the bilingual transcript can be exported for review.',
        zh: '最后，双语转写结果可以导出用于复盘。',
      },
    ],
  },
  {
    id: 'technical-talk',
    label: 'Technical Talk',
    badge: '技术分享',
    title: 'Realtime Systems Tech Talk',
    summary: '突出技术讲座中的上下文保持、流式推理、术语一致性和复盘导出。',
    terms: [
      { source: 'streaming inference', target: '流式推理', enabled: true },
      { source: 'context window', target: '上下文窗口', enabled: true },
      { source: 'packet loss', target: '丢包率', enabled: true },
    ],
    transcript: [
      {
        startMs: 0,
        endMs: 4300,
        en: 'In this technical session, we will discuss how streaming inference changes live subtitles.',
        zh: '在这场技术分享中，我们会讨论流式推理如何改变实时字幕。',
        termsApplied: ['streaming inference'],
      },
      {
        startMs: 4300,
        endMs: 8700,
        en: 'A context window is necessary because pronouns and technical terms often depend on previous sentences.',
        zh: '上下文窗口是必要的，因为代词和技术术语经常依赖前面的句子。',
        termsApplied: ['context window'],
      },
      {
        startMs: 8700,
        endMs: 13100,
        en: 'The interpreter should not wait for a full paragraph before showing a useful Chinese subtitle.',
        zh: '同传助手不应该等完整段落结束后才显示有用的中文字幕。',
      },
      {
        startMs: 13100,
        endMs: 17700,
        en: 'When packet loss happens, the system marks uncertain segments for later review.',
        zh: '发生丢包时，系统会把不确定片段标记出来，方便后续复盘。',
        termsApplied: ['packet loss'],
      },
      {
        startMs: 17700,
        endMs: 22400,
        en: 'A human correction is stored as memory so the next translation can follow the confirmed wording.',
        zh: '人工修正会被保存为记忆，使后续翻译能够遵循已确认的表述。',
      },
      {
        startMs: 22400,
        endMs: 26800,
        en: 'This is important when a team uses the same acronym across a long architecture review.',
        zh: '当团队在长时间架构评审中反复使用同一个缩写时，这一点尤其重要。',
      },
      {
        startMs: 26800,
        endMs: 31500,
        en: 'Finally, the review report exports risks, glossary hits, and the complete bilingual transcript.',
        zh: '最后，复盘报告会导出风险项、术语命中和完整双语转写。',
      },
    ],
  },
  {
    id: 'business-meeting',
    label: 'Business Meeting',
    badge: '商务会议',
    title: 'Cross-border Partner Meeting',
    summary: '模拟跨境商务会议，展示数字、责任分工和商业表达的修正能力。',
    terms: [
      { source: 'service-level agreement', target: '服务等级协议', enabled: true },
      { source: 'go-to-market', target: '市场进入策略', enabled: true },
      { source: 'renewal rate', target: '续约率', enabled: true },
    ],
    transcript: [
      {
        startMs: 0,
        endMs: 4100,
        en: 'Thank you for joining the partner meeting across three time zones.',
        zh: '感谢大家跨越三个时区参加这次合作伙伴会议。',
      },
      {
        startMs: 4100,
        endMs: 8600,
        en: 'The first topic is our service-level agreement for enterprise customers.',
        zh: '第一个议题是面向企业客户的服务等级协议。',
        termsApplied: ['service-level agreement'],
      },
      {
        startMs: 8600,
        endMs: 12900,
        en: 'We also need to align the go-to-market plan before the pilot starts next month.',
        zh: '我们还需要在下个月试点开始前对齐市场进入策略。',
        termsApplied: ['go-to-market'],
      },
      {
        startMs: 12900,
        endMs: 17400,
        en: 'If the renewal rate drops below eighty percent, the account team should trigger a risk review.',
        zh: '如果续约率低于百分之八十，客户团队应触发风险复盘。',
        termsApplied: ['renewal rate'],
      },
      {
        startMs: 17400,
        endMs: 21900,
        en: 'Please correct any translation that changes ownership, deadline, or commercial commitment.',
        zh: '如果译文改变了负责人、截止时间或商业承诺，请立即修正。',
      },
      {
        startMs: 21900,
        endMs: 26700,
        en: 'The final bilingual transcript will be shared with legal and customer success teams.',
        zh: '最终双语转写会同步给法务和客户成功团队。',
      },
    ],
  },
];

export const defaultDemoScenarioId = 'launch';

export function getDemoScenario(id = defaultDemoScenarioId) {
  return demoScenarios.find((scenario) => scenario.id === id) ?? demoScenarios[0];
}

export const demoTranscript = getDemoScenario(defaultDemoScenarioId).transcript;
