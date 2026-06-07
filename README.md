# Simultaneous-Interpretation-AI

![AI 同声传译助手视觉封面](interpreter/public/og-cover.svg)

题目二作品：**AI 同声传译助手**。

本项目面向英语演讲、技术分享、国际会议、网课、网页直播和线上会议等单向音频流场景，提供从听音接入、语音切分、语义理解、目标语重组到字幕输出、语音播报、人工修正和最终导出的完整同传工作台。默认目标语言为中文，也支持繁体中文、英文、日文、韩文、法文和西班牙文等目标语言切换。

核心目标不是离线翻译一个文件，而是在音频持续输入时，以低延迟字幕或语音形式输出可跟随的目标语言内容，并允许用户在同传过程中修正译文、沉淀术语和复用修正记忆。

## 演示入口

- 应用目录：[interpreter](interpreter/)
- 工程说明：[interpreter/README.md](interpreter/README.md)
- 最终演示路径：[interpreter/docs/final-demo-path.md](interpreter/docs/final-demo-path.md)
- 录屏讲解脚本：[interpreter/docs/demo-script.md](interpreter/docs/demo-script.md)
- 最终验收记录：[interpreter/docs/final-closure-smoke.md](interpreter/docs/final-closure-smoke.md)
- Demo 视频：待替换为公开可访问链接

建议评审演示顺序：

1. 用 Demo 模式展示无 Key 兜底闭环。
2. 用 File 内置样本展示真实 ASR、媒体同步和逐句字幕释放。
3. 切换目标语言和字幕视图，展示语言路由。
4. 点击字幕保存人工修正，展示修正记忆。
5. 添加术语并执行术语重译。
6. 切到 Live 模式，选择标签页或屏幕音频，打开字幕浮窗。
7. 导出 SRT 或复制双语文本。

## 已实现能力

- **Demo 模式**：不配置 API Key 也能稳定演示“英文音频流 -> 中文字幕 -> 人工修正 -> 术语重译 -> TTS -> SRT 导出”的完整闭环。
- **File 模式**：支持上传音频/视频文件，或一键加载内置英文样本；真实 ASR 完成后按媒体播放进度逐句释放字幕，避免音频未结束字幕先跑完。
- **Live 模式**：通过浏览器 `getDisplayMedia` 捕获共享标签页或屏幕音频，按低延迟语义窗送入 ASR，再持续输出目标语言字幕。
- **Mic 模式**：在支持 Web Speech API 的浏览器中，可用麦克风 final 识别结果进入翻译管线。
- **字幕浮窗**：支持 Document Picture-in-Picture；浏览器不支持时降级为普通弹窗，便于覆盖在直播或会议页面上方。
- **真实 ASR / 翻译 Gateway**：本地 Node Gateway 隔离 Key，统一适配 DashScope 和 OpenAI-compatible API。
- **媒体兼容**：常见音频、视频音轨、WebM/Opus Live 分片会在 Gateway 侧转成 ASR 更稳定的 16kHz mono WAV。
- **快语速和静音处理**：区分快语速、ASR 不稳定、无实际音量和无可转写语音，不把诊断状态当成正式字幕。
- **人工修正闭环**：保存后的用户译文会进入修正记忆，并保护人工确认译文不被自动回修覆盖。
- **术语表**：支持添加专业词条、术语命中提示和术语重译。
- **输出能力**：支持双语/目标语言/源语言视图、浏览器 TTS、SRT 下载和双语文本复制。

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

终端 B：启动前端工作台。

```bash
cd interpreter
npm run dev -- --host 127.0.0.1
```

默认地址：

- 前端：`http://127.0.0.1:5173`
- Gateway：`http://127.0.0.1:8787`
- 健康检查：`http://127.0.0.1:8787/api/health`

如果只想无 Key 体验产品闭环，可以直接启动前端并使用 Demo 模式。真实 File / Live ASR 需要配置 Provider Key。

## API 配置

项目默认使用阿里云百炼 DashScope：

- `qwen-plus`：目标语言翻译。
- `qwen3-asr-flash`：英文 ASR。
- OpenAI-compatible 入口：保留给 OpenAI 或其他兼容网关。

最小 `.env` 配置：

```env
DASHSCOPE_API_KEY=你的阿里云百炼 DashScope Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_TRANSLATION_MODEL=qwen-plus
ASR_PROVIDER=dashscope
DASHSCOPE_ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_ASR_MODEL=qwen3-asr-flash
```

