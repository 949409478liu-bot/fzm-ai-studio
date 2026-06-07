"use client";

import { track, useEditor, type TLShapeId } from "@tldraw/tldraw";

function Port({
  x,
  y,
  side,
}: {
  x: number;
  y: number;
  side: "input" | "output";
}) {
  return (
    <span
      aria-hidden
      data-connection-port={side}
      className="absolute h-2.5 w-2.5 rounded-full border border-indigo-300/80 bg-[#111118] shadow-[0_0_0_2px_rgba(129,140,248,0.12)]"
      style={{
        left: x,
        top: y,
        opacity: side === "output" ? 0.95 : 0.72,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

export const ConnectionPorts = track(() => {
  const editor = useEditor();
  const selectedIds = editor.getSelectedShapeIds();
  const hoveredId = editor.getHoveredShapeId();
  const ids = new Set<TLShapeId>(
    selectedIds.length > 0
      ? selectedIds
      : hoveredId
        ? [hoveredId]
        : []
  );

  const ports = Array.from(ids).flatMap((id) => {
    const shape = editor.getShape(id);
    if (!shape || !["image", "group"].includes(shape.type)) return [];

    const bounds = editor.getShapePageBounds(id);
    if (!bounds) return [];

    const input = editor.pageToViewport({
      x: bounds.x,
      y: bounds.y + bounds.h / 2,
    });
    const output = editor.pageToViewport({
      x: bounds.x + bounds.w,
      y: bounds.y + bounds.h / 2,
    });

    return [
      <Port key={`${id}-input`} x={input.x} y={input.y} side="input" />,
      <Port key={`${id}-output`} x={output.x} y={output.y} side="output" />,
    ];
  });

  return <div className="pointer-events-none absolute inset-0">{ports}</div>;
});
