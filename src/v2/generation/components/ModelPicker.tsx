"use client";

import type { ProviderCapability } from "@/v2/providers/types";
import { useProviderStore } from "@/v2/providers/providerStore";

interface ModelPickerProps {
  capability: ProviderCapability;
  providerId: string | null;
  modelId: string | null;
  onChange: (modelId: string) => void;
}

export function ModelPicker({ capability, providerId, modelId, onChange }: ModelPickerProps) {
  const provider = useProviderStore((state) => state.providers.find((item) => item.id === providerId));
  const models = provider?.models.filter((model) => model.capabilities.includes(capability)) ?? [];
  return (
    <label className="fzm-prompt-select">
      <span>Model</span>
      <select aria-label="Model" value={modelId ?? ""} onChange={(event) => onChange(event.target.value)} disabled={!providerId}>
        <option value="" disabled>选择 Model</option>
        {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
      </select>
    </label>
  );
}
