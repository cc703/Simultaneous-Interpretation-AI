# AI 同声传译助手

本作品选择比赛题目二：**AI 同声传译助手**。

目标是在 2026-06-05 00:00 至 2026-06-07 23:59 的开发周期内，完成一个能将外语音频流实时翻译成中文，并支持字幕/语音输出与翻译修正能力的 AI 应用。

## 当前阶段

PR-13：TTS 语音播报。

当前已建立 Vite + React + Tailwind CSS 基础工程，完成同传字幕工作台的静态界面，接入 Web Speech API STT 封装，实现 OpenAI-compatible 流式翻译引擎，完成可演示的翻译修正闭环，加入稳定 Demo 模式，支持文件上传播放驱动时间轴字幕流，支持直播标签页/屏幕音频捕获入口，支持高级设置面板，接入 Web Audio 波形可视化，支持浏览器中文 TTS 播报，并支持导出 SRT / 复制双语文本。页面包含输入源选择、Provider 配置、术语表、字幕设置、时间轴字幕流、修正编辑器、底部大字幕和统计栏。

后续会继续补充波形增强、TTS、ASR Adapter 和最终 Demo 材料。

## 快速开始

```bash
cd interpreter
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

## STT 验证

Chrome 或 Edge 中打开本地页面，点击 `Start Interpreting` 后授权麦克风。说英文时，当前识别中的英文会显示在字幕区；完整句 final 后会进入翻译管线。未填写 API Key 时会显示明确的占位提示，后续设置面板会提供 Key 输入。

## 翻译验证

当前翻译引擎支持 OpenAI-compatible SSE 流式响应，默认 Provider 为 DeepSeek。填写 API Key 的 UI 会在后续设置 PR 中接入；目前引擎代码已完成，未填写 Key 时会明确显示“等待填写 API Key 后接入实时中文翻译”，不会伪装成真实翻译成功。

## 修正闭环验证

页面加载后会用内置字幕和术语表初始化工作台：

1. 点击任意字幕卡片。
2. 在 `Correction Desk` 编辑中文译文。
3. 点击 `Save correction`，字幕会标记为用户修正，修正计数增加。
4. 在左侧术语表输入 source 和中文译法，点击 `Add term`。
5. 点击 `Retranslate with glossary`，命中术语的字幕会标记为术语命中。

## Demo 模式验证

不填写 API Key 也可以验证完整产品闭环：

1. 保持输入源为 `Demo`。
2. 点击 `Start Interpreting`。
3. 字幕会按时间逐条出现，而不是一次性显示全部内容。
4. 示例脚本包含 `latency budget`、`pitch deck`、`edge device` 三个术语。
5. Demo 字幕仍可继续执行人工修正、添加术语和术语重译。

## 文件模式验证

1. 点击输入源 `File`，上传 `.mp3`、`.mp4`、`.wav`、`.m4a`、`.webm` 或 `.ogg` 文件。
2. 左侧会显示文件名、大小、格式和时长。
3. 点击 `Start Interpreting` 后，文件会自动播放，进度条跟随 `audio.currentTime` 推进。
4. 当前 MVP 使用内置演示转写流按文件播放进度释放字幕，稳定展示“文件播放 -> 字幕流 -> 修正 -> 导出”闭环。
5. 这不是任意音频文件的真实 ASR 识别；真实文件音频分片 ASR 会作为后续 ASR Adapter 扩展。

## 直播模式验证

1. 点击输入源 `Live`。
2. 点击 `Choose tab audio`，选择一个带英文音频的浏览器标签页或屏幕。
3. 左侧会显示捕获来源名称，并可点击 `Stop live capture` 释放所有音频 track。
4. 当前 MVP 证明直播音频入口、权限流和资源释放；Web Speech API 不能直接消费该系统音频流，直接 ASR 识别会在 ASR Adapter 中扩展。

## 设置面板验证

- 顶部点击 `Settings` 可打开高级设置面板。
- 支持配置目标语言、翻译风格、上下文窗口、音频分片长度和专业词汇增强。
- Provider、Custom Base URL 和翻译参数会保存到 localStorage。
- API Key 只保存在当前内存状态中，不写入 localStorage。

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
- 点击顶部 `Copy` 会复制当前双语文本；如果浏览器剪贴板不可用，则降级下载文本文件。
- 导出内容使用当前字幕状态，因此会包含人工修正后的最终译文。

## 计划功能

- 麦克风英文语音实时识别与中文字幕输出
- 文件音频 / Demo 音频按时间轴输出双语字幕
- AI 流式翻译
- 人工修正字幕译文
- 术语表与术语命中
- 上下文自动重译
- SRT / 双语文本导出
- 可选中文 TTS 播报

## 能力边界

当前阶段仅完成前端工程骨架。真实 STT、翻译、修正、导出和 Demo 模式会在后续 PR 中实现。

Web Speech API 主要用于麦克风输入；文件音频和系统音频流会通过 Demo 转写流或 ASR Adapter 扩展，不会夸大为已直接支持任意音频流识别。

## 后续 PR 计划

1. PR-02：全局状态管理
2. PR-03：UI 框架与静态布局
3. PR-04：STT 引擎
4. PR-05：AI 流式翻译引擎
5. PR-06：翻译修正闭环
6. PR-10：Demo 模式与演示脚本
