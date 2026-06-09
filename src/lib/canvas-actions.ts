import type {
  Editor,
  TLAssetId,
  TLImageAsset,
  TLShapeId,
} from "@tldraw/tldraw";
import { isShapeId } from "@tldraw/tldraw";
import { useStudioStore, uid, assetUid } from "./store";
import { createAiConnection } from "./connection-system";
import { resolveImageReference } from "./shape-helpers";
import type { CanvasAction, ResultType } from "@/types";
import { enqueueGenerationTask } from "./api-scheduler";

// ─── Generation route resolver ───────────────────────────────────────

export function resolveGenerationRoute(
  actionType: ResultType | "text-to-image",
  hasSourceImage: boolean
): { endpoint: "generations" | "edits" | "mock"; requiredCapability: string } {
  switch (actionType) {
    case "text-to-image":
      return { endpoint: "generations", requiredCapability: "text-to-image" };
    case "similar":
      return {
        endpoint: hasSourceImage ? "edits" : "generations",
        requiredCapability: hasSourceImage ? "image-to-image" : "text-to-image",
      };
    case "img2img":
      return { endpoint: hasSourceImage ? "edits" : "mock", requiredCapability: "image-to-image" };
    case "clean":
      return { endpoint: hasSourceImage ? "edits" : "mock", requiredCapability: "image-to-image" };
    case "removeBg":
      return { endpoint: hasSourceImage ? "edits" : "mock", requiredCapability: "remove-bg" };
    case "upscale":
      return { endpoint: "mock", requiredCapability: "upscale" };
    case "video":
      return { endpoint: "mock", requiredCapability: "image-to-video" };
    default:
      return { endpoint: "mock", requiredCapability: "text-to-image" };
  }
}

export const ACTION_TITLES: Record<string, string> = {
  "text-to-image": "文生图",
  similar: "生图",
  img2img: "图生图",
  clean: "洗图优化",
  removeBg: "去背景",
  upscale: "高清放大",
  video: "图生视频",
};

// ─── SVG utilities ───────────────────────────────────────────────────

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createSvgImageShape(
  editor: Editor,
  x: number,
  y: number,
  w: number,
  h: number,
  svg: string,
  name: string,
  role: "label" | "operation-node" | "placeholder" | "container" = "label"
): TLShapeId {
  const assetId = assetUid();
  const shapeId = uid();

  editor.createAssets([
    {
      id: assetId,
      typeName: "asset",
      type: "image",
      props: {
        name,
        src: svgToDataUrl(svg),
        w,
        h,
        mimeType: "image/svg+xml",
        isAnimated: false,
      },
      meta: {},
    } satisfies TLImageAsset,
  ]);

  editor.createShape({
    id: shapeId,
    type: "image",
    x,
    y,
    props: { assetId, w, h },
    meta: { role },
  });

  return shapeId;
}

// ─── SVG generators ──────────────────────────────────────────────────

function createLabelSvg(label: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28" viewBox="0 0 120 28">
  <rect x="0.5" y="0.5" width="119" height="27" rx="10" fill="rgba(15,15,25,0.92)" stroke="rgba(139,92,246,0.55)"/>
  <text x="60" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#d4d4d8">${label}</text>
</svg>`;
}

function createCardSvg(label: string, w: number, h: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="#151520" stroke="rgba(139,92,246,0.35)" stroke-width="2"/>
  <text x="${w / 2}" y="${h / 2 + 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#a5b4fc">${label}</text>
</svg>`;
}

