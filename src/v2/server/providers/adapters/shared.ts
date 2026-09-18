import "server-only";
import type { FetchedProviderOutput, ProviderModelDescriptor } from "../types";
import { ProviderAmbiguousSubmitError, ProviderBusyError, ProviderFatalError, ProviderPollError, ProviderRateLimitError } from "../errors";

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

export async function fetchOutputUrl(url: string, timeoutMs = 30000, headers: Record<string, string> = {}): Promise<FetchedProviderOutput> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
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

export function normalizeOpenAiBaseUrl(raw: string) {
  let url = raw.trim().replace(/\/+$/, "");
  for (const suffix of ["/chat/completions", "/images/generations", "/images/edits", "/images/variations", "/images"]) {
    if (url.endsWith(suffix)) { url = url.slice(0, -suffix.length); break; }
  }
  return url.replace(/\/+$/, "");
}

export function normalizeGeminiBaseUrl(raw: string) {
  let url = raw.trim().replace(/\/+$/, "");
  if (url.endsWith("/v1beta")) url = url.slice(0, -7);
  if (url.endsWith("/v1")) url = url.slice(0, -3);
  return url.replace(/\/+$/, "");
}

export function aspectRatioFromParams(params: Record<string, unknown>) {
  const width = Number(params.width || 1024);
  const height = Number(params.height || 1024);
  const key = `${width}x${height}`;
  return ({ "1024x1024": "1:1", "1536x864": "16:9", "864x1536": "9:16", "1280x960": "4:3", "960x1280": "3:4" } as Record<string, string>)[key] || "1:1";
}

export function sizeFromParams(params: Record<string, unknown>) {
  return `${Number(params.width || 1024)}x${Number(params.height || 1024)}`;
}

export function resolutionFromQuality(quality: unknown) {
  if (quality === "low") return "1K";
  if (quality === "high") return "4K";
  return "2K";
}

export async function classifySubmitResponse(response: Response) {
  if (response.status === 429) throw new ProviderRateLimitError("rate_limited", retryAfterMs(response));
  if (response.status === 503) throw new ProviderBusyError("provider_busy", retryAfterMs(response));
  if ([400, 401, 403, 404].includes(response.status)) throw new ProviderFatalError(`provider_fatal_${response.status}`);
  if (!response.ok) throw new ProviderFatalError(`provider_http_${response.status}`);
}

export function classifySubmitNetwork(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/abort|timeout|econnreset|socket|network|fetch failed/i.test(message)) throw new ProviderAmbiguousSubmitError(message);
  throw error;
}

export async function classifyPollResponse(response: Response) {
  if (response.status === 429) throw new ProviderPollError("poll_rate_limited");
  if (!response.ok) throw new ProviderPollError(`poll_http_${response.status}`);
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

export function parseOpenAiImageOutputs(body: unknown): Promise<FetchedProviderOutput[]> {
  return outputsFromJson(body);
}

export function parseGeminiOutputs(body: unknown): FetchedProviderOutput[] {
  const outputs: FetchedProviderOutput[] = [];
  const candidates = (body as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> }).candidates ?? [];
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data) outputs.push(outputFromBase64(data, part.inlineData?.mimeType || "image/png"));
    }
  }
  return outputs;
}
