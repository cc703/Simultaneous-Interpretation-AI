# AI 同声传译助手

本作品选择比赛题目二：**AI 同声传译助手**。

目标是在 2026-06-05 00:00 至 2026-06-07 23:59 的开发周期内，完成一个能将外语音频流实时翻译成中文，并支持字幕/语音输出与翻译修正能力的 AI 应用。

## 当前阶段

PR-14：演示材料与提交文案完善。

当前已建立 Vite + React 前端工程，完成同传字幕工作台的静态界面，接入 Web Speech API STT 封装，实现 OpenAI-compatible 流式翻译引擎，完成可演示的翻译修正闭环，加入稳定 Demo 模式，支持文件上传后调用 OpenAI `/audio/transcriptions` 做真实英文转写，支持直播标签页/屏幕音频捕获并通过 MediaRecorder 分片送入 ASR，支持高级设置面板，接入 Web Audio 波形可视化，支持浏览器中文 TTS 播报，并支持导出 SRT / 复制双语文本 / 同传复盘报告。页面包含输入源选择、Provider 配置、File/Live ASR 配置、术语表、质量诊断、修正记忆、字幕设置、时间轴字幕流、修正编辑器、底部大字幕和统计栏。

Demo 视频：待录制，提交前替换为公开可访问链接。

录屏讲解脚本见 `docs/demo-script.md`。

## 快速开始

