# design.md — 题目二：AI 同声传译助手 · 产品与开发任务书

> 本文件是给 Codex（或任意 AI 编码 Agent）的完整工作说明。
> 目标是完成本批次题目二：开发能将外语音频流实时翻译成中文（以字幕或语音形式输出）的助手，并具备翻译修正能力。
> 请**严格按照章节顺序**执行，每完成一个 PR 单元后提交并推送，不要跨单元合并，保证 72 小时内有持续 Commit 和 PR 记录。

---

## 0. 项目总览

### 0.1 产品定位

用户在观看英语直播、网课、国际会议、技术发布会或公开课程时，需要把外语音频尽快转成可阅读、可修正、可导出的中文字幕。
本工具定位为“AI 同声传译字幕工作台”：优先保证实时中文字幕输出，其次提供中文语音播报作为增强能力。

本工具提供四种输入/运行模式：

- **麦克风模式**：直接收录用户或现场外语声音，实时输出双语字幕
- **文件模式**：上传本地音视频文件，按时间轴流式输出双语字幕
- **直播模式**：通过浏览器系统音频捕获（`getDisplayMedia`），处理正在播放的标签页/屏幕音频
- **Demo 模式**：内置示例音频和示例转写流，保证评委在无 API Key、无稳定麦克风环境下也能看到完整产品闭环

### 0.1.1 实验目标与评审对齐

本项目必须紧贴题目二，不做英语口语陪练、不做小说转剧本，不扩展到与同声传译无关的功能。

| 评审维度 | 本项目对应设计 |
|---|---|
| 作品完整度与创新性 40% | 实时外语音频输入、中文滚动字幕、底部大字幕、人工修正、术语表、自动上下文修正、导出字幕 |
| 开发过程与质量 40% | 按单一功能拆 PR，主分支始终可运行，README 写清架构/限制/测试方式，保留持续提交记录 |
| 演示与表达 20% | 提供 Demo 模式、示例音频、稳定演示脚本、字幕修正闭环、最终双语结果导出 |

### 0.1.2 成功标准

最小可交付版本必须满足：

1. 输入英文音频或示例音频后，页面能按时间顺序显示英文原文和中文字幕。
2. 中文字幕以流式或准实时方式出现，用户能感知“正在同传”而不是一次性翻译全文。
3. 用户可以编辑任意一句译文，并将修正保存为字幕记录。
4. 用户可以维护术语表，后续翻译会优先遵守术语表。
5. 系统能显示翻译延迟、已翻译句数、修正次数、当前运行状态。
6. 会话结果可导出为 SRT 或双语文本，便于 Demo 后展示完整成果。
7. README 中必须包含题目选择、功能说明、运行方式、Demo 视频链接、PR/Commit 说明和已知限制。

### 0.2 核心链路

```
音频采集层 → STT/示例转写流 → 滑动窗口上下文管理 → AI 流式翻译 → 字幕渲染
                                                   ↑                 ↓
                                   术语表 + 用户修正记录 ← 人工编辑/自动重译
                                                                     ↓
                                                        TTS 语音播报（可选）
```

### 0.3 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | React 18 + Vite | 前端优先，便于快速演示和部署 |
| 样式 | Tailwind CSS | 工具类优先 |
| 音频采集 | MediaDevices + Web Audio API | 麦克风、文件播放、系统音频捕获、波形可视化 |
| STT MVP | Web Speech API | 浏览器原生，适合麦克风实时识别，interim results 实现流式 |
| STT 扩展 | Whisper/ASR API Adapter | 文件音频和系统音频的可信音频流方案，按分片送入识别服务 |
| 翻译 | OpenAI-compatible API | 支持 DeepSeek / Claude / GPT-4o，用户自填 Key |
| 修正 | 术语表 + 人工编辑 + 上下文重译 | 对应题目要求的“翻译修正能力” |
| TTS | Web Speech Synthesis API | 浏览器原生，零成本；可降级接 OpenAI TTS |
| 状态管理 | Zustand | 轻量，避免 Redux 复杂度 |
| 构建 | Vite | 快速 HMR，支持 PWA 扩展 |

### 0.4 目录结构（目标态）

```
interpreter/
├── public/
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── LeftPanel/
│   │   │   ├── SourceSelector.jsx   # 麦克风 / 文件 / 直播 / Demo 切换
│   │   │   ├── FileUploader.jsx
│   │   │   ├── LiveCapture.jsx
│   │   │   ├── ProviderConfig.jsx   # API Key + Provider 选择
│   │   │   ├── TermGlossary.jsx      # 术语表与修正规则
│   │   │   └── SubtitleSettings.jsx
│   │   ├── RightPanel/
│   │   │   ├── Waveform.jsx
│   │   │   ├── SubtitleScroll.jsx   # 历史字幕列表
│   │   │   ├── SubtitleBanner.jsx   # 底部大字幕
│   │   │   ├── CorrectionEditor.jsx # 单句译文编辑/重译
│   │   │   └── StatsBar.jsx
│   │   └── SettingsModal.jsx
│   ├── engine/
│   │   ├── stt.js                   # Web Speech API 封装
│   │   ├── translator.js            # AI 流式翻译 + 修正逻辑
│   │   ├── audioCapture.js          # getDisplayMedia 封装
│   │   ├── demoStream.js             # 示例转写流，保障 Demo 可复现
│   │   ├── asrAdapter.js             # 可选：文件/系统音频分片送入 ASR API
│   │   └── tts.js                   # TTS 语音播报封装
│   ├── utils/
│   │   ├── export.js                 # SRT / 双语文本导出
│   │   └── time.js
│   ├── mock/
│   │   └── demoTranscript.js         # 内置演示转写数据
│   ├── store/
│   │   └── useStore.js              # Zustand 全局状态
│   ├── App.jsx
│   └── main.jsx
├── design.md                        # 产品与开发任务书
├── README.md                        # 面向评委的项目说明、Demo 链接、运行指南
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 1. 全局工作规范

### 1.1 Git 分支策略

```bash
main          # 主分支，始终可运行，评委随时可复现
└── feat/xxx  # 每个 PR 对应一个独立 feature 分支
```

**禁止**直接向 `main` 提交。所有变更必须通过 PR 合并。

### 1.1.1 72 小时持续提交工作流（强制）

为了满足比赛“严禁突击提交”的要求，本项目采用“一个 PR 单元 = 一个独立功能 = 多个小 Commit = 一个 PR”的工作流。

每个 PR 单元必须按以下节奏执行：

```bash
# 0. 确保 main 是可运行基线
git switch main
npm run build

# 1. 从 main 新建功能分支
git switch -c feat/<feature-name>

