"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  isShapeId,
  track,
  useEditor,
  type Editor,
  type TLShapeId,
  type TLAssetId,
} from "@tldraw/tldraw";
import { useStudioStore } from "@/lib/store";
import { resolveImageReference } from "@/lib/shape-helpers";
import {
  createAiConnection,
  hasAiConnection,
} from "@/lib/connection-system";
import { Video, Sparkles, ImageIcon, Droplets, Scissors } from "lucide-react";
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
  let nearestDistance = 36;
  for (const port of ports) {
    if (port.id === sourceId || hasAiConnection(sourceId, port.id)) continue;
    const d = Math.hypot(port.input.x - point.x, port.input.y - point.y);
    if (d < nearestDistance) { nearest = port; nearestDistance = d; }
  }
  return nearest;
}

function Port({
  id, x, y, side, emphasized, highlighted, onStart,
}: {
  id: TLShapeId;
  x: number;
  y: number;
  side: "input" | "output";
  emphasized: boolean;
  highlighted: boolean;
  onStart?: (event: ReactPointerEvent<HTMLButtonElement>, id: TLShapeId) => void;
}) {
  const isOutput = side === "output";
  const visible = emphasized || highlighted;

  // Port: outer glow ring 18px + mid ring 12px + solid core 7px
  const outerSize = highlighted ? 22 : visible ? 18 : 14;
  const coreSize = highlighted ? 8 : visible ? 7 : 5;
  const glowSpread = highlighted ? 8 : visible ? 5 : 3;
  const glowAlpha = highlighted ? 0.35 : visible ? 0.2 : 0.08;

  return (
    <button
      type="button"
      aria-label={isOutput ? "拖出生成" : "连接输入"}
      data-connection-port={side}
      data-shape-id={id}
      onPointerDown={
        isOutput && onStart
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              (event.target as HTMLElement).setPointerCapture(event.pointerId);
              onStart(event, id);
            }
          : (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
      }
      className="pointer-events-auto absolute flex items-center justify-center select-none transition-[opacity,transform] duration-200"
      style={{
        left: x,
        top: y,
        width: outerSize,
        height: outerSize,
        transform: `translate(-50%, -50%) scale(${highlighted ? 1.15 : 1})`,
        opacity: highlighted ? 1 : visible ? 0.92 : 0.4,
        cursor: isOutput ? "crosshair" : "default",
        zIndex: 100,
      }}
    >
      {/* Outer glow ring */}
      <span
        className="absolute inset-0 rounded-full transition-all duration-200"
        style={{
          background: "transparent",
          boxShadow: `0 0 ${glowSpread}px ${glowSpread / 2}px rgba(120,180,255,${glowAlpha})`,
          border: `1px solid rgba(120,180,255,${highlighted ? 0.55 : visible ? 0.35 : 0.15})`,
        }}
      />
      {/* Solid core */}
      <span
        className="rounded-full transition-all duration-200"
        style={{
          width: coreSize,
          height: coreSize,
          background: highlighted
            ? "rgba(255,255,255,0.95)"
            : visible
              ? "rgba(200,220,255,0.85)"
              : "rgba(150,170,200,0.5)",
          boxShadow: highlighted
            ? `0 0 6px rgba(200,225,255,0.5)`
            : "none",
        }}
      />
      {/* "+" indicator for output */}
      {isOutput && visible && (
        <span
          className="absolute text-[9px] font-bold leading-none select-none"
          style={{
            color: highlighted ? "rgba(255,255,255,0.9)" : "rgba(180,210,255,0.8)",
            marginTop: -0.5,
          }}
        >
          +
        </span>
      )}
    </button>
  );
}

