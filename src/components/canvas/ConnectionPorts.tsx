"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  isShapeId,
  track,
  useEditor,
  type Editor,
  type TLShapeId,
} from "@tldraw/tldraw";
import { useStudioStore } from "@/lib/store";
import {
  createAiConnection,
  hasAiConnection,
} from "@/lib/connection-system";
import { getAiConnectionPath } from "./AiConnectionShape";

type PortPosition = {
  id: TLShapeId;
  input: { x: number; y: number };
  output: { x: number; y: number };
};

type DraftConnection = {
  sourceId: TLShapeId;
  start: { x: number; y: number };
  current: { x: number; y: number };
  targetId: TLShapeId | null;
};

function getTopLevelNodeId(editor: Editor, id: TLShapeId) {
  let currentId = id;
  let shape = editor.getShape(currentId);

  while (shape && isShapeId(shape.parentId)) {
    const parent = editor.getShape(shape.parentId);
    if (!parent || parent.type !== "group") break;
    currentId = parent.id;
    shape = parent;
  }

  return currentId;
}

function getConnectablePorts(editor: Editor) {
  return editor.getCurrentPageShapes().flatMap<PortPosition>((shape) => {
    if (!["image", "group"].includes(shape.type)) return [];

    if (shape.type === "image" && isShapeId(shape.parentId)) {
      const parent = editor.getShape(shape.parentId);
      if (parent?.type === "group") return [];
    }

    const bounds = editor.getShapePageBounds(shape.id);
    if (!bounds) return [];

    return [
      {
        id: shape.id,
        input: editor.pageToViewport({
          x: bounds.x,
          y: bounds.y + bounds.h / 2,
        }),
        output: editor.pageToViewport({
          x: bounds.x + bounds.w,
          y: bounds.y + bounds.h / 2,
        }),
      },
    ];
  });
}

function getNearestTarget(
  ports: PortPosition[],
  sourceId: TLShapeId,
  point: { x: number; y: number }
) {
  let nearest: PortPosition | null = null;
  let nearestDistance = 24;

  for (const port of ports) {
    if (port.id === sourceId || hasAiConnection(sourceId, port.id)) continue;
    const distance = Math.hypot(
      port.input.x - point.x,
      port.input.y - point.y
    );
    if (distance < nearestDistance) {
      nearest = port;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function Port({
  id,
  x,
  y,
  side,
  emphasized,
  highlighted,
  onStart,
}: {
  id: TLShapeId;
  x: number;
  y: number;
  side: "input" | "output";
  emphasized: boolean;
  highlighted: boolean;
  onStart?: (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: TLShapeId
  ) => void;
}) {
  return (
    <button
      type="button"
      aria-label={side === "output" ? "拖动创建连接" : "连接输入端口"}
      data-connection-port={side}
      data-shape-id={id}
      onPointerDown={
        side === "output" && onStart
          ? (event) => onStart(event, id)
          : undefined
      }
      className="pointer-events-auto absolute h-2.5 w-2.5 rounded-full border bg-[#111118] transition-[opacity,transform,background-color,box-shadow] duration-150"
      style={{
        left: x,
        top: y,
        opacity: highlighted ? 1 : emphasized ? 0.9 : 0.24,
        borderColor: highlighted
          ? "rgba(199,210,254,1)"
          : "rgba(165,180,252,0.72)",
        backgroundColor: highlighted
          ? "rgba(129,140,248,1)"
          : "rgba(17,17,24,1)",
        boxShadow: highlighted
          ? "0 0 0 4px rgba(129,140,248,0.2)"
          : "0 0 0 2px rgba(129,140,248,0.1)",
        cursor: side === "output" ? "crosshair" : "default",
        transform: `translate(-50%, -50%) scale(${highlighted ? 1.2 : 1})`,
      }}
    />
  );
}

export const ConnectionPorts = track(() => {
  const editor = useEditor();
  const activeTool = useStudioStore((state) => state.activeTool);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftConnection | null>(null);
  const ports = getConnectablePorts(editor);
  const selectedIds = new Set(
    editor.getSelectedShapeIds().map((id) => getTopLevelNodeId(editor, id))
  );
  const hoveredId = editor.getHoveredShapeId();
  const normalizedHoveredId = hoveredId
    ? getTopLevelNodeId(editor, hoveredId)
    : null;

  const handleStart = (
    event: ReactPointerEvent<HTMLButtonElement>,
    id: TLShapeId
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const port = ports.find((item) => item.id === id);
    if (!port) return;

    let currentTargetId: TLShapeId | null = null;
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const bounds = overlay.getBoundingClientRect();
      const current = {
        x: pointerEvent.clientX - bounds.left,
        y: pointerEvent.clientY - bounds.top,
      };
      const nearest = getNearestTarget(
        getConnectablePorts(editor),
        id,
        current
      );
      currentTargetId = nearest?.id ?? null;

      setDraft((value) =>
        value
          ? {
              ...value,
              current: nearest?.input ?? current,
              targetId: currentTargetId,
            }
          : null
      );
    };

    const handlePointerUp = () => {
      if (currentTargetId) {
        const connectionId = createAiConnection(
          editor,
          id,
          currentTargetId,
          { type: "manual" }
        );
        if (connectionId) editor.select(connectionId);
      }
      setDraft(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    editor.select(id);
    setDraft({
      sourceId: id,
      start: port.output,
      current: port.output,
      targetId: null,
    });
  };

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0">
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {draft && (
          <path
            d={getAiConnectionPath({
              startX: draft.start.x,
              startY: draft.start.y,
              endX: draft.current.x,
              endY: draft.current.y,
            })}
            fill="none"
            stroke="rgba(165,180,252,0.55)"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        )}
      </svg>

      {ports.flatMap((port) => {
        const emphasized =
          activeTool === "connection" ||
          selectedIds.has(port.id) ||
          normalizedHoveredId === port.id ||
          draft?.sourceId === port.id;
        const highlighted = draft?.targetId === port.id;

        return [
          <Port
            key={`${port.id}-input`}
            id={port.id}
            x={port.input.x}
            y={port.input.y}
            side="input"
            emphasized={emphasized}
            highlighted={highlighted}
          />,
          <Port
            key={`${port.id}-output`}
            id={port.id}
            x={port.output.x}
            y={port.output.y}
            side="output"
            emphasized={emphasized}
            highlighted={draft?.sourceId === port.id}
            onStart={handleStart}
          />,
        ];
      })}
    </div>
  );
});
