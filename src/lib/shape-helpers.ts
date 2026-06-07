import type { Editor, TLImageShape, TLShapeId } from "@tldraw/tldraw";

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
  if (shape.type === "image") return shape;
  if (shape.type !== "group") return null;

  for (const childId of editor.getSortedChildIdsForParent(shape.id)) {
    const child = editor.getShape(childId);
    if (child?.type === "image" && child.props.h > 40) return child;
  }

  return null;
}

export function getSelectedImage(editor: Editor) {
  const ids = editor.getSelectedShapeIds();
  if (ids.length !== 1) return null;
  return getImageFromShape(editor, ids[0]);
}