# 2. 完成一个最小可验证步骤后立即提交
git add -A
git commit -m "feat(scope): 完成某个可验证小步骤"

# 3. 每完成下一个小步骤继续提交，不等到整个项目完成
git add -A
git commit -m "feat(scope): 接入某个组件或状态"

# 4. 当前 PR 单元完成后运行验证
npm run build

# 5. 推送分支，创建 PR
git push -u origin feat/<feature-name>
```

**硬性规则**：

- 每个 PR 至少 1 个 Commit；复杂 PR 建议 2-4 个 Commit。
- 每个 Commit 必须对应一个可解释的小进展，例如“创建组件骨架”“接入 store”“补测试/README”，不能写成无意义的 `update`。
- 每个 PR 只做一个功能，不把多个 PR 单元合并到同一分支。
- 每天都必须有可见提交记录。建议上午、下午、晚上各完成 1 个小功能或文档/测试提交。
- 主分支必须始终可运行；合并 PR 前至少执行 `npm run build`。
- 如果某功能未完全成功，也可以提交“明确边界的阶段性成果”，例如 Demo 模式、Mock 数据、接口适配器骨架，但 README/PR 描述必须写清未完成部分。

### 1.1.2 推荐提交节奏

| 时间 | 推荐目标 | 产出 |
|---|---|---|
| 2026-06-05 上午 | PR-01 脚手架 + README 初稿 | 1-2 commits + 1 PR |
| 2026-06-05 下午 | PR-02 Store / PR-03 静态 UI | 2-4 commits + 1-2 PR |
| 2026-06-05 晚上 | PR-04 STT 或 Demo 字幕流骨架 | 1-3 commits + 1 PR |
| 2026-06-06 上午 | PR-05 翻译引擎 | 2-3 commits + 1 PR |
| 2026-06-06 下午 | PR-06 修正闭环 + 术语表 | 2-4 commits + 1 PR |
| 2026-06-06 晚上 | PR-08 文件模式 / PR-10 Demo 模式 | 2-4 commits + 1-2 PR |
| 2026-06-07 上午 | 导出、波形、TTS 等增强功能 | 2-4 commits + PR |
| 2026-06-07 下午 | README、Demo 脚本、视频准备 | 文档 commits + PR |
| 2026-06-07 晚上 | 最终联调，不做大改 | polish commit + final PR |

### 1.1.3 PR 完成定义

一个 PR 只有同时满足以下条件，才算完成：

1. 功能已达到该 PR 章节的目标。
2. 至少有一个清晰 Commit。
3. `npm run build` 通过，或 PR 描述中明确说明无法运行的原因。
4. PR 描述包含功能描述、实现思路、测试方式。
5. README 或相关文档在需要时同步更新。
6. 合并后 `main` 分支仍可运行。

### 1.2 PR 提交规范（强制）

每个 PR 必须包含以下四项，缺一不可：

```
标题：[feat] 一句话说明本 PR 新增/修改了什么

## 功能描述
说明该功能的作用与使用方式（面向用户视角）

## 实现思路
简要说明技术选型或核心实现逻辑（面向评委/审查者视角）

## 测试方式
如何验证该功能正常运行（步骤要可操作，不能写"自测通过"）

## Commit 记录
- `feat(scope): ...`
- `docs(scope): ...`
- `test(scope): ...`
```

### 1.3 每步完成后的 Commit 格式

```
feat(scope): 简短描述

- 具体变更点 1
- 具体变更点 2
```

示例：
```
feat(stt): 实现 Web Speech API 流式识别封装

- 支持 interim/final result 事件分离
- 暴露 onInterim / onFinal / onError 回调接口
- 识别语言默认 en-US，可配置
```

推荐 Commit 类型：

| 类型 | 使用场景 |
|---|---|
| `feat` | 新增同传功能、UI、引擎、修正能力 |
| `fix` | 修复识别、翻译、字幕、构建问题 |
| `docs` | 更新 README、Demo 脚本、设计说明 |
| `test` | 增加测试或验证脚本 |
| `chore` | 配置、依赖、脚手架维护 |

禁止使用含糊提交信息：

```bash
git commit -m "update"
git commit -m "fix"
git commit -m "改了一下"
```

### 1.4 可调用的辅助能力

| 能力 | 使用时机 |
|---|---|
| `read_file` | 查看现有代码再修改，避免覆盖 |
| `write_file` / `str_replace` | 创建或精确修改文件 |
| `run_terminal` | 执行 `npm install`、`npm run build`、`git` 命令 |
| `web_search` | 查找 Web Speech API / getDisplayMedia 最新用法、MDN 文档 |
| `browser_preview` | 在浏览器中预览当前页面，验证 UI 渲染 |

---

## 2. 开发任务清单（按 PR 粒度拆分）

---

### PR-01 · 项目脚手架初始化

**分支名**：`feat/scaffold`

**目标**：建立可运行的空项目骨架，所有后续 PR 基于此构建。

**执行步骤**：

```bash
# Step 1: 初始化项目
npm create vite@latest interpreter -- --template react
cd interpreter
npm install

# Step 2: 安装依赖
npm install zustand tailwindcss @tailwindcss/vite

# Step 3: 配置 Tailwind
# 在 vite.config.js 中添加 tailwindcss 插件
# 在 src/index.css 中添加 @import "tailwindcss"

# Step 4: 清空 App.jsx，替换为最小骨架
# 仅保留一个 <div>Hello Interpreter</div>，确认页面可渲染

# Step 5: 创建 README.md 初稿
# 必须写明：本作品选择题目二 AI 同声传译助手、当前开发阶段、运行命令、后续 PR 计划

# Step 6: 提交
git add -A
git commit -m "feat(scaffold): 初始化 Vite + React + Tailwind 项目骨架"
git push origin feat/scaffold
```

**PR 描述模板**：

```
标题：[feat] 初始化项目脚手架

## 功能描述
建立项目基础结构，包含 Vite + React 18 + Tailwind CSS 配置，
为后续所有功能模块提供可运行的基础环境，并创建 README 初稿明确选择题目二。

## 实现思路
使用 Vite 官方 React 模板初始化，Tailwind 通过 @tailwindcss/vite 插件集成，
无需单独 PostCSS 配置。

