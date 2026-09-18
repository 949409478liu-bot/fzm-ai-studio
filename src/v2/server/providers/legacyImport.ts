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

type LegacyModel = { endpointMode?: string; providerPath?: string; name?: string; label?: string };

function classifyProvider(config: { id: string; name: string; type?: string; baseUrl?: string; models?: LegacyModel[] }): { kind: ProviderKind; enabled: boolean; warning?: string } {
  const type = String(config.type || "").toLowerCase();
  const models = config.models ?? [];
  if (models.some((model) => model.endpointMode === "gptsapi-v3-image" || model.providerPath === "google" || model.providerPath === "openai" && String(config.baseUrl || "").includes("gptsapi"))) return { kind: "gptsapi", enabled: true };
  const baseUrl = String(config.baseUrl || "").toLowerCase();
  if (type === "moyu" || baseUrl.includes("moyu.info") || models.some((model) => ["gpt-image-2", "gemini-3-pro-image-preview"].includes(String(model.name)) && (model.endpointMode === "openai-images" || model.endpointMode === "gemini-native"))) return { kind: "moyu", enabled: true };
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
    const legacyModels = (runtime.models || []).map((model) => model as unknown as LegacyModel);
    const classification = classifyProvider({ id: runtime.id, name: runtime.name, type: runtime.type, baseUrl: runtime.baseUrl, models: legacyModels });
    const capabilities = (runtime.capabilities || []).map(String).map(mapCapability).filter(Boolean);
    const models = (runtime.models || []).map((model) => ({
      id: model.name,
      label: model.label || model.name,
      capabilities: (model.capabilities || []).map(String).map(mapCapability).filter(Boolean),
      internal: mapInternal(classification.kind, model as unknown as LegacyModel),
    })).filter((model) => model.id && model.capabilities.length > 0);
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

function mapInternal(kind: ProviderKind, model: LegacyModel) {
  if (kind === "gptsapi") return { providerPath: model.providerPath || "openai" };
  if (kind === "moyu") return { protocol: model.endpointMode === "gemini-native" ? "gemini-native" : "openai-images", authMode: model.endpointMode === "gemini-native" ? "bearer" : undefined };
  if (kind === "gemini-native") return { protocol: "gemini-native", authMode: "bearer" };
  return {};
}
