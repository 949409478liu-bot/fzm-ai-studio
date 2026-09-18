"use client";

import { Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { createProvider, deleteProvider, testProvider, updateProvider } from "./providerApi";
import { ProviderKindPicker, providerKindLabels } from "./ProviderKindPicker";
import { ProviderModelEditor } from "./ProviderModelEditor";
import type { EditableProviderKind, ProviderDto, ProviderEditorPayload, ProviderModelEditorValue } from "./types";

interface ProviderEditorProps {
  provider: ProviderDto | null;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
  onDeleted: (message: string) => Promise<void>;
}

const blankModel = (): ProviderModelEditorValue => ({ id: "", label: "", capabilities: ["image.generate"] });

const gptsApiModels = (): ProviderModelEditorValue[] => [
  { id: "gpt-image-2", label: "GPT Image", capabilities: ["image.generate"], modelFamily: "openai" },
  { id: "gemini-3.1-flash-image-preview", label: "Gemini Flash Image", capabilities: ["image.generate"], modelFamily: "google" },
  { id: "gemini-3-pro-image-preview", label: "Gemini Pro Image", capabilities: ["image.generate"], modelFamily: "google" },
];

function modelsFromProvider(provider: ProviderDto | null): ProviderModelEditorValue[] {
  return provider?.models.map((model) => ({ id: model.id, label: model.label, capabilities: model.capabilities.filter((capability): capability is "image.generate" | "image.edit" => capability === "image.generate" || capability === "image.edit") })) ?? [];
}

function kindFromProvider(provider: ProviderDto | null): EditableProviderKind {
  if (provider?.kind === "openai-compatible" || provider?.kind === "gptsapi" || provider?.kind === "moyu" || provider?.kind === "gemini-native" || provider?.kind === "custom") return provider.kind;
  return "openai-compatible";
}

export function ProviderEditor({ provider, onCancel, onSaved, onDeleted }: ProviderEditorProps) {
  const [name, setName] = useState(provider?.name ?? "");
  const [kind, setKind] = useState<EditableProviderKind>(kindFromProvider(provider));
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [models, setModels] = useState<ProviderModelEditorValue[]>(modelsFromProvider(provider));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyTemplate = (template: EditableProviderKind | "blank") => {
    if (template === "blank") {
      setName("");
      setKind("custom");
      setModels([]);
      return;
    }
    setKind(template);
    if (template === "gptsapi") {
      setName("GPTsAPI Relay");
      setModels(gptsApiModels());
    } else if (template === "moyu") {
      setName("Multi-protocol Image Relay");
      setModels([]);
    } else if (template === "gemini-native") {
      setName("Gemini Native");
      setModels([]);
    } else if (template === "openai-compatible") {
      setName("OpenAI Compatible Relay");
      setModels([]);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const payload: ProviderEditorPayload = { name, kind, enabled, baseUrl, models, ...(apiKey.trim() ? { apiKey } : {}) };
    try {
      if (provider) await updateProvider(provider.id, payload);
      else await createProvider(payload);
      setApiKey("");
      await onSaved(provider ? "Provider saved" : "Provider created");
    } catch (error) {
      const body = (error as { body?: { error?: string } }).body;
      setMessage(body?.error ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!provider) return;
    try {
      await deleteProvider(provider.id);
      await onDeleted("Provider deleted");
    } catch (error) {
      const body = (error as { body?: { error?: string } }).body;
      setMessage(body?.error === "provider_in_use" ? "该 Provider 已有生成历史，请停用而不是删除。" : body?.error ?? "Delete failed");
    }
  };

  const runTest = async () => {
    if (!provider) return;
    const result = await testProvider(provider.id);
    setMessage(`${result.result.ok ? "PASS" : "INFO"}: ${result.result.message}`);
  };

  return (
    <section className="fzm-provider-editor" aria-label="Provider Editor">
      <div className="fzm-provider-editor-head">
        <div>
          <strong>{provider ? "Edit Provider" : "Add Provider"}</strong>
          {provider?.apiKeyMasked ? <span>Saved key: {provider.apiKeyMasked}</span> : null}
        </div>
        <button className="fzm-button" type="button" onClick={onCancel}>Back</button>
      </div>
      {!provider ? (
        <div className="fzm-provider-template-row" aria-label="Provider templates">
          <button className="fzm-button" type="button" onClick={() => applyTemplate("openai-compatible")}>OpenAI Compatible</button>
          <button className="fzm-button" type="button" onClick={() => applyTemplate("gptsapi")}>GPTsAPI</button>
          <button className="fzm-button" type="button" onClick={() => applyTemplate("moyu")}>Moyu-compatible</button>
          <button className="fzm-button" type="button" onClick={() => applyTemplate("gemini-native")}>Gemini Native</button>
          <button className="fzm-button" type="button" onClick={() => applyTemplate("blank")}>Blank Custom</button>
        </div>
      ) : null}
      <label className="fzm-provider-field">
        <span>Name</span>
        <input aria-label="Provider Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Example Relay" />
      </label>
      <ProviderKindPicker value={kind} onChange={setKind} />
      <label className="fzm-provider-field">
        <span>Base URL</span>
        <input aria-label="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://example.com/v1" />
        <small>填写服务商提供的 API 根地址</small>
      </label>
      <label className="fzm-provider-field">
        <span>API Key</span>
        <div className="fzm-provider-key-row">
          <input aria-label="API Key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider?.apiKeyMasked ? provider.apiKeyMasked : "Required for new providers"} />
          <button className="fzm-button fzm-icon-button" type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "Hide secret" : "Show secret"}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        </div>
      </label>
      <label className="fzm-provider-toggle"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
      <div className="fzm-provider-models-head">
        <strong>Models</strong>
        <button className="fzm-button" type="button" onClick={() => setModels((items) => [...items, blankModel()])}><Plus size={14} /> Add Model</button>
      </div>
      {models.length === 0 ? <p className="fzm-provider-message">未配置模型</p> : null}
      <div className="fzm-provider-model-list">
        {models.map((model, index) => (
          <ProviderModelEditor key={index} kind={kind} model={model} index={index} onChange={(next) => setModels((items) => items.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => setModels((items) => items.filter((_, itemIndex) => itemIndex !== index))} />
        ))}
      </div>
      {message ? <p className="fzm-provider-message">{message}</p> : null}
      <div className="fzm-provider-actions">
        <button className="fzm-button fzm-provider-save" type="button" disabled={saving} onClick={save}><Save size={14} /> Save Provider</button>
        {provider ? <button className="fzm-button" type="button" onClick={runTest}>Test</button> : null}
        {provider ? <button className="fzm-button" type="button" onClick={remove}><Trash2 size={14} /> Delete</button> : null}
      </div>
      <p className="fzm-provider-message">Type: {providerKindLabels[kind]}. Save only stores configuration; it never calls the provider.</p>
    </section>
  );
}
