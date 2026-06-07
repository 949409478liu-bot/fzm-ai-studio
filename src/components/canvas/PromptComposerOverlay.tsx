"use client";

import { useState, useEffect } from "react";
import { track, useEditor } from "@tldraw/tldraw";
import { X, Sparkles, Loader2, Zap } from "lucide-react";
import { useStudioStore } from "@/lib/store";
import type { ProviderCapability } from "@/lib/providers/types";
import { PROVIDER_TYPE_LABELS } from "@/lib/providers/types";
import type { ResultType } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { label: "1:1", w: 1024, h: 1024 },
  { label: "16:9", w: 1536, h: 864 },
  { label: "9:16", w: 864, h: 1536 },
  { label: "4:3", w: 1280, h: 960 },
  { label: "3:4", w: 960, h: 1280 },
] as const;

const QUALITIES = ["low", "medium", "high"] as const;
const COUNTS = [1, 2, 4] as const;

/** Map actionType to the required ProviderCapability */
function requiredCapability(actionType: ResultType | "text-to-image"): ProviderCapability {
  switch (actionType) {
    case "text-to-image":
    case "similar":
      return "text-to-image";
    case "img2img":
    case "clean":
      return "image-to-image";
    case "upscale":
      return "upscale";
    case "removeBg":
      return "remove-bg";
    case "video":
      return "image-to-video";
    default:
      return "text-to-image";
  }
}

// ─── Component ───────────────────────────────────────────────────────

