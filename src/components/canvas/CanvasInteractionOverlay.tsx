"use client";

import { useEffect, useState } from "react";
import {
  Copy,
  Droplets,
  ImageIcon,
  Maximize2,
  Scissors,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { track, useEditor, type TLShapeId } from "@tldraw/tldraw";
import { ConnectionPorts } from "./ConnectionPorts";
import {
  generateClean,
  generateImg2Img,
  generateRemoveBg,
  generateSimilar,
  generateUpscale,
  generateVideo,
} from "@/lib/canvas-actions";
import {
  getImageFromShape,
  getTopLevelShapeId,
} from "@/lib/shape-helpers";
import { useStudioStore } from "@/lib/store";
import type { ActionStatus } from "@/types";

const actions = [
  { label: "相似图", menuLabel: "生成相似图", icon: Sparkles, run: generateSimilar },
  { label: "图生图", menuLabel: "参考图生图", icon: ImageIcon, run: generateImg2Img },
  { label: "放大", menuLabel: "高清放大", icon: Maximize2, run: generateUpscale },
  { label: "洗图", menuLabel: "洗图优化", icon: Droplets, run: generateClean },
  { label: "去背景", menuLabel: "去背景", icon: Scissors, run: generateRemoveBg },
  { label: "视频", menuLabel: "图生视频", icon: Video, run: generateVideo },
];

const statusLabels: Record<ActionStatus, string> = {
  queued: "排队中",
  running: "生成中",
  completed: "已完成",
  failed: "失败",
};

export const CanvasInteractionOverlay = track(() => {
  const editor = useEditor();
  const canvasActions = useStudioStore((state) => state.actions);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    shapeId: TLShapeId;
  } | null>(null);
  const selectedIds = editor.getSelectedShapeIds();
  const selectionId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedImage = selectionId
    ? getImageFromShape(editor, selectionId)
    : null;
  const selectedBounds = selectionId && selectedImage
    ? editor.getShapePageBounds(selectionId)
    : null;
  const toolbarPosition = selectedBounds
    ? editor.pageToViewport({
        x: selectedBounds.x + selectedBounds.w / 2,
        y: selectedBounds.y,
      })
    : null;

  useEffect(() => {
    const container = editor.getContainer();
    const handleContextMenu = (event: MouseEvent) => {
      const pagePoint = editor.screenToPage({
        x: event.clientX,
        y: event.clientY,
      });
      const hit = editor
        .getShapesAtPoint(pagePoint, { hitInside: true })
        .find((shape) => getImageFromShape(editor, shape.id));
      if (!hit) {
        setMenu(null);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const shapeId = getTopLevelShapeId(editor, hit.id);
      editor.select(shapeId);
      const bounds = container.getBoundingClientRect();
      setMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        shapeId,
      });
    };
    const closeMenu = () => setMenu(null);

    container.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("pointerdown", closeMenu);
    return () => {
      container.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("pointerdown", closeMenu);
    };
  }, [editor]);

  const runAction = (
    run: (sourceId?: TLShapeId) => void,
    shapeId: TLShapeId
  ) => {
    run(shapeId);
    setMenu(null);
  };

  return (
    <>
      <ConnectionPorts />

      {toolbarPosition && selectedImage && (
        <div
          data-floating-action-bar
          className="pointer-events-auto absolute flex h-8 items-center gap-0.5 rounded-md border border-white/10 bg-[#15151c]/95 p-1 shadow-xl backdrop-blur-md"
          style={{
            left: toolbarPosition.x,
            top: toolbarPosition.y - 10,
            transform: "translate(-50%, -100%)",
          }}
        >
          {actions.map(({ label, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => runAction(run, selectedImage.id)}
              className="flex h-6 w-7 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-indigo-300"
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      )}

      {canvasActions.map((action) => {
        const bounds = editor.getShapePageBounds(action.targetId);
        if (!bounds) return null;
        const point = editor.pageToViewport({
          x: bounds.x + bounds.w,
          y: bounds.y,
        });
        return (
          <div
            key={action.id}
            className="pointer-events-none absolute rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-lg backdrop-blur-md"
            style={{
              left: point.x - 6,
              top: point.y + 8,
              transform: "translateX(-100%)",
              color:
                action.status === "failed"
                  ? "#fca5a5"
                  : action.status === "completed"
                    ? "#a7f3d0"
                    : "#c7d2fe",
              borderColor:
                action.status === "running"
                  ? "rgba(129,140,248,0.55)"
                  : "rgba(255,255,255,0.08)",
              background: "rgba(17,17,24,0.9)",
            }}
          >
            {action.status === "running" && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
            )}
            {statusLabels[action.status]}
          </div>
        );
      })}

      {menu && (
        <div
          data-canvas-context-menu
          className="pointer-events-auto absolute z-50 w-44 overflow-hidden rounded-md border border-white/10 bg-[#17171f]/98 p-1 shadow-2xl backdrop-blur-xl"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {actions.map(({ menuLabel, icon: Icon, run }) => (
            <button
              key={menuLabel}
              type="button"
              onClick={() => runAction(run, menu.shapeId)}
              className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[12px] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
            >
              <Icon size={13} className="text-zinc-500" />
              {menuLabel}
            </button>
          ))}
          <div className="my-1 h-px bg-white/[0.06]" />
          <button
            type="button"
            onClick={() => {
              editor.duplicateShapes([menu.shapeId], { x: 24, y: 24 });
              setMenu(null);
            }}
            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[12px] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
          >
            <Copy size={13} className="text-zinc-500" />
            复制
          </button>
          <button
            type="button"
            onClick={() => {
              editor.deleteShape(menu.shapeId);
              setMenu(null);
            }}
            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[12px] text-zinc-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 size={13} />
            删除
          </button>
        </div>
      )}
    </>
  );
});
