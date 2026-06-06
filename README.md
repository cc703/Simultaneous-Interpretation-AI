# Simultaneous-Interpretation-AI

题目二作品：AI 同声传译助手。

本项目面向 72 小时 AI 应用开发评审，目标是完成一个能将外语音频流实时翻译成中文的助手，并支持中文字幕输出、语音播报、人工翻译修正、修正记忆沉淀和最终导出。

核心演示闭环：

```text
英文音频 / 英文视频 / 直播音频
        -> ASR 英文转写
        -> 中文同传字幕
        -> 人工修正与术语重译
        -> 修正记忆沉淀
        -> SRT / 双语文本 / 同传复盘报告导出
```

## 当前状态

已完成一个可运行的同传工作台，包含：

- Demo 模式：无 API Key 也能稳定展示完整同传闭环。
- File 模式：一键加载内置英文样本或上传英文音频/视频后，经 ASR 或明确标注的样本转写文本进入中文翻译链路。
- Live 模式：捕获网页直播、社交平台直播、媒体直播或线上会议的标签页/屏幕音频，按音频分片做准实时转写和翻译；无 ASR Key 时只展示捕获与配置缺口，不生成假字幕。
- 翻译修正：点击字幕后可修改中文译文，并记录到 Correction Memory。
- 术语表：支持专业词条添加、术语命中和术语重译。
- 质量诊断：提示疑似漏译、术语未命中、占位翻译等风险。
- 输出能力：支持中文字幕、浏览器中文 TTS、SRT、双语文本和同传复盘报告导出。

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

1. 先跑 Demo 模式，证明英文音频流进入后中文字幕逐句出现。
2. 点击一条字幕，在 Correction Desk 中修改中文译文并保存。
3. 添加或确认术语，展示术语重译和风险提示。
4. 切到 File 模式，点击 `Use sample audio`，展示 `File -> ASR -> Translate -> Done` 阶段条。
5. 切到 Live 模式，展示标签页/屏幕音频捕获、分片统计、静音跳过和重复转写去重。
6. 点击 Export / Review / Copy，展示 SRT、双语文本和同传复盘报告导出。

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
```

说明：

- `npm test` 覆盖质量诊断、修正记忆、SRT 和复盘报告生成。
- `npm run build` 验证生产构建。
- `npm run check:api` 检查翻译和 ASR Provider 的配置边界。
- `npm run smoke:file-asr` 使用内置英文样本测试文件 ASR；未配置 Key 时会明确暴露边界，不伪装成功。

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

比赛要求：开发能将外语音频流实时翻译成中文，并以字幕或语音形式输出，且具备翻译修正能力的助手。

本项目对应实现：

- 外语音频流输入：Demo、Mic、File、Live 四类输入源。
- 实时中文输出：字幕流、底部大字幕、浏览器中文 TTS。
- 翻译修正能力：人工修正、术语重译、修正记忆、风险复盘。
- 可提交材料：公开仓库、README、Demo 视频链接位、演示脚本和可运行代码。

## 能力边界

- Demo 模式用于稳定证明完整产品闭环，不伪装成真实 ASR。
- File / Live 真实 ASR 依赖 Provider、Key、网络和供应商接口能力。
- Live 模式是几秒级准实时分片，不承诺零延迟。
- 当前单文件上传建议控制在 25MB 内；DashScope inline 音频建议 10MB 内。
