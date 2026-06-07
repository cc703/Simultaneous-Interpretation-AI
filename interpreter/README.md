# AI 同声传译助手

![AI 同声传译助手视觉封面](public/og-cover.svg)

本项目对应比赛题目二：**AI 同声传译助手**。它面向英语演讲、技术分享、国际会议、网课和网页直播等单向音频流场景，通过 ASR、语义分段、流式翻译、字幕浮窗、语音播报和修正记忆，帮助用户实时跟上外语内容。

当前默认目标语言为中文，也支持繁体中文、英文、日文、韩文、法文和西班牙文等目标语言切换。核心目标不是“把音频文件翻译完”，而是按同传流程持续读取当前音频流，以低延迟字幕或语音形式输出，并在后续上下文到来时修正前面的识别或翻译结果。

## 当前能力

- **Demo 模式**：无 Key 也能稳定演示“英文音频流 -> 中文字幕 -> 人工修正 -> 术语重译 -> TTS -> SRT 导出”的完整闭环。
- **File 模式**：支持上传音频/视频文件，或一键加载内置样本；真实 ASR 完成后按媒体播放进度逐句释放字幕，避免语音未结束字幕先跑完。
- **Live 模式**：通过浏览器 `getDisplayMedia` 捕获当前共享标签页或屏幕的音频流，按 2-3 秒自适应语义窗送入 ASR，再持续输出中文字幕。
- **直播/媒体兼容**：浏览器常见 WebM/Opus 直播片段会在本地 Gateway 转成 16kHz mono WAV 后再送 DashScope ASR。
- **快语速处理**：检测 WPM、ASR 不稳定和追赶状态；语速过快时显示紧凑状态提示，不把诊断文字当作正式大字幕。
- **静音/无音频处理**：能区分“没有实际音量”和“有声音但 ASR 未稳定捕获”，不会把快语速误报成静音，也不会伪造字幕。
- **字幕浮窗**：支持浏览器 Document Picture-in-Picture 或弹出窗口，用户可切回直播/会议页面观看，字幕继续同步。
- **翻译修正**：人工修正会写入修正记忆；自动回修会基于后续上下文修正近期字幕，同时保护用户人工确认的译文不被覆盖。
- **输出能力**：支持双语/目标语言/源语言视图、浏览器 TTS 播报、SRT 导出和双语文本复制。

## 技术结构

```text
interpreter/
  server/index.js              本地 AI Gateway，隔离 Key、转发翻译/ASR、处理转码和重试
  src/App.jsx                  主工作台、输入源、字幕、浮窗、修正和设置
  src/engine/liveAsr.js        Live MediaRecorder 分片、语速检测、静音/ASR 不稳定处理
  src/engine/fileAsrStream.js  File 播放进度驱动的语义释放
  src/engine/asrAdapter.js     ASR 文本清洗、语义分段和翻译入口
  src/engine/translator.js     OpenAI-compatible 流式翻译
  src/engine/correctionEngine.js 自动上下文回修
  src/engine/tts.js            浏览器中文语音播报队列
  src/store/useStore.js        Zustand 状态、字幕、术语、修正记忆
  scripts/                     API、媒体、浏览器和最终闭环 smoke
  docs/                        设计、演示路径、DashScope 配置和 smoke 证据
  test-media/                  自动化测试用音频、视频和直播分片样本
```

前端使用 Vite + React + Zustand。后端是轻量 Node Gateway，不做用户系统、数据库或字幕持久化，只负责：

- 从 `.env` 读取 Key，避免浏览器暴露真实 Key。
- 统一 `/api/translate` 和 `/api/transcribe`。
- 适配 DashScope / OpenAI-compatible API。
- 将 WebM/Opus/视频音轨转成 ASR 更稳定的 WAV。
- 对 ASR 网络错误、429、5xx 做有限重试。
- 返回明确的边界错误，不生成假字幕。

## 快速启动

推荐使用两个终端。

终端 A：启动本地 Gateway。

```bash
cd interpreter
copy .env.example .env
# 在 .env 中填写 DASHSCOPE_API_KEY
npm install
npm run dev:server
```

终端 B：启动前端。

```bash
cd interpreter
npm run dev -- --host 127.0.0.1
```

默认地址：

- 前端：`http://127.0.0.1:5173`
- Gateway：`http://127.0.0.1:8787`
- 健康检查：`http://127.0.0.1:8787/api/health`

如果 `8787` 提示 `EADDRINUSE`，先打开健康检查。如果返回 `ok: true` 且显示 `asrProvider: dashscope`，说明已有健康 Gateway 在运行，不需要再启动第二个。

## 环境变量

最小 DashScope 配置：

