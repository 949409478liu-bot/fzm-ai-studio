import type {
  Editor,
  TLAssetId,
  TLImageAsset,
  TLShapeId,
} from "@tldraw/tldraw";
import { isShapeId } from "@tldraw/tldraw";
import { useStudioStore, uid, assetUid } from "./store";
import { createAiConnection } from "./connection-system";
import type { ResultType } from "@/types";

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
  name: string
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
    props: {
      assetId,
      w,
      h,
    },
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

function createVideoPlaceholderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <rect x="1" y="1" width="318" height="198" rx="18" fill="#11111a" stroke="rgba(139,92,246,0.45)" stroke-width="2"/>
  <circle cx="160" cy="92" r="28" fill="rgba(139,92,246,0.18)" stroke="rgba(139,92,246,0.55)"/>
  <path d="M153 78 L153 106 L176 92 Z" fill="#a78bfa"/>
  <text x="160" y="145" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="600" fill="#d4d4d8">视频占位</text>
  <text x="160" y="168" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#71717a">Image to Video Mock</text>
</svg>`;
}

// ─── Internal helpers ────────────────────────────────────────────────

function getSelectedImage(editor: Editor) {
  const ids = editor.getSelectedShapeIds();
  if (ids.length !== 1) return null;
  const shape = editor.getShape(ids[0]);
  if (!shape || shape.type !== "image") return null;
  return shape;
}

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

function createResultCard(
  editor: Editor,
  sourceId: TLShapeId,
  sourceAssetId: TLAssetId,
  _resultType: ResultType,
  label: string,
  extraScale = 1
) {
  const sourceBounds = editor.getShapePageBounds(sourceId);
  if (!sourceBounds) return null;

  const cardW = sourceBounds.w * extraScale;
  const cardH = sourceBounds.h * extraScale;
  const { x: cardX, y: cardY } = getResultPosition(
    sourceBounds,
    cardW,
    cardH
  );

  const sourceAsset = sourceAssetId ? editor.getAsset(sourceAssetId) : null;
  const assetSrc =
    (sourceAsset?.props as Record<string, unknown>)?.src as string || "";

  // Label as SVG image
  const labelId = createSvgImageShape(
    editor,
    cardX,
    cardY - 34,
    120,
    28,
    createLabelSvg(label),
    `${label}-标签`
  );

  // Result image — reference the same assetId
  const imgId = uid();
  editor.createShape({
    id: imgId,
    type: "image",
    x: cardX,
    y: cardY,
    props: {
      assetId: sourceAssetId,
      w: cardW,
      h: cardH,
    },
  });

  editor.groupShapes([labelId, imgId]);
  const parentId = editor.getShape(imgId)?.parentId;
  const groupId = isShapeId(parentId) ? parentId : imgId;

  createAiConnection(editor, sourceId, imgId, {
    type: "auto",
    label,
  });

  useStudioStore.getState().addResult({
    id: imgId,
    imageUrl: assetSrc,
    type: _resultType,
    typeLabel: label,
    shapeId: groupId,
  });
  editor.select(sourceId);
}

// ─── Public action functions ────────────────────────────────────────

export function generateSimilar() {
  const { editor } = useStudioStore.getState();
  if (!editor) return;
  const shape = getSelectedImage(editor);
  if (!shape) return alert("请先在画布中选择一张图片");
  if (!shape.props.assetId) return;
  createResultCard(editor, shape.id, shape.props.assetId, "similar", "相似图");
}

export function generateImg2Img() {
  const { editor } = useStudioStore.getState();
  if (!editor) return;
  const shape = getSelectedImage(editor);
  if (!shape) return alert("请先在画布中选择一张图片");
  if (!shape.props.assetId) return;
  createResultCard(editor, shape.id, shape.props.assetId, "img2img", "图生图");
}

export function generateUpscale() {
  const { editor } = useStudioStore.getState();
  if (!editor) return;
  const shape = getSelectedImage(editor);
  if (!shape) return alert("请先在画布中选择一张图片");
  if (!shape.props.assetId) return;
  createResultCard(editor, shape.id, shape.props.assetId, "upscale", "高清放大", 1.5);
}

export function generateClean() {
  const { editor } = useStudioStore.getState();
  if (!editor) return;
  const shape = getSelectedImage(editor);
  if (!shape) return alert("请先在画布中选择一张图片");
  if (!shape.props.assetId) return;
  createResultCard(editor, shape.id, shape.props.assetId, "clean", "已洗图");
}

export function generateRemoveBg() {
  const { editor } = useStudioStore.getState();
  if (!editor) return;
  const shape = getSelectedImage(editor);
  if (!shape) return alert("请先在画布中选择一张图片");
  if (!shape.props.assetId) return;
  createResultCard(editor, shape.id, shape.props.assetId, "removeBg", "去背景");
}

export function generateVideo() {
  const { editor } = useStudioStore.getState();
  if (!editor) return;
  const shape = getSelectedImage(editor);
  if (!shape) return alert("请先在画布中选择一张图片");

  const sourceBounds = editor.getShapePageBounds(shape.id);
  if (!sourceBounds) return;

  const cardW = 320;
  const cardH = 200;
  const { x: cardX, y: cardY } = getResultPosition(
    sourceBounds,
    cardW,
    cardH
  );

  const labelId = createSvgImageShape(
    editor, cardX, cardY - 34, 120, 28,
    createLabelSvg("视频"), "视频-标签"
  );

  const videoId = createSvgImageShape(
    editor, cardX, cardY, cardW, cardH,
    createVideoPlaceholderSvg(), "视频-占位"
  );

  editor.groupShapes([labelId, videoId]);
  const parentId = editor.getShape(videoId)?.parentId;
  const groupId = isShapeId(parentId) ? parentId : videoId;

  createAiConnection(editor, shape.id, videoId, {
    type: "auto",
    label: "视频",
  });

  useStudioStore.getState().addResult({
    id: videoId,
    imageUrl: "",
    type: "video",
    typeLabel: "视频",
    shapeId: groupId,
  });
  editor.select(shape.id);
}

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

  // ── Source card ──
  const label1Id = createSvgImageShape(
    editor, cx, cy - 34, 120, 28,
    createLabelSvg("原图"), "原图-标签"
  );
  const sourceId = createSvgImageShape(
    editor, cx, cy, cardW, cardH,
    createCardSvg("原图", cardW, cardH), "原图-卡片"
  );
  editor.groupShapes([label1Id, sourceId]);

  // ── Similar card ──
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

  createAiConnection(editor, sourceId, simId, {
    type: "auto",
    label: "相似图",
  });

  // ── Video card ──
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

  createAiConnection(editor, sourceId, vidId, {
    type: "auto",
    label: "视频",
  });
  createAiConnection(editor, simId, vidId, {
    type: "auto",
    label: "相似图转视频",
  });

  const store = useStudioStore.getState();
  store.addResult({ id: simId, imageUrl: "", type: "similar", typeLabel: "相似图", shapeId: simId });
  store.addResult({ id: vidId, imageUrl: "", type: "video", typeLabel: "视频", shapeId: vidId });

  editor.zoomToFit({ animation: { duration: 400 } });
}
