import type { ProviderDto, ProviderEditorPayload } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) throw Object.assign(new Error("request_failed"), { response, body });
  return body;
}

export async function listProviders() {
  return parseJson<{ providers: ProviderDto[] }>(await fetch("/api/v2/providers", { cache: "no-store" }));
}

export async function importV1Providers() {
  return parseJson<{ imported: Array<{ id: string; status: string; kind: string; warning?: string }> }>(await fetch("/api/v2/providers/import-v1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }));
}

export async function testProvider(providerId: string) {
  return parseJson<{ result: { ok: boolean; message: string; testMode: string } }>(await fetch(`/api/v2/providers/${providerId}/test`, { method: "POST" }));
}

export async function createProvider(payload: ProviderEditorPayload) {
  return parseJson<{ provider: ProviderDto }>(await fetch("/api/v2/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
}

export async function updateProvider(providerId: string, payload: Partial<ProviderEditorPayload>) {
  return parseJson<{ provider: ProviderDto }>(await fetch(`/api/v2/providers/${providerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
}

export async function deleteProvider(providerId: string) {
  return parseJson<{ ok: boolean }>(await fetch(`/api/v2/providers/${providerId}`, { method: "DELETE" }));
}
