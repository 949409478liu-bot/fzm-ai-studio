"use client";

import { useEffect, useState, useCallback } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useStudioStore } from "@/lib/store";
import {
  Sparkles,
  Plus,
  Trash2,
  Check,
  Globe,
  Key,
  Box,
} from "lucide-react";
import type {
  ProviderConfigForClient,
  ProviderType,
  ProviderStatus,
} from "@/lib/providers/types";
import { PROVIDER_TYPE_LABELS } from "@/lib/providers/types";

const STATUS_ICONS: Record<ProviderStatus, string> = {
  unconfigured: "○",
  configured: "●",
  ok: "✓",
  error: "✗",
};
const STATUS_COLORS: Record<ProviderStatus, string> = {
  unconfigured: "text-zinc-600",
  configured: "text-zinc-400",
  ok: "text-emerald-400",
  error: "text-red-400",
};

const CAPABILITY_TAGS: Record<string, string> = {
  "text-to-image": "文生图",
  "image-to-image": "图生图",
  "inpaint": "局部重绘",
  "remove-bg": "去背景",
  "text": "文本",
  "upscale": "放大",
  "image-to-video": "图生视频",
  "text-to-video": "文生视频",
};

export function ApiSettingsDialog() {
  const isOpen = useStudioStore((s) => s.isApiSettingsOpen);
  const setOpen = useStudioStore((s) => s.setApiSettingsOpen);

  const [providers, setProviders] = useState<ProviderConfigForClient[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Form state — only user-facing fields, no engineering fields
  const [form, setForm] = useState({
    name: "",
    type: "openai-compatible" as ProviderType,
    baseUrl: "",
    apiKey: "",
    defaultModel: "",
    enabled: true,
  });

  // Load providers when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/settings/providers");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setProviders(data.providers || []);
          useStudioStore.getState().setProviders(data.providers || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        useStudioStore.getState().setProviders(data.providers || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Select a provider and populate form
  const selectProvider = (id: string) => {
    setSelectedId(id);
    const p = providers.find((c) => c.id === id);
    if (p) {
      setForm({
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl || "",
        apiKey: "",
        defaultModel: p.defaultModel || "",
        enabled: p.enabled,
      });
    }
  };

  // Start adding a new provider
  const startNew = () => {
    setSelectedId("");
    setForm({
      name: "",
      type: "openai-compatible",
      baseUrl: "",
      apiKey: "",
      defaultModel: "",
      enabled: true,
    });
  };

  // Save current form
  const handleSave = async () => {
    if (!form.name.trim()) return alert("请输入 Provider 名称");

    const id = selectedId || `custom-${Date.now()}`;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: form.name.trim(),
          type: form.type,
          baseUrl: form.baseUrl.trim() || undefined,
          apiKey: form.apiKey.trim() || undefined,
          defaultModel: form.defaultModel.trim() || undefined,
          enabled: form.enabled,
        }),
      });
      if (res.ok) {
        await loadProviders();
        setSelectedId(id);
      } else {
        alert("保存失败");
      }
    } catch {
      alert("保存请求失败");
    } finally {
      setSaving(false);
    }
  };

  // Test connection
  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId || `test-${Date.now()}`,
          name: form.name.trim() || "未命名",
          type: form.type,
          baseUrl: form.baseUrl.trim() || undefined,
          apiKey: form.apiKey.trim() || undefined,
          defaultModel: form.defaultModel.trim() || undefined,
          enabled: form.enabled,
        }),
      });
      const result = await res.json();
      alert(result.message || (result.ok ? "测试通过" : "测试失败"));
      if (res.ok) await loadProviders();
    } catch {
      alert("测试请求失败");
    } finally {
      setTesting(false);
    }
  };

  // Delete provider
  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("确认删除此 Provider？")) return;
    try {
      await fetch(`/api/settings/providers/${selectedId}`, {
        method: "DELETE",
      });
      await loadProviders();
      setSelectedId("");
      startNew();
    } catch {
      alert("删除失败");
    }
  };

  const selected = providers.find((p) => p.id === selectedId);
  const presetModels = selected?.models || [];

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <div className="relative flex flex-col" style={{ minHeight: 480 }}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-zinc-100">
              API 配置中心
            </h2>
            <p className="text-[11px] text-zinc-500">
              管理多平台 Provider · 模型能力由系统自动识别
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-1 min-h-0">

          {/* ── Left: Provider list ── */}
          <div className="w-44 shrink-0 flex flex-col gap-1 overflow-y-auto">
            {loading && (
              <p className="text-[11px] text-zinc-600 px-2 py-4 text-center">
                加载中...
              </p>
            )}
            {!loading &&
              providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectProvider(p.id)}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors ${
                    selectedId === p.id
                      ? "bg-indigo-500/10 text-zinc-200 ring-1 ring-indigo-500/20"
                      : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                  }`}
                >
                  <span className={`text-[10px] ${STATUS_COLORS[p.status]}`}>
                    {STATUS_ICONS[p.status]}
                  </span>
                  <span className="truncate flex-1">{p.name}</span>
                </button>
              ))}
            <div className="border-t border-white/[0.04] mt-1 pt-1">
              <button
                onClick={startNew}
                className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12px] w-full transition-colors ${
                  !selectedId
                    ? "bg-indigo-500/10 text-zinc-200 ring-1 ring-indigo-500/20"
                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <Plus size={12} />
                添加 Provider
              </button>
            </div>
          </div>

          {/* ── Right: Config form ── */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {!selectedId && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Globe size={24} className="text-zinc-600 mb-2" />
                <p className="text-[12px] text-zinc-500">
                  选择一个 Provider 或添加新的
                </p>
              </div>
            )}

            {(selectedId || !loading) && (
              <div className="space-y-3">
                {/* Name & Type */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1 block">
                      显示名称
                    </label>
                    <input
                      className="s-input text-[12px]"
                      placeholder="例如：魔芋中转站"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="w-36">
                    <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1 block">
                      类型
                    </label>
                    <select
                      className="s-input s-select text-[12px]"
                      value={form.type}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          type: e.target.value as ProviderType,
                        }))
                      }
                    >
                      {(
                        Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[]
                      ).map((t) => (
                        <option key={t} value={t}>
                          {PROVIDER_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Base URL */}
                <div>
                  <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1 block">
                    Base URL
                  </label>
                  <input
                    className="s-input text-[12px]"
                    placeholder={
                      form.type === "comfyui"
                        ? "http://127.0.0.1:8188"
                        : form.type === "openai"
                          ? "https://api.openai.com/v1"
                          : "https://your-proxy.com/v1"
                    }
                    value={form.baseUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, baseUrl: e.target.value }))
                    }
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1 block flex items-center gap-1.5">
                    <Key size={10} />
                    API Key
                    {selected?.apiKeyMasked && (
                      <span className="text-zinc-600 font-normal normal-case tracking-normal ml-1">
                        (已配置: {selected.apiKeyMasked})
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    className="s-input text-[12px]"
                    placeholder={
                      selected?.apiKeyMasked
                        ? "留空则保留现有 Key"
                        : "输入 API Key"
                    }
                    value={form.apiKey}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                  />
                </div>

                {/* Default Model */}
                <div>
                  <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1 block">
                    默认模型
                  </label>
                  <input
                    className="s-input text-[12px]"
                    placeholder="例如: gpt-image-2"
                    value={form.defaultModel}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, defaultModel: e.target.value }))
                    }
                  />
                  {presetModels.length > 0 && (
                    <p className="text-[10px] text-zinc-600 mt-1">
                      可选模型见下方列表
                    </p>
                  )}
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
                    启用
                  </label>
                  <button
                    onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                    className={`relative w-8 h-4 rounded-full transition-colors ${
                      form.enabled ? "bg-indigo-500/60" : "bg-white/[0.08]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                        form.enabled ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Preset models (read-only display) */}
                {presetModels.length > 0 && (
                  <div>
                    <label className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mb-1.5 block flex items-center gap-1.5">
                      <Box size={10} />
                      系统识别模型
                      <span className="normal-case tracking-normal text-zinc-500 ml-1">
                        (能力由系统自动配置)
                      </span>
                    </label>
                    <div className="space-y-1">
                      {presetModels.map((m) => (
                        <div
                          key={m.name}
                          className="flex items-center gap-2 rounded-md bg-white/[0.02] border border-white/[0.04] px-2.5 py-1.5"
                        >
                          <span className="text-[11px] text-zinc-300 flex-1">
                            {m.label || m.name}
                          </span>
                          {m.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="rounded bg-indigo-500/8 text-[9px] text-indigo-300/70 px-1.5 py-0.5"
                            >
                              {CAPABILITY_TAGS[cap] || cap}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                  <div className="flex gap-1.5">
                    <button
                      className="s-btn s-btn-xs text-zinc-500"
                      onClick={handleTest}
                      disabled={testing}
                    >
                      {testing ? (
                        <span className="inline-block w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      {testing ? "测试中..." : "测试连接"}
                    </button>
                    <button
                      className="s-btn s-btn-xs s-btn-primary"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                  </div>
                  {selectedId && (
                    <button
                      className="s-btn s-btn-ghost s-btn-xs text-zinc-600 hover:text-red-400 gap-1"
                      onClick={handleDelete}
                    >
                      <Trash2 size={11} />
                      删除
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