```env
DASHSCOPE_API_KEY=你的阿里云百炼 DashScope Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_TRANSLATION_MODEL=qwen-plus
ASR_PROVIDER=dashscope
DASHSCOPE_ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_ASR_MODEL=qwen3-asr-flash
```

可选配置：

```env
PORT=8787
ASR_RETRY_ATTEMPTS=3
ASR_RETRY_DELAY_MS=750
OPENAI_TRANSLATION_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_TRANSLATION_API_KEY=同 DASHSCOPE_API_KEY 或其他 OpenAI-compatible Key
OPENAI_TRANSLATION_MODEL=qwen-plus
OPENAI_ASR_BASE_URL=https://api.openai.com/v1
OPENAI_ASR_API_KEY=你的 OpenAI ASR Key
OPENAI_ASR_MODEL=gpt-4o-mini-transcribe
```

说明：

- 默认前端翻译 Provider 为 `Server Gateway`，启动后端后不需要在浏览器输入 Key。
- 浏览器设置面板中的 API Key 只保存在当前页面内存，不写入 localStorage。
- Provider、Base URL、目标语言、风格、上下文窗口、分片长度、TTS 语速等用户设置会保存到 localStorage。
- 许多第三方聊天网关只支持 `/chat/completions`，不支持语音转写。用 `npm run check:api` 检查当前 `.env` 是否可用。

## 使用流程

### Demo 模式

1. 选择输入源 `演示`。
2. 可切换发布会、技术分享、商务会议三个场景。
3. 点击 `开始同传`。
4. 英文音频模拟播放，中文字幕按时间逐句出现。
5. 任意字幕都可以继续执行人工修正、术语重译、TTS 和导出。

### File 模式

1. 选择输入源 `文件`。
2. 点击 `加载样本`，或上传 `.mp3`、`.mp4`、`.wav`、`.m4a`、`.webm`、`.ogg` 等音视频文件。
3. 点击 `开始同传`。
4. 系统会先做真实 ASR；完成后按媒体播放进度逐句释放字幕，媒体还没结束时不会提前把同传流程判定为完成。
5. 如果未配置 ASR Key，内置样本会明确标注使用绑定转写文本继续跑演示闭环；普通文件会提示配置缺口，不伪装真实 ASR。

当前前端建议单次上传 25MB 内。DashScope inline 音频建议 10MB 内；更大文件需要继续扩展对象存储 URL 或后端分片上传。

### Live 模式

1. 选择输入源 `直播`。
2. 点击 `选择直播音频`。
3. 在浏览器弹窗中选择正在播放英文视频/直播/会议的标签页或屏幕，并勾选共享标签页音频。
4. 点击 `开始同传` 或捕获后自动进入 Live ASR。
5. 打开顶部 `浮窗`，切回直播页面观看；字幕会继续同步。

Live 左侧会显示：

- 捕获来源和权限状态。
- ASR Provider 是否可用。
- 语义窗长度。
- 语速 WPM 和快语速/过载状态。
- 输出状态：字幕就绪、无实际音量、ASR 不稳定等。
- 队列、完成、跳过、重复、Backlog、最近延迟。

注意：如果只共享画面，没有共享标签页音频，系统会提示没有实际音量，不会伪装翻译。若音频存在但语速过快、背景声重或 ASR 采样异常，系统会显示 ASR 不稳定/语速过快，并继续合并下一语义窗追赶当前讲话。

### Mic 模式

1. 选择输入源 `麦克风`。
2. 点击 `开始同传` 并授权麦克风。
3. 浏览器 Web Speech API 产生英文 final 结果后进入翻译管线。

Mic 依赖浏览器内置语音识别能力。Chrome/Edge 支持较好；如果浏览器不支持，会明确提示并可切回 Demo。

## 修正、术语、TTS 和导出

- 点击任意字幕卡片，可在修正区编辑译文。
- 点击 `保存修正` 后，字幕标记为用户修正，并进入人工确认记忆。
- 在设置面板 `Terms` 中添加术语后，可对字幕执行 `术语重译`。
- 自动回修只修改非人工确认字幕，不覆盖用户保存过的译文。
- 打开 `Chinese voice output` 后，稳定中文字幕会进入浏览器 TTS 队列。
- 点击 `Export` 下载 SRT；点击 `Copy` 复制双语文本，剪贴板不可用时降级下载文本。

## 字幕显示

- 顶部 `双语 / 目标语言 / 检测语言` 可切换显示模式。
- 底部字幕预览只显示正式字幕，不再显示快语速/ASR 不稳定等诊断文本。
- 快语速、无声、ASR 不稳定会显示为紧凑状态卡，不占用主字幕大字区域。
- 主字幕区已移除大块 waveform/progress 装饰面板，避免遮挡当前字幕位置。
- 浮窗使用当前字幕模式同步显示；不支持 Document Picture-in-Picture 时降级为普通弹窗。

