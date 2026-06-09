import type { ResultType } from "@/types";

// ─── Provider identity ───────────────────────────────────────────────

export type ProviderName =
  | "mock"
  | "openai-compatible"
  | "gemini"
  | "openai"
  | "fal"
  | "comfyui"
  | "kling";

// ─── Provider config (multi-vendor) ──────────────────────────────────

export type ProviderType =
  | "openai"
  | "openai-compatible"
  | "gemini"
  | "fal"
  | "replicate"
  | "comfyui"
  | "kling"
  | "custom-http";

export type ProviderCapability =
  | "text"
  | "text-to-image"
  | "image-to-image"
  | "upscale"
  | "inpaint"
  | "remove-bg"
  | "image-to-video"
  | "text-to-video";

export type ProviderStatus =
  | "unconfigured"
  | "configured"
  | "ok"
  | "error";

export interface ProviderModelConfig {
  name: string;
  label?: string;
  capabilities: ProviderCapability[];
  endpointMode?: "openai-images" | "openai-chat" | "gemini-native" | "gptsapi-v3-image" | "custom";
  /** GPTsAPI v3: provider segment in API path, e.g. "openai" or "google" */
  providerPath?: string;
  defaultQuality?: "low" | "medium" | "high" | "auto";
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  capabilities: ProviderCapability[];
  models?: ProviderModelConfig[];
  enabled: boolean;
  status: ProviderStatus;
  lastTestAt?: string;
  errorMessage?: string;
}

/** Client-facing version — apiKey is never exposed, only a masked hint */
export interface ProviderConfigForClient {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKeyMasked?: string;
  defaultModel?: string;
  capabilities: ProviderCapability[];
  models?: ProviderModelConfig[];
  enabled: boolean;
  status: ProviderStatus;
  lastTestAt?: string;
  errorMessage?: string;
}

// ─── Provider type labels ────────────────────────────────────────────

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  openai: "OpenAI",
  "openai-compatible": "OpenAI Compatible",
  gemini: "Gemini",
  fal: "fal.ai",
  replicate: "Replicate",
  comfyui: "ComfyUI",
  kling: "Kling / 可灵",
  "custom-http": "自定义 HTTP",
};

export const CAPABILITY_LABELS: Record<ProviderCapability, string> = {
  text: "文本对话",
  "text-to-image": "文生图",
  "image-to-image": "图生图",
  upscale: "高清放大",
  inpaint: "局部重绘",
  "remove-bg": "去背景",
  "image-to-video": "图生视频",
  "text-to-video": "文生视频",
};

// ─── Request / Response (unchanged from V0.5) ────────────────────────

export interface ImageGenerationRequest {
  provider: ProviderName;
  model?: string;
  prompt?: string;
  quality?: string;
  referenceImage?: {
    assetId: string;
    url: string;
    width: number;
    height: number;
  };
  size: { width: number; height: number };
  count: number;
  actionType: ResultType;
}

export interface GeneratedAsset {
  url: string;
  width: number;
  height: number;
  mimeType?: string;
  /** Base64-encoded image data (server→client transfer, no Blob in JSON) */
  b64Json?: string;
}

export interface ImageGenerationResponse {
  assets: GeneratedAsset[];
  provider: ProviderName | string;
  model: string;
  metadata: {
    elapsed: number;
    seed?: number;
    size?: string;
  };
}

// ─── Provider adapter ────────────────────────────────────────────────

export interface ProviderAdapter {
  readonly name: ProviderName;
  generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResponse>;
}

// ─── Labels (legacy) ─────────────────────────────────────────────────

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  mock: "Mock（模拟）",
  "openai-compatible": "OpenAI Compatible",
  gemini: "Gemini / Nano Banana",
  openai: "OpenAI / GPT Image",
  fal: "fal.ai",
  comfyui: "ComfyUI",
  kling: "Kling",
};
