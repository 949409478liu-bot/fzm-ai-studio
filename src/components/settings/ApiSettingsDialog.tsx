"use client";

import { Dialog } from "@/components/ui/Dialog";
import { useStudioStore } from "@/lib/store";
import { Key, Server, Check, Trash2, Sparkles } from "lucide-react";

export function ApiSettingsDialog() {
  const isOpen = useStudioStore((s) => s.isApiSettingsOpen);
  const setOpen = useStudioStore((s) => s.setApiSettingsOpen);
  const settings = useStudioStore((s) => s.apiSettings);
  const setSettings = useStudioStore((s) => s.setApiSettings);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Sparkles size={14} className="text-indigo-400" />
          </div>
          <h2 className="text-[15px] font-semibold text-zinc-100">API 设置</h2>
        </div>
        <p className="text-[11px] text-zinc-500 ml-9 mb-6">
          密钥仅存储在本地，不会上传。
        </p>

        {/* Provider: Cloud AI */}
        <div className="mb-5">
          <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-3">
            云端模型
          </p>
          <div className="space-y-3">
            <ApiField
              icon={Key}
              label="Gemini API Key"
              placeholder="AIza..."
              value={settings.geminiKey}
              onChange={(v) => setSettings({ geminiKey: v })}
            />
            <ApiField
              icon={Key}
              label="OpenAI API Key"
              placeholder="sk-proj-..."
              value={settings.openaiKey}
              onChange={(v) => setSettings({ openaiKey: v })}
            />
            <ApiField
              icon={Key}
              label="fal.ai Key"
              placeholder="fv-..."
              value={settings.falKey}
              onChange={(v) => setSettings({ falKey: v })}
            />
          </div>
        </div>

        {/* Provider: Self-hosted */}
        <div className="mb-5">
          <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-3">
            本地服务
          </p>
          <ApiField
            icon={Server}
            label="ComfyUI 服务地址"
            placeholder="http://localhost:8188"
            value={settings.comfyuiUrl}
            onChange={(v) => setSettings({ comfyuiUrl: v })}
            type="text"
          />
        </div>

        {/* Provider: Video */}
        <div className="mb-5">
          <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-3">
            视频模型
          </p>
          <ApiField
            icon={Key}
            label="Kling API Key"
            placeholder="kl-..."
            value={settings.klingKey}
            onChange={(v) => setSettings({ klingKey: v })}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
          <button
            className="s-btn s-btn-ghost s-btn-xs text-zinc-600 hover:text-zinc-400 gap-1"
            onClick={() =>
              setSettings({
                geminiKey: "",
                openaiKey: "",
                falKey: "",
                comfyuiUrl: "",
                klingKey: "",
              })
            }
          >
            <Trash2 size={11} />
            清空
          </button>
          <div className="flex gap-1.5">
            <button
              className="s-btn s-btn-xs text-zinc-500"
              onClick={() => alert("当前为模拟测试，未连接真实 API")}
            >
              <Check size={12} />
              测试
            </button>
            <button
              className="s-btn s-btn-xs s-btn-primary"
              onClick={() => { setOpen(false); alert("设置已保存到本地模拟状态"); }}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function ApiField({
  icon: Icon,
  label,
  placeholder,
  value,
  onChange,
  type = "password",
}: {
  icon: typeof Key;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-zinc-500 mb-1 flex items-center gap-1.5">
        <Icon size={10} className="text-zinc-600" />
        {label}
      </label>
      <input
        type={type}
        className="s-input text-[12px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
