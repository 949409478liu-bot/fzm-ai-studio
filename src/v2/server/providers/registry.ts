import "server-only";
import type { ProviderKind } from "@/v2/types/domain";
import { ProviderValidationError } from "./errors";
import { getProviderConfig, listProviderConfigs, providerToClientDto } from "./repository";
import type { ProviderAdapter, ProviderCapability, ProviderClientDto, ProviderConfigRecord, ProviderContext, ProviderModelDescriptor } from "./types";
import { gptsapiAdapter } from "./adapters/gptsapi";
import { moyuAdapter } from "./adapters/moyu";
import { geminiNativeAdapter } from "./adapters/geminiNative";
import { openAiCompatibleAdapter } from "./adapters/openaiCompatible";

const adapters = new Map<ProviderKind, ProviderAdapter>([
  ["gptsapi", gptsapiAdapter],
  ["moyu", moyuAdapter],
  ["gemini-native", geminiNativeAdapter],
  ["openai-compatible", openAiCompatibleAdapter],
]);

export class ProviderRegistry {
  resolve(kind: ProviderKind) {
    const adapter = adapters.get(kind);
    if (!adapter) throw new ProviderValidationError("unsupported_provider_kind");
    return adapter;
  }

  context(provider: ProviderConfigRecord): ProviderContext {
    return { provider, config: provider.config, secret: provider.secret };
  }

  async listModels(provider: ProviderConfigRecord) {
    return this.resolve(provider.kind).listModels(this.context(provider));
  }

  async listClientProviders(): Promise<ProviderClientDto[]> {
    const providers = listProviderConfigs();
    return Promise.all(providers.map(async (provider) => providerToClientDto(provider, await this.listModels(provider))));
  }

  async validatePaidRequest(input: { providerId: string; modelId: string; action: ProviderCapability; referenceCount: number }) {
    const provider = getProviderConfig(input.providerId);
    if (!provider) throw new ProviderValidationError("provider_not_found");
    if (!provider.enabled) throw new ProviderValidationError("provider_disabled");
    const models = await this.listModels(provider);
    const model = models.find((item) => item.id === input.modelId);
    if (!model) throw new ProviderValidationError("model_not_found");
    if (!model.capabilities.includes(input.action)) throw new ProviderValidationError("capability_not_supported");
    const maxReferences = typeof model.internal?.maxReferences === "number" ? model.internal.maxReferences : input.action === "image.edit" ? 1 : 0;
    if (input.action === "image.edit" && input.referenceCount < 1) throw new ProviderValidationError("image_edit_requires_reference");
    if (input.referenceCount > maxReferences) throw new ProviderValidationError("too_many_references");
    return { provider, adapter: this.resolve(provider.kind), model };
  }

  stripInternal(model: ProviderModelDescriptor) {
    const { internal, ...publicModel } = model;
    void internal;
    return publicModel;
  }
}

const globalForRegistry = globalThis as typeof globalThis & { __fzmV2ProviderRegistry?: ProviderRegistry };

export function getProviderRegistry() {
  globalForRegistry.__fzmV2ProviderRegistry ??= new ProviderRegistry();
  return globalForRegistry.__fzmV2ProviderRegistry;
}