function createGeneratingPlaceholderSvg(
  status: "queued" | "running" | "failed",
  model: string,
  errorMsg?: string
) {
  const label =
    status === "queued" ? "排队中..." :
    status === "running" ? "正在生成图片..." :
    "生成失败";
  const subLabel =
    status === "running" ? `${model} · 预计 1-3 分钟` :
    status === "failed" ? (errorMsg || "未知错误") : "";
  const accentColor =
    status === "failed" ? "rgba(252,165,165,0.2)" : "rgba(129,140,248,0.15)";
  const borderColor =
    status === "failed" ? "rgba(252,165,165,0.4)" : "rgba(139,92,246,0.35)";
  const textColor =
    status === "failed" ? "#fca5a5" : "#c7d2fe";

  const w = 320;
  const h = 220;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="16" fill="#111118" stroke="${borderColor}" stroke-width="1.5"/>`;

  if (status !== "failed") {
    // Animated spinner circles
    svg += `
  <circle cx="160" cy="75" r="24" fill="none" stroke="${accentColor}" stroke-width="3" stroke-dasharray="120 40"/>
  <circle cx="160" cy="75" r="18" fill="none" stroke="${borderColor}" stroke-width="2" opacity="0.6"/>
  <text x="160" y="80" text-anchor="middle" font-family="Arial" font-size="14" fill="${textColor}">⟳</text>`;
  } else {
    svg += `
  <circle cx="160" cy="75" r="24" fill="none" stroke="rgba(252,165,165,0.25)" stroke-width="2"/>
  <text x="160" y="80" text-anchor="middle" font-family="Arial" font-size="14" fill="#fca5a5">✕</text>`;
  }

  svg += `
  <text x="160" y="125" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="600" fill="${textColor}">${label}</text>
  <text x="160" y="147" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#71717a">${subLabel}</text>
  <text x="160" y="170" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#52525b">模型: ${model}</text>`;

  if (status === "failed") {
    svg += `
  <text x="160" y="195" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#f87171">点击右侧面板「重新运行」重试</text>`;
  }

  svg += `</svg>`;
  return svg;
}

function createVideoPlaceholderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <rect x="1" y="1" width="318" height="198" rx="18" fill="#11111a" stroke="rgba(139,92,246,0.45)" stroke-width="2"/>
  <circle cx="160" cy="92" r="28" fill="rgba(139,92,246,0.18)" stroke="rgba(139,92,246,0.55)"/>
  <path d="M153 78 L153 106 L176 92 Z" fill="#a78bfa"/>
  <text x="160" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#d4d4d8">视频占位</text>
  <text x="160" y="168" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#71717a">Image to Video Mock</text>
