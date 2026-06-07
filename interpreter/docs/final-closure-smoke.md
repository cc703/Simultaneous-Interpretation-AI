# 最终闭环自动验收记录

测试时间：2026/6/7 17:41:13 +08:00

本记录对应最终闭环测试计划中的自动检查部分。真实 API Key 只保存在本地 `.env`，本报告不记录任何密钥。

Gateway：http://127.0.0.1:8792
Frontend：http://127.0.0.1:4173

后端状态：复用已有服务

| 检查项 | 状态 | 耗时 ms | 末尾输出摘要 |
| --- | --- | --- | --- |
| build | pass | 1985 | ✓ built in 466ms |
| unit-tests | pass | 1994 | # tests 29 / # suites 9 / # fail 0 |
| api-config | pass | 2008 | translation: 200 OK https://dashscope.aliyuncs.com/compatible-mode/v1/models / asr: 200 OK https://dashscope.aliyuncs.com/compatible-mode/v1/models |
| file-asr | pass | 4284 | PASS transcribed 973 characters. |
| media-scenarios | pass | 6724 | PASS english-speech-wav http=200 chars=973 ok / PASS music-only-wav http=200 chars=0 no speech detected / PASS english-video-mp4 http=200 chars=104 ok / PASS live-chunk-wav http=200 chars=104 ok / PASS live-chunk-webm http=200 chars=103 ok |
| gateway-boundaries | pass | 2610 | PASS health-ready http=200 translationKey=true asrKey=true / PASS translate-success-sse http=200 sseBytes=1680 / PASS translate-invalid-json http=400 invalid_json / PASS transcribe-invalid-content-type http=400 invalid_audio_upload / PASS transcribe-empty-multipart http=400 invalid_audio_upload / PASS transcribe-oversize-inline-limit http=413 file_too_large |
| browser-ux | pass | 108796 | PASS demo-realtime-captions cards=1 control=同传控制台 On air 实时音频流 Demo stream 语义分段 final ASR units 自动回修 0 revised 同传质量 未发现格式风险 人工确认 No entries sample=00:00:00 当前同传 Good morning everyone, welcome to our global AI product launch. 大家早上好，欢迎参加我们的全球 AI 产品发布会。 / PASS manual-correction-export correction_count=1 export=.omx\ux-manual-correction.srt corrected=大家早上好，欢迎参加我们的全球 AI 产品发布会。（人工修正验收） / PASS demo-voice-output tts={'queued': 1, 'spoken': 2, 'dropped': 0, 'cancelled': 0, 'lastText': '大家早上好，欢迎参加我们的全球 AI 产品发布会。', 'lastLang': 'zh-CN', 'lastRate': 1.1, 'status': 'idle', 'enabled': True, 'speaking': False, 'queueLength': 0, 'available': True} spoken=[{'text': 'Good morning everyone, welcome to our global AI product launch.', 'lang': 'en-US', 'rate': 1.05}, {'text': '大家早上好，欢迎参加我们的全球 AI 产品发布会。', 'lang': 'zh-CN', 'rate': 1.1}] / PASS audio-file-interpretation status=同传闭环完成：听音 -> 切分 -> 理解 -> 转译 -> 字幕 -> 修正导出。 sample=00:00:01 当前同传 a free online resource for downloading sample files in a wide variety of. 一个免费的在线资源，可下载多种类型的样本文件。 online resource sample files 00:00:00 Welcome to SampleLab.com, 欢迎访问 SampleLab.com， / PASS adaptive-audio-file-interpretation status=真实 ASR 已完成，正在播放媒体并按时间轴输出同传字幕。 sample=00:00:01 当前同传 a free online resource for downloading sample files in a wide variety of digital formats. 一个免费的在线资源，可下载多种数字格式的样本文件。 online resource sample files 00:00:00 Welcome to SampleLab.com, 欢迎访问 SampleLab.com！ / PASS video-file-interpretation status=同传闭环完成：听音 -> 切分 -> 理解 -> 转译 -> 字幕 -> 修正导出。 sample=00:00:01 当前同传 a free online resource for downloading sample files in a wide variety of. 一个免费的在线资源，可下载多种类型的样本文件。 online resource sample files 00:00:00 Welcome to SampleLab.com, 欢迎访问 SampleLab.com！ / PASS live-sample-stream live=1 听音接入 2 语音切分 3 语义理解 4 转译重组 5 字幕输出 6 修正沉淀 停止直播捕获 适用于网页直播、社交直播、媒体直播和线上会议。 直播路径会持续读取当前共享标签页或屏幕的音频流，不注入第三方页面。 SOURCE Test-only injected sample media stream / 测试样本音频流 PERMISSION Audi sample=live 识别中 Whether you are a software developer testing file upload functionality, a quality. 正在理解源语义并重组目标语言... 00:00:14 当前同传 a free online resource for downloading sample files in a wide variety of digital formats. 一 / PASS live-overlay-sync overlay=auto -> zh-CN · 字幕 Test-only injected sample media stream / 测试样本音频流 · running · Done 0 a free online resource for downloading sample files in a wide variety of digital formats. 一个 / PASS fast-live-sample-stream live=1 听音接入 2 语音切分 3 语义理解 4 转译重组 5 字幕输出 6 修正沉淀 停止直播捕获 适用于网页直播、社交直播、媒体直播和线上会议。 直播路径会持续读取当前共享标签页或屏幕的音频流，不注入第三方页面。 SOURCE Test-only fast injected sample media stream / 测试快语速样本音频流 PERMISSION Audio captured ASR Provider ready CHUNKING 3s + semantic 语速检测 204 WPM OUTPUT sample=live 识别中 Welcome to SampleLab.com, 正在理解源语义并重组目标语言... / PASS live-stop-final-flush stable_before=1 live=1 听音接入 2 语音切分 3 语义理解 4 转译重组 5 字幕输出 6 修正沉淀 选择直播音频 适用于网页直播、社交直播、媒体直播和线上会议。 直播路径会持续读取当前共享标签页或屏幕的音频流，不注入第三方页面。 SOURCE Not selected PERMISSION Required ASR Provider ready CHUNKING 3s + semantic 语速检测 Listening OUTPUT Caption sample=00:00:13 当前同传 Welcome to SampleLab.com, 欢迎访问 SampleLab.com， / PASS live-silent-stream live=1 听音接入 2 语音切分 3 语义理解 4 转译重组 5 字幕输出 6 修正沉淀 停止直播捕获 适用于网页直播、社交直播、媒体直播和线上会议。 直播路径会持续读取当前共享标签页或屏幕的音频流，不注入第三方页面。 SOURCE Test-only silent media stream / 测试静音音频流 PERMISSION Audio captured ASR Provider ready CHUNKING 3s + semantic 语速检测 Listening O |
| secret-scan | pass | 105 | PASS no obvious API secrets in tracked source surfaces. |

## 覆盖范围

- 构建与单元测试。
- API Provider 可达性检查。
- File 主线 ASR。
- 音频、视频、音乐/无语音、Live 分片多媒体边界。
- Gateway 成功路径与错误边界。
- 浏览器内 Demo、音频文件、视频文件、Live 样本音频流、快语速、静音、字幕浮窗、语音输出调用和修正/导出闭环体验。
- 源码与示例配置密钥扫描。

## 手动补充测试

- File 模式：加载样本或上传音视频，验证字幕、修正、导出。
- Live 模式自动化使用注入 MediaStream 和 WebM/Opus 分片证明同传引擎；真实直播/DY/会议标签页仍需在浏览器权限弹窗中手动勾选共享标签页音频，验证 Queued/Done、字幕生成和无音频提示。
- 语音输出自动化验证浏览器 TTS 调用；实际可听音量仍取决于系统浏览器语音和输出设备。
- 语言路由：源语言默认自动检测，目标语言可切换，字幕按钮为双语/目标语言/检测语言。
