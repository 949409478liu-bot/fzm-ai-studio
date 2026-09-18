export type ProviderCapability = "image.generate" | "image.edit" | "text.generate" | "video.generate" | "video.image-to-video";

export interface ProviderModelDto {
  id: string;
  label: string;
  capabilities: ProviderCapability[];
  defaults?: Record<string, unknown>;
}

export interface ProviderDto {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  baseUrl?: string;
  apiKeyMasked?: string;
  models: ProviderModelDto[];
  capabilities: ProviderCapability[];
  status: string;
}

export type EditableProviderKind = "openai-compatible" | "gptsapi" | "moyu" | "gemini-native" | "custom";

export interface ProviderModelEditorValue {
  id: string;
  label: string;
  capabilities: Array<"image.generate" | "image.edit">;
  modelFamily?: "openai" | "google";
  protocol?: "openai-images" | "gemini-native";
  authMode?: "auto" | "bearer" | "google-api-key";
}

export interface ProviderEditorPayload {
  name: string;
  kind: EditableProviderKind;
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  models: ProviderModelEditorValue[];
}
