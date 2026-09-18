"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, RefreshCw, X } from "lucide-react";
import { importV1Providers, updateProvider } from "./providerApi";
import { ProviderEditor } from "./ProviderEditor";
import { providerKindLabels } from "./ProviderKindPicker";
import { useProviderStore } from "./providerStore";
import type { ProviderDto } from "./types";

interface ProviderSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function ProviderSettings({ open, onClose }: ProviderSettingsProps) {
  const providers = useProviderStore((state) => state.providers);
  const refreshProviders = useProviderStore((state) => state.refresh);
  const loading = useProviderStore((state) => state.loading);
  const [message, setMessage] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderDto | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    await refreshProviders();
  }, [refreshProviders]);

  useEffect(() => { if (open) void Promise.resolve().then(refresh); }, [open, refresh]);
  if (!open) return null;

  const refreshWithMessage = async (nextMessage: string) => {
    await refresh();
    setMessage(nextMessage);
    setEditingProvider(undefined);
  };

  return (
    <aside className="fzm-provider-drawer fzm-floating" aria-label="Provider settings">
      <div className="fzm-asset-drawer__head">
        <strong><KeyRound size={15} /> Provider Settings</strong>
        <button className="fzm-button fzm-icon-button" type="button" onClick={onClose} aria-label="Close providers"><X size={15} /></button>
      </div>
      <div className="fzm-provider-actions">
        <button className="fzm-button" type="button" disabled={loading} onClick={refresh}><RefreshCw size={14} /> Refresh</button>
        <button className="fzm-button" type="button" onClick={() => setEditingProvider(null)}><Plus size={14} /> Add Provider</button>
        {providers.length === 0 ? <button className="fzm-button" type="button" onClick={async () => { const result = await importV1Providers(); setMessage(`${result.imported.length} legacy providers processed`); await refresh(); }}>Import Existing Providers</button> : null}
      </div>
      {message ? <p className="fzm-provider-message">{message}</p> : null}
      {editingProvider !== undefined ? <ProviderEditor key={editingProvider?.id ?? "new-provider"} provider={editingProvider} onCancel={() => setEditingProvider(undefined)} onSaved={refreshWithMessage} onDeleted={refreshWithMessage} /> : null}
      <div className="fzm-provider-list">
        {providers.map((provider) => (
          <section className="fzm-provider-card" key={provider.id}>
            <div className="fzm-provider-card-head">
              <button className="fzm-provider-card-title" type="button" onClick={() => setEditingProvider(provider)}>
                <strong>{provider.name}</strong>
                <span>{providerKindLabels[provider.kind as keyof typeof providerKindLabels] ?? provider.kind} · {provider.enabled ? "Enabled" : "Disabled"}</span>
              </button>
            </div>
            <dl>
              <dt>Base URL</dt><dd>{provider.baseUrl || "default"}</dd>
              <dt>API Key</dt><dd>{provider.apiKeyMasked || "not set"}</dd>
              <dt>Capabilities</dt><dd>{provider.capabilities.join(", ") || "none"}</dd>
              <dt>Models</dt><dd>{provider.models.map((model) => model.label).join(", ") || "未配置模型"}</dd>
            </dl>
            <div className="fzm-provider-actions">
              <button className="fzm-button" type="button" onClick={async () => { await updateProvider(provider.id, { enabled: !provider.enabled }); await refresh(); }}>{provider.enabled ? "Disable" : "Enable"}</button>
              <button className="fzm-button" type="button" onClick={() => setEditingProvider(provider)}>Edit</button>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
