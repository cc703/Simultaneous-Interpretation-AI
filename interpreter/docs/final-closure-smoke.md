# 最终闭环自动验收记录

测试时间：2026/6/6 20:41:10 +08:00

本记录对应最终闭环测试计划中的自动检查部分。真实 API Key 只保存在本地 `.env`，本报告不记录任何密钥。

Gateway：http://localhost:8787

后端状态：复用已有服务

| 检查项 | 状态 | 耗时 ms | 末尾输出摘要 |
| --- | --- | --- | --- |
| build | pass | 1665 | ✓ built in 374ms |
| unit-tests | pass | 971 | Node test suite passed: 6 tests, 2 suites, 0 failures. |
| api-config | pass | 1396 | translation: 200 OK https://dashscope.aliyuncs.com/compatible-mode/v1/models / asr: 200 OK https://dashscope.aliyuncs.com/compatible-mode/v1/models |
| file-asr | pass | 4330 | PASS transcribed 973 characters. |
| media-scenarios | pass | 5242 | PASS english-speech-wav http=200 chars=973 ok / PASS music-only-wav http=200 chars=0 no speech detected / PASS english-video-mp4 http=200 chars=103 ok / PASS live-chunk-wav http=200 chars=104 ok |
| gateway-boundaries | pass | 1454 | PASS health-ready http=200 translationKey=true asrKey=true / PASS translate-success-sse http=200 sseBytes=1680 / PASS translate-invalid-json http=400 invalid_json / PASS transcribe-invalid-content-type http=400 invalid_audio_upload / PASS transcribe-empty-multipart http=400 invalid_audio_upload / PASS transcribe-oversize-inline-limit http=413 file_too_large |
| secret-scan | pass | 123 | PASS no obvious API secrets in tracked source surfaces. |

## 覆盖范围

- 构建与单元测试。
- API Provider 可达性检查。
- File 主线 ASR。
- 音频、视频、音乐/无语音、Live 分片多媒体边界。
- Gateway 成功路径与错误边界。
- 源码与示例配置密钥扫描。

## 手动补充测试

- File 模式：加载样本或上传音视频，验证字幕、修正、导出。
- Live 模式：打开 `/live-room.html`，选择标签页并共享音频，验证 Queued/Done 和字幕生成。
- 语言路由：源语言默认自动检测，目标语言可切换，字幕按钮为双语/目标语言/检测语言。
