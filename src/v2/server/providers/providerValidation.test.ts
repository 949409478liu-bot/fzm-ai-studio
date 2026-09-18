import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDbForTests, getDb } from "@/v2/server/db/connection";
import { deleteProviderConfig, getProviderConfig, providerHasGenerationHistory, providerToClientDto, upsertProviderConfig } from "./repository";
import { normalizeEditableProviderPayload } from "./providerValidation";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-v2-provider-editor-"));
  process.env.FZM_V2_DATA_DIR = dir;
  closeDbForTests();
});

afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.FZM_V2_DATA_DIR;
});

function payload(overrides: Record<string, unknown> = {}) {
  return normalizeEditableProviderPayload({
    name: "Example Relay",
    kind: "openai-compatible",
    enabled: true,
    baseUrl: " http://localhost:9999/v1 ",
    apiKey: "secret-1234",
    models: [{ id: "test-image-model", label: "Test Image", capabilities: ["image.generate"] }],
    ...overrides,
  });
}

describe("provider editor validation", () => {
  it("PE01 creates a provider with server-owned config shape", () => {
    const provider = upsertProviderConfig(payload());
    expect(provider.id).toBeTruthy();
    expect(provider.name).toBe("Example Relay");
    expect(provider.secret.apiKey).toBe("secret-1234");
    expect(provider.config.baseUrl).toBe("http://localhost:9999/v1");
  });

  it("PE02/PE03 updates name and baseUrl", () => {
    const provider = upsertProviderConfig(payload());
    const update = normalizeEditableProviderPayload({ name: "Renamed", baseUrl: "https://example.invalid/v1" }, provider);
    const saved = upsertProviderConfig({ id: provider.id, ...update });
    expect(saved.name).toBe("Renamed");
    expect(saved.config.baseUrl).toBe("https://example.invalid/v1");
  });

  it("PE04 replaces key and PE05 preserves key when empty", () => {
    const provider = upsertProviderConfig(payload());
    const replaced = upsertProviderConfig({ id: provider.id, ...normalizeEditableProviderPayload({ apiKey: "new-secret-5678" }, provider) });
    expect(replaced.secret.apiKey).toBe("new-secret-5678");
    const preserved = upsertProviderConfig({ id: provider.id, ...normalizeEditableProviderPayload({ name: "Preserve", apiKey: "" }, replaced) });
    expect(preserved.secret.apiKey).toBe("new-secret-5678");
  });

  it("PE06/PE07/PE08 adds edits and removes models", () => {
    const provider = upsertProviderConfig(payload({ models: [{ id: "a", label: "A", capabilities: ["image.generate"] }] }));
    const edited = upsertProviderConfig({ id: provider.id, ...normalizeEditableProviderPayload({ models: [{ id: "b", label: "B", capabilities: ["image.generate", "image.edit"] }] }, provider) });
    expect(edited.config.models).toEqual([{ id: "b", label: "B", capabilities: ["image.generate", "image.edit"], internal: { protocol: "openai-images" } }]);
    const removed = upsertProviderConfig({ id: provider.id, ...normalizeEditableProviderPayload({ models: [] }, edited) });
    expect(removed.config.models).toEqual([]);
  });

  it("PE09 disables provider", () => {
    const provider = upsertProviderConfig(payload());
    const disabled = upsertProviderConfig({ id: provider.id, ...normalizeEditableProviderPayload({ enabled: false }, provider) });
    expect(disabled.enabled).toBe(false);
  });

  it("PE10/PE11 returns masked browser DTO without raw key", () => {
    const provider = upsertProviderConfig(payload({ apiKey: "raw-secret-9999" }));
    const dto = providerToClientDto(provider, provider.config.models as never[]);
    expect(dto.apiKeyMasked).toBe("****9999");
    expect(JSON.stringify(dto)).not.toContain("raw-secret");
    expect(JSON.stringify(dto)).not.toContain("internal");
  });

  it("PE12 rejects invalid URL protocols", () => {
    expect(() => payload({ baseUrl: "file:///tmp/provider" })).toThrow("invalid_base_url_protocol");
  });

  it("PE13 rejects delete when provider is referenced by generations", () => {
    const provider = upsertProviderConfig(payload());
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO projects (id, name, viewport_json, revision, created_at, updated_at) VALUES ('p', 'p', '{}', 0, ?, ?)").run(now, now);
    db.prepare("INSERT INTO generations (id, project_id, request_id, action, provider_id, model_id, prompt, references_json, params_json, status, created_at, updated_at) VALUES ('g', 'p', 'r', 'image.generate', ?, 'm', 'prompt', '[]', '{}', 'queued', ?, ?)").run(provider.id, now, now);
    expect(providerHasGenerationHistory(provider.id)).toBe(true);
    expect(() => deleteProviderConfig(provider.id)).toThrow();
    expect(getProviderConfig(provider.id)).not.toBeNull();
  });
});
