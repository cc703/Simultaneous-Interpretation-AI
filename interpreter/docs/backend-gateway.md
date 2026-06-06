# 轻量 AI Gateway 设计

本项目不是纯前端 Demo，而是由 React 同传工作台和 Node 本地 AI Gateway 组成。Gateway 的职责是保护 API Key、统一 ASR/翻译供应商接口，并把后端错误转换成前端可解释的状态。

## 架构定位

```text
React Interpreter Workbench
  - Demo / File / Live / Mic 输入源
  - 字幕、术语、修正、质量诊断、导出
        |
        | /api/health
        | /api/transcribe
        | /api/translate
        v
Node AI Gateway
  - Key 隔离
  - ASR Provider 适配
  - Translation Provider 适配
  - 统一错误边界
        |
        v
DashScope Bailian / OpenAI / OpenAI-compatible providers
```

Gateway 不做用户系统、数据库、长期存储或字幕业务逻辑。字幕、修正记忆、术语和导出都保留在前端工作台内，Gateway 只负责模型访问。默认情况下，阿里云百炼 DashScope 同时作为翻译和 ASR Provider。

百炼 API Key 配置步骤见 `docs/dashscope-bailian-setup.md`。

## 接口

### GET `/api/health`

用于前端判断后端是否启动、ASR/翻译 Key 是否可用，以及当前 Provider 与模型配置。

返回示例：

```json
{
  "ok": true,
  "gateway": "ai-interpreter-gateway",
  "hasTranslationKey": true,
  "hasAsrKey": true,
  "asrProvider": "dashscope",
  "translationModel": "qwen-plus",
  "asrModel": "qwen3-asr-flash",
  "translationBaseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "asrBaseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
```

### POST `/api/transcribe`

统一 File 和 Live 的 ASR 入口。

输入：`multipart/form-data`

- `file`: 音频文件或直播音频分片
- `model`: 可选，浏览器直连兼容字段；后端默认使用 `.env` 中配置
- `language`: 可选，默认英文
- `response_format`: 可选，默认 JSON

输出：

```json
{
  "text": "Good morning everyone..."
}
```

Provider 策略：

- `ASR_PROVIDER=dashscope`：通过 DashScope OpenAI-compatible `/chat/completions` 调用 `qwen3-asr-flash`。
- `ASR_PROVIDER=openai`：通过 OpenAI-compatible `/audio/transcriptions` 调用转写模型。

### POST `/api/translate`

统一中文翻译入口，输出 OpenAI-compatible SSE 流。

输入：

```json
{
  "model": "qwen-plus",
  "messages": []
}
```

输出：`text/event-stream`

前端负责消费流式 token，并更新字幕。

## 环境变量

```env
PORT=8787

DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_TRANSLATION_MODEL=qwen-plus

ASR_PROVIDER=dashscope
DASHSCOPE_ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_ASR_MODEL=qwen3-asr-flash

OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_TRANSLATION_BASE_URL=
OPENAI_TRANSLATION_API_KEY=
OPENAI_TRANSLATION_MODEL=

OPENAI_ASR_BASE_URL=https://api.openai.com/v1
OPENAI_ASR_API_KEY=
OPENAI_ASR_MODEL=gpt-4o-mini-transcribe
```

Key 优先级：

- 翻译：`OPENAI_TRANSLATION_API_KEY` 优先，缺省回退到 `DASHSCOPE_API_KEY`，再回退到 `OPENAI_API_KEY`。
- OpenAI ASR：`OPENAI_ASR_API_KEY` 优先，缺省回退到 `OPENAI_API_KEY`。
- DashScope ASR：`DASHSCOPE_API_KEY` 优先，缺省回退到 `OPENAI_ASR_API_KEY`。

## 错误边界

Gateway 返回统一 JSON 错误，前端可以用 `code` 判断状态。

```json
{
  "error": "Missing asr API key.",
  "code": "missing_server_key",
  "purpose": "asr",
  "provider": "dashscope"
}
```

核心错误码：

- `missing_server_key`：缺少服务端 Key。
- `invalid_json`：翻译请求体不是合法 JSON。
- `invalid_audio_upload`：上传体不是有效音频 multipart。
- `file_too_large`：音频超过当前 Gateway 限制。
- `asr_network_error`：ASR Provider 网络错误。
- `asr_upstream_error`：ASR Provider 返回非 2xx。
- `asr_invalid_response`：ASR Provider 返回无法解析的响应。
- `asr_empty_response`：ASR Provider 没有返回转写文本。
- `translation_network_error`：翻译 Provider 网络错误。
- `translation_upstream_error`：翻译 Provider 返回非 2xx。
- `route_not_found`：未知接口。

## 能力边界

- Gateway 是本地轻量代理，不提供生产级认证、限流、审计或多用户隔离。
- DashScope 当前使用 inline base64 音频，单段建议小于 10MB。
- Live 是几秒级音频分片 ASR，不承诺零延迟。
- 没有 ASR Key 时，Live 不生成假字幕；File 内置样本会明确标注使用绑定转写文本。
- API Key 不写入前端持久化存储；服务端 Key 只来自 `.env`。
