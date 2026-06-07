# FZM AI Studio — Codex 交接说明

## 项目定位

FZM AI Studio 是一个个人私有 AI 无限画布创作平台。当前阶段不是染发专用工具，也不是传统节点工作流，而是图片优先的 AI 创作画布。

目标体验参考：

- LibTV / Jaaz 的平台感
- Infinite Kanvas 的图片无限画布体验
- tldraw 的无限画布操作
- 后续再接 Gemini / OpenAI / ComfyUI / fal.ai / Kling 等模型能力

当前阶段只做前端 mock，不接真实 API。

## 技术栈

- Next.js 16
- TypeScript
- Tailwind CSS v4
- Zustand
- tldraw
- lucide-react

## 当前运行地址

```bash
npm run dev -- --port 3100
```

浏览器访问：

```
http://localhost:3100
```

## 当前功能状态

已经完成：

- 深色中文 AI Studio 界面
- 顶部栏、左侧工具栏、右侧属性面板、底部结果图库
- tldraw 无限画布接入
- 支持拖拽图片进入画布
- 图片可选中、移动、缩放
- 右侧按钮有 mock 操作
- mock 结果会在原图右侧生成
- 结果会进入底部图库
- 已修复 tldraw isDarkMode 报错
- 已修复 image shape 使用 props.url 的错误，改为 assetId
- 已将 type: "text" 和 type: "geo" mock 元素替换为 SVG image asset，避免 tldraw schema 崩溃和白底卡片

## 重要历史 BUG

### 1. 不要使用 isDarkMode

错误写法：

```ts
editor.user.updateUserPreferences({
  isDarkMode: true,
})
```

正确写法：

```ts
editor.user.updateUserPreferences({
  colorScheme: "dark",
})
```

### 2. 不要使用 shape.props.url

tldraw 的 image shape 不能用：

```ts
shape.props.url
```

必须使用：

```ts
shape.props.assetId
editor.getAsset(assetId)
asset.props.src
```

创建 image shape 时必须使用：

```ts
props: {
  assetId,
  w,
  h,
}
```

### 3. 不要用 type: "text" 创建文字标签

当前 tldraw 版本会报：

```
shape(type = text).props.text: Unexpected property
```

所以 mock 标签必须用 SVG data URL 创建 image asset。

### 4. 不要用默认 geo 做结果卡片

容易出现白底或风格不统一。视频占位卡、标签、demo 卡片都应该用深色 SVG image asset。

## 当前重点文件

请优先阅读：

- `src/lib/canvas-actions.ts`
- `src/components/canvas/TldrawCanvas.tsx`
- `src/components/shell/RightInspector.tsx`
- `src/components/shell/TopBar.tsx`
- `src/components/shell/BottomGallery.tsx`
- `src/components/shell/LeftToolbar.tsx`
- `src/lib/store.ts`
- `src/types/index.ts`
- `src/app/globals.css`

## 当前不要做的事

现阶段不要做：

- 不接真实 API
- 不接 Gemini
- 不接 OpenAI
- 不接 fal.ai
- 不接 ComfyUI
- 不接 Kling
- 不做数据库
- 不做登录
- 不做云部署
- 不重构整个 UI
- 不恢复 React Flow
- 不把项目改回传统节点工作流

## 下一步任务

当前第一优先级是验收并稳定 V0.2.3：

### 必须检查

1. 拖入真实图片
2. 选中图片
3. 点击"生成相似图"
4. 点击"参考图生图"
5. 点击"高清放大"
6. 点击"洗图优化"
7. 点击"去背景"
8. 点击"图生视频"
9. 点击"运行演示"

### 验收标准

- 页面不出现 Something went wrong
- 不出现 tldraw schema validation error
- 不出现白底结果图
- 图片类结果复制原图 asset
- 视频类结果生成深色 SVG 占位卡
- 标签是深色胶囊样式
- 底部结果图库同步新增结果
- 点击图库缩略图能定位到对应结果
- 画布整体保持深色高级风格

## 已知残留问题

### 1. tldraw license 提示

右下角 Get a license for production 是 tldraw SDK 授权提示。不要用 CSS hack 隐藏。后续有两个方案：

- 继续用 tldraw，正式使用时申请 licenseKey
- 如果不想接受授权限制，后续切 React Konva 自研画布

当前阶段继续使用 tldraw。

### 2. 连接线不是 shape binding

现在连线是 point 锚点，移动图片后可能不会自动跟随。后续 V0.3 需要升级为：

- tldraw binding
- 或监听 shape move 后动态更新 arrow

当前先不处理，先稳定 V0.2.3。

## Codex 接手要求

Codex 接手后，请先做以下流程：

1. 阅读 `docs/CODEX_HANDOFF.md`
2. 阅读重点文件
3. 不要立即重构
4. 先运行项目
5. 复现当前按钮交互
6. 如果有报错，先修当前报错
7. 每次只修一个问题
8. 修完后运行 TypeScript / 编译检查
9. 给出修改文件清单和验收结果

## 当前目标

短期目标：

让 V0.2.3 成为稳定可操作的 tldraw 无限画布 mock 版。

不是接 API，不是加新功能。

等 V0.2.3 稳定后，再进入：

- V0.3：连接线 binding + 右键菜单 + LocalStorage 保存画布