export const PromptComposerOverlay = track(() => {
  const editor = useEditor();
  const composer = useStudioStore((s) => s.promptComposer);
  const closePromptComposer = useStudioStore((s) => s.closePromptComposer);
  const providers = useStudioStore((s) => s.providers);
  const setProviders = useStudioStore((s) => s.setProviders);
  const executePromptGeneration = useStudioStore((s) => s.executePromptGeneration);

  const [prompt, setPrompt] = useState("");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [aspect, setAspect] = useState(0);
  const [quality, setQuality] = useState<string>("low");
  const [count, setCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  const actionType = composer.actionType as ResultType | "text-to-image";
  const cap = requiredCapability(actionType);

  // Load providers if store is empty
  useEffect(() => {
    if (composer.open && providers.length === 0) {
      fetch("/api/settings/providers")
        .then((r) => r.json())
        .then((d) => {
          setProviders(d.providers || []);
        })
        .catch(() => {});
    }
  }, [composer.open, providers.length, setProviders]);

  // Filter: enabled + matching capability
  const matchingProviders = providers.filter(
    (p) =>
      p.enabled &&
      (p.capabilities as ProviderCapability[]).includes(cap)
  );

  // Fallback to Mock if no real providers
  const hasRealProviders = matchingProviders.length > 0;

  // Auto-select first matching provider; clear stale selection
  useEffect(() => {
    if (!composer.open) return;
    if (matchingProviders.length === 0) {
      setProviderId("");
      return;
    }
    const inList = matchingProviders.some((p) => p.id === providerId);
    if (!inList) {
      setProviderId(matchingProviders[0].id);
    }
  }, [composer.open, matchingProviders, providerId]);

  const selectedProvider = hasRealProviders
    ? providers.find((p) => p.id === providerId)
    : null;

  const effectiveModel = model || selectedProvider?.defaultModel || "";

  if (!composer.open) return null;

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    if (hasRealProviders && !providerId) {
      alert("请选择 Provider");
      return;
    }
    setSubmitting(true);
    try {
      console.log("[PromptComposer] handleSubmit", JSON.stringify({
        prompt: prompt.trim().slice(0, 60),
        actionType,
        selectedProviderId: providerId || "(mock)",
        selectedModel: effectiveModel || "(auto)",
        capability: cap,
        sourceShapeId: composer.sourceShapeId ?? "(none)",
        sourceAssetId: composer.sourceAssetId ?? "(none)",
      }));
      await executePromptGeneration({
        prompt: prompt.trim(),
        providerId: hasRealProviders ? providerId : "",
        model: effectiveModel || "gpt-image-2",
        size: `${ASPECT_RATIOS[aspect].w}x${ASPECT_RATIOS[aspect].h}`,
        quality,
        actionType,
        actionLabel: composer.actionLabel,
        sourceShapeId: composer.sourceShapeId ?? undefined,
        sourceAssetId: composer.sourceAssetId ?? undefined,
      });
      closePromptComposer();
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    closePromptComposer();
  };

  // Position
  const panelW = 640;
  let left = 200, top = 160;
  if (composer.sourceShapeId) {
    const bounds = editor.getShapePageBounds(composer.sourceShapeId);
    if (bounds) {
      const vp = editor.pageToViewport({ x: bounds.x + bounds.w + 48, y: bounds.y - 20 });
      left = vp.x; top = vp.y;
    }
  } else {
    const vp = editor.getViewportPageBounds();
    if (vp) {
      const center = editor.pageToViewport({ x: vp.x + vp.w / 2, y: vp.y + vp.h / 2 });
      left = center.x - panelW / 2; top = center.y - 210;
    }
  }

  // Capability tags for display
  const capabilityTags = selectedProvider
    ? (selectedProvider.capabilities as ProviderCapability[])
        .slice(0, 4)
        .map((c) => c === "text-to-image" ? "文生图" : c === "image-to-image" ? "图生图" : c === "image-to-video" ? "视频" : c)
    : [];

  return (
    <div
      data-prompt-composer
      className="pointer-events-auto absolute z-50 rounded-[18px] border border-white/[0.06] bg-[#101018]/98 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_1px_0_rgba(255,255,255,0.03)_inset] backdrop-blur-2xl"
      style={{ left, top, width: panelW }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <Sparkles size={14} className="text-indigo-400" />
          </div>
          <span className="text-[14px] font-semibold text-zinc-100">
            {composer.actionLabel || "AI 生成"}
          </span>
          {composer.sourceName && (
            <span className="text-[11px] text-zinc-500 ml-1 truncate max-w-[160px]">
              · {composer.sourceName}
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300"
          disabled={submitting}
        >
          <X size={15} />
        </button>
      </div>

      {/* Prompt area */}
      <div className="px-5 pb-4">
        <textarea
          className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl text-[13px] text-zinc-200 placeholder:text-zinc-600 p-4 h-[110px] resize-none outline-none focus:border-indigo-500/30 focus:bg-white/[0.03] transition-colors"
          placeholder="输入你想生成或修改的内容..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
      </div>

      {/* Provider + Model row */}
      <div className="px-5 pb-3 flex gap-3">
        {/* Provider selector */}
        <div className="flex-1">
          <label className="text-[10px] text-zinc-600 mb-1 block">Provider</label>
          {hasRealProviders ? (
            <select
              className="s-input s-select text-[11px] h-7"
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                const p = providers.find((x) => x.id === e.target.value);
                if (p?.defaultModel) setModel(p.defaultModel);
              }}
            >
              {matchingProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {PROVIDER_TYPE_LABELS[p.type] || p.type}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 h-7 px-2 rounded bg-white/[0.02] border border-white/[0.05]">
              <Zap size={10} className="text-zinc-500" />
              <span className="text-[11px] text-zinc-500">Mock Provider · 本地模拟</span>
            </div>
          )}
        </div>

        {/* Model input */}
        <div className="flex-1">
          <label className="text-[10px] text-zinc-600 mb-1 block">模型</label>
          <input
            className="s-input text-[11px] h-7"
            value={effectiveModel}
            onChange={(e) => setModel(e.target.value)}
            placeholder={selectedProvider?.defaultModel || "输入模型名"}
          />
        </div>
      </div>

      {/* Controls bar */}
      <div className="px-5 pb-3 flex items-center gap-3 flex-wrap">
        {/* Aspect ratio */}
        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5">
          {ASPECT_RATIOS.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setAspect(i)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] transition-colors ${
                aspect === i ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Quality */}
        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5">
          {QUALITIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] transition-colors ${
                quality === q ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2 py-1.5">
          {COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] transition-colors ${
                count === n ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-zinc-600 ml-auto">
          {ASPECT_RATIOS[aspect].w}×{ASPECT_RATIOS[aspect].h}
        </span>
      </div>

      {/* Call path + capability info */}
      <div className="px-5 pb-1 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-zinc-600">
          {hasRealProviders && selectedProvider
            ? `当前: ${selectedProvider.name} / ${effectiveModel || "—"} / ${capabilityTags.join(" / ")}`
            : "当前: Mock Provider / 模拟生成 / 不消耗 API"}
        </span>
      </div>

      {/* Generate button */}
      <div className="px-5 pb-4 flex items-center gap-2">
        <button
          className="s-btn s-btn-xs text-zinc-500 px-4"
          onClick={handleClose}
          disabled={submitting}
        >
          取消
        </button>
        <button
          className="flex-1 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-indigo-500/30 hover:text-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={submitting || !prompt.trim()}
        >
          {submitting ? (
            <><Loader2 size={14} className="animate-spin" />生成中...</>
          ) : (
            <><Sparkles size={14} />生成</>
          )}
        </button>
        <span className="text-[9px] text-zinc-700">⌘⏎</span>
      </div>
    </div>
  );
});
