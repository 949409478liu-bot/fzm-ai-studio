import "server-only";
import { getClientProviderConfigs, getProviderConfigById } from "@/lib/server/provider-config-store";
import type { ProviderKind } from "@/v2/types/domain";
import { getProviderConfig, upsertProviderConfig } from "./repository";

function mapCapability(value: string) {
  if (value === "text-to-image") return "image.generate";
  if (value === "image-to-image") return "image.edit";
  if (value === "text") return "text.generate";
  return null;
}

function classifyProvider(config: { id: string; name: string; type?: string; baseUrl?: string }): { kind: ProviderKind; enabled: boolean; warning?: string } {
  const type = String(config.type || "").toLowerCase();
  if (type === "gemini") return { kind: "gemini-native", enabled: true };
  if (type === "openai-compatible") return { kind: "openai-compatible", enabled: true };
  if (type === "openai") return { kind: "openai-compatible", enabled: true };
  if (type === "gptsapi") return { kind: "gptsapi", enabled: true };
  if (type === "moyu") return { kind: "moyu", enabled: true };
  return { kind: "custom", enabled: false, warning: "ambiguous legacy provider" };
}

export function importLegacyProviders(options: { overwrite?: boolean } = {}) {
  const imported = [];
  for (const clientConfig of getClientProviderConfigs()) {
    const runtime = getProviderConfigById(clientConfig.id);
    if (!runtime) continue;
    const existing = getProviderConfig(clientConfig.id);
    if (existing && !options.overwrite) {
      imported.push({ id: existing.id, status: "skipped-existing", kind: existing.kind });
      continue;
    }
    const classification = classifyProvider({ id: runtime.id, name: runtime.name, type: runtime.type, baseUrl: runtime.baseUrl });
    const capabilities = (runtime.capabilities || []).map(String).map(mapCapability).filter(Boolean);
    const models = (runtime.models || []).map((model) => ({
      id: model.name,
      label: model.label || model.name,
      capabilities: (model.capabilities || []).map(String).map(mapCapability).filter(Boolean),
      internal: { endpointMode: (model as unknown as Record<string, unknown>).endpointMode, providerPath: (model as unknown as Record<string, unknown>).providerPath },
    }));
    const provider = upsertProviderConfig({
      id: runtime.id,
      kind: classification.kind,
      name: runtime.name,
      enabled: Boolean(runtime.enabled) && classification.enabled,
      config: { baseUrl: runtime.baseUrl, defaultModel: runtime.defaultModel, capabilities, models, warning: classification.warning },
      secret: { apiKey: runtime.apiKey },
      preserveSecret: !options.overwrite,
    });
    imported.push({ id: provider.id, status: existing ? "overwritten" : "imported", kind: provider.kind, warning: classification.warning });
  }
  return imported;
}
