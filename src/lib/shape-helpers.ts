import type { Editor, TLImageShape, TLShapeId } from "@tldraw/tldraw";

const NON_CONTENT_NAMES = ["标签", "Prompt", "placeholder", "指令", "占位", "失败"];

function isContentImage(shape: TLImageShape): boolean {
  // Check meta.role first
  const meta = (shape.meta ?? {}) as Record<string, unknown>;
  if (meta.role === "content-image") return true;
  if (meta.role && meta.role !== "content-image") return false;

  // Fallback: SVG mime type from asset likely means label/placeholder
  const assetId = shape.props.assetId;
  if (assetId) {
    // Can't access editor here, check by shape properties
  }

  // Height heuristic: labels are ~28-70px, real images are taller
  if (shape.props.h <= 80) return false;

  return true;
}

export function getTopLevelShapeId(editor: Editor, shapeId: TLShapeId) {
  let currentId = shapeId;
  let shape = editor.getShape(currentId);

  while (shape && typeof shape.parentId === "string" && shape.parentId.startsWith("shape:")) {
    const parent = editor.getShape(shape.parentId as TLShapeId);
    if (!parent || parent.type !== "group") break;
    currentId = parent.id;
    shape = parent;
  }

  return currentId;
}

export function getImageFromShape(
  editor: Editor,
  shapeId: TLShapeId
): TLImageShape | null {
  const shape = editor.getShape(shapeId);
  if (!shape) return null;

  if (shape.type === "image") {
    // Direct image: check role
    if (isContentImage(shape)) return shape;
    return null;
  }

  if (shape.type !== "group") return null;

  // Traverse group children, return first content image
  for (const childId of editor.getSortedChildIdsForParent(shape.id)) {
    const child = editor.getShape(childId);
    if (child?.type === "image" && isContentImage(child)) return child;
  }

  return null;
}

export function getSelectedImage(editor: Editor) {
  const ids = editor.getSelectedShapeIds();
  if (ids.length !== 1) return null;
  return getImageFromShape(editor, ids[0]);
}

// ─── Unified image reference resolver ────────────────────────────────

export interface ImageReference {
  sourceShapeId: TLShapeId;
  sourceAssetId: string;
  sourceName: string;
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Resolve complete image reference info from any shape type.
 * Only returns content-image shapes, never labels/placeholders/operation-nodes.
 */
export function resolveImageReference(
  editor: Editor,
  shapeId: TLShapeId
): ImageReference | null {
  const image = getImageFromShape(editor, shapeId);
  if (!image) return null;

  const assetId = image.props.assetId;
  if (!assetId) return null;

  const asset = editor.getAsset(assetId);
  const props = (asset?.props ?? {}) as Record<string, unknown>;
  const name = (props.name as string) || "";

  // Guard: reject label/placeholder names
  for (const keyword of NON_CONTENT_NAMES) {
    if (name.includes(keyword)) return null;
  }

  // Guard: reject SVG-only assets (labels/placeholders)
  if ((props.mimeType as string) === "image/svg+xml") return null;

  return {
    sourceShapeId: image.id,
    sourceAssetId: assetId,
    sourceName: name || (props.src as string)?.split("/").pop() || "未命名图片",
    sourceUrl: (props.src as string) || "",
    sourceWidth: Math.round(image.props.w),
    sourceHeight: Math.round(image.props.h),
  };
}