</svg>`;
}

// ─── Layout helper ───────────────────────────────────────────────────

function getResultPosition(
  sourceBounds: { x: number; y: number; w: number; h: number },
  resultWidth: number,
  resultHeight: number
) {
  const slot = useStudioStore.getState().results.length;
  const column = slot % 3;
  const row = Math.floor(slot / 3);
  const columnWidth = Math.max(sourceBounds.w, resultWidth) + 120;
  const rowHeight = Math.max(sourceBounds.h, resultHeight) + 80;

  return {
    x: sourceBounds.x + sourceBounds.w + 160 + column * columnWidth,
    y: sourceBounds.y + row * rowHeight,
  };
}

// ─── Result card creator (called by scheduler callback) ──────────────

function createResultCard(
  editor: Editor,
  sourceId: TLShapeId,
  sourceAssetId: TLAssetId,
  _resultType: ResultType,
  label: string,
  extraScale = 1
): TLShapeId | null {
  // Guard: tldraw requires asset IDs to start with "asset:"
  if (!sourceAssetId || !String(sourceAssetId).startsWith("asset:")) return null;

  const sourceBounds = editor.getShapePageBounds(sourceId);
  if (!sourceBounds) return null;

  const cardW = sourceBounds.w * extraScale;
  const cardH = sourceBounds.h * extraScale;
  const { x: cardX, y: cardY } = getResultPosition(sourceBounds, cardW, cardH);

  const sourceAsset = editor.getAsset(sourceAssetId);
  const assetSrc =
    (sourceAsset?.props as Record<string, unknown>)?.src as string || "";

  // Label
  const labelId = createSvgImageShape(
    editor, cardX, cardY - 34, 120, 28,
    createLabelSvg(label), `${label}-标签`, "label"
  );

  // Result image — reference the same assetId, mark as content
  const imgId = uid();
  editor.createShape({
    id: imgId,
    type: "image",
    x: cardX,
    y: cardY,
    props: { assetId: sourceAssetId, w: cardW, h: cardH },
    meta: { role: "content-image", isGenerated: true },
  });

  editor.groupShapes([labelId, imgId]);

  // Arrow
  createAiConnection(editor, sourceId, imgId, { type: "auto", label });

  // Gallery result
  const parentId = editor.getShape(imgId)?.parentId;
  const groupId = isShapeId(parentId) ? parentId : imgId;

  useStudioStore.getState().addResult({
    id: imgId,
    imageUrl: assetSrc,
    type: _resultType,
    typeLabel: label,
    shapeId: groupId,
  });

  return null;
}

/** Create a result card from a real provider's generated image data URL. */
function createRealImageCard(
  editor: Editor,
  sourceId: TLShapeId,
  dataUrl: string,
  label: string,
  width: number,
  height: number
): TLShapeId | null {
  const sourceBounds = editor.getShapePageBounds(sourceId);
  if (!sourceBounds) return null;

  const maxW = 400;
  const scale = Math.min(1, maxW / width);
  const cardW = Math.round(width * scale);
  const cardH = Math.round(height * scale);
  const { x: cardX, y: cardY } = getResultPosition({ ...sourceBounds, w: cardW, h: cardH }, cardW, cardH);

  const assetId = assetUid();
  const imgId = uid();

  // Create a NEW tldraw asset from the generated data URL
  editor.createAssets([
    {
      id: assetId,
      typeName: "asset",
      type: "image",
      props: {
        name: `${label}结果`,
        src: dataUrl,
        w: cardW,
        h: cardH,
        mimeType: "image/png",
        isAnimated: false,
      },
      meta: {},
    } satisfies TLImageAsset,
  ]);

  // Label (distinct role)
  const labelId = createSvgImageShape(
    editor, cardX, cardY - 34, 120, 28,
    createLabelSvg(label), `${label}-标签`, "label"
  );

  // Image shape with NEW asset, marked as content
  editor.createShape({
    id: imgId,
    type: "image",
    x: cardX,
    y: cardY,
    props: { assetId, w: cardW, h: cardH },
    meta: { role: "content-image", isGenerated: true },
  });

  editor.groupShapes([labelId, imgId]);

  createAiConnection(editor, sourceId, imgId, { type: "auto", label });

  const parentId = editor.getShape(imgId)?.parentId;
  const groupId = isShapeId(parentId) ? parentId : imgId;

  useStudioStore.getState().addResult({
    id: imgId,
    imageUrl: dataUrl,
    type: "similar",
    typeLabel: label,
    shapeId: groupId,
  });

  return imgId;
}

// ─── Prompt node SVG ─────────────────────────────────────────────────

function createPromptNodeSvg(
  actionLabel: string,
  promptText: string,
  model: string,
  status: string
) {
  const truncated = promptText.length > 40
    ? promptText.slice(0, 40) + "..."
    : promptText;
  const statusLabel =
    status === "queued" ? "排队中" :
    status === "running" ? "生成中" :
    status === "completed" ? "已完成" : "失败";
  const statusColor =
    status === "completed" ? "#a7f3d0" :
    status === "running" ? "#c7d2fe" :
    status === "failed" ? "#fca5a5" : "#71717a";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="70" viewBox="0 0 280 70">
  <rect x="1" y="1" width="278" height="68" rx="12" fill="#13131f" stroke="rgba(139,92,246,0.35)" stroke-width="1.5"/>
  <text x="14" y="22" font-family="Arial,sans-serif" font-size="12" font-weight="600" fill="#a5b4fc">${actionLabel}</text>
  <text x="14" y="40" font-family="Arial,sans-serif" font-size="11" fill="#71717a">${truncated}</text>
  <text x="14" y="56" font-family="Arial,sans-serif" font-size="10" fill="#52525b">${model}</text>
  <rect x="210" y="10" width="58" height="18" rx="6" fill="rgba(129,140,248,0.1)" stroke="rgba(129,140,248,0.2)"/>
  <text x="239" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="${statusColor}">${statusLabel}</text>
</svg>`;
}

// ─── Execute from PromptComposer ─────────────────────────────────────

