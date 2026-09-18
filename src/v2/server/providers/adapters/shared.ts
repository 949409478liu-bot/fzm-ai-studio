import "server-only";
import type { FetchedProviderOutput, ProviderModelDescriptor } from "../types";

export function configuredModels(config: Record<string, unknown>, fallback: ProviderModelDescriptor[]) {
  const models = config.models;
  if (!Array.isArray(models)) return fallback;
  return models
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: String(item.id || item.model || ""),
      label: String(item.label || item.name || item.id || item.model || "Model"),
      capabilities: Array.isArray(item.capabilities) ? item.capabilities.map(String) : [],
      defaults: typeof item.defaults === "object" && item.defaults ? item.defaults as Record<string, unknown> : undefined,
      internal: typeof item.internal === "object" && item.internal ? item.internal as Record<string, unknown> : undefined,
    }))
    .filter((item) => item.id && item.capabilities.length > 0) as ProviderModelDescriptor[];
}

export async function fetchOutputUrl(url: string, timeoutMs = 30000): Promise<FetchedProviderOutput> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`result_download_failed_${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  return { bytes: Buffer.from(await response.arrayBuffer()), mimeType };
}

export function outputFromBase64(base64: string, mimeType = "image/png"): FetchedProviderOutput {
  return { bytes: Buffer.from(base64, "base64"), mimeType };
}

export async function outputsFromJson(value: unknown): Promise<FetchedProviderOutput[]> {
  const body = value as Record<string, unknown>;
  const data = Array.isArray(body.data) ? body.data : Array.isArray(body.outputs) ? body.outputs : [];
  const outputs: FetchedProviderOutput[] = [];
  for (const item of data as Array<Record<string, unknown>>) {
    if (typeof item.url === "string") outputs.push(await fetchOutputUrl(item.url));
    else if (typeof item.b64_json === "string") outputs.push(outputFromBase64(item.b64_json, typeof item.mimeType === "string" ? item.mimeType : "image/png"));
    else if (typeof item.base64 === "string") outputs.push(outputFromBase64(item.base64, typeof item.mimeType === "string" ? item.mimeType : "image/png"));
  }
  return outputs;
}

export function authHeaders(apiKey: unknown): Record<string, string> {
  return typeof apiKey === "string" && apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}
