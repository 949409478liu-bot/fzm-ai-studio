import "server-only";
import type { ProviderKind } from "@/v2/types/domain";
import type { ProviderCapability, ProviderConfigRecord, ProviderModelDescriptor } from "./types";

const providerKinds = ["openai-compatible", "gptsapi", "moyu", "gemini-native", "custom"] as const;
const capabilities = ["image.generate", "image.edit"] as const;

type EditableProviderKind = (typeof providerKinds)[number];
type EditableCapability = (typeof capabilities)[number];

interface NormalizedProviderPayload {
  kind: ProviderKind;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  secret?: Record<string, unknown>;
  preserveSecret: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, error: string) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(error);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function validateUrlProtocol(baseUrl: string) {
  let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { throw new Error("invalid_base_url"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("invalid_base_url_protocol");
}

function normalizeKind(value: unknown): EditableProviderKind {
  if (typeof value !== "string" || !providerKinds.includes(value as EditableProviderKind)) throw new Error("invalid_provider_kind");
  return value as EditableProviderKind;
}

function normalizeCapabilities(value: unknown): EditableCapability[] {
  if (!Array.isArray(value)) throw new Error("invalid_model_capabilities");
  const unique = [...new Set(value.filter((item): item is EditableCapability => capabilities.includes(item as EditableCapability)))];
  if (unique.length === 0) throw new Error("model_capability_required");
  return unique;
}

function normalizeModelInternal(kind: EditableProviderKind, model: Record<string, unknown>, existing?: ProviderModelDescriptor) {
  if (kind === "openai-compatible") return { protocol: "openai-images" };
  if (kind === "gptsapi") {
    if (model.modelFamily !== "google" && model.modelFamily !== "openai" && existing?.internal) return existing.internal;
    const family = model.modelFamily === "google" ? "google" : "openai";
    return { providerPath: family };
  }
  if (kind === "moyu") {
    if (model.protocol !== "gemini-native" && model.protocol !== "openai-images" && existing?.internal) return existing.internal;
    const protocol = model.protocol === "gemini-native" ? "gemini-native" : "openai-images";
    return { protocol, ...(protocol === "gemini-native" ? { authMode: "bearer" } : {}) };
  }
  if (kind === "gemini-native") {
    if (model.authMode !== "bearer" && model.authMode !== "google-api-key" && existing?.internal) return existing.internal;
    const authMode = model.authMode === "bearer" ? "bearer" : model.authMode === "google-api-key" ? "query-key" : undefined;
    return { protocol: "gemini-native", ...(authMode ? { authMode } : {}) };
  }
  return {};
}

function normalizeModels(kind: EditableProviderKind, value: unknown, existingModels: ProviderModelDescriptor[] = []): ProviderModelDescriptor[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("invalid_models");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("invalid_model");
    const id = requiredString(item.id, "model_id_required");
    const label = optionalString(item.label) || optionalString(item.displayName) || id;
    const modelCapabilities = normalizeCapabilities(item.capabilities) as ProviderCapability[];
    const existing = existingModels.find((model) => model.id === id);
    return { id, label, capabilities: modelCapabilities, internal: normalizeModelInternal(kind, item, existing) };
  });
}

export function normalizeEditableProviderPayload(body: unknown, existing?: ProviderConfigRecord | null): NormalizedProviderPayload {
  if (!isRecord(body)) throw new Error("invalid_provider_payload");
  const kind = normalizeKind(body.kind ?? existing?.kind);
  const name = requiredString(body.name ?? existing?.name, "provider_name_required").slice(0, 120);
  const baseUrl = requiredString(body.baseUrl ?? existing?.config.baseUrl, "provider_base_url_required");
  validateUrlProtocol(baseUrl);
  const existingModels = existing?.kind === kind && Array.isArray(existing.config.models) ? existing.config.models as ProviderModelDescriptor[] : [];
  const models = normalizeModels(kind, body.models ?? existing?.config.models ?? [], existingModels);
  const apiKey = optionalString(body.apiKey);
  if (!existing && !apiKey) throw new Error("provider_api_key_required");
  const config = { baseUrl, models };
  return {
    kind,
    name,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing?.enabled ?? true,
    config,
    secret: apiKey ? { apiKey } : existing?.secret,
    preserveSecret: Boolean(existing && !apiKey),
  };
}

export function toProviderValidationResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "invalid_provider_payload";
  return Response.json({ error: message }, { status: 400 });
}
