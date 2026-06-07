import type { ProviderAdapter, ProviderName } from "./types";
import { mockProvider } from "./mock";

// ─── Provider registry ────────────────────────────────────────────────
// Register providers here. Currently only mock is active.
// Reserved slots for future real providers:
//   gemini:  import { geminiProvider } from "./gemini"
//   openai:  import { openaiProvider } from "./openai"
//   fal:     import { falProvider } from "./fal"
//   comfyui: import { comfyuiProvider } from "./comfyui"
//   kling:   import { klingProvider } from "./kling"

const registry: Partial<Record<ProviderName, ProviderAdapter>> = {
  mock: mockProvider,
};

export function getProvider(name: ProviderName): ProviderAdapter {
  const adapter = registry[name];
  if (!adapter) {
    throw new Error(
      `未找到 Provider "${name}"。可用 Provider：${Object.keys(registry).join("、")}`
    );
  }
  return adapter;
}

export function listAvailableProviders(): ProviderName[] {
  return Object.keys(registry) as ProviderName[];
}

export function registerProvider(
  name: ProviderName,
  adapter: ProviderAdapter
) {
  registry[name] = adapter;
}
