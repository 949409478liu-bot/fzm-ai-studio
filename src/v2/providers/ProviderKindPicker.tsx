"use client";

import type { EditableProviderKind } from "./types";

export const providerKindLabels: Record<EditableProviderKind, string> = {
  "openai-compatible": "OpenAI Compatible",
  gptsapi: "GPTsAPI",
  moyu: "Moyu / Multi-protocol Relay",
  "gemini-native": "Gemini Native",
  custom: "Custom",
};

interface ProviderKindPickerProps {
  value: EditableProviderKind;
  onChange: (value: EditableProviderKind) => void;
}

export function ProviderKindPicker({ value, onChange }: ProviderKindPickerProps) {
  return (
    <label className="fzm-provider-field">
      <span>Provider Type</span>
      <select aria-label="Provider Type" value={value} onChange={(event) => onChange(event.target.value as EditableProviderKind)}>
        {Object.entries(providerKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
      </select>
    </label>
  );
}
