# 阿里云百炼 DashScope API 配置

如果你在阿里云百炼控制台有免费额度，本项目可以直接使用百炼作为默认模型入口：

- 翻译模型：`qwen-plus`
- ASR 模型：`qwen3-asr-flash`
- OpenAI-compatible Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`

## 1. 获取 API Key

在百炼控制台创建或复制 API Key。不要把真实 Key 提交到公开仓库。

控制台入口：

```text
https://bailian.console.aliyun.com/cn-beijing?tab=model#/model-usage
```

## 2. 配置 `.env`

```bash
cd interpreter
copy .env.example .env
```

在 `.env` 中填写：

```env
DASHSCOPE_API_KEY=你的百炼DashScope API Key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_TRANSLATION_MODEL=qwen-plus

ASR_PROVIDER=dashscope
DASHSCOPE_ASR_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_ASR_MODEL=qwen3-asr-flash
```

通常只需要填写 `DASHSCOPE_API_KEY`，其他值保持默认即可。

## 3. 启动

终端一：

```bash
cd interpreter
npm run dev:server
```

终端二：

```bash
cd interpreter
npm run dev
```

打开：

```text
http://localhost:5173
```

## 4. 验证

```bash
cd interpreter
npm run check:api
npm run smoke:file-asr
```

期望：

- `check:api` 中 `translation` 和 `asr` 不再是 401。
- `smoke:file-asr` 返回 `PASS transcribed ... characters.`。

如果 `check:api` 仍然返回 401，说明 API Key 没填、填错、额度不可用或当前账号无模型调用权限。

## 5. 安全边界

- `.env` 已被 `.gitignore` 忽略，不要手动 `git add .env`。
- 如果真实 Key 曾经被提交到公开仓库，请立即在百炼控制台重置或删除该 Key。
- README 和 `.env.example` 只能写占位符，不写真实 Key。

