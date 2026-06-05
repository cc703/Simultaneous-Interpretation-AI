# AI 同声传译助手

本作品选择比赛题目二：**AI 同声传译助手**。

目标是在 2026-06-05 00:00 至 2026-06-07 23:59 的开发周期内，完成一个能将外语音频流实时翻译成中文，并支持字幕/语音输出与翻译修正能力的 AI 应用。

## 当前阶段

PR-05：AI 流式翻译引擎。

当前已建立 Vite + React + Tailwind CSS 基础工程，完成同传字幕工作台的静态界面，接入 Web Speech API STT 封装，并实现 OpenAI-compatible 流式翻译引擎。页面包含输入源选择、Provider 配置、术语表、字幕设置、mock 双语字幕、修正编辑器、底部大字幕和统计栏。

修正持久化、导出和 Demo 流会按 `../design.md` 的 PR 顺序逐步实现。

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
