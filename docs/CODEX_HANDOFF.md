# FZM AI Studio — Codex 交接日志

## 2026-06-08 Mac 收工

### 提交信息

```
commit: a6b83aa
tag:    wip-2026-06-08-mac-close
branch: main
status: clean
```

### 今日进度

#### V0.5.3：OpenAI-Compatible 文生图真实调用

- `/images/generations` 文生图已跑通，返回 `b64_json` 正常写回画布
- PromptComposerPanel 成为生成入口
- `resolveGenerationRoute()` 严格路由：有源图 → edits，无源图 → generations

#### V0.5.4：/images/edits 图生图骨架

- `POST /api/providers/edit` 路由已创建（multipart/form-data）
- `generateOpenAiCompatibleImageEdit()` adapter 已实现
- scheduler 内 `isEditAction()` 判断 img2img/clean/removeBg → FormData → `/api/providers/edit`

#### BottomPromptBar 主生成入口

- 选中图片 → 只显示浮动工具条 + 输出端口（不再自动弹底部栏）
- 点击图生图/洗图/去背景/图生视频 → `openBottomPromptBar()`
- 拉线菜单选择 → `openBottomPromptBar()`
- 底部"新建生成" → 文生图入口
- Provider 每次打开时从 `/api/settings/providers` 刷新
- Provider 加载中显示"正在加载 Provider..."脉冲文字，生成按钮 disabled
- 无匹配 Provider 时显示琥珀色警告卡片

#### 连接线视觉升级

- 双层线结构（glow + main），三态（default/hover/selected）
- 流动动画层（hover/select 时显示 dash 动画）
- 端口升级为 glow ring + solid core + "+" 指示器
- 拖拽草稿线更醒目

#### 引用关系

- `openGenUI()` 统一入口，传入 sourceShapeId/sourceAssetId/sourceName
- PromptComposer 代码保留但不参与正常流程
- 移除引用自动切换到 text-to-image

### 明天优先级（3 件）

1. **图生图真实浏览器验收** — Network 确认 `POST /api/providers/edit`
2. **魔芋 Provider 能力检查** — API 配置中心确认勾选 `text-to-image` + `image-to-image`
3. **操作节点落点** — 拉线后是否先在松手位置创建节点，再弹底部栏

### 技术要点

- API Key 不暴露前端，`GET /api/settings/providers` 返回 masked key
- `data/provider-configs.json` 在 `.gitignore`
- 配置的魔芋 Provider ID: `test-1780835282147`
- dev server: `npm run dev -- --port 3100`
- 所有 actionType 使用 `resolveGenerationRoute()` 统一路由

### 已知残留

- 操作节点暂无"拉线前先落点"的预创建
- 文生视频/图生视频未接真实接口
- 多结果组未实现
- tldraw license 提示（开发模式可忽略）

---

## 2026-06-08 Mac 最终收工

### 提交信息

```
commit: 330e9b3
tag:    v0.5.5.7-gemini-native-image-stable
branch: main
remote: https://github.com/949409478liu-bot/fzm-ai-studio.git
status: clean (已推送)
```

### 今日后续进度（V0.5.4 → V0.5.5.7）

#### Provider / Model 分离
- Provider 决定通道，Model 只是请求参数
- 不再使用 model 名判断 adapter，完全移除 `"gpt-image-2"` 硬编码
- BottomPromptBar 每次打开刷新 Provider 列表，加载中显示 "正在加载 Provider..."
- 无匹配 Provider 时显示琥珀色警告卡片

#### 节点角色体系
- `meta.role`: content-image / label / operation-node / placeholder
- `resolveImageReference()` 统一引用解析，过滤标签、SVG、占位卡
- `isContentImage()` 双层过滤（meta.role + height + name 黑名单）
- A→B→C→D 连续生成时每步引用当前 content-image

#### 模型能力校验
- `ProviderModelConfig`: name / capabilities / endpointMode
- 模型下拉按 actionType 过滤（图生图只显示支持 image-to-image 的模型）
- 提交前 `confirm` 拦截能力不匹配的模型
- endpointMode 硬拦截：非 openai-images/gemini-native 不允许编辑类动作

#### Gemini Native 适配器 (V0.5.5.7)
- 新增 `src/lib/providers/gemini-native.ts`
- 文生图: `POST /v1beta/models/{model}:generateContent` (JSON)
- 图生图: 同上，parts 包含 `inlineData` + `text` (base64)
- `/api/providers/run` 和 `/api/providers/edit` 按 `endpointMode` 分流
- 模型预设: `DEFAULT_OPENAI_MODELS` + `DEFAULT_GEMINI_MODELS` 存入追踪代码

#### 连接线视觉
- 双层线：glow (2.8-3.2px) + main (1.8-2.4px)
- 三态：default/hover/selected
- 流动动画层（hover/select 时 dash 动画）
- 端口：三层结构（glow ring + mid border + solid core）

### Win 端开工步骤

```bash
# 1. 克隆
git clone https://github.com/949409478liu-bot/fzm-ai-studio.git
cd fzm-ai-studio

# 2. 安装依赖
npm install

# 3. 启动
npm run dev -- --port 3100

# 4. 打开浏览器
http://localhost:3100
```

### Win 端必须重新配置 Provider

`data/provider-configs.json` 不进 Git，需在 API 配置中心重新配置：

**魔芋 GPT-Image-2** (OpenAI Compatible)：
- Base URL: `https://www.moyu.info/v1`
- API Key: 填你的魔芋 key
- 能力: text-to-image / image-to-image / inpaint

**模型配置**：
1. gpt-image-2 → endpointMode: openai-images, 能力: text-to-image / image-to-image / inpaint
2. gemini-3-pro-image-preview → endpointMode: gemini-native, 能力: text-to-image / image-to-image

### 重要文件清单

| 文件 | 作用 |
|------|------|
| `src/lib/canvas-actions.ts` | `openGenUI`, `executePromptGeneration`, `createRealImageCard`, `resolveGenerationRoute` |
| `src/lib/shape-helpers.ts` | `resolveImageReference`, `getImageFromShape`, `isContentImage` |
| `src/lib/api-scheduler.ts` | 任务队列，isEditAction 判断，/run vs /edit 分流 |
| `src/lib/providers/openai-compatible.ts` | OpenAI 图片接口 adapter |
| `src/lib/providers/gemini-native.ts` | Gemini Native adapter (generateContent) |
| `src/lib/providers/types.ts` | ProviderConfig, ProviderModelConfig, endpointMode |
| `src/lib/server/provider-config-store.ts` | 服务端配置读写 + 默认 Provider 预设 |
| `src/components/canvas/BottomPromptBar.tsx` | 底部生成面板（主入口） |
| `src/components/canvas/ConnectionPorts.tsx` | 拉线菜单 + 连接端口 |
| `src/components/canvas/AiConnectionShape.tsx` | 自定义连接线 shape |
| `src/app/api/providers/run/route.ts` | 文生图 API route |
| `src/app/api/providers/edit/route.ts` | 图生图 API route |
| `src/app/api/settings/providers/route.ts` | Provider CRUD API |