## 测试方式
执行 `npm run dev`，浏览器访问 localhost:5173，
页面显示"Hello Interpreter"即为成功。
```

---

### PR-02 · 全局状态管理（Zustand Store）

**分支名**：`feat/store`

**目标**：定义整个应用的数据模型，所有组件通过 store 通信，不直接传 props。

**创建文件**：`src/store/useStore.js`

**Store 数据结构**（严格按此实现）：

```javascript
{
  // 音频源
  sourceMode: 'mic' | 'file' | 'live' | 'demo', // 当前输入/运行模式
  uploadedFile: null | File,             // 已上传的文件对象
  isCapturing: false,                    // 系统音频是否正在捕获
  demoEnabled: false,                    // 是否使用内置示例转写流

  // AI Provider 配置
  provider: 'deepseek',                  // 'deepseek' | 'claude' | 'openai' | 'custom'
  apiKey: '',
  baseUrl: '',                           // custom 模式下的端点

  // 运行状态
  isRunning: false,                      // 是否正在翻译
  elapsedTime: 0,                        // 已运行秒数
  latencyMs: 0,                          // 最近一次翻译延迟

  // 字幕数据
  subtitles: [],                         // SubtitleEntry[] 见下方类型定义
  currentInterim: { en: '', zh: '' },    // 正在识别/翻译中的当前句

  // 翻译修正能力
  glossary: [],                          // TermRule[] 术语表/用户修正规则
  correctionHistory: [],                 // CorrectionRecord[] 修正记录
  selectedSubtitleId: null,              // 当前正在编辑/重译的字幕

  // 字幕显示设置
  subtitleMode: 'bilingual',             // 'bilingual' | 'zh-only' | 'en-only'
  showBanner: true,                      // 是否显示底部大字幕
  showOriginal: true,                    // 历史列表中是否显示英文原文
  autoCorrect: true,                     // 是否启用自动修正
  voiceOutput: false,                    // 是否启用 TTS 播报

  // 统计
  totalSentences: 0,
  totalChars: 0,
  correctionCount: 0,

  // Actions（方法）
  setSourceMode, setUploadedFile, setIsCapturing,
  setProvider, setApiKey, setBaseUrl,
  startTranslation, stopTranslation,
  appendSubtitle, updateCurrentInterim, correctLastSubtitle,
  updateSubtitleTranslation, retranslateSubtitle,
  addGlossaryTerm, updateGlossaryTerm, removeGlossaryTerm,
  applyDemoTranscript,
  setSubtitleMode, setShowBanner, setShowOriginal,
  setAutoCorrect, setVoiceOutput,
  resetSession,
}
```

**SubtitleEntry 类型**：

```javascript
{
  id: string,           // nanoid()
  timestamp: number,    // Date.now() 时识别完成时
  timeLabel: string,    // "00:00:03" 格式
  en: string,           // 英文原文（final）
  zh: string,           // 中文译文
  corrected: boolean,   // 是否经过修正
  correctionType: null | 'auto' | 'manual' | 'glossary', // 修正来源
  termsApplied: string[], // 命中的术语 key
  isCurrent: boolean,   // 是否为当前最新句
}
```

**TermRule 类型**：

```javascript
{
  id: string,
  source: string,        // 外语术语，如 "pitch deck"
  target: string,        // 中文译法，如 "融资演示文稿"
  note: string,          // 可选说明，如 "商业路演场景"
  enabled: boolean,
  createdAt: number,
}
```

**CorrectionRecord 类型**：

```javascript
{
  id: string,
  subtitleId: string,
  beforeZh: string,
  afterZh: string,
  type: 'auto' | 'manual' | 'glossary',
  reason: string,
  createdAt: number,
}
```

**执行步骤**：

```bash
npm install zustand nanoid

# 创建 src/store/useStore.js，实现上述 store
# 创建 src/store/index.js，re-export useStore

git add -A
git commit -m "feat(store): 建立 Zustand 全局状态管理，定义字幕数据模型"
git push origin feat/store
```

---

### PR-03 · UI 框架与静态布局

**分支名**：`feat/ui-layout`

**目标**：实现完整的视觉框架，所有面板就位，数据用 mock 填充，无真实功能。

**设计规范**：

```
色彩系统：
  背景       #080c10
  次级背景   #0d1318
  边框       #1e2d3a
  强调色     #00d4ff  （冷青，用于激活态、发光效果）
  绿色       #00e5a0  （运行中状态）
  琥珀       #ffb347  （修正标记）
  红色       #ff4d6a  （停止按钮）
  主文字     #e8f4f8
  次文字     #7a9bab
  暗文字     #3d5a6b

字体：
  标题/Logo  Syne（Google Fonts）
  正文/字幕  Noto Sans SC（Google Fonts）
  数据/代码  JetBrains Mono（Google Fonts）
```

**布局结构**：

```
Header（高 57px）
  └─ Logo | 状态 Pill | 工具按钮组

Main（双栏）
  ├─ LeftPanel（宽 320px，固定）
  │   ├─ 输入源选择（文件 / 系统音频 Tab）
  │   ├─ 上传区 / 系统音频说明
  │   ├─ AI Provider 配置
  │   ├─ 术语表（新增术语、启用/禁用、命中说明）
  │   ├─ 字幕设置（Toggle 组）
  │   └─ 开始/停止按钮
  │
  └─ RightPanel（flex: 1）
      ├─ 字幕工具栏（显示模式切换 | 导出/复制按钮）
      ├─ 音频波形条（高 56px）
      ├─ 进度条（高 3px）
      ├─ 字幕滚动区（flex: 1，overflow-y: auto）
      ├─ 修正编辑器（选中字幕后编辑中文译文 / 重新翻译）
      ├─ 底部大字幕 Banner（可隐藏）
      └─ 统计栏（延迟 | 已翻译 | 修正次数 | Provider）
```

**Mock 数据**：在 `src/mock/subtitles.js` 中写入 5 条示例字幕，包含：

- 1 条 `correctionType: 'manual'` 的用户修正字幕
- 1 条 `correctionType: 'glossary'` 的术语命中字幕
- 1 条 `correctionType: 'auto'` 的上下文自动修正字幕

这样静态 UI 阶段就能展示题目二要求的“翻译修正能力”。

**执行步骤**：

```bash
# 安装 Google Fonts（在 index.html 中添加 <link>）
# 实现所有组件，数据从 mock 读取，不接 store
# 确认整体视觉与色彩规范一致

git add -A
git commit -m "feat(ui-layout): 实现完整静态 UI 框架，包含双栏布局与 mock 字幕展示"
git push origin feat/ui-layout
```

**PR 测试方式**：`npm run dev`，页面完整渲染，左右面板均可见，mock 字幕显示，切换显示模式有效。

---

### PR-04 · STT 引擎：Web Speech API 封装

**分支名**：`feat/stt-engine`

**目标**：封装浏览器原生语音识别，支持流式 interim 结果，与 store 对接。

**创建文件**：`src/engine/stt.js`

**核心接口设计**：

```javascript
class STTEngine {
  constructor({ lang = 'en-US', continuous = true } = {}) {}

