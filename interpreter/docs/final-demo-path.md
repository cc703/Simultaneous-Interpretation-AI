# 最终演示路径

目标：让评审看到题目二的完整闭环，而不是只看到页面控件。

## 0. 启动

无真实 Key 也能演示稳定闭环：

```bash
cd interpreter
npm run dev
```

需要真实 ASR / 翻译时：

```bash
cd interpreter
npm run dev:server
npm run dev
```

打开 `http://localhost:5173`。右上角显示 `ASR dashscope` 或其他 provider 时，说明前端已经识别到后端。

## 1. 先跑稳定 Demo

1. 输入源保持 `Demo`。
2. 选择 `Product Launch` 或 `Technical Talk` 场景。
3. 点击 `Start Demo Interpretation`。
4. 讲解：英文语音流逐句进入，中文字幕流式出现，Demo Guide 会点亮输入流、术语、复盘状态。

## 2. 展示修正闭环

1. 点击一条字幕。
2. 在 `Correction Desk` 修改中文。
3. 点击 `Save correction`。
4. 讲解：字幕标记为人工修正，Correction Memory 记录用户确认译文，后续真实翻译 prompt 会参考它。

## 3. 展示术语重译

1. 切到 `Configuration -> Terms`。
2. 添加或确认当前场景术语。
3. 选择包含该术语的字幕。
4. 点击 `Retranslate with glossary`。
5. 讲解：术语命中标签和 Risk Review 体现专业场景的一致性控制。

## 4. 展示真实文件模式

1. 切到 `File`。
2. 上传 `test-media/sample-english-speech.wav`。
3. 观察左侧阶段条：`File -> ASR -> Translate -> Done`。
4. 如果 ASR Key 不可用，讲解错误状态和 `Retry file ASR`，不要伪装成功。
5. 如果 Key 可用，等待字幕生成后继续执行修正、术语和导出。

## 5. 展示 Live 稳定性设计

1. 切到 `Live`。
2. 点击 `Choose tab audio`。
3. 选择带英文音频的标签页或屏幕。
4. 讲解 Live 统计：`Queued`、`Done`、`Silent`、`Dup`。
5. 说明系统会跳过过短/静音片段，并对重复转写做去重，避免字幕刷屏。

## 6. 导出

1. 点击 `Export` 下载 SRT。
2. 点击 `Review` 下载同传复盘报告。
3. 点击 `Copy` 复制双语文本。

## 必须说明的边界

- Demo 模式用于稳定证明完整产品闭环。
- File / Live 真实 ASR 依赖后端 provider、Key、网络和供应商能力。
- Live 是几秒级准实时分片，不承诺零延迟。
- 当前前端单文件建议 25MB 内；DashScope inline 音频建议 10MB 内。
