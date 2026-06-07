"use client";

import { useEffect, useState, useRef } from "react";
import {
  Copy,
  Droplets,
  ImageIcon,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  Video,
  Type,
} from "lucide-react";
import { track, useEditor, type TLShapeId } from "@tldraw/tldraw";
import { ConnectionPorts } from "./ConnectionPorts";
import {
  generateClean,
  generateImg2Img,
  generateRemoveBg,
  generateSimilar,
  generateVideo,
} from "@/lib/canvas-actions";
import {
  getImageFromShape,
  getTopLevelShapeId,
} from "@/lib/shape-helpers";
import { useStudioStore } from "@/lib/store";
import type { ActionStatus } from "@/types";

const actions = [
  { label: "图生图", menuLabel: "图生图 · 参考当前图片生成新图", icon: ImageIcon, run: generateImg2Img, needsSource: true },
  { label: "文生图", menuLabel: "文生图 · 文字描述生成图片", icon: Sparkles, run: generateSimilar },
  { label: "去背景", menuLabel: "去背景 · 移除背景保留主体", icon: Scissors, run: generateRemoveBg, needsSource: true },
  { label: "洗图", menuLabel: "洗图优化 · 提升清晰度和质感", icon: Droplets, run: generateClean, needsSource: true },
  { label: "图生视频", menuLabel: "图生视频 · 基于图片生成视频", icon: Video, run: generateVideo, needsSource: true },
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
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number } | null>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
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
          {actions.map(({ label, menuLabel, icon: Icon, run }) => (
            <button
              key={label}
              type="button"
              title={menuLabel}
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

      {/* "新建生成" button — bottom-center when no image selected */}
      {!selectedImage && (
        <div
          className="pointer-events-auto absolute left-1/2 bottom-6 -translate-x-1/2 z-40"
        >
          <button
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#15151c]/95 px-5 py-2.5 text-[13px] font-medium text-zinc-300 shadow-xl backdrop-blur-md hover:border-indigo-500/30 hover:text-zinc-100 transition-colors"
            onClick={() => {
              const container = editor.getContainer();
              const rect = container.getBoundingClientRect();
              setCreateMenu({ x: rect.width / 2, y: rect.height - 60 });
            }}
          >
            <Plus size={15} className="text-indigo-400" />
            新建生成
          </button>
        </div>
      )}

      {/* Create menu overlay */}
      {createMenu && (
        <div
          ref={createMenuRef}
          className="pointer-events-auto absolute z-50 w-48 rounded-xl border border-white/[0.08] bg-[#15151f]/98 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{
            left: createMenu.x - 96,
            top: createMenu.y - 260,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-zinc-500 px-2 py-1">新建生成</p>
          <div className="h-px bg-white/[0.05] my-1" />
          <CreateMenuItem
            icon={Sparkles} label="文生图" desc="通过文字描述生成图片"
            onClick={() => {
              useStudioStore.getState().openBottomPromptBar({
                actionType: "text-to-image", actionLabel: "文生图",
              });
              setCreateMenu(null);
            }}
          />
          <CreateMenuItem
            icon={Type} label="文本节点" desc="添加文本标注"
            onClick={() => {
              editor.setCurrentTool("text");
              setCreateMenu(null);
            }}
          />
          <CreateMenuItem
            icon={ImageIcon} label="图片节点" desc="拖入或选择本地图片"
            onClick={() => {
              alert("请直接拖入图片文件到画布，或使用导入功能");
              setCreateMenu(null);
            }}
          />
          <div className="h-px bg-white/[0.05] my-1" />
          <CreateMenuItem
            icon={Video} label="文生视频" desc="即将接入" disabled
          />
          <div className="h-px bg-white/[0.05] my-1" />
          <button
            className="w-full text-left text-[11px] text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded"
            onClick={() => setCreateMenu(null)}
          >
            取消
          </button>
        </div>
      )}
    </>
  );
});

function CreateMenuItem({
  icon: Icon, label, desc, disabled, onClick,
}: { icon: typeof Sparkles; label: string; desc: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "hover:bg-white/[0.04]"
      }`}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      <Icon size={14} className={`mt-0.5 shrink-0 ${disabled ? "text-zinc-600" : "text-zinc-400"}`} />
      <div>
        <span className={`text-[12px] font-medium block ${disabled ? "text-zinc-600" : "text-zinc-300"}`}>
          {label}
        </span>
        <span className="text-[10px] text-zinc-600 block">{desc}</span>
      </div>
    </button>
  );
}
