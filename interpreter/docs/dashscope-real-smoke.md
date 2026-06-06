# DashScope 真实接口烟测记录

测试时间：2026-06-06 13:30 +08:00

本记录用于比赛 PR 描述和最终提交前自查。测试使用本地 `.env` 中的 `DASHSCOPE_API_KEY`，Key 不进入仓库，以下结果均为脱敏记录。

## 环境

- Gateway：`http://localhost:8787`
- Provider：阿里云百炼 DashScope
- 翻译模型：`qwen-plus`
- ASR 模型：`qwen3-asr-flash`
- 测试音频：`test-media/sample-english-speech.wav`

## 结果

```text
npm run check:api
translation: 200 OK https://dashscope.aliyuncs.com/compatible-mode/v1/models
asr: 200 OK https://dashscope.aliyuncs.com/compatible-mode/v1/models
```

```text
GET /api/health
hasTranslationKey: true
hasAsrKey: true
asrProvider: dashscope
translationModel: qwen-plus
asrModel: qwen3-asr-flash
```

```text
npm run smoke:file-asr
PASS transcribed 973 characters.
```

翻译 Gateway 也已通过 `/api/translate` 真实 SSE 测试，`qwen-plus` 返回中文分片，例如“直播”“主题”“演讲”。

## 结论

- File 模式的真实 ASR 后端链路已跑通：英文音频上传到 `/api/transcribe`，Gateway 调用 DashScope Qwen-ASR 并返回非空英文转写。
- 翻译链路已跑通：前端选择 `Server Gateway` 时，可通过 `/api/translate` 调用 DashScope `qwen-plus` 流式生成中文。
- `.env.example` 只保留占位符；真实 Key 只放在本地 `.env`。