export const ConnectionPorts = track(() => {
  const editor = useEditor();
  const activeTool = useStudioStore((state) => state.activeTool);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftConnection | null>(null);
  const draftRef = useRef<DraftConnection | null>(null);
  const [portMenu, setPortMenu] = useState<{
    x: number; y: number; sourceId: TLShapeId;
  } | null>(null);
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

    const shape = editor.getShape(id);
    const assetId = shape?.type === "image" ? shape.props.assetId : undefined;
    console.log("[ConnectionPorts] start connect", JSON.stringify({
      sourceShapeId: id,
      sourceAssetId: assetId ?? "(none)",
    }));

    let currentTargetId: TLShapeId | null = null;

    const handlePointerMove = (ev: PointerEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const b = overlay.getBoundingClientRect();
      const current = { x: ev.clientX - b.left, y: ev.clientY - b.top };
      const nearest = getNearestTarget(getConnectablePorts(editor), id, current);
      currentTargetId = nearest?.id ?? null;
      const updated: DraftConnection = {
        sourceId: id,
        start: port.output,
        current: nearest?.input ?? current,
        targetId: currentTargetId,
      };
      draftRef.current = updated;
      setDraft(updated);
    };

    const handlePointerUp = () => {
      const curDraft = draftRef.current;
      console.log("[ConnectionPorts] pointerUp", JSON.stringify({
        hasTarget: !!currentTargetId,
        hasDraft: !!curDraft,
      }));

      if (currentTargetId) {
        const cid = createAiConnection(editor, id, currentTargetId, { type: "manual" });
        if (cid) editor.select(cid);
      } else if (curDraft) {
        setPortMenu({
          x: curDraft.current.x,
          y: curDraft.current.y,
          sourceId: id,
        });
        console.log("[ConnectionPorts] 打开菜单", JSON.stringify({
          x: curDraft.current.x, y: curDraft.current.y, sourceId: id,
        }));
      }
      setDraft(null);
      draftRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    editor.select(id);
    const initialDraft: DraftConnection = {
      sourceId: id,
      start: port.output,
      current: port.output,
      targetId: null,
    };
    draftRef.current = initialDraft;
    setDraft(initialDraft);
  };

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-30">
      {/* Draft line — double-layer: glow + main */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {draft && (
          <>
            <path
              d={getAiConnectionPath({
                startX: draft.start.x,
                startY: draft.start.y,
                endX: draft.current.x,
                endY: draft.current.y,
              })}
              fill="none"
              stroke="rgba(90,170,255,0.28)"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={getAiConnectionPath({
                startX: draft.start.x,
                startY: draft.start.y,
                endX: draft.current.x,
                endY: draft.current.y,
              })}
              fill="none"
              stroke="rgba(220,240,255,0.95)"
              strokeWidth={2}
              strokeDasharray="8 5"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>

      {/* Ports */}
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
            id={port.id} x={port.input.x} y={port.input.y}
            side="input" emphasized={emphasized} highlighted={highlighted}
          />,
          <Port
            key={`${port.id}-output`}
            id={port.id} x={port.output.x} y={port.output.y}
            side="output" emphasized={emphasized}
            highlighted={draft?.sourceId === port.id}
            onStart={handleStart}
          />,
        ];
      })}

      {/* Menu */}
      {portMenu && (
        <div
          className="pointer-events-auto absolute z-[999] w-40 rounded-lg border border-white/[0.08] bg-[#15151f]/98 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ left: portMenu.x + 12, top: portMenu.y - 8 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-zinc-500 px-2 py-1">引用该节点生成</p>
          <div className="h-px bg-white/[0.05] my-1" />
          {[
            { icon: ImageIcon, label: "图生图", at: "img2img" },
            { icon: Sparkles, label: "文生图", at: "similar" },
            { icon: Droplets, label: "洗图优化", at: "clean" },
            { icon: Scissors, label: "去背景", at: "removeBg" },
            { icon: Video, label: "图生视频", at: "video" },
          ].map(({ icon: Icon, label, at }) => (
            <DragMenuItem key={at} icon={Icon} label={label} onClick={() => {
              const ref = resolveImageReference(editor, portMenu.sourceId);
              useStudioStore.getState().openBottomPromptBar({
                actionType: at as "img2img" | "similar" | "clean" | "removeBg" | "video",
                actionLabel: label,
                sourceShapeId: ref?.sourceShapeId ?? portMenu.sourceId,
                sourceAssetId: ref?.sourceAssetId as TLAssetId | undefined,
                sourceName: ref?.sourceName ?? "",
                sourceWidth: ref?.sourceWidth ?? 0,
                sourceHeight: ref?.sourceHeight ?? 0,
                sourceUrl: ref?.sourceUrl ?? "",
              });
              setPortMenu(null);
            }} />
          ))}
          <div className="h-px bg-white/[0.05] my-1" />
          <button
            className="w-full text-left text-[11px] text-zinc-600 hover:text-zinc-400 px-2 py-1 rounded"
            onClick={() => setPortMenu(null)}
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
});

function DragMenuItem({
  icon: Icon, label, onClick,
}: { icon: typeof Sparkles; label: string; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[11px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      onClick={onClick}
    >
      <Icon size={12} className="text-zinc-500" />
      {label}
    </button>
  );
}
