# 多媒体场景烟测记录

测试时间：2026/6/6 20:41:08 +08:00

本记录用于验证题目二“AI 同声传译助手”的多输入能力。真实 Key 只保存在本地 `.env`，报告只记录脱敏状态、字符数和短预览。

| 场景 | 文件 | 状态 | HTTP | 字符数 | 延迟 ms | 脱敏预览 |
| --- | --- | --- | --- | --- | --- | --- |
| english-speech-wav | test-media/sample-english-speech.wav | pass | 200 | 973 | 3128 | Welcome to SampleLab dot com, a free online resource for downloading sample file |
| music-only-wav | test-media/sample-music-tone.wav | pass | 200 | 0 | 325 |  |
| english-video-mp4 | test-media/sample-english-video.mp4 | pass | 200 | 103 | 539 | Welcome to SampleLab dot com, a free online resource for downloading sample file |
| live-chunk-wav | test-media/sample-live-chunk.wav | pass | 200 | 104 | 565 | Welcome to SampleLab. dot com, a free online resource for downloading sample fil |

## 结论

- 英文语音音频用于验证 File 主线：音频进入 ASR 后返回英文转写。
- 音乐/非语音音频用于验证边界：系统可以上传并明确返回未检测到可转写语音，演示时不承诺音乐内容可被翻译成有效字幕。
- 视频文件用于验证上传视频类素材后，Gateway 可以先提取音轨再发送给 ASR Provider。
- Live 分片样本用于近似验证直播分片 ASR：真实 Live 仍需要浏览器 `getDisplayMedia` 权限和用户主动共享音频。
