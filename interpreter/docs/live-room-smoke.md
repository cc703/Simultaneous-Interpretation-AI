# Live 直播间测试记录

测试时间：2026-06-06 18:45 +08:00

本记录用于验证题目二 Live 场景。Live 的真实浏览器共享权限需要人工选择标签页或屏幕，因此本测试拆成两部分：可自动验证的后端分片 ASR，以及需要浏览器手动确认的标签页音频捕获。

## 本地直播源

打开：

```text
http://127.0.0.1:5173/live-room.html
```

该页面播放 `public/demo-media/sample-english-video.mp4`，用于模拟网页直播间的英文视频声音。

## 自动验证

```bash
npm run smoke:file-asr -- test-media/sample-live-chunk.wav
```

结果：

```text
PASS transcribed 104 characters.
```

说明：Live 模式中的音频分片最终会进入同一个 `/api/transcribe` Gateway；该命令验证了直播分片进入 DashScope Qwen-ASR 后可以返回非空英文转写。

## 手动浏览器验证步骤

1. 启动后端：`npm run dev:server`
2. 启动前端：`npm run dev -- --host 127.0.0.1`
3. 打开 `http://127.0.0.1:5173/live-room.html`
4. 点击 `Play test broadcast`，确认视频开始播放并有声音
5. 打开 `http://127.0.0.1:5173`
6. 切换到 `Live`
7. 点击 `Choose live audio`
8. 在浏览器共享弹窗中选择 `Live Room Test Source` 标签页，并勾选/启用共享标签页音频
9. 预期：
   - Source 显示已选择的标签页或屏幕
   - Permission 显示 `Audio captured`
   - ASR 显示 Provider ready
   - Queued/Done 统计增长
   - 字幕区出现英文转写和中文字幕
10. 点击 `Stop live capture`
11. 预期：音频 track 释放，Live 统计不再增长

## 边界

- Live 处理的是浏览器共享出来的音频，不做画面理解。
- Live 默认 1 秒低延迟分片，处理耗时按毫秒统计；端到端仍不承诺毫秒级同步。
- 如果用户未勾选共享音频，系统只能显示捕获/权限状态，不能生成真实字幕。
- 如果 ASR Key 不可用，Live 不生成假字幕。
