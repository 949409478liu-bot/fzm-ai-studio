"use client";

import {
  MousePointer2,
  ImageIcon,
  Type,
  Sparkles,
  Maximize2,
  Droplets,
  Paintbrush,
  Workflow,
  Video,
  FolderOpen,
} from "lucide-react";
import { useStudioStore } from "@/lib/store";
import type { ToolType } from "@/types";
import { cn } from "@/lib/utils";

const tools: { id: ToolType; icon: typeof MousePointer2; label: string; tldrawTool?: string }[] = [
  { id: "select", icon: MousePointer2, label: "选择", tldrawTool: "select" },
  { id: "image", icon: ImageIcon, label: "图片", tldrawTool: "select" },
  { id: "text", icon: Type, label: "文本", tldrawTool: "text" },
  { id: "generate", icon: Sparkles, label: "生成" },
  { id: "upscale", icon: Maximize2, label: "放大" },
  { id: "clean", icon: Droplets, label: "洗图" },
  { id: "inpaint", icon: Paintbrush, label: "局部", tldrawTool: "draw" },
  { id: "connection", icon: Workflow, label: "连接", tldrawTool: "select" },
  { id: "video", icon: Video, label: "视频" },
  { id: "assets", icon: FolderOpen, label: "素材" },
];

export function LeftToolbar() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const editor = useStudioStore((s) => s.editor);

  const handleToolClick = (tool: (typeof tools)[0]) => {
    setActiveTool(tool.id);
    if (editor && tool.tldrawTool) {
      editor.setCurrentTool(tool.tldrawTool);
    }
  };

  return (
    <nav className="absolute left-2.5 top-[50px] z-20 glass-float rounded-xl py-1.5 px-1 flex flex-col items-center gap-0.5 w-10">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            title={tool.label}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-180",
              isActive
                ? "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/25 shadow-sm shadow-indigo-500/10"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] hover:scale-105"
            )}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </nav>
  );
}
