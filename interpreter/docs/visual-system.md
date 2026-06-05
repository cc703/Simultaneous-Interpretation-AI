# 视觉系统与页面层级设计

本设计服务比赛题目二：AI 同声传译助手。视觉目标不是做营销页，而是让评审在操作工作台时迅速理解产品链路：外语音频流输入、准实时中文字幕输出、人工修正与复盘导出。

## 设计关键词

- **实时音频流**：用波形、频谱线、运行状态点表达音频正在进入系统。
- **中文字幕输出**：用高对比字幕卡片和底部大字幕表达“同传结果可直接观看”。
- **翻译修正能力**：用修正台、Risk Review、Correction Memory 表达产品不是一次性翻译，而是能被人工校准并影响后续结果。
- **评审可演示**：Demo、Mic、File、Live 四种入口保持同一工作流，避免不同模式割裂。

## 页面层级

### 1. App Shell

顶部栏承担身份识别、运行状态和全局动作。品牌标识使用 `public/brand-mark.svg`，主体由“波形 + 字幕行 + 翻译加号”组成，避免使用通用 AI 闪电或聊天图标。

全局动作保持工具型按钮：`Settings`、`Export`、`Review`、`Copy`。图标使用 `lucide-react`，因为这些是操作命令，不需要位图生图。

### 2. Left Control Panel

左侧是同传控制面板，按真实演示顺序组织：

1. `Workflow`：让评审知道当前完成到了哪一步。
2. `Source`：选择 Demo、Mic、File、Live。
3. `Configuration`：配置翻译、ASR、术语。
4. `Subtitle Settings`：控制字幕展示、TTS、修正记忆。

这一层的视觉重点是“可操作”和“状态清楚”，不使用大插画，避免抢走工作台注意力。

### 3. Subtitle Workspace

右侧是产品主场景：

- 顶部字幕模式切换：`Bilingual`、`ZH only`、`EN only`。
- 波形条：连接音频输入和字幕输出。
- 时间轴字幕流：按时间推进，体现准实时处理。
- 底部大字幕：模拟现场同传字幕观看场景。

字幕卡片使用英文原文、中文译文、术语命中和修正状态区分，让用户能看到翻译质量如何被持续改进。

### 4. Correction And Review

修正台和复盘区是题目二的差异化能力：

- `Correction Desk`：人工修改当前字幕译文。
- `Retranslate with glossary`：用术语表触发重译。
- `Risk Review`：显示漏译、术语未命中、占位翻译等风险。
- `Correction Memory`：展示人工修正如何影响后续翻译 prompt。

这里的图标选用功能语义明确的线性图标，例如 `ClipboardCheck`、`AlertTriangle`、`ListChecks`，比装饰性位图更适合评审理解。

## 项目资产

- `public/favicon.svg`：浏览器标签页图标，小尺寸下优先表达波形和字幕输出。
- `public/brand-mark.svg`：页面顶部品牌标识，适合深色背景。
- `public/og-cover.svg`：README、仓库社交预览或 Demo 封面使用，展示完整产品链路。

## 生图使用边界

本项目当前更适合使用 SVG 和 lucide 图标：

- 图标需要在按钮、状态、字幕工作台中清晰缩放，SVG 更稳定。
- 页面是工具型产品，过多位图插画会削弱操作密度。
- 评审重点是功能完整度、开发质量和 Demo 表达，视觉资产应解释功能，而不是成为独立营销物料。

如果后续需要真正的位图生图，建议只生成两类资产：

1. Demo 视频封面：展示“会议音频 -> 中文字幕 -> 修正复盘”的产品场景。
2. README 顶部宣传图：可使用 `public/og-cover.svg` 作为构图参考生成高清位图。

当前 Codex 会话未暴露内置 `image_gen` 工具，因此本轮没有生成位图。若要走 CLI 生图，需要显式启用 fallback，并提供可用的 `OPENAI_API_KEY`。