```bash
cd interpreter
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

验证命令：

```bash
npm test
npm run build
```

`npm test` 使用 Node 原生测试覆盖质量诊断、修正记忆、SRT 和同传复盘报告生成。

## STT 验证

Chrome 或 Edge 中打开本地页面，点击输入源 `Mic`，再点击 `Start Interpreting` 后授权麦克风。说英文时，当前识别中的英文会显示在字幕区；完整句 final 后会进入翻译管线。未填写 API Key 时会显示明确的占位提示，不会伪装成真实翻译成功。

## 翻译验证

当前翻译引擎支持 OpenAI-compatible SSE 流式响应，默认 Provider 为 DeepSeek。左侧 `Configuration -> Translate` 可选择 DeepSeek、OpenAI 或 Custom，并填写 API Key。API Key 只保存在当前页面内存状态中，不写入 localStorage。未填写 Key 时会明确显示“等待填写 API Key 后接入实时中文翻译”。

## 修正闭环验证

页面加载后会初始化术语表；字幕需要通过 Demo、Mic、File 或 Live 工作流产生：

1. 点击任意字幕卡片。
2. 在 `Correction Desk` 编辑中文译文。
3. 点击 `Save correction`，字幕会标记为用户修正，修正计数增加。
4. 在左侧术语表输入 source 和中文译法，点击 `Add term`。
5. 点击 `Retranslate with glossary`，命中术语的字幕会标记为术语命中。
6. 页面会在 `Risk Review` 中提示疑似漏译、术语未命中、占位翻译等风险。
7. 人工保存过的修正会进入 `Correction Memory`，后续真实翻译 prompt 会参考这些用户确认译文。

## Demo 模式验证

不填写 API Key 也可以验证完整产品闭环：

1. 保持输入源为 `Demo`。
2. 点击 `Start Interpreting`。
3. 字幕会按时间逐条出现，而不是一次性显示全部内容。
4. 示例脚本包含 `latency budget`、`pitch deck`、`edge device` 三个术语。
5. Demo 字幕仍可继续执行人工修正、添加术语和术语重译。

## 文件模式验证

1. 点击输入源 `File`，上传 `.mp3`、`.mp4`、`.wav`、`.m4a`、`.webm` 或 `.ogg` 文件。
2. 在 `Configuration -> ASR` 填写 OpenAI ASR Key，默认模型为 `gpt-4o-mini-transcribe`。
3. 左侧会显示文件名、大小、格式和时长。
4. 点击 `Start Interpreting` 后，系统会把文件发送到 `/audio/transcriptions` 做真实英文转写。
5. 转写结果会按英文句子进入现有中文翻译、字幕修正、术语命中、TTS 和导出流程。
6. 如果未填写 ASR Key，文件模式会明确提示并降级为内置演示转写流，不会伪装成真实 ASR。
7. 浏览器直传限制为 25MB；更大文件需要后端分片上传。

## 直播模式验证

1. 点击输入源 `Live`。
2. 在 `Configuration -> ASR` 填写 OpenAI ASR Key，Live 会复用同一套 `/audio/transcriptions` 配置。
3. 点击 `Choose tab audio`，选择一个带英文音频的浏览器标签页或屏幕。
4. 左侧会显示捕获来源名称，并可点击 `Stop live capture` 释放所有音频 track。
5. 如果浏览器支持 MediaRecorder，系统会按设置的音频分片长度持续转写直播音频，并把转写文本送入翻译链路。
6. 未填写 ASR Key 时，Live 只展示捕获和波形，不会伪装为真实转写。

## 设置面板验证

- 顶部点击 `Settings` 可打开高级设置面板。
- 支持配置目标语言、翻译风格、上下文窗口、音频分片长度和专业词汇增强。
- Provider、Custom Base URL 和翻译参数会保存到 localStorage。
- API Key 只保存在当前内存状态中，不写入 localStorage。

## 字幕显示验证

- 右上 `Bilingual` / `ZH only` / `EN only` 会实时切换字幕展示方式。
- 左侧 `Subtitle Settings` 可控制是否显示英文原文、底部大字幕、修正记忆和中文语音输出。
- 关闭 `Auto correction memory` 后，后续真实翻译不会注入人工修正记忆。

## 波形验证

- 文件模式开始播放后，波形条会读取 `<audio>` 的 Web Audio 频谱数据。
- 直播模式捕获音频后，波形条会读取 `MediaStream` 的频谱数据。
- 没有真实音频输入时，页面保留静态 fallback 波形，避免界面空白。

## TTS 验证

- 打开左侧 `Chinese voice output`。
- Demo 或文件模式产生稳定中文字幕后，浏览器会使用系统中文语音播报。
- `Settings` 中可调整语速，浏览器原生音色取决于当前系统/浏览器可用语音。
- 停止翻译会立即取消播报队列，避免停止后继续朗读。

## 导出验证

- 点击顶部 `Export` 会下载 SRT 字幕文件。
- 点击顶部 `Review` 会下载 Markdown 同传复盘报告，包含质量诊断、术语表、修正记录和完整双语转写。
- 点击顶部 `Copy` 会复制当前双语文本；如果浏览器剪贴板不可用，则降级下载文本文件。
- 导出内容使用当前字幕状态，因此会包含人工修正后的最终译文。

## 计划功能

- 麦克风英文语音实时识别与中文字幕输出：已完成浏览器 Web Speech API MVP。
- 文件音频真实 ASR：已完成 OpenAI `/audio/transcriptions` 浏览器直传入口，未填 ASR Key 时降级为稳定演示流。
- Demo 音频流：已完成英文语音模拟 + 中文流式字幕，用于无 Key 稳定演示。
- AI 流式翻译：已完成 OpenAI-compatible SSE 引擎与 Provider 配置。
- 人工修正字幕译文：已完成。
- 术语表与术语命中：已完成。
- 质量诊断与修正记忆：已完成，支持风险标签、Risk Review 和用户修正记忆 prompt。
- 上下文自动重译：已完成术语重译入口，后续可扩展更多上下文策略。
- SRT / 双语文本导出：已完成。
- 同传复盘报告导出：已完成，包含风险诊断、术语表、修正记录和完整双语转写。
- 可选中文 TTS 播报：已完成浏览器原生中文语音输出。

## 能力边界

当前作品聚焦比赛题目二要求的“外语音频流实时翻译成中文、字幕/语音输出、翻译修正能力”。为了保证 72 小时内可稳定演示，系统提供三层能力：

- 稳定评审闭环：Demo 模式可以在无 Key 情况下稳定展示“外语音频流输入 -> 中文字幕输出 -> 人工修正 -> 术语重译 -> TTS 播报 -> 导出”。
- 真实浏览器能力：Mic 使用 Web Speech API 做英文语音识别；File 模式可调用 OpenAI ASR 做真实文件转写；Live 模式可通过 MediaRecorder 分片调用 ASR；Provider 配置后可走真实 OpenAI-compatible 流式翻译。
- 翻译修正能力：人工修正会写入 Correction Memory，并作为后续翻译提示的一部分；Risk Review 会提示漏译、术语未命中和占位翻译。
- 能力限制：Live ASR 依赖浏览器 MediaRecorder、用户共享音频权限、ASR Key 和网络质量；分片转写不是毫秒级实时，适合 4 秒左右的准实时字幕。

## 已完成 PR 记录

1. PR-02：全局状态管理
2. PR-03：UI 框架与静态布局
3. PR-04：STT 引擎
4. PR-05：AI 流式翻译引擎
5. PR-06：翻译修正闭环
6. PR-07：Demo 时间轴字幕流
7. PR-08：SRT / 双语文本导出
8. PR-09：文件上传播放驱动字幕流
9. PR-10：直播系统音频捕获入口
10. PR-11：Provider 与翻译设置面板
11. PR-12：Web Audio 波形可视化
12. PR-13：浏览器中文 TTS 播报
13. PR-14：演示材料、README 和提交文案完善

## 后续扩展

- 优化 Live ASR 分片去重、静音过滤和延迟统计。
- 增加自动质量评估，例如延迟、漏译率、术语命中率和人工修正前后对比。
- 提交前录制 Demo 视频，并将公开链接替换到 README 顶部。
