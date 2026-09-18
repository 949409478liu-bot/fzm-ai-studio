"use client";

import type { ProviderCapability } from "@/v2/providers/types";
import { useProviderStore } from "@/v2/providers/providerStore";
import { useMemo } from "react";

interface ProviderPickerProps {
  capability: ProviderCapability;
  providerId: string | null;
  onChange: (providerId: string) => void;
}

export function ProviderPicker({ capability, providerId, onChange }: ProviderPickerProps) {
  const allProviders = useProviderStore((state) => state.providers);
  const providers = useMemo(() => allProviders.filter((provider) => provider.enabled && provider.models.some((model) => model.capabilities.includes(capability))), [allProviders, capability]);
  return (
    <label className="fzm-prompt-select">
      <span>Provider</span>
      <select aria-label="Provider" value={providerId ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>选择 Provider</option>
        {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
      </select>
    </label>
  );
}
