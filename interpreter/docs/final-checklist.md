# 最终提交前检查清单

用于录制 Demo 视频和最终提交前逐项确认。

## 本地运行

- [ ] 执行 `cd interpreter && npm install`
- [ ] 执行 `npm run dev`
- [ ] 浏览器打开 `http://localhost:5173`
- [ ] 执行 `npm test` 通过
- [ ] 执行 `npm run build` 通过

## 核心演示链路

- [ ] Demo 模式无需 Key，点击 `Start Demo Interpretation` 后字幕按时间流动。
- [ ] 打开 `Chinese voice output` 后，中文字幕可被浏览器语音播报。
- [ ] 点击字幕，修改中文，点击 `Save correction`，字幕显示用户修正。
- [ ] `Risk Review` 能显示质量风险或空状态说明。
- [ ] `Correction Memory` 能显示最近人工修正。
- [ ] `Configuration -> Terms` 可新增术语，并通过 `Retranslate with glossary` 应用。
- [ ] 顶部 `Bilingual` / `ZH only` / `EN only` 切换有效。
- [ ] `Export` 下载 SRT。
- [ ] `Review` 下载 Markdown 复盘报告。
- [ ] `Copy` 复制双语文本，或在剪贴板不可用时降级下载文本。

## 真实能力验证

- [ ] Mic 模式在 Chrome / Edge 下可请求麦克风权限。
- [ ] File 模式上传 25MB 以内英文音频/视频后，填写 `DASHSCOPE_API_KEY` 可通过 `/api/transcribe` 调用真实 ASR。
- [ ] File 模式未填写 ASR Key 时，页面明确提示降级为演示转写流。
- [ ] Live 模式可通过 `Choose tab audio` 请求标签页/屏幕音频。
- [ ] Live 模式填写 ASR Key 后会显示 Live ASR 分片状态。
- [ ] 停止 Live 捕获后音频 track 被释放，状态不再继续转写。

## 文案边界

- [ ] README 写明选择题目二。
- [ ] README 写明 Demo 视频链接占位，提交前替换为公开视频链接。
- [ ] 不声称直播是毫秒级无延迟同传。
- [ ] 不声称前端可无限制处理任意大小文件。
- [ ] 说明 API Key 仅保存在内存，不写入 localStorage。

## 提交材料

- [ ] GitHub/Gitee 仓库公开可访问。
- [ ] README 包含运行方式、功能说明、能力边界和 Demo 视频链接。
- [ ] Demo 视频有声音讲解。
- [ ] Demo 视频展示：输入源 -> 实时字幕 -> 修正 -> 术语 -> 语音播报 -> 导出。
