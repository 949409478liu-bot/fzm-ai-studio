"use client";

import { useState, useEffect } from "react";
import { track } from "@tldraw/tldraw";
import { X, Sparkles, Loader2, ImageIcon, Video, Droplets, Scissors } from "lucide-react";
import { useStudioStore } from "@/lib/store";
import type { ProviderCapability } from "@/lib/providers/types";
import { resolveGenerationRoute } from "@/lib/canvas-actions";
import type { ResultType } from "@/types";

const ASPECT_RATIOS = [
  { label: "1:1", w: 1024, h: 1024 },
  { label: "16:9", w: 1536, h: 864 },
  { label: "9:16", w: 864, h: 1536 },
  { label: "4:3", w: 1280, h: 960 },
  { label: "3:4", w: 960, h: 1280 },
] as const;

const QUALITIES = ["low", "medium", "high"] as const;
const COUNTS = [1, 2, 4] as const;

type BarAction = {
  type: ResultType | "text-to-image";
  label: string;
  icon: typeof Sparkles;
  needsSource: boolean;
};

const IMAGE_ACTIONS: BarAction[] = [
  { type: "img2img", label: "参考图生图", icon: ImageIcon, needsSource: true },
  { type: "clean", label: "洗图优化", icon: Droplets, needsSource: true },
  { type: "removeBg", label: "去背景", icon: Scissors, needsSource: true },
  { type: "video", label: "图生视频", icon: Video, needsSource: true },
];

const NO_IMAGE_ACTIONS: BarAction[] = [
  { type: "text-to-image", label: "文生图", icon: Sparkles, needsSource: false },
  { type: "video", label: "文生视频", icon: Video, needsSource: false },
];

