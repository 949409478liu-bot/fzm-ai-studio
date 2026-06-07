"use client";

import Image from "next/image";
import { ImageIcon, Sparkles } from "lucide-react";
import { useStudioStore } from "@/lib/store";
import type { TLShapeId } from "@tldraw/tldraw";

export function BottomGallery() {
  const results = useStudioStore((s) => s.results);
  const editor = useStudioStore((s) => s.editor);
  const actions = useStudioStore((s) => s.actions);

  const handleClick = (shapeId: TLShapeId) => {
    if (editor) {
      editor.select(shapeId);
      editor.zoomToSelection({ animation: { duration: 300 } });
    }
  };

  const displaySlots = 4;
  const slots = [...results.slice(0, displaySlots), ...Array(Math.max(0, displaySlots - results.length)).fill(null)];

  return (
    <div className="h-28 glass-float border-t border-white/[0.04] shrink-0 z-20 mx-2 mb-2 rounded-xl">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-zinc-500" />
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">结果图库</span>
        </div>
        <span className="text-[10px] text-zinc-600 flex items-center gap-2">
          {actions.filter((a) => a.status === "running" || a.status === "queued").length > 0 && (
            <span className="text-indigo-400/70 animate-pulse">
              {actions.filter((a) => a.status === "running").length > 0 ? "生成中..." : "排队中..."}
            </span>
          )}
          {results.length > 0 ? `${results.length} 个结果` : "生成结果会显示在这里"}
        </span>
      </div>
      <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
        {slots.map((r, i) =>
          r ? (
            <button
              key={r.id}
              onClick={() => handleClick(r.shapeId)}
              className="w-[84px] h-[56px] rounded-lg border border-white/[0.08] bg-white/[0.02] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:border-indigo-400/30 hover:bg-indigo-500/5 cursor-pointer relative overflow-hidden"
            >
              {r.imageUrl ? (
                <Image
                  src={r.imageUrl}
                  alt={r.typeLabel}
                  fill
                  unoptimized
                  className="object-cover opacity-60"
                />
              ) : (
                <div className="absolute inset-0 bg-indigo-500/5" />
              )}
              <span className="text-[9px] text-zinc-400 relative z-10 font-medium">
                {r.typeLabel}
              </span>
              {(() => {
                const action = actions.find((item) => item.targetId === r.id);
                if (!action || action.status === "completed") return null;
                return (
                  <span className="absolute bottom-1 right-1 z-10 h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
                );
              })()}
            </button>
          ) : (
            <div
              key={`empty-${i}`}
              className="w-[84px] h-[56px] rounded-lg border border-white/[0.04] bg-white/[0.015] flex-shrink-0 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03]"
            >
              <ImageIcon size={16} className="text-zinc-700" />
              <span className="text-[9px] text-zinc-700">空</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
