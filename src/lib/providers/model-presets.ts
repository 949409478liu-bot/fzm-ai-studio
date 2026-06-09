/**
 * Built-in model presets (V0.5.5.11).
 *
 * Every known model's capabilities and API protocol are defined here.
 * The config store auto-injects matching presets into provider configs
 * so users never need to fill in endpointMode / providerPath / capabilities.
 */
import type { ProviderConfig, ProviderModelConfig } from "./types";

// ─── Preset definition ─────────────────────────────────────────────────

export interface ModelPreset {
  /** Match provider whose baseUrl contains this keyword */
  providerKeyword: string;
  /** Model name (used as API identifier) */
  name: string;
  /** Display label */
  label: string;
  capabilities: ProviderModelConfig["capabilities"];
  endpointMode: ProviderModelConfig["endpointMode"];
  /** GPTsAPI v3 only: provider segment in API path */
  providerPath?: string;
}

// ─── All known presets ──────────────────────────────────────────────────

export const ALL_MODEL_PRESETS: ModelPreset[] = [
  // ── 魔芋中转 ──────────────────────────────────────────────────────
  {
    providerKeyword: "moyu",
    name: "gpt-image-2",
    label: "GPT-Image-2",
    capabilities: ["text-to-image", "image-to-image", "inpaint"],
    endpointMode: "openai-images",
  },
  {
    providerKeyword: "moyu",
    name: "gemini-3-pro-image-preview",
    label: "Gemini 3 Pro Image Preview",
    capabilities: ["text-to-image", "image-to-image"],
    endpointMode: "gemini-native",
  },

  // ── GPTsAPI ───────────────────────────────────────────────────────
  {
    providerKeyword: "gptsapi",
    name: "gpt-image-2",
    label: "GPTsAPI GPT-Image-2",
    capabilities: ["text-to-image"],
    endpointMode: "gptsapi-v3-image",
    providerPath: "openai",
  },
  {
    providerKeyword: "gptsapi",
    name: "gemini-3.1-flash-image-preview",
    label: "GPTsAPI Gemini 3.1 Flash Image",
    capabilities: ["text-to-image"],
    endpointMode: "gptsapi-v3-image",
    providerPath: "google",
  },
  {
    providerKeyword: "gptsapi",
    name: "gemini-3-pro-image-preview",
    label: "GPTsAPI Gemini 3 Pro Image",
    capabilities: ["text-to-image"],
    endpointMode: "gptsapi-v3-image",
    providerPath: "google",
  },
];

// ─── Matching logic ─────────────────────────────────────────────────────

function keywordFromConfig(config: ProviderConfig): string {
  const haystack = `${config.baseUrl || ""} ${config.name || ""}`.toLowerCase();
  return haystack;
}

/**
 * Find all presets that match a given provider config.
 * A preset matches if the provider's baseUrl or name contains the preset's keyword.
 */
export function findMatchingPresets(config: ProviderConfig): ModelPreset[] {
  const haystack = keywordFromConfig(config);
  return ALL_MODEL_PRESETS.filter((p) => haystack.includes(p.providerKeyword));
}

/**
 * Convert matched presets to ProviderModelConfig.
 * If the provider already has a model with the same name, keep existing fields
 * but backfill missing ones from the preset.
 */
export function presetsToModelConfigs(
  presets: ModelPreset[],
  existing: ProviderModelConfig[] | undefined
): ProviderModelConfig[] {
  const existingMap = new Map((existing || []).map((m) => [m.name, m]));

  return presets.map((preset) => {
    const existing = existingMap.get(preset.name);
    return {
      name: preset.name,
      label: existing?.label || preset.label,
      capabilities: preset.capabilities,
      endpointMode: preset.endpointMode,
      providerPath: preset.providerPath,
      defaultQuality: existing?.defaultQuality,
    };
  });
}