export const BottomPromptBar = track(() => {
  const bar = useStudioStore((s) => s.bottomPromptBar);
  const closeBottomPromptBar = useStudioStore((s) => s.closeBottomPromptBar);
  const openBottomPromptBar = useStudioStore((s) => s.openBottomPromptBar);
  const providers = useStudioStore((s) => s.providers);
  const setProviders = useStudioStore((s) => s.setProviders);
  const executePromptGeneration = useStudioStore((s) => s.executePromptGeneration);

  // Refresh providers from API every time the bar opens
  const [providerLoading, setProviderLoading] = useState(false);
  useEffect(() => {
    if (!bar.open) return;
    setProviderLoading(true);
    fetch("/api/settings/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers || []))
      .catch(() => {})
      .finally(() => setProviderLoading(false));
  }, [bar.open, setProviders]);

  const [prompt, setPrompt] = useState("");
  const [providerId, setProviderId] = useState("");
  const [model, setModel] = useState("");
  const [aspect, setAspect] = useState(0);
  const [quality, setQuality] = useState<string>("low");
  const [count, setCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  if (!bar.open) return null;

  const hasSource = !!bar.sourceAssetId;
  const actionType = bar.actionType;
  const route = resolveGenerationRoute(actionType, hasSource);
  const cap = route.requiredCapability as ProviderCapability;

  const availableActions = hasSource ? IMAGE_ACTIONS : NO_IMAGE_ACTIONS;

  // Filter providers only after loading completes
  const matchingProviders = !providerLoading
    ? providers.filter(
        (p) => p.enabled && (p.capabilities as ProviderCapability[]).includes(cap)
      )
    : [];
  const hasRealProviders = !providerLoading && matchingProviders.length > 0;
  const selectedProvider = hasRealProviders
    ? providers.find((p) => p.id === providerId) || matchingProviders[0]
    : null;
  const effectiveModel = model || selectedProvider?.defaultModel || "";

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    // Guard: edit actions require source image
    const editActions = ["img2img", "clean", "removeBg", "video"];
    if (editActions.includes(actionType) && !hasSource) {
      alert("请先引用一张图片。点击画布中的图片后再操作。");
      return;
    }
    // Guard: real providers available but none selected
    if (hasRealProviders && !providerId && !matchingProviders.some((p) => p.id === providerId)) {
      setProviderId(matchingProviders[0]?.id || "");
    }

    // Guard: reject label/placeholder names
    const labelKeywords = ["标签", "Prompt", "placeholder", "指令", "占位", "失败"];
    for (const kw of labelKeywords) {
      if (bar.sourceName.includes(kw)) {
        alert(`当前选中的是${kw}节点，不是真实图片。请选择图片节点。`);
        return;
      }
    }

    console.log("[BottomPromptBar submit reference]", {
      actionType,
      sourceShapeId: bar.sourceShapeId,
      sourceAssetId: bar.sourceAssetId,
      sourceName: bar.sourceName,
      sourceWidth: bar.sourceWidth,
      sourceHeight: bar.sourceHeight,
      hasSourceUrl: !!bar.sourceUrl,
      route: route.endpoint,
    });

    setSubmitting(true);
    try {
      await executePromptGeneration({
        prompt: prompt.trim(),
        providerId: hasRealProviders ? (providerId || matchingProviders[0]?.id || "") : "",
        model: effectiveModel,
        size: `${ASPECT_RATIOS[aspect].w}x${ASPECT_RATIOS[aspect].h}`,
        quality,
        actionType,
        actionLabel: bar.actionLabel,
        sourceShapeId: bar.sourceShapeId ?? undefined,
        sourceAssetId: bar.sourceAssetId ?? undefined,
      });
      closeBottomPromptBar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成失败");
    } finally {
      setSubmitting(false);
    }
  };

  const switchAction = (a: BarAction) => {
    openBottomPromptBar({ actionType: a.type, actionLabel: a.label });
  };

  return (
    <div
      data-bottom-prompt-bar
      className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-[20px] border border-white/[0.06] bg-[#0d0d16]/98 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
      style={{ width: "min(70%, 1100px)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Top: Action tabs + reference */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          {availableActions.map((a) => (
            <button
              key={a.type}
              onClick={() => switchAction(a)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                actionType === a.type
                  ? "bg-indigo-500/15 text-indigo-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <a.icon size={13} />
              {a.label}
            </button>
          ))}
        </div>

        {/* Reference image thumbnail */}
        {hasSource && (
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
            <div className="w-8 h-8 rounded-md bg-black/40 border border-white/[0.05] flex items-center justify-center overflow-hidden">
              {bar.sourceUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bar.sourceUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={12} className="text-zinc-600" />
              )}
            </div>
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-medium">已引用</p>
              <p className="text-[11px] text-zinc-300 truncate max-w-[140px]">{bar.sourceName}</p>
            </div>
            <button
              className="p-1 rounded hover:bg-white/[0.05] text-zinc-500 hover:text-red-400"
              onClick={() => {
                // Remove reference: clear source + switch to text-to-image
                openBottomPromptBar({
                  sourceShapeId: undefined, sourceAssetId: undefined,
                  sourceName: "", sourceUrl: "", sourceWidth: 0, sourceHeight: 0,
                  actionType: "text-to-image", actionLabel: "文生图",
                });
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        <button
          onClick={closeBottomPromptBar}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 ml-2"
        >
          <X size={15} />
        </button>
      </div>

      {/* Prompt textarea */}
      <div className="px-4 pt-2 pb-3">
        <textarea
          className="w-full bg-white/[0.015] border border-white/[0.04] rounded-xl text-[13px] text-zinc-200 placeholder:text-zinc-600 p-3.5 h-[90px] resize-none outline-none focus:border-indigo-500/25 focus:bg-white/[0.02] transition-colors"
          placeholder={hasSource ? "输入你想基于这张图修改或生成的内容..." : "输入你想生成的画面..."}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
      </div>

      {/* Controls row */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        {/* Provider */}
        <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] text-zinc-500">Provider</span>
          {providerLoading ? (
            <span className="text-[11px] text-zinc-500 animate-pulse">正在加载 Provider...</span>
          ) : hasRealProviders ? (
            <select
              className="bg-transparent text-[11px] text-zinc-300 outline-none cursor-pointer"
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                const p = providers.find((x) => x.id === e.target.value);
                // Only auto-fill model if user hasn't manually typed one
                if (p?.defaultModel && !model) setModel(p.defaultModel);
              }}
            >
              {matchingProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-[11px] text-zinc-500">Mock</span>
          )}
        </div>

        {/* Model */}
        <input
          className="bg-white/[0.02] border border-white/[0.05] rounded-lg text-[11px] text-zinc-300 outline-none px-2.5 py-1.5 w-36"
          value={effectiveModel}
          onChange={(e) => setModel(e.target.value)}
          placeholder="模型名"
        />

        {/* Aspect ratio */}
        <div className="flex items-center gap-0.5 bg-white/[0.02] border border-white/[0.05] rounded-lg px-1.5 py-1">
          {ASPECT_RATIOS.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setAspect(i)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                aspect === i ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Quality */}
        <div className="flex items-center gap-0.5 bg-white/[0.02] border border-white/[0.05] rounded-lg px-1.5 py-1">
          {QUALITIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                quality === q ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="flex items-center gap-0.5 bg-white/[0.02] border border-white/[0.05] rounded-lg px-1.5 py-1">
          {COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                count === n ? "bg-indigo-500/15 text-indigo-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Generate button */}
        <button
          className="h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[12px] font-medium flex items-center justify-center gap-1.5 px-5 hover:bg-indigo-500/30 hover:text-indigo-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
          onClick={handleSubmit}
          disabled={submitting || !prompt.trim() || providerLoading}
        >
          {submitting ? (
            <><Loader2 size={13} className="animate-spin" />生成中...</>
          ) : (
            <><Sparkles size={13} />生成</>
          )}
        </button>
        <span className="text-[9px] text-zinc-700">⌘⏎</span>
      </div>

      {/* No-matching-provider warning */}
      {!hasRealProviders && (
        <div className="px-4 pb-2">
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-2">
            <p className="text-[10px] text-amber-400/80">
              当前没有支持「{bar.actionLabel}」的真实 Provider。
              请到 API 配置中心给对应 Provider 勾选 {cap === "text-to-image" ? "文生图" : cap === "image-to-image" ? "图生图" : cap} 能力，
              或将 Provider 启用。当前将使用 Mock 生成。
            </p>
          </div>
        </div>
      )}
      {/* Route info */}
      <div className="px-4 pb-3 flex items-center gap-2">
        <span className="text-[10px] text-zinc-600">
          当前：{bar.actionLabel} · {route.endpoint === "edits" ? "图生图编辑" : "文生图"} · {hasRealProviders ? (selectedProvider?.name || "—") : "Mock"}
        </span>
      </div>
    </div>
  );
});