## 验证命令

```bash
npm run build
npm test
npm run check:api
npm run smoke:file-asr
npm run smoke:media
npm run smoke:gateway-boundaries
npm run smoke:browser-ux
npm run smoke:final
npm run scan:secrets
```

命令说明：

- `npm run build`：Vite 生产构建。
- `npm test`：Node 原生测试，覆盖语义分段、ASR 错误、快语速/静音、自动回修、TTS、导出、质量诊断。
- `npm run check:api`：检查 `.env` 中翻译/ASR API 的基本可达性。
- `npm run smoke:file-asr`：上传英文样本到 `/api/transcribe`，要求返回真实英文转写。
- `npm run smoke:media`：覆盖英文音频、音乐无语音、视频音轨、WAV Live 分片和 WebM/Opus Live 分片。
- `npm run smoke:gateway-boundaries`：验证坏 JSON、缺文件、超大小、缺 Key 等边界。
- `npm run smoke:browser-ux`：用浏览器自动验证 Demo、文件、视频、Live 注入流、浮窗、快语速、静音、TTS、人工修正、SRT 导出，并断言主字幕区不存在 waveform/progress 大块。
- `npm run smoke:final`：聚合构建、单测、API、File、媒体、Gateway、浏览器体验和密钥扫描。
- `npm run scan:secrets`：检查仓库中是否误提交真实 Key。

最近一次已验证结果：

- `npm.cmd run build` 通过。
- `npm.cmd test` 通过：9 suites / 29 tests / 0 fail。
- `APP_URL=http://127.0.0.1:5173 npm.cmd run smoke:browser-ux` 通过。
- `npm.cmd run smoke:media` 通过。
- `npm.cmd run smoke:file-asr` 通过。
- 详细 smoke 记录见 `docs/final-closure-smoke.md`、`docs/media-scenario-smoke.md`、`docs/gateway-boundary-smoke.md`。

## 能力边界

- Live 同传依赖浏览器 `getDisplayMedia` 权限、用户是否勾选共享标签页音频、ASR Key、网络质量和上游供应商稳定性。
- 默认 2-3 秒自适应语义窗追求低延迟，但端到端延迟仍受音频分片、ASR、翻译和网络影响，不承诺零延迟。
- 自动化测试可证明注入 MediaStream、WebM/Opus 分片、文件/视频和浮窗同步链路；真实抖音、会议或直播标签页仍需要用户手动选择共享音频。
- 字幕浮窗是浏览器窗口能力，不直接注入、修改或控制第三方直播/会议网站页面。
- TTS 使用浏览器原生 `speechSynthesis`，实际音色和可用语言取决于系统/浏览器。
- Gateway 不存储历史字幕和用户数据；刷新页面后仅保留 localStorage 中的非 Key 设置。

## 演示建议

1. 先用 Demo 展示稳定闭环。
2. 再用 File 内置样本展示真实 ASR、媒体同步和逐句字幕。
3. 打开 Live，选择正在播放英文视频的标签页并勾选共享音频。
4. 打开浮窗，切回视频页面，观察字幕同步。
5. 手动修正一条字幕，保存后导出 SRT。
6. 说明边界：没有共享音频不会生成假字幕；快语速会显示状态诊断并继续追赶。

录屏讲解脚本见 `docs/demo-script.md`。最终演示路径见 `docs/final-demo-path.md`。DashScope 配置见 `docs/dashscope-bailian-setup.md`。

## 已完成记录

- PR-02：全局状态管理。
- PR-03：UI 框架与静态布局。
- PR-04：STT 引擎。
- PR-05：AI 流式翻译引擎。
- PR-06：翻译修正闭环。
- PR-07：Demo 时间轴字幕流。
- PR-08：SRT / 双语文本导出。
- PR-09：文件上传播放驱动字幕流。
- PR-10：直播系统音频捕获入口。
- PR-11：Provider 与翻译设置面板。
- PR-12：TTS 和输出能力。
- PR-13：DashScope Gateway、真实 File ASR 和媒体 smoke。
- PR-14：Live 语义窗、浮窗、快语速/静音/ASR 不稳定检测。
- PR-15：诊断提示紧凑化，避免把状态文本当成正式字幕。
- PR-16：移除主字幕区 waveform/progress 大块并补充最终 README。

## 后续扩展

- 增加长直播的云端录制、断点续传和历史字幕检索。
- 增加真人口译质量评分和更多真实平台直播的人工验收样例。
- 增加对象存储 URL ASR，支持更大音视频文件。
