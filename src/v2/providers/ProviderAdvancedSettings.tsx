"use client";

import type { EditableProviderKind, ProviderModelEditorValue } from "./types";

interface ProviderAdvancedSettingsProps {
  kind: EditableProviderKind;
  model: ProviderModelEditorValue;
  onChange: (model: ProviderModelEditorValue) => void;
}

export function ProviderAdvancedSettings({ kind, model, onChange }: ProviderAdvancedSettingsProps) {
  if (kind !== "gptsapi" && kind !== "moyu" && kind !== "gemini-native") return null;
  return (
    <details className="fzm-provider-advanced">
      <summary>Advanced</summary>
      {kind === "gptsapi" ? (
        <label className="fzm-provider-field">
          <span>Model Family</span>
          <select aria-label="Model Family" value={model.modelFamily ?? "openai"} onChange={(event) => onChange({ ...model, modelFamily: event.target.value as "openai" | "google" })}>
            <option value="openai">OpenAI</option>
            <option value="google">Google</option>
          </select>
        </label>
      ) : null}
      {kind === "moyu" ? (
        <label className="fzm-provider-field">
          <span>API Protocol</span>
          <select aria-label="API Protocol" value={model.protocol ?? "openai-images"} onChange={(event) => onChange({ ...model, protocol: event.target.value as "openai-images" | "gemini-native" })}>
            <option value="openai-images">OpenAI Images</option>
            <option value="gemini-native">Gemini Native</option>
          </select>
        </label>
      ) : null}
      {kind === "gemini-native" ? (
        <label className="fzm-provider-field">
          <span>Auth</span>
          <select aria-label="Gemini Auth" value={model.authMode ?? "auto"} onChange={(event) => onChange({ ...model, authMode: event.target.value as "auto" | "bearer" | "google-api-key" })}>
            <option value="auto">Auto</option>
            <option value="bearer">Bearer</option>
            <option value="google-api-key">Google API Key</option>
          </select>
        </label>
      ) : null}
    </details>
  );
}
