# 文件 ASR 烟测记录

本项目使用一段公开英文语音样本测试 File 模式：

- 文件：`test-media/sample-english-speech.wav`
- 来源：Samplelib `sample-speech-1m.wav`
- 页面：https://samplelib.com/sample-wav.html
- 说明：页面标注这些样本文件用于测试和演示，可下载使用。
- 大小：约 5.0MB，低于当前前端 25MB 上传限制。

## 下载命令

```bash
curl.exe -L --retry 3 --connect-timeout 20 ^
  -o test-media/sample-english-speech.wav ^
  https://samplelib.com/wav/sample-speech-1m.wav
```

## 后端烟测

先启动后端：

```bash
npm run dev:server
```

再执行：

```bash
npm run smoke:file-asr
```

如果 `.env` 没有配置 `OPENAI_API_KEY`，期望输出：

```text
PASS missing_server_key: backend is reachable and correctly refuses ASR without OPENAI_API_KEY.
```

如果 `.env` 已配置 `OPENAI_API_KEY`，脚本会把音频上传到 `/api/transcribe`，并要求上游返回非空英文转写文本。
