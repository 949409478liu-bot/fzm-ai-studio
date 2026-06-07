import type { Editor, TLShapeId } from "@tldraw/tldraw";
import {
  AI_CONNECTION_TYPE,
  type AiConnectionShape,
} from "@/components/canvas/AiConnectionShape";
import { useStudioStore, uid } from "./store";
import type { CanvasConnection } from "@/types";

function getConnectionPoints(
  editor: Editor,
  sourceId: TLShapeId,
  targetId: TLShapeId
) {
  const sourceBounds = editor.getShapePageBounds(sourceId);
  const targetBounds = editor.getShapePageBounds(targetId);
  if (!sourceBounds || !targetBounds) return null;

  return {
    startX: sourceBounds.x + sourceBounds.w,
    startY: sourceBounds.y + sourceBounds.h / 2,
    endX: targetBounds.x,
    endY: targetBounds.y + targetBounds.h / 2,
  };
}

export function createAiConnection(
  editor: Editor,
  sourceId: TLShapeId,
  targetId: TLShapeId,
  options: {
    type: CanvasConnection["type"];
    label?: string;
  }
) {
  if (sourceId === targetId) return null;

  const state = useStudioStore.getState();
  const duplicate = state.connections.find(
    (connection) =>
      connection.sourceId === sourceId && connection.targetId === targetId
  );
  if (duplicate) return duplicate.id;

  const points = getConnectionPoints(editor, sourceId, targetId);
  if (!points) return null;

  const id = uid();
  const createdAt = Date.now();
  editor.createShape<AiConnectionShape>({
    id,
    type: AI_CONNECTION_TYPE,
    x: 0,
    y: 0,
    props: {
      sourceId,
      targetId,
      sourcePort: "output",
      targetPort: "input",
      connectionType: options.type,
      label: options.label ?? "",
      createdAt,
      ...points,
    },
  });
  editor.sendToBack([id]);
  state.addConnection({
    id,
    sourceId,
    targetId,
    sourcePort: "output",
    targetPort: "input",
    type: options.type,
    label: options.label,
    createdAt,
  });

  return id;
}

export function hasAiConnection(
  sourceId: TLShapeId,
  targetId: TLShapeId
) {
  return useStudioStore
    .getState()
    .connections.some(
      (connection) =>
        connection.sourceId === sourceId && connection.targetId === targetId
    );
}

export function synchronizeAiConnections(editor: Editor) {
  const { connections, removeConnection } = useStudioStore.getState();

  for (const connection of connections) {
    const shape = editor.getShape(connection.id);
    const points = getConnectionPoints(
      editor,
      connection.sourceId,
      connection.targetId
    );

    if (!shape || shape.type !== AI_CONNECTION_TYPE || !points) {
      if (shape) editor.deleteShape(connection.id);
      removeConnection(connection.id);
      continue;
    }

    const current = shape.props;
    if (
      current.startX === points.startX &&
      current.startY === points.startY &&
      current.endX === points.endX &&
      current.endY === points.endY
    ) {
      continue;
    }

    editor.updateShape<AiConnectionShape>({
      id: connection.id,
      type: AI_CONNECTION_TYPE,
      props: points,
    });
  }
}
