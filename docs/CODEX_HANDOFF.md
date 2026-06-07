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
