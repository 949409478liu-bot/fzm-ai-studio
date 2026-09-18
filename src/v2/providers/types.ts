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
