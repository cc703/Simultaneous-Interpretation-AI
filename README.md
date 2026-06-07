# Simultaneous-Interpretation-AI

题目二作品：AI 同声传译助手。

本项目面向 72 小时 AI 应用开发评审，目标是完成一个能将外语音频流实时翻译成目标语言的助手，并支持字幕输出、语音播报、人工翻译修正、修正记忆沉淀和最终导出。

核心演示闭环：

```text
英文音频 / 英文视频 / 直播音频
        -> 听音接入 / 语音切分
        -> 语义理解 / 目标语重组
        -> 同传字幕输出
        -> 人工修正与术语重译
        -> 修正记忆沉淀
        -> SRT / 双语文本导出
```

## 当前状态

已完成一个可运行的同传工作台，包含：

- Demo 模式：无 API Key 也能稳定展示完整同传闭环。
- File 模式：一键加载内置英文样本或上传音频/视频后，经 ASR 或明确标注的样本转写文本进入目标语言翻译链路。
- Live 模式：捕获网页直播、社交平台直播、媒体直播或线上会议的标签页/屏幕音频，默认按 1 秒低延迟分片做转写和翻译；无 ASR Key 时只展示捕获与配置缺口，不生成假字幕。
- 直播字幕浮窗：可打开独立字幕浮窗，Chromium 支持时以 Document Picture-in-Picture 形式覆盖在直播/会议页面上方，避免用户来回切回工作台。
- 同传流程化工作台：按“听音接入、语音切分、语义理解、转译重组、字幕输出、修正沉淀”组织 File 和 Live 状态。
- 翻译修正：点击字幕后可修改目标语言译文，并记录到修正记忆。
- 术语表：支持专业词条添加、术语命中和术语重译。
- 质量诊断：提示疑似漏译、术语未命中、占位翻译等风险。
- 语言路由：源语言默认自动检测，也可手动选择；目标语言可选中文、英文、日文、韩文等。
- 输出能力：支持字幕、浏览器 TTS、SRT 和双语文本导出。

Demo 视频：待录制，提交前会替换为公开可访问链接。

## 快速启动

前端工作台：

```bash
cd interpreter
npm install
npm run dev
```

打开：

```text
http://localhost:5173
```

真实 ASR / 翻译建议同时启动本地后端代理：

```bash
cd interpreter
copy .env.example .env
npm run dev:server
```

然后另开一个终端：

```bash
cd interpreter
npm run dev
```

Vite 会把 `/api/*` 请求转发到本地后端 `http://localhost:8787`。

## API 配置

项目支持把翻译和语音识别分开配置。默认优先使用阿里云百炼 DashScope：`qwen-plus` 负责中文翻译，`qwen3-asr-flash` 负责英文 ASR，也保留 OpenAI-compatible 自定义入口。

后端不是业务后台，而是轻量 AI Gateway：负责 Key 隔离、ASR Provider 适配、翻译 Provider 适配和统一错误边界。前端继续负责输入源、字幕、修正、术语和导出。详见 [轻量 AI Gateway 设计](interpreter/docs/backend-gateway.md)。

`.env` 示例：

```env
DASHSCOPE_API_KEY=你的阿里云百炼DashScope Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_TRANSLATION_MODEL=qwen-plus
ASR_PROVIDER=dashscope
DASHSCOPE_ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_ASR_MODEL=qwen3-asr-flash
```

也就是说，如果你使用百炼免费额度，通常只需要复制 `.env.example` 为 `.env`，然后填写 `DASHSCOPE_API_KEY`。
前端默认 Provider 为 `Server Gateway`，会通过本地 `/api/translate` 使用 `.env` 中的百炼 Key。

检查当前接口配置：

```bash
cd interpreter
npm run check:api
```

## 最终演示路径

建议评审演示按这个顺序进行：

1. 先跑 File 模式，点击 `加载样本` 或上传音视频，展示 `上传 -> ASR -> 翻译 -> 字幕` 主线。
2. 展示语言路由：源语言默认自动检测，目标语言可切换；字幕显示为 `双语 / 目标语言 / 检测语言`。
3. 点击一条字幕，在翻译修正区修改译文并保存。
4. 添加或确认术语，展示术语重译和修正记忆。
5. 切到 Live 模式，展示标签页/屏幕音频捕获、字幕浮窗、分片统计、静音跳过和重复转写去重。
6. 点击 Export / Copy，展示 SRT 和双语文本导出。Demo 模式作为无 Key 兜底演示。

详细脚本见：

- [最终演示路径](interpreter/docs/final-demo-path.md)
- [录屏讲解脚本](interpreter/docs/demo-script.md)
- [文件 ASR 烟测说明](interpreter/docs/file-asr-smoke.md)
- [轻量 AI Gateway 设计](interpreter/docs/backend-gateway.md)
- [阿里云百炼 DashScope API 配置](interpreter/docs/dashscope-bailian-setup.md)

## 验证命令

```bash
cd interpreter
npm test
npm run build
npm run check:api
npm run smoke:file-asr
npm run smoke:media
npm run smoke:gateway-boundaries
npm run smoke:final
```

说明：

- `npm test` 覆盖质量诊断、修正记忆、SRT 和导出报告生成函数。
- `npm run build` 验证生产构建。
- `npm run check:api` 检查翻译和 ASR Provider 的配置边界。
- `npm run smoke:file-asr` 使用内置英文样本测试文件 ASR；未配置 Key 时会明确暴露边界，不伪装成功。
- `npm run smoke:media` 覆盖英文语音、英文视频、音乐/无语音和 Live 分片样本。
- `npm run smoke:gateway-boundaries` 覆盖 Gateway 成功路径和错误边界。
- `npm run smoke:final` 聚合构建、单测、API、File、媒体、Gateway 和密钥扫描，并生成最终自动验收记录。

## 项目结构

```text
.
├── README.md                  # GitHub 首页说明
├── design.md                  # 产品目标与设计文档
├── AGENT.md                   # 开发协作与提交规范
└── interpreter/
    ├── src/                   # React 同传工作台
    ├── server/                # Node AI Gateway 与 ASR/翻译代理
    ├── docs/                  # 演示脚本、视觉系统、测试说明
    ├── scripts/               # API 检查与文件 ASR 烟测脚本
    ├── test-media/            # 英文语音测试样本
    └── README.md              # 更详细的工程说明
```

## 题目二对应关系

比赛要求：开发能将外语音频流实时翻译成中文，并以字幕或语音形式输出，且具备翻译修正能力的助手。本项目默认目标语言为中文，同时保留英文、日文、韩文等目标语言切换，便于展示可扩展的同传路由。

本项目对应实现：

- 外语音频流输入：Demo、Mic、File、Live 四类输入源。
- 实时目标语言输出：字幕流、底部大字幕、浏览器 TTS，默认中文。
- 翻译修正能力：人工修正、术语重译、修正记忆、质量诊断。
- 可提交材料：公开仓库、README、Demo 视频链接位、演示脚本和可运行代码。

## 能力边界

- Demo 模式用于稳定证明完整产品闭环，不伪装成真实 ASR。
- File / Live 真实 ASR 依赖 Provider、Key、网络和供应商接口能力。
- Live 模式默认 1 秒低延迟分片，处理耗时按毫秒统计；端到端延迟仍取决于 ASR、翻译和网络，不承诺零延迟。
- 字幕浮窗通过浏览器 Picture-in-Picture 或弹出窗口展示，不直接修改第三方直播网页 DOM。
- 当前单文件上传建议控制在 25MB 内；DashScope inline 音频建议 10MB 内。