export async function executePromptGeneration(params: {
  prompt: string;
  providerId: string;
  model: string;
  size: string;
  quality: string;
  actionType: ResultType | "text-to-image";
  actionLabel: string;
  sourceShapeId?: TLShapeId;
  sourceAssetId?: TLAssetId;
}) {
  const { editor } = useStudioStore.getState();
  if (!editor) return;

  const {
    prompt, providerId, model, size,
    actionType, actionLabel, sourceShapeId, sourceAssetId,
  } = params;

  const [sw, sh] = size.split("x").map(Number);
  const imgW = sw || 1024;
  const imgH = sh || 1024;

  // Resolve position (drop point > source shape > default)
  const composer = useStudioStore.getState().promptComposer;
  let nodeX = composer.dropX ?? 200;
  let nodeY = composer.dropY ?? 160;
  if (!composer.dropX && sourceShapeId && editor.getShape(sourceShapeId)) {
    const bounds = editor.getShapePageBounds(sourceShapeId);
    if (bounds) {
      nodeX = bounds.x;
      nodeY = bounds.y + bounds.h + 60;
    }
  }

  // Create Prompt node on canvas
  const nodeId = createSvgImageShape(
    editor, nodeX, nodeY, 280, 70,
    createPromptNodeSvg(actionLabel, prompt, model, "queued"),
    `${actionLabel}-指令节点`,
    "operation-node"
  );

  // Arrow from source to prompt node
  if (sourceShapeId) {
    createAiConnection(editor, sourceShapeId, nodeId, { type: "auto", label: "指令" });
  }

  // Create generating placeholder card to the right of Prompt node
  const placeholderX = nodeX + 320;
  const placeholderY = nodeY - 20;
  const placeholderId = createSvgImageShape(
    editor, placeholderX, placeholderY, 320, 220,
    createGeneratingPlaceholderSvg("queued", model),
    `${actionLabel}-占位`,
    "placeholder"
  );
  createAiConnection(editor, nodeId, placeholderId, { type: "auto", label: "生成" });

  // Create action
  const action: CanvasAction = {
    id: actionUid(),
    sourceId: (sourceShapeId || nodeId) as TLShapeId,
    targetId: placeholderId,
    actionType: actionType as ResultType,
    actionLabel,
    createdAt: Date.now(),
    status: "queued",
    provider: providerId ? "openai-compatible" : "mock",
    promptNodeId: nodeId,
    placeholderId,
    model,
  };
  useStudioStore.getState().addAction(action);

  console.log("[executePromptGeneration]", JSON.stringify({
    actionId: action.id,
    providerId: providerId || "(mock)",
    model,
    actionType,
    promptNodeId: nodeId,
    placeholderId,
    prompt: prompt.slice(0, 60),
  }));

  const useReal = !!providerId;

  enqueueGenerationTask({
    provider: useReal ? "openai-compatible" : "mock",
    providerId: useReal ? providerId : undefined,
    action,
    sourceShapeId: nodeId,
    sourceAssetId: sourceAssetId || ("" as TLAssetId),
    request: {
      provider: useReal ? "openai-compatible" : "mock",
      model,
      quality: params.quality,
      actionType: actionType as ResultType,
      prompt,
      size: { width: imgW, height: imgH },
      count: 1,
    },
    onResult: (result) => {
      if (!editor) return;

      // Delete the placeholder card
      editor.deleteShape(placeholderId);

      const asset = result.assets?.[0];
      const dataUrl =
        asset?.url?.startsWith("data:")
          ? asset.url
          : asset?.b64Json
            ? `data:${asset.mimeType || "image/png"};base64,${asset.b64Json}`
            : null;

      if (dataUrl && !dataUrl.endsWith("base64,")) {
        const resultId = createRealImageCard(
          editor, nodeId, dataUrl, actionLabel,
          asset.width || imgW, asset.height || imgH
        );
        if (resultId) {
          createAiConnection(editor, nodeId, resultId, { type: "auto", label: "结果" });
        }
      } else if (sourceAssetId && String(sourceAssetId).startsWith("asset:")) {
        createResultCard(
          editor, nodeId, sourceAssetId,
          actionType as ResultType, actionLabel, 1
        );
      }
      editor.select(nodeId);
    },
    onError: (error) => {
      if (!editor) return;
      const errMsg = error.message;

      // Replace placeholder with failed card
      editor.deleteShape(placeholderId);

      createSvgImageShape(
        editor, placeholderX, placeholderY, 320, 220,
        createGeneratingPlaceholderSvg("failed", model, errMsg),
        `${actionLabel}-失败`,
        "placeholder"
      );
      editor.select(nodeId);
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function actionUid() {
  return `action:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public action functions ─────────────────────────────────────────
// All open the Prompt Composer instead of executing directly.

function openGenUI(
  actionType: ResultType | "text-to-image",
  actionLabel: string,
  sourceId?: TLShapeId
) {
  const { editor } = useStudioStore.getState();
  if (!editor) return;

  const ref = sourceId ? resolveImageReference(editor, sourceId) : null;

  useStudioStore.getState().openBottomPromptBar({
    actionType,
    actionLabel,
    sourceShapeId: ref?.sourceShapeId ?? undefined,
    sourceAssetId: (ref?.sourceAssetId as TLAssetId | undefined) ?? undefined,
    sourceName: ref?.sourceName ?? "",
    sourceWidth: ref?.sourceWidth ?? 0,
    sourceHeight: ref?.sourceHeight ?? 0,
    sourceUrl: ref?.sourceUrl ?? "",
  });
}

export function generateSimilar(sourceId?: TLShapeId) {
  openGenUI("similar", "生图", sourceId);
}

export function generateImg2Img(sourceId?: TLShapeId) {
  openGenUI("img2img", "参考图生图", sourceId);
}

export function generateUpscale(sourceId?: TLShapeId) {
  openGenUI("upscale", "高清放大", sourceId);
}

export function generateClean(sourceId?: TLShapeId) {
  openGenUI("clean", "洗图优化", sourceId);
}

export function generateRemoveBg(sourceId?: TLShapeId) {
  openGenUI("removeBg", "去背景", sourceId);
}

export function generateVideo(sourceId?: TLShapeId) {
  openGenUI("video", "图生视频", sourceId);
}

// ─── Run demo — stays direct, no scheduler needed ────────────────────

export function runDemo(editor: Editor) {
  const shapes = editor.getCurrentPageShapes();
  if (shapes.length > 0) {
    alert("演示已生成。如需重新生成，请先清空画布。");
    return;
  }

  const cx = 200;
  const cy = 160;
  const cardW = 260;
  const cardH = 200;

  // Source card
  const label1Id = createSvgImageShape(
    editor, cx, cy - 34, 120, 28,
    createLabelSvg("原图"), "原图-标签"
  );
  const sourceId = createSvgImageShape(
    editor, cx, cy, cardW, cardH,
    createCardSvg("原图", cardW, cardH), "原图-卡片"
  );
  editor.groupShapes([label1Id, sourceId]);

  // Similar card
  const simX = cx + cardW + 260;
  const label2Id = createSvgImageShape(
    editor, simX, cy - 34, 120, 28,
    createLabelSvg("相似图"), "相似图-标签"
  );
  const simId = createSvgImageShape(
    editor, simX, cy, cardW, cardH,
    createCardSvg("相似图", cardW, cardH), "相似图-卡片"
  );
  editor.groupShapes([label2Id, simId]);

  createAiConnection(editor, sourceId, simId, { type: "auto", label: "相似图" });

  // Video card
  const vidX = simX;
  const vidY = cy + cardH + 80;
  const vidW = 320;
  const vidH = 200;
  const label3Id = createSvgImageShape(
    editor, vidX, vidY - 34, 120, 28,
    createLabelSvg("视频"), "视频-标签"
  );
  const vidId = createSvgImageShape(
    editor, vidX, vidY, vidW, vidH,
    createVideoPlaceholderSvg(), "视频-卡片"
  );
  editor.groupShapes([label3Id, vidId]);

  createAiConnection(editor, sourceId, vidId, { type: "auto", label: "视频" });
  createAiConnection(editor, simId, vidId, { type: "auto", label: "相似图转视频" });

  const store = useStudioStore.getState();
  store.addResult({ id: simId, imageUrl: "", type: "similar", typeLabel: "相似图", shapeId: simId });
  store.addResult({ id: vidId, imageUrl: "", type: "video", typeLabel: "视频", shapeId: vidId });

  // Demo actions — use the scheduler for status simulation
  const simAction: CanvasAction = {
    id: actionUid(),
    sourceId,
    targetId: simId,
    actionType: "similar",
    actionLabel: "相似图",
    createdAt: Date.now(),
    status: "completed",
    provider: "mock",
  };
  const vidAction: CanvasAction = {
    id: actionUid(),
    sourceId,
    targetId: vidId,
    actionType: "video",
    actionLabel: "视频",
    createdAt: Date.now(),
    status: "completed",
    provider: "mock",
  };
  store.addAction(simAction);
  store.addAction(vidAction);

  editor.zoomToFit({ animation: { duration: 400 } });
}
