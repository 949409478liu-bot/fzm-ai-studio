"use client";

import { useState } from "react";
import Image from "next/image";
import { useStudioStore } from "@/lib/store";
import {
  Sparkles,
  ImageIcon,
  Maximize2,
  Droplets,
  Paintbrush,
  Scissors,
  Video,
  Trash2,
} from "lucide-react";
import {
  generateSimilar,
  generateImg2Img,
  generateUpscale,
  generateClean,
  generateRemoveBg,
  generateVideo,
} from "@/lib/canvas-actions";

const models = [
  { value: "gemini", label: "Gemini / Nano Banana" },
  { value: "openai", label: "OpenAI / GPT Image" },
  { value: "comfyui", label: "ComfyUI" },
  { value: "fal", label: "fal.ai" },
  { value: "kling", label: "Kling" },
];

const sizes = ["1024", "1536", "2048", "4K"];

export function RightInspector() {
  const selected = useStudioStore((s) => s.selectedShape);
  const editor = useStudioStore((s) => s.editor);
  const [inpaintActive, setInpaintActive] = useState(false);

  if (!selected) {
    return (
      <aside className="w-[264px] glass border-l border-white/[0.04] shrink-0 flex flex-col items-center justify-center text-center p-6 z-20">
        <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-zinc-600">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
        <p className="text-[13px] text-zinc-400 font-medium">属性面板</p>
        <p className="text-[11px] text-zinc-600 mt-1.5 leading-relaxed max-w-[180px]">
          点击画布中的图片查看详情并进行 AI 操作
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-[264px] glass border-l border-white/[0.04] shrink-0 flex flex-col overflow-y-auto z-20">
      {/* Preview */}
      <div className="p-2.5">
        <div className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-black/30 aspect-[4/3] flex items-center justify-center">
          {selected.imageUrl ? (
            <Image
              src={selected.imageUrl}
              alt={selected.name}
              fill
              unoptimized
              className="object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">无预览</div>
          )}
        </div>
      </div>

      {/* File info */}
      <div className="px-3 pb-2">
        <h3 className="text-[13px] font-medium text-zinc-200 truncate">{selected.name}</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {selected.width} × {selected.height} px
        </p>
      </div>

      {/* Group 1 — 生成 */}
      <div className="border-t border-white/[0.04]" />
      <div className="p-2.5 space-y-1">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-2 px-1">生成</p>
        <ActionBtn icon={Sparkles} label="生成相似图" onClick={generateSimilar} />
        <ActionBtn icon={ImageIcon} label="参考图生图" onClick={generateImg2Img} />
      </div>

      {/* Group 2 — 增强 */}
      <div className="border-t border-white/[0.04]" />
      <div className="p-2.5 space-y-1">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-2 px-1">增强</p>
        <ActionBtn icon={Maximize2} label="高清放大" onClick={generateUpscale} />
        <ActionBtn icon={Droplets} label="洗图优化" onClick={generateClean} />
        <ActionBtn
          icon={Paintbrush}
          label={inpaintActive ? "重绘模式已激活" : "局部重绘"}
          onClick={() => {
            setInpaintActive(!inpaintActive);
            if (!inpaintActive) {
              alert("请框选需要重绘的区域（模拟模式，在画布上用选区工具框选区域）");
            }
          }}
        />
        {inpaintActive && (
          <p className="text-[10px] text-indigo-400/60 px-2 pt-0.5">
            请框选需要重绘的区域
          </p>
        )}
      </div>

      {/* Group 3 — 转换 */}
      <div className="border-t border-white/[0.04]" />
      <div className="p-2.5 space-y-1">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-2 px-1">转换</p>
        <ActionBtn icon={Scissors} label="去背景" onClick={generateRemoveBg} />
        <ActionBtn icon={Video} label="图生视频" onClick={generateVideo} />
      </div>

      {/* Prompt */}
      <div className="border-t border-white/[0.04]" />
      <div className="p-2.5 space-y-1.5">
        <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest px-1">提示词</label>
        <textarea
          className="s-input h-[68px] resize-none text-[12px]"
          placeholder="输入你想生成或修改的内容..."
        />
      </div>

      {/* Model & Size */}
      <div className="px-2.5 pb-1.5 flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest px-1 mb-1 block">模型</label>
          <select className="s-input s-select text-[12px]" defaultValue="gemini">
            {models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest px-1 mb-1 block">尺寸</label>
          <select className="s-input s-select text-[12px]" defaultValue="1024">
            {sizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Remove */}
      <div className="border-t border-white/[0.04] mt-0.5" />
      <div className="p-2.5">
        <button
          className="s-btn s-btn-ghost w-full justify-center text-[11px] text-zinc-500 hover:text-red-400 gap-1.5"
          onClick={() => {
            if (editor) {
              editor.deleteShape(selected.id);
            }
          }}
        >
          <Trash2 size={12} />
          从画布移除
        </button>
      </div>
    </aside>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="s-btn s-btn-ghost w-full justify-start text-[12px] h-[30px] gap-2 px-2 rounded-md"
      onClick={onClick}
    >
      <Icon size={13} className="text-zinc-500 shrink-0" />
      <span className="text-zinc-400">{label}</span>
    </button>
  );
}