  // 绑定回调
  onInterim(cb)   // cb(text: string) — 识别中，实时更新，可能被覆盖
  onFinal(cb)     // cb(text: string) — 识别完成，稳定文本
  onError(cb)     // cb(error: SpeechRecognitionError)
  onEnd(cb)       // cb() — 识别结束（可能需要重启）

  start()         // 启动识别
  stop()          // 停止识别

  // 内部：自动重启（continuous 模式下 recognition 会意外停止）
  _autoRestart()
}
```

**关键实现细节**：

```javascript
// Web Speech API 的 continuous 模式在某些浏览器会自动停止
// 必须在 onend 事件中判断是否需要重启
recognition.onend = () => {
  if (this._shouldRun) {
    setTimeout(() => recognition.start(), 300);
  }
};

// interim results 需要开启
recognition.interimResults = true;
recognition.maxAlternatives = 1;

// 区分 interim 和 final
recognition.onresult = (event) => {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const transcript = event.results[i][0].transcript;
    if (event.results[i].isFinal) {
      this._finalCb?.(transcript);
    } else {
      this._interimCb?.(transcript);
    }
  }
};
```

**与 store 对接**（在 `src/engine/sttManager.js` 中）：

```javascript
// onInterim → store.updateCurrentInterim({ en: text })
// onFinal   → 触发翻译流程，翻译完成后 store.appendSubtitle(entry)
```

**执行步骤**：

```bash
# 创建 src/engine/stt.js
# 创建 src/engine/sttManager.js（连接 stt.js 与 store）
# 在 LeftPanel 开始按钮处接入 sttManager

git add -A
git commit -m "feat(stt): 实现 Web Speech API 流式识别引擎，支持 interim/final 分离与自动重启"
git push origin feat/stt-engine
```

**PR 测试方式**：
1. `npm run dev`，填入任意 API Key
2. 点击「开始翻译」，对着麦克风说英语
3. 字幕区的「当前句」实时更新（interim），说完整句后固定（final）
4. Console 无报错

---

### PR-05 · AI 流式翻译引擎

**分支名**：`feat/translator`

**目标**：调用 AI API（OpenAI-compatible 格式），流式输出中文翻译，支持多 Provider。

**创建文件**：`src/engine/translator.js`

**Provider 路由逻辑**：

```javascript
const PROVIDER_CONFIGS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  claude: {
    // Claude 使用不同的 API 格式，需单独处理
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-4-5-20251001',
  },
  custom: {
    // baseUrl 由用户填写，model 暂用 gpt-3.5-turbo
    model: 'gpt-3.5-turbo',
  },
};
```

**核心翻译函数**：

```javascript
async function* streamTranslate({
  text,           // 待翻译英文（final STT 结果）
  context,        // 最近 N 条字幕的双语对照（用于上下文连贯）
  glossary,       // 当前启用的术语表/用户修正规则
  provider,
  apiKey,
  baseUrl,
  onToken,        // (token: string) => void，每个流式 token 回调
}) {
  // 1. 构造 system prompt（含上下文、风格要求）
  // 2. 根据 provider 选择 API 格式（OpenAI / Anthropic）
  // 3. 使用 fetch + ReadableStream 解析 SSE
  // 4. 逐 token yield，同时调用 onToken
}
```

**System Prompt 模板**：

```
你是一名专业同声传译员。将用户提供的英文片段翻译成自然流畅的中文。

规则：
1. 直接输出译文，不加任何解释或前缀
2. 保持专业术语准确性
3. 根据上下文调整语气（学术/口语/技术）
4. 如果术语表中出现匹配项，必须优先使用指定中文译法
5. 上下文参考（最近 {{N}} 句）：
{{context}}
6. 当前术语表：
{{glossary}}
```

**滑动窗口上下文管理**：

```javascript
// 从 store 取最近 6 条已稳定的字幕，格式化为上下文
function buildContext(subtitles, windowSize = 6) {
  return subtitles
    .slice(-windowSize)
    .map(s => `EN: ${s.en}\nZH: ${s.zh}`)
    .join('\n---\n');
}

function buildGlossaryPrompt(glossary) {
  return glossary
    .filter(t => t.enabled)
    .map(t => `${t.source} => ${t.target}${t.note ? ` (${t.note})` : ''}`)
    .join('\n');
}
```

**SSE 流式解析**（OpenAI 格式）：

```javascript
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      const json = JSON.parse(line.slice(6));
      const token = json.choices?.[0]?.delta?.content ?? '';
      if (token) onToken(token);
    }
  }
}
```

**执行步骤**：

```bash
# 创建 src/engine/translator.js
# 在 sttManager.js 的 onFinal 回调中调用 streamTranslate
# 流式 token → store.updateCurrentInterim({ zh: accumulated })
# 翻译完成 → store.appendSubtitle()，记录延迟

git add -A
git commit -m "feat(translator): 实现 OpenAI-compatible 流式翻译引擎，支持 DeepSeek/OpenAI/Claude 多 Provider"
git push origin feat/translator
```

**PR 测试方式**：
1. 在设置面板填入 DeepSeek API Key
2. 对麦克风说一句英文
3. 字幕区出现流式中文翻译（逐字出现）
4. 翻译完成后固定，统计栏延迟数据更新

---

### PR-06 · 翻译修正闭环：人工编辑 + 术语表 + 自动修正

**分支名**：`feat/correction-loop`

**目标**：完成题目二要求的“翻译修正能力”。用户可以修正任意字幕译文、把修正沉淀为术语表；系统也可以在新上下文到来后自动重译前一句。

**产品行为**：

```
人工修正：
  1. 用户点击任意字幕卡片
  2. 右侧/底部出现修正编辑器，显示英文原文和当前中文译文
  3. 用户编辑中文译文后点击「保存修正」
  4. 字幕卡片标记为「用户修正」，统计栏 correctionCount +1
  5. correctionHistory 记录 before/after，便于 Demo 展示产品闭环

术语表：
  1. 用户在左侧添加 source -> target，例如 "pitch deck" -> "融资演示文稿"
  2. 后续翻译 prompt 必须包含启用的术语表
  3. 命中术语的字幕显示「术语命中」标记和 termsApplied

重新翻译：
  1. 用户可对单句点击「用当前术语重译」
  2. 系统只重译该句，不影响其他字幕
  3. 新译文保存为 correctionType: 'glossary'
```

**自动修正逻辑**：当新的 final STT 结果到来时，用更完整的上下文重新翻译前一句，若有差异则更新。

**实现逻辑**：

```
时序：
  T=0  说完第 N 句，STT final → 翻译第 N 句（上下文：N-6 到 N-1）
  T=1  说完第 N+1 句，STT final → 
         ① 翻译第 N+1 句（主流程）
         ② 同时，用包含第 N+1 句英文的上下文，重新翻译第 N 句
         ③ 比较新旧译文，若相似度 < 阈值，更新第 N 句，标记 corrected: true
