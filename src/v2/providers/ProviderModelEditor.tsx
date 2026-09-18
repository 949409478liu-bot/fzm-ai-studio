"use client";

import { Trash2 } from "lucide-react";
import type { EditableProviderKind, ProviderModelEditorValue } from "./types";
import { ProviderAdvancedSettings } from "./ProviderAdvancedSettings";

interface ProviderModelEditorProps {
  kind: EditableProviderKind;
  model: ProviderModelEditorValue;
  index: number;
  onChange: (model: ProviderModelEditorValue) => void;
  onRemove: () => void;
}

function toggleCapability(model: ProviderModelEditorValue, capability: "image.generate" | "image.edit", checked: boolean): ProviderModelEditorValue {
  const next = checked ? [...new Set([...model.capabilities, capability])] : model.capabilities.filter((item) => item !== capability);
  return { ...model, capabilities: next };
}

export function ProviderModelEditor({ kind, model, index, onChange, onRemove }: ProviderModelEditorProps) {
  return (
    <section className="fzm-provider-model-card" aria-label={`Model ${index + 1}`}>
      <div className="fzm-provider-model-head">
        <strong>Model {index + 1}</strong>
        <button className="fzm-button fzm-icon-button" type="button" onClick={onRemove} aria-label="Remove Model"><Trash2 size={14} /></button>
      </div>
      <label className="fzm-provider-field">
        <span>Model ID</span>
        <input aria-label="Model ID" value={model.id} onChange={(event) => onChange({ ...model, id: event.target.value })} placeholder="gpt-image-2" />
      </label>
      <label className="fzm-provider-field">
        <span>Display Name</span>
        <input aria-label="Display Name" value={model.label} onChange={(event) => onChange({ ...model, label: event.target.value })} placeholder="Friendly model name" />
      </label>
      <div className="fzm-provider-capabilities" aria-label="Capabilities">
        <label><input type="checkbox" checked={model.capabilities.includes("image.generate")} onChange={(event) => onChange(toggleCapability(model, "image.generate", event.target.checked))} /> 文生图</label>
        <label><input type="checkbox" checked={model.capabilities.includes("image.edit")} onChange={(event) => onChange(toggleCapability(model, "image.edit", event.target.checked))} /> 图生图</label>
      </div>
      <ProviderAdvancedSettings kind={kind} model={model} onChange={onChange} />
    </section>
  );
}
