"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, TestTube2, X } from "lucide-react";
import { importV1Providers, listProviders, testProvider, updateProvider } from "./providerApi";
import type { ProviderDto } from "./types";

interface ProviderSettingsProps {
  open: boolean;
  onClose: () => void;
}

export function ProviderSettings({ open, onClose }: ProviderSettingsProps) {
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const body = await listProviders();
      setProviders(body.providers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) void Promise.resolve().then(refresh); }, [open, refresh]);
  if (!open) return null;

  return (
    <aside className="fzm-provider-drawer fzm-floating" aria-label="Provider settings">
      <div className="fzm-asset-drawer__head">
        <strong><KeyRound size={15} /> Provider Settings</strong>
        <button className="fzm-button fzm-icon-button" type="button" onClick={onClose} aria-label="Close providers"><X size={15} /></button>
      </div>
      <div className="fzm-provider-actions">
        <button className="fzm-button" type="button" disabled={loading} onClick={refresh}><RefreshCw size={14} /> Refresh</button>
        {providers.length === 0 ? <button className="fzm-button" type="button" onClick={async () => { const result = await importV1Providers(); setMessage(`${result.imported.length} legacy providers processed`); await refresh(); }}>Import Existing Providers</button> : null}
      </div>
      {message ? <p className="fzm-provider-message">{message}</p> : null}
      <div className="fzm-provider-list">
        {providers.map((provider) => (
          <section className="fzm-provider-card" key={provider.id}>
            <div>
              <strong>{provider.name}</strong>
              <span>{provider.kind} · {provider.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <dl>
              <dt>Base URL</dt><dd>{provider.baseUrl || "default"}</dd>
              <dt>API Key</dt><dd>{provider.apiKeyMasked || "not set"}</dd>
              <dt>Capabilities</dt><dd>{provider.capabilities.join(", ") || "none"}</dd>
              <dt>Models</dt><dd>{provider.models.map((model) => model.label).join(", ") || "none"}</dd>
            </dl>
            <div className="fzm-provider-actions">
              <button className="fzm-button" type="button" onClick={async () => { await updateProvider(provider.id, { enabled: !provider.enabled }); await refresh(); }}>{provider.enabled ? "Disable" : "Enable"}</button>
              <button className="fzm-button" type="button" onClick={async () => { const result = await testProvider(provider.id); setMessage(`${provider.name}: ${result.result.ok ? "PASS" : "FAIL"} (${result.result.testMode})`); }}><TestTube2 size={14} /> Test</button>
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
