# Demo 录屏讲解脚本

本脚本用于比赛提交视频，目标是清楚展示题目二“AI 同声传译助手”的核心闭环：外语音频流输入、实时中文字幕、语音输出、翻译修正和导出。

建议时长：3 到 5 分钟。

## 录制前准备

1. 启动项目：

```bash
cd interpreter
npm install
npm run dev
```

2. 打开 `http://localhost:5173`。
3. 保持输入源为 `Demo`，不需要 API Key 也能完成稳定演示。
4. 在左侧 Demo 场景中选择一个最适合讲解的预设，例如 `Product Launch`、`Technical Talk` 或 `Business Meeting`。
5. 可选：如果要展示真实流式翻译，在 `Configuration -> Translate` 填写 OpenAI-compatible API Key。
6. 可选：如果要展示真实文件或直播 ASR，在 `Configuration -> ASR` 填写 OpenAI ASR Key。

## 讲解顺序

### 1. 说明选题和目标

“本项目选择题目二：AI 同声传译助手。目标是把外语音频流实时转换为中文字幕，并提供语音播报、人工修正、术语增强、质量诊断和会后导出能力。”

画面操作：展示顶部标题、Workflow、输入源、Configuration、质量概览和字幕工作区。

### 2. 展示实时字幕流

“我先用 Demo 模式展示稳定评审闭环。左侧有三个内置同传场景，切换场景会同步更换英文发言、中文字幕和推荐术语。点击 Start Interpreting 后，英文发言会按时间轴逐句进入字幕区，而不是一次性显示全部内容。”

画面操作：

1. 在 Demo 场景中点选 `Product Launch`、`Technical Talk` 或 `Business Meeting`。
2. 指出右侧 `Demo Guide` 会显示当前场景、输入流、术语、修正和复盘证明项。
3. 点击 `Start Interpreting`。
4. 等待字幕逐条出现。
5. 指出底部大字幕、质量概览和 Demo Guide 会同步变化。

### 3. 展示中文语音输出

“打开 Chinese voice output 后，系统会使用浏览器中文语音播报新生成的中文字幕，满足题目要求中的字幕或语音输出。”

画面操作：

1. 勾选 `Chinese voice output`。
2. 让下一句 Demo 字幕出现并播放。
3. 可打开 `Settings` 展示语速调节。

### 4. 展示翻译修正能力

“同传场景中译文可能需要人工快速修正。这里我选择一条字幕，直接在 Correction Desk 修改中文，然后保存。”

画面操作：

1. 点击一条字幕卡片。
2. 在 `Correction Desk` 修改中文译文。
3. 点击 `Save correction`。
4. 展示字幕卡片标记为用户修正，Corrections 计数增加，右侧 Demo Guide 的“修正”证明项点亮。

### 5. 展示质量诊断、术语表和重译

“专业会议里术语一致性很重要。系统会检查术语命中、疑似漏译和占位翻译，也支持添加术语并对选中字幕进行术语重译。”

画面操作：

1. 在 `Configuration -> Terms` 添加 `pitch deck` -> `融资演示文稿`。
2. 选择包含该词的字幕。
3. 点击 `Retranslate with glossary`。
4. 展示术语命中标签、`Risk Review` 和 `Correction Memory`。
5. 指出 Demo Guide 的“术语”和“复盘”证明项会根据字幕结果更新。

### 6. 展示文件模式

“文件模式支持上传本地英文音频或视频。填写 ASR Key 后，系统会调用 `/audio/transcriptions` 做真实英文转写，再进入中文翻译、修正、术语和导出流程。”

画面操作：

1. 切换到 `File`。
2. 上传一个音频或视频文件。
3. 在 `Configuration -> ASR` 确认 ASR Key 和模型。
4. 点击 `Transcribe Uploaded File`。
5. 展示文件名、ASR 状态、进度条、波形和字幕输出。

边界说明：“浏览器直传限制为 25MB；未填写 ASR Key 时会明确降级为演示转写流。”

### 7. 展示直播捕获和分片 ASR

“Live 模式可以捕获浏览器标签页或屏幕音频。填写 ASR Key 后，系统会使用 MediaRecorder 按分片长度持续转写直播音频，再送入中文翻译链路。”

画面操作：

1. 切换到 `Live`。
2. 在 `Configuration -> ASR` 确认 ASR Key。
3. 点击 `Choose tab audio`。
4. 选择一个带英文音频的标签页或屏幕。
5. 展示捕获状态、波形、Live ASR 状态和 `Stop live capture`。

边界说明：“Live ASR 依赖浏览器共享音频权限、MediaRecorder、ASR Key 和网络质量，是几秒级准实时分片转写。”

### 8. 展示导出

“最后，系统支持把当前字幕结果导出为 SRT、复制双语文本，还可以导出同传复盘报告，方便会后检查质量和修正记录。”

画面操作：

1. 点击 `Export` 下载 SRT。
2. 点击 `Review` 下载 Markdown 复盘报告。
3. 点击 `Copy` 复制双语文本。

### 9. 总结开发过程

“开发过程按功能逐步推进：状态管理、UI、STT、流式翻译、修正闭环、Demo、文件真实 ASR、直播分片 ASR、质量诊断、修正记忆、导出报告、波形、TTS 和最终演示材料。主分支始终保持可运行，每一步都经过构建验证。”

## 必须避免的说法

- 不要说“无限制支持任意大小文件音频真实识别”。
- 不要说“直播同传无延迟”。
- 可以说“文件模式支持浏览器直传到 OpenAI ASR，25MB 以内更适合前端直传”。
- 可以说“直播模式支持 MediaRecorder 分片 ASR，属于几秒级准实时字幕”。
- 可以说“Demo 模式用于保证评审时稳定展示题目要求的完整产品闭环”。