```

**相似度判断**（简单实现，避免过度复杂）：

```javascript
function needsCorrection(oldZh, newZh) {
  // 字符级别差异率超过 15% 则认为需要修正
  const maxLen = Math.max(oldZh.length, newZh.length);
  const diff = levenshteinDistance(oldZh, newZh);
  return diff / maxLen > 0.15;
}
```

**Store 新增 action**：

```javascript
updateSubtitleTranslation(id, newZh, type = 'manual', reason = '') {
  set(state => ({
    subtitles: state.subtitles.map(s =>
      s.id === id ? { ...s, zh: newZh, corrected: true, correctionType: type } : s
    ),
    correctionCount: state.correctionCount + 1,
    correctionHistory: [
      ...state.correctionHistory,
      {
        id: nanoid(),
        subtitleId: id,
        beforeZh: state.subtitles.find(s => s.id === id)?.zh ?? '',
        afterZh: newZh,
        type,
        reason,
        createdAt: Date.now(),
      },
    ],
  }));
}

addGlossaryTerm({ source, target, note }) {
  set(state => ({
    glossary: [
      ...state.glossary,
      { id: nanoid(), source, target, note, enabled: true, createdAt: Date.now() },
    ],
  }));
}
```

**UI 联动**：

- 修正过的字幕块显示琥珀色左边框。
- `correctionType: 'manual'` 显示「用户修正」角标。
- `correctionType: 'auto'` 显示「上下文修正」角标。
- `correctionType: 'glossary'` 显示「术语命中」角标。
- 修正时有 0.3s 淡入动画。
- 统计栏显示修正次数、术语数量、最近一次修正来源。

**执行步骤**：

```bash
# 在 translator.js 中添加 correctPrevious() 函数
# 在 sttManager.js 的 onFinal 流程末尾调用修正逻辑
# store 中新增 updateSubtitleTranslation / retranslateSubtitle / glossary actions
# 新增 TermGlossary.jsx 和 CorrectionEditor.jsx
# SubtitleScroll.jsx 中添加修正视觉标记和字幕选择逻辑

git add -A
git commit -m "feat(correction): 实现字幕人工修正、术语表和上下文自动重译闭环"
git push origin feat/correction-loop
```

**PR 测试方式**：
1. 运行 Demo 模式或真实翻译模式，生成至少 3 条字幕
2. 点击一条字幕，修改中文译文并保存
3. 字幕显示「用户修正」，统计栏修正次数 +1
4. 添加术语 "pitch deck" -> "融资演示文稿"
5. 点击「用当前术语重译」或继续输入包含该术语的英文句子
6. 新译文使用术语表译法，并显示「术语命中」
7. 说一段前后语义关联强的内容，观察前一句是否触发「上下文修正」

---

### PR-07 · 系统音频捕获（直播模式）

**分支名**：`feat/live-capture`

**目标**：通过 `getDisplayMedia` 捕获浏览器标签页/屏幕音频，为直播同传模式提供真实音频流入口。MVP 先证明“捕获成功 + 可视化 + 可释放资源”，扩展方案再将 PCM 分片送入 ASR API。

**创建文件**：`src/engine/audioCapture.js`

**实现要点**：

```javascript
async function startSystemAudioCapture({ onAudioStream, onError }) {
  try {
    // 请求屏幕共享（含音频）
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,   // 必须为 true，否则部分浏览器拒绝
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
    });

    // 仅保留音频轨道，丢弃视频
    const audioStream = new MediaStream(stream.getAudioTracks());
    stream.getVideoTracks().forEach(t => t.stop());

    onAudioStream(audioStream);
    return stream;
  } catch (err) {
    onError(err);
  }
}
```

**与 STT 对接边界**：

Web Speech API 不能直接接受任意 `MediaStream` 输入。不能把“捕获到系统音频”虚假描述为“已直接送入 Web Speech API 识别”。

两级方案：

```
MVP 方案：
  1. getDisplayMedia 捕获标签页/屏幕音频
  2. AudioContext + AnalyserNode 显示实时音量/波形
  3. UI 明确显示「已捕获直播音频」
  4. 真实识别仍使用麦克风 Web Speech API 或 Demo 转写流

扩展方案：
  1. 使用 AudioWorklet / MediaRecorder 对捕获到的音频做 3-5 秒分片
  2. 分片送入 Whisper/ASR API Adapter
  3. ASR 返回文本后接入同一翻译与修正管线
```

如因 72 小时限制暂未实现扩展方案，README 必须如实说明：直播模式已完成音频捕获与可视化，直接 ASR 识别处于扩展接口阶段；不能把外放收音作为正式能力宣传。

**UI 变化**：
- 直播模式下，左面板显示"选择标签页"按钮
- 捕获成功后显示已连接的标签页名称（`stream.getVideoTracks()[0].label`）
- 停止时释放所有媒体轨道（防止内存泄漏）

**执行步骤**：

```bash
# 创建 src/engine/audioCapture.js
# 在 LiveCapture.jsx 组件中集成
# store 新增 captureStream 字段，停止时调用 track.stop()

git add -A
git commit -m "feat(live-capture): 实现 getDisplayMedia 系统音频捕获，支持直播/标签页翻译模式"
git push origin feat/live-capture
```

**PR 测试方式**：
1. 切换到「系统音频」模式
2. 点击「选择标签页」，选择一个正在播放英语的标签页
3. 左面板显示已连接的源名称
4. 波形随标签页音频变化，Console 可打印 audioTracks 确认
5. 点击停止后所有 track 释放，浏览器停止共享提示消失

---

### PR-08 · 文件上传模式

**分支名**：`feat/file-upload`

**目标**：支持上传本地音视频文件，按时间轴生成外语转写流并翻译成中文字幕。文件模式是 Demo 的首选入口，必须比直播模式更稳定。

**支持格式**：`.mp3` `.mp4` `.wav` `.m4a` `.webm` `.ogg`

**实现思路**：

```javascript
// 方案A（MVP + Demo 稳定）：使用 <audio> 元素播放文件
// + 内置 demoTranscript 或用户粘贴/加载 transcript
// + 按 audio.currentTime 定时释放字幕片段，模拟真实同传节奏
// 该方案用于稳定展示：音频播放 -> 原文字幕流 -> 中文翻译 -> 修正 -> 导出

// 方案B（可信音频流扩展）：使用 Web Audio API / MediaRecorder
// → 3-5 秒音频分片 → Whisper/ASR API Adapter
// → 返回文本后进入翻译管线

