"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Download,
  Upload,
  Settings,
  Play,
  Pencil,
} from "lucide-react";
import { useStudioStore } from "@/lib/store";
import { runDemo } from "@/lib/canvas-actions";
import { cn } from "@/lib/utils";

export function TopBar() {
  const setApiSettingsOpen = useStudioStore((s) => s.setApiSettingsOpen);
  const editor = useStudioStore((s) => s.editor);
  const [projectName, setProjectName] = useState("未命名画布");
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return (
    <header className="h-10 glass flex items-center justify-between px-3 shrink-0 select-none z-30 relative">
      {/* Left — Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm shadow-indigo-500/20">
          <span className="text-white font-bold text-[10px] leading-none">F</span>
        </div>
        <span className="font-semibold text-[13px] tracking-tight text-zinc-200">FZM AI Studio</span>
      </div>

      {/* Center — Editable project name */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 group cursor-pointer"
        onClick={() => setEditing(true)}>
        {editing ? (
          <input
            ref={inputRef}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setEditing(false);
              if (e.key === "Escape") { setProjectName("未命名画布"); setEditing(false); }
            }}
            className="bg-transparent border-b border-indigo-400/40 text-sm text-zinc-300 outline-none text-center w-40 px-1 py-0.5"
          />
        ) : (
          <>
            <span className="text-[13px] text-zinc-500 font-medium group-hover:text-zinc-400 transition-colors">
              {projectName}
            </span>
            <Pencil size={10} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        )}
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-1">
        <button
          className="s-btn s-btn-xs"
          onClick={() => {
            if (editor) {
              editor.deleteShapes(editor.getCurrentPageShapes().map(s => s.id));
              useStudioStore.setState({
                results: [],
                connections: [],
                actions: [],
              });
            }
          }}
        >
          <Plus size={13} />新建
        </button>
        <button className="s-btn s-btn-xs" onClick={() => alert("导入功能：拖拽图片文件到画布即可导入")}>
          <Upload size={13} />导入
        </button>
        <button className="s-btn s-btn-xs" onClick={() => {
          if (editor) {
            const shapes = editor.getCurrentPageShapes();
            if (shapes.length === 0) {
              alert("画布为空，请先添加内容");
              return;
            }
            editor.selectAll();
            alert("导出功能将在后续版本中完善。当前可右键画布选择 'Copy as PNG'。");
          }
        }}>
          <Download size={13} />导出
        </button>
        <button
          className={cn("s-btn s-btn-xs", "text-zinc-400 hover:text-zinc-200")}
          onClick={() => setApiSettingsOpen(true)}
        >
          <Settings size={13} />
          API 设置
        </button>
        <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
        <button
          className="s-btn s-btn-xs s-btn-primary"
          onClick={() => {
            if (editor) runDemo(editor);
          }}
        >
          <Play size={13} />
          运行演示
        </button>
      </div>
    </header>
  );
}
