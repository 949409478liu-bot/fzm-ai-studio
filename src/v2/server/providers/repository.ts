import "server-only";
import { randomUUID } from "node:crypto";
import type { ProviderKind } from "@/v2/types/domain";
import { getDb } from "@/v2/server/db/connection";
import type { ProviderCapability, ProviderClientDto, ProviderConfigRecord, ProviderModelDescriptor } from "./types";

function now() { return new Date().toISOString(); }
function parseJson<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }

function maskApiKey(value: unknown) {
  if (typeof value !== "string" || !value) return undefined;
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

export function mapProvider(row: Record<string, unknown>): ProviderConfigRecord {
  return {
    id: String(row.id),
    kind: String(row.kind) as ProviderKind,
    name: String(row.name),
    enabled: Number(row.enabled) === 1,
    config: parseJson(String(row.config_json), {}),
    secret: parseJson(String(row.secret_json), {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function listProviderConfigs(db = getDb()) {
  return db.prepare("SELECT * FROM provider_configs ORDER BY created_at ASC, id ASC").all().map((row) => mapProvider(row as Record<string, unknown>));
}

export function getProviderConfig(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM provider_configs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapProvider(row) : null;
}

export function providerHasGenerationHistory(id: string, db = getDb()) {
  const row = db.prepare("SELECT 1 FROM generations WHERE provider_id = ? LIMIT 1").get(id);
  return Boolean(row);
}

export function deleteProviderConfig(id: string, db = getDb()) {
  db.prepare("DELETE FROM provider_configs WHERE id = ?").run(id);
}

export function upsertProviderConfig(input: {
  id?: string;
  kind: ProviderKind;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  secret?: Record<string, unknown>;
  preserveSecret?: boolean;
}, db = getDb()) {
  const id = input.id || randomUUID();
  const existing = getProviderConfig(id, db);
  const timestamp = now();
  const secret = input.preserveSecret && existing ? existing.secret : (input.secret ?? existing?.secret ?? {});
  if (existing) {
    db.prepare("UPDATE provider_configs SET kind = ?, name = ?, enabled = ?, config_json = ?, secret_json = ?, updated_at = ? WHERE id = ?").run(
      input.kind,
      input.name,
      input.enabled ? 1 : 0,
      JSON.stringify(input.config),
      JSON.stringify(secret),
      timestamp,
      id,
    );
  } else {
    db.prepare("INSERT INTO provider_configs (id, kind, name, enabled, config_json, secret_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      id,
      input.kind,
      input.name,
      input.enabled ? 1 : 0,
      JSON.stringify(input.config),
      JSON.stringify(secret),
      timestamp,
      timestamp,
    );
  }
  return getProviderConfig(id, db)!;
}

export function providerToClientDto(provider: ProviderConfigRecord, models: ProviderModelDescriptor[]): ProviderClientDto {
  const publicModels = models.map(({ internal, ...model }) => {
    void internal;
    return model;
  });
  const capabilities = [...new Set(publicModels.flatMap((model) => model.capabilities))] as ProviderCapability[];
  return {
    id: provider.id,
    kind: provider.kind,
    name: provider.name,
    enabled: provider.enabled,
    baseUrl: typeof provider.config.baseUrl === "string" ? provider.config.baseUrl : undefined,
    apiKeyMasked: maskApiKey(provider.secret.apiKey),
    models: publicModels,
    capabilities,
    status: provider.enabled ? "configured" : "disabled",
  };
}