// 禁止把“文件外放再让麦克风收音”作为正式文件模式。
// 如临时用于调试，UI 和 README 必须标记为调试降级方案。
```

**文件上传组件行为**：

```
1. 拖拽或点击上传 → 展示文件名、时长、格式
2. 点击「开始翻译」→ 自动播放文件 + 启动 demoTranscript/ASR 分片流程
3. 进度条跟随音频播放进度（audio.currentTime / audio.duration）
4. 文件播放完毕 → 自动停止翻译，显示完成状态
5. 支持拖拽新文件替换当前文件
6. 如果没有 ASR API Key，允许使用内置示例转写流完成 Demo
```

**执行步骤**：

```bash
# 在 FileUploader.jsx 中实现拖拽上传与文件预览
# 新增 demoTranscript.js，按时间戳释放英文片段
# 在 store 中维护 uploadedFile、audioElement、demoEnabled
# 开始翻译时 audioElement.play()，结合 demoTranscript 或 asrAdapter 同步运行
# 进度条接入 audio.currentTime

git add -A
git commit -m "feat(file-upload): 实现文件音频播放与时间轴转写流翻译流程"
git push origin feat/file-upload
```

---

### PR-09 · 字幕导出功能

**分支名**：`feat/export`

**目标**：支持将当前会话字幕导出为 SRT 文件和纯文本双语对照。

**SRT 格式**：

```
1
00:00:03,000 --> 00:00:09,500
Good morning everyone, and welcome to this year's Global AI Summit.
大家早上好，欢迎参加今年的全球人工智能峰会。