说明：

- 前端默认 Provider 为 `Server Gateway`，启动后端后不需要在浏览器输入真实 Key。
- `.env` 只在本地 Gateway 读取，真实 Key 不提交到仓库。
- 浏览器设置面板里的 API Key 只保存在当前页面内存，不写入 localStorage。
- Provider、Base URL、目标语言、风格、上下文窗口、分片长度、TTS 语速等非密钥设置会保存到 localStorage。

检查当前接口配置：

```bash
cd interpreter
npm run check:api
```

## 项目结构

```text
.
├── README.md                  # GitHub 首页说明
├── design.md                  # 产品目标与设计文档
├── AGENT.md                   # 开发协作与提交规范
└── interpreter/
    ├── src/                   # React 同传工作台
    ├── server/                # Node AI Gateway 与 ASR/翻译代理
    ├── docs/                  # 演示脚本、视觉系统、测试与验收记录
    ├── scripts/               # API 检查、媒体 smoke、浏览器 smoke、密钥扫描
    ├── test-media/            # 自动化测试用音频、视频和 Live 分片样本
    └── README.md              # 更详细的工程说明
```

前端使用 Vite + React + Zustand。后端是轻量 Node Gateway，不做用户系统、数据库或字幕持久化，只负责 Key 隔离、ASR/翻译请求适配、音频转码、有限重试和统一错误边界。

## 验证命令

在 `interpreter/` 下执行：

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

- `npm run build`：验证 Vite 生产构建。
- `npm test`：覆盖语义分段、ASR 错误、快语速/静音、自动回修、TTS、导出和质量诊断。
- `npm run check:api`：检查 `.env` 中翻译和 ASR Provider 的可达性。
- `npm run smoke:file-asr`：使用内置英文样本测试文件 ASR。
- `npm run smoke:media`：覆盖英文音频、音乐无语音、视频音轨、WAV Live 分片和 WebM/Opus Live 分片。
- `npm run smoke:gateway-boundaries`：验证坏 JSON、缺文件、超大小、缺 Key 等边界。
- `npm run smoke:browser-ux`：浏览器自动验证 Demo、文件、视频、Live 注入流、浮窗、快语速、静音、TTS、人工修正和 SRT 导出。
- `npm run smoke:final`：聚合构建、单测、API、File、媒体、Gateway、浏览器体验和密钥扫描，并生成最终验收记录。
- `npm run scan:secrets`：检查仓库中是否误提交真实 Key。

最近一次自动验收结果见 [最终闭环自动验收记录](interpreter/docs/final-closure-smoke.md)，记录包含构建、单测、API 配置、File ASR、多媒体场景、Gateway 边界、浏览器体验和密钥扫描。

## 题目二对应关系

比赛要求：开发能将外语音频流实时翻译成中文，并以字幕或语音形式输出，且具备翻译修正能力的助手。

本项目对应实现：

- 外语音频流输入：Demo、Mic、File、Live 四类输入源。
- 实时目标语言输出：字幕流、底部大字幕、字幕浮窗、浏览器 TTS，默认中文。
- 翻译修正能力：人工修正、术语重译、修正记忆、自动上下文回修和质量诊断。
- 可提交材料：公开仓库、README、Demo 视频链接位、演示脚本、验收记录和可运行代码。

## 能力边界

- Demo 模式用于稳定证明完整产品闭环，不伪装成真实 ASR。
- File / Live 真实 ASR 依赖 Provider、Key、网络和供应商接口能力。
- Live 模式默认采用低延迟语义窗；端到端延迟仍取决于音频采样、ASR、翻译和网络，不承诺零延迟。
- 如果没有共享标签页音频，系统会提示无实际音量，不生成假字幕。
- 字幕浮窗依赖浏览器 Picture-in-Picture 或弹出窗口，不直接修改第三方直播/会议页面 DOM。
- 当前前端建议单次上传 25MB 内；DashScope inline 音频建议 10MB 内。更大文件需要继续扩展对象存储 URL 或后端分片上传。
- TTS 使用浏览器原生 `speechSynthesis`，实际音色、语言和音量取决于系统与浏览器。
- Gateway 不存储历史字幕和用户数据；刷新页面后仅保留 localStorage 中的非 Key 设置。
