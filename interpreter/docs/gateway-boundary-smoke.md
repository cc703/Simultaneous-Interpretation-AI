# Gateway 成功与边界烟测记录

测试时间：2026/6/6 20:41:10 +08:00

本记录验证本地 AI Gateway 的成功路径和错误边界。真实 Key 只保存在本地 `.env`，报告不包含任何密钥。

| 用例 | 状态 | HTTP | Code | 延迟 ms | 说明 |
| --- | --- | --- | --- | --- | --- |
| health-ready | pass | 200 | - | 68 | translationKey=true asrKey=true |
| translate-success-sse | pass | 200 | - | 607 | sseBytes=1680 |
| translate-invalid-json | pass | 400 | invalid_json | 3 | - |
| transcribe-invalid-content-type | pass | 400 | invalid_audio_upload | 4 | - |
| transcribe-empty-multipart | pass | 400 | invalid_audio_upload | 4 | - |
| transcribe-oversize-inline-limit | pass | 413 | file_too_large | 43 | - |

## 覆盖范围

- 成功：健康检查、DashScope 翻译 SSE。
- 边界：翻译坏 JSON、ASR 非 multipart、ASR 缺少文件、DashScope inline 音频大小限制。
- 这些边界用于确保演示时失败会被明确解释，而不是静默生成假字幕。