2
00:00:09,500 --> 00:00:17,000
Today we're going to explore...
今天我们将探讨...
```

**实现**：

```javascript
function exportSRT(subtitles) {
  const content = subtitles.map((s, i) => {
    const start = msToSRT(s.timestamp - sessionStartTime);
    const end = msToSRT((subtitles[i+1]?.timestamp ?? s.timestamp + 5000) - sessionStartTime);
    return `${i+1}\n${start} --> ${end}\n${s.en}\n${s.zh}`;
  }).join('\n\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  // 触发下载
  const a = document.createElement('a');
  a.href = url;
  a.download = `subtitles_${Date.now()}.srt`;
  a.click();
}

function msToSRT(ms) {
  // 转换为 HH:MM:SS,mmm 格式
}
```

**执行步骤**：

```bash
# 在 src/utils/export.js 中实现 exportSRT 和 exportBilingual
# 在工具栏「导出 SRT」按钮接入
# 在工具栏「复制全文」按钮接入（复制到剪贴板）

git add -A
git commit -m "feat(export): 实现 SRT 字幕文件导出与双语全文复制功能"
git push origin feat/export
```

---

### PR-10 · Demo 模式与演示脚本

**分支名**：`feat/demo-mode`

**目标**：确保评委在没有真实麦克风、没有稳定 API、没有直播源的情况下，也能看到题目二完整闭环：外语音频流 → 中文字幕 → 翻译修正 → 术语生效 → 导出。

**内置 Demo 内容**：

```
场景：Global AI Product Launch / 国际 AI 产品发布会
时长：60-90 秒
内容：包含 8-12 条英文片段，其中至少包含 2 个容易翻错的术语
术语示例：
  "latency budget" -> "延迟预算"
  "pitch deck" -> "融资演示文稿"
  "edge device" -> "边缘设备"
```

**创建文件**：`src/mock/demoTranscript.js`

```javascript
export const demoTranscript = [
  {
    startMs: 0,
    endMs: 4200,
    en: 'Good morning everyone, welcome to our global AI product launch.',
  },
  {
    startMs: 4200,
    endMs: 8800,
    en: 'Today we will show how real-time translation reduces the latency budget for online meetings.',
  },
];
```

**Demo 运行逻辑**：

```javascript
// demoStream.js
// 1. 根据 audio.currentTime 或 setInterval 推送 demoTranscript 片段
// 2. 每条片段进入同一 streamTranslate 管线
// 3. 如果没有 API Key，使用内置 demoZh 字段作为降级译文
// 4. 保留人工修正、术语表、导出等真实交互
```

**UI 要求**：

- 输入源选择中提供「Demo」模式。
- Demo 模式显示“用于评审稳定演示，真实模式请切换麦克风/文件/直播”。
- 开始后字幕按时间流动，不能一次性全部出现。
- Demo 模式也必须允许人工修正和术语重译。

**执行步骤**：

```bash
# 创建 src/mock/demoTranscript.js
# 创建 src/engine/demoStream.js
# SourceSelector.jsx 增加 Demo 模式
# startTranslation 根据 sourceMode === 'demo' 启动 demoStream

git add -A
git commit -m "feat(demo): 增加同传演示模式，稳定展示字幕翻译与修正闭环"
git push origin feat/demo-mode
```

**PR 测试方式**：
1. 不填写 API Key，切换到 Demo 模式
2. 点击开始，字幕按时间逐句出现
3. 编辑一条中文译文并保存
4. 添加术语并重译相关字幕
5. 导出双语文本，确认包含修正后的译文

---

### PR-11 · 高级设置面板

**分支名**：`feat/settings-modal`

**目标**：实现设置弹窗，允许用户调整翻译参数。

**设置项**：

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| 翻译语言 | Select | 英语→中文（简体） | 源/目标语言对 |
| 翻译风格 | Select | 正式（学术/会议） | 影响 system prompt |
| 上下文窗口 | Number | 6 | 送入 AI 的历史句数 |
| 音频分片长度 | Number | 4s | 每次 STT 处理的时间窗口 |
| 专业词汇增强 | Toggle | 开 | 在 prompt 中加入领域词汇提示 |

**执行步骤**：

```bash
# SettingsModal.jsx 已有静态结构（PR-03），本 PR 接入 store
# 设置保存后写入 store，实时生效（不需要重启翻译）
# 设置项持久化到 localStorage（页面刷新后保留）

git add -A
git commit -m "feat(settings-modal): 实现高级设置面板，支持翻译参数配置与 localStorage 持久化"
git push origin feat/settings-modal
```

---

### PR-12 · 音频波形可视化

**分支名**：`feat/waveform`

**目标**：实时显示麦克风/系统音频的音量波形，给用户视觉反馈。

**实现**：

```javascript
// 使用 Web Audio API AnalyserNode
const analyser = audioContext.createAnalyser();
analyser.fftSize = 64; // 32 个频段，足够波形显示

const dataArray = new Uint8Array(analyser.frequencyBinCount);

function drawWaveform() {
  analyser.getByteFrequencyData(dataArray);
  // 将 dataArray 写入 store，Waveform 组件订阅并渲染
  requestAnimationFrame(drawWaveform);
}
```

**执行步骤**：

```bash
# 创建 src/engine/audioAnalyser.js
# Waveform.jsx 从 store 读取频率数据，渲染为柱状动画
# 停止翻译时清理 AudioContext

git add -A
git commit -m "feat(waveform): 实现 Web Audio API 实时音量波形可视化"
git push origin feat/waveform
```

---

### PR-13 · TTS 语音播报

**分支名**：`feat/tts`

**目标**：将每条稳定译文通过语音播报，实现"同声传译"的语音输出形态，满足题目"字幕**或**语音"的要求。

**两级方案（优先用方案A，方案B作为进阶）**：

```
方案A：Web Speech Synthesis API（浏览器原生）
  优点：零成本、零延迟、无需 API Key
  缺点：中文音色质量因浏览器和系统而异

方案B：OpenAI TTS API（tts-1 模型）
  优点：音色自然、稳定
  缺点：需要额外 API 调用，增加约 500-1000ms 延迟
  触发条件：用户在设置中选择"高质量语音"
```

**创建文件**：`src/engine/tts.js`

**核心接口设计**：

```javascript
class TTSEngine {
  constructor() {
    this._queue = [];        // 待播报队列
    this._isSpeaking = false;
    this._enabled = false;
    this._rate = 1.1;        // 语速，略快于正常（同传场景）
    this._voice = null;      // 选中的中文语音
  }

  // 初始化：等待语音列表加载完成，选最优中文声音
  async init() {
    await this._waitForVoices();
    this._voice = this._selectBestChineseVoice();
  }

  // 将文本加入播报队列
  enqueue(text) {
    if (!this._enabled) return;
    this._queue.push(text);
    if (!this._isSpeaking) this._processQueue();
  }

  // 立即打断当前播报（用户停止翻译时调用）
  cancel() {
    speechSynthesis.cancel();
    this._queue = [];
    this._isSpeaking = false;
  }

  setEnabled(bool) { this._enabled = bool; if (!bool) this.cancel(); }
  setRate(rate) { this._rate = rate; }
}
```

**选择最优中文声音**：

```javascript
_selectBestChineseVoice() {
  const voices = speechSynthesis.getVoices();

  // 优先级：Microsoft 中文 > Google 中文 > 任意 zh 语音
  const priority = [
    v => v.name.includes('Microsoft') && v.lang.startsWith('zh'),
    v => v.name.includes('Google') && v.lang.startsWith('zh'),
    v => v.lang.startsWith('zh-CN'),
    v => v.lang.startsWith('zh'),
  ];

  for (const match of priority) {
    const found = voices.find(match);
    if (found) return found;
  }
  return null; // 降级：使用系统默认
}
```

**队列播报逻辑**：

```javascript
_processQueue() {
  if (this._queue.length === 0) {
    this._isSpeaking = false;
    return;
  }

  this._isSpeaking = true;
  const text = this._queue.shift();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = this._voice;
  utterance.lang = 'zh-CN';
  utterance.rate = this._rate;
  utterance.pitch = 1.0;

  utterance.onend = () => this._processQueue();
  utterance.onerror = (e) => {
    console.warn('[TTS] error:', e.error);
    this._processQueue(); // 出错也继续下一条
  };

  // Chrome bug：长时间不说话后 synthesis 会卡住，需要 resume
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// Chrome 已知 bug：synthesis 在后台标签页暂停
// 每 10 秒 resume 一次防止卡死
_startKeepAlive() {
  this._keepAliveTimer = setInterval(() => {
    if (speechSynthesis.speaking) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    }
  }, 10000);
}
```

**与主流程对接**（在 `sttManager.js` 的翻译完成回调中）：

```javascript
// 翻译完成，字幕已 append 后：
if (store.getState().voiceOutput) {
  ttsEngine.enqueue(finalZhText);
}

// 修正触发时，不重复播报（避免混乱）
// correctSubtitle 不调用 ttsEngine.enqueue
```

**Store 新增字段**：

```javascript
// 在 useStore.js 中补充：
voiceOutput: false,          // 是否启用语音播报（已有，现在真正接入）
ttsRate: 1.1,                // 语速（0.5 - 2.0）
ttsQuality: 'browser',       // 'browser' | 'openai'
setTtsRate: (rate) => set({ ttsRate: rate }),
setTtsQuality: (q) => set({ ttsQuality: q }),
```

**UI 联动**：

```
左面板「字幕设置」区域：
  [Toggle] 语音播报         ← 已有，现在真正生效
  [Slider] 语速  ●————  1.1x   ← 新增，range: 0.8-1.5，step: 0.1
  [Select] 音质  浏览器原生 ▾   ← 新增，选项：浏览器原生 / OpenAI TTS（需Key）

播报状态指示（Header 状态区）：
  当 voiceOutput=true 且正在说话时，状态 pill 显示 🔊 播报中
  当队列积压 > 3 条时，显示 ⚡ 加速 badge（自动提升语速）
```

**队列积压保护**（同传场景说话速度可能超过 TTS 播报速度）：

```javascript
enqueue(text) {
  if (!this._enabled) return;

  // 队列超过 3 条说明跟不上，丢弃最旧的
  if (this._queue.length > 3) {
    this._queue.shift();
    console.warn('[TTS] queue overflow, dropping oldest item');
  }

  // 自动加速
  const autoRate = this._queue.length > 1 ? this._rate * 1.15 : this._rate;
  this._queue.push({ text, rate: autoRate });

  if (!this._isSpeaking) this._processQueue();
}
```

**执行步骤**：

```bash
# Step 1：创建 src/engine/tts.js，实现 TTSEngine 类
npm install  # 无新依赖，纯浏览器 API

# Step 2：在 src/engine/sttManager.js 中实例化 TTSEngine
# 翻译完成后调用 ttsEngine.enqueue(zhText)
# 停止翻译时调用 ttsEngine.cancel()

# Step 3：左面板 SubtitleSettings.jsx 新增语速 Slider 和音质 Select
# 接入 store 的 ttsRate / ttsQuality

# Step 4：Header 状态 pill 接入播报状态

git add -A
git commit -m "feat(tts): 实现 Web Speech Synthesis 语音播报，支持队列管理与积压自动加速"
git push origin feat/tts
```

**PR 描述模板**：

```
标题：[feat] 实现 TTS 语音播报，支持中文同声朗读

## 功能描述
翻译完成的中文字幕可通过浏览器语音合成 API 实时朗读，
用户无需盯着屏幕即可通过听觉跟上内容。
支持语速调节（0.8x-1.5x）、自动积压丢帧保护，
可在设置中一键开关。

## 实现思路
使用浏览器原生 SpeechSynthesisUtterance，优先选择 Microsoft/Google
中文声音。设计队列管理器处理流式字幕的顺序播报，
积压超过 3 条时自动丢弃最旧条目并提速，避免越来越滞后。
针对 Chrome 后台标签页暂停的已知 bug，加入 10s keep-alive 定时器。

## 测试方式
1. 打开页面，在设置中开启「语音播报」
2. 上传音频文件并开始翻译
3. 每条字幕固定后约 0-200ms 内应有中文朗读声音
4. 调节语速 Slider，朗读速度应实时变化
5. 快速说话（或用快速音频）时，Console 出现 "queue overflow" 警告，
   但页面不卡顿，播报不中断
```

---

### PR-14 · 整体联调与 Demo 打磨

**分支名**：`feat/polish`

**目标**：端到端联调，修复 bug，优化交互细节，确保 Demo 可复现，并满足题目二提交规则。

**检查清单**：

```
[ ] 冷启动流程：打开页面 → 配置 Key → 上传文件 → 开始翻译 → 看到字幕，全程无报错
[ ] Demo 模式：无 API Key 也能看到外语片段按时间流动、中文字幕出现、修正和导出可用
[ ] 麦克风模式：对着麦克风说英文，interim 原文和 final 中文译文正常出现
[ ] 文件模式：上传示例音频后，音频播放、时间轴、字幕流同步推进
[ ] 直播模式：getDisplayMedia 能捕获标签页/屏幕音频，波形随声音变化，停止后释放 track
[ ] 切换 Provider 不需要刷新页面
[ ] 停止翻译后再次开始，历史字幕清空，重新计时
[ ] 文件播放完毕自动停止
[ ] 人工修正：点击字幕可编辑中文译文，保存后显示「用户修正」
[ ] 术语表：添加术语后，后续翻译/重译优先使用指定译法并显示「术语命中」
[ ] 自动修正：新上下文到来后可重译前一句，并显示「上下文修正」
[ ] 导出 SRT 文件可被 VLC / 剪映正常识别
[ ] 导出双语文本包含人工修正后的最终译文
[ ] 语音播报开关正常，朗读与字幕基本同步（允许 <500ms 误差）
[ ] 快速音频下 TTS 队列不会无限积压，Console 出现 overflow 警告但页面不卡
[ ] 停止翻译时语音立即打断，不继续播报残留队列
[ ] 页面在 Chrome / Edge 最新版可正常运行（Safari 不强求，Web Speech API 支持有限）
[ ] 统计栏延迟数据真实反映 API 响应时间
[ ] 移动端不崩溃（不要求完美，能打开即可）
[ ] README.md 明确写出：本作品选择题目二 AI 同声传译助手
[ ] README.md 包含：功能截图、快速开始步骤、环境要求、支持的 Provider、Demo 视频链接
[ ] README.md 如实说明真实模式和 Demo 模式边界，不能夸大 Web Speech API 对文件/系统音频流的能力
[ ] GitHub/Gitee 仓库公开可访问
[ ] Commit 时间均位于 2026-06-05 00:00 至 2026-06-07 23:59
[ ] PR 记录按单一功能拆分，标题/描述/测试方式齐全，主分支最终可运行
[ ] Demo 视频有声音讲解，展示：音频输入 → 实时字幕 → 人工修正 → 术语生效 → 导出
```

**执行步骤**：

```bash
# 修复联调中发现的所有 P0 bug
# 更新 README.md
# 补充 docs/demo-script.md，写清 Demo 讲解顺序
# 确认 npm run build 无报错

git add -A
git commit -m "feat(polish): 完成题目二端到端联调与 Demo 提交材料"
git push origin feat/polish
```

---

## 3. 注意事项与常见坑

### 3.1 Web Speech API 限制

```
⚠️ 仅 Chrome / Edge 支持完整功能
⚠️ 必须 HTTPS 或 localhost，http:// 下无法使用
⚠️ continuous 模式下会自动停止，必须在 onend 中重启
⚠️ 识别结果可能包含标点，也可能不含，翻译 prompt 要容错
⚠️ Web Speech API 主要面向麦克风输入，不等价于“文件/系统音频流直接识别”
```

### 3.1.1 能力边界表述

README、Demo 视频和页面文案必须诚实区分：

| 能力 | 可以怎么说 | 不能怎么说 |
|---|---|---|
| 麦克风模式 | 支持通过 Web Speech API 实时识别麦克风英文语音并翻译 | 支持所有浏览器、所有语言、无延迟同传 |
| 文件模式 MVP | 支持示例音频按时间轴驱动转写流，展示同传字幕、修正和导出闭环 | 已完整从任意文件音频直接 ASR 识别，除非 ASR Adapter 已实现并验证 |
| 直播模式 MVP | 支持捕获标签页/屏幕音频并做波形确认，预留 ASR 分片接口 | 已把系统音频直接送入 Web Speech API 识别 |
| Demo 模式 | 用于评审稳定演示完整产品闭环 | 替代真实功能或隐藏真实能力限制 |

题目二的有效核心是“外语音频流实时翻译成中文 + 翻译修正能力”。所有页面、README 和视频讲解都要围绕这个核心，不加入英语陪练评分、小说转剧本、泛聊天机器人等无关表述。

### 3.2 CORS 问题

```
DeepSeek / OpenAI API 支持跨域，可直接从浏览器调用。
Claude API 需要后端代理（浏览器直调会 CORS 报错）。
如果要支持 Claude，需要在 vite.config.js 配置代理：

server: {
  proxy: {
    '/api/claude': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/claude/, ''),
    }
  }
}
```

### 3.3 内存泄漏防护

```javascript
// 每次停止翻译时必须执行：
recognition.stop();
mediaStream?.getTracks().forEach(t => t.stop());
audioContext?.close();
cancelAnimationFrame(animFrameId);
```

### 3.4 API Key 安全

```
⚠️ API Key 仅存在 Zustand 内存中（不写 localStorage）
⚠️ 设置面板的 Key 输入框 type="password"
⚠️ 在 README 中明确说明：本工具不收集任何数据，Key 仅在本地使用
```

---

## 4. 快速参考

### 启动命令

```bash
npm install
npm run dev      # 开发服务器 localhost:5173
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

### 环境要求

- Node.js >= 18
- Chrome 或 Edge 最新版（Web Speech API）
- 需要科学上网访问 OpenAI API；DeepSeek 国内可直连

### 支持的 Provider 与 Base URL

| Provider | Base URL | 备注 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | 国内直连，推荐 |
| OpenAI | `https://api.openai.com/v1` | 需梯子 |
| Claude | 需后端代理 | 见 3.2 |
| 自定义 | 用户填写 | 兼容 OpenAI 格式的任意服务 |
