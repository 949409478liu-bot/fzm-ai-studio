import "server-only";
import type { ProviderAdapter, ProviderContext, ProviderGenerationRequest } from "../types";
import { ProviderValidationError } from "../errors";
import { aspectRatioFromParams, authHeaders, classifyPollResponse, classifySubmitNetwork, classifySubmitResponse, configuredModels, fetchOutputUrl, outputFromBase64, resolutionFromQuality } from "./shared";

function nested(value: unknown, ...path: string[]) {
  let current = value as Record<string, unknown> | undefined;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key] as Record<string, unknown> | undefined;
  }
  return current;
}

export function normalizeGptsApiRoot(baseUrl: string) {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (url.endsWith("/v1")) url = url.slice(0, -3);
  return url.replace(/\/+$/, "");
}

function buildBody(providerPath: string, request: ProviderGenerationRequest) {
  const aspectRatio = aspectRatioFromParams(request.params);
  if (providerPath === "google") return { prompt: request.prompt, aspect_ratio: aspectRatio, output_format: "png" };
  return { prompt: request.prompt, aspect_ratio: aspectRatio, resolution: resolutionFromQuality(request.params.quality) };
}

async function parseGptsApiOutputs(body: unknown, auth: Record<string, string>) {
  const outputRoot = nested(body, "data", "outputs") ?? (body as Record<string, unknown>).outputs ?? (body as Record<string, unknown>).output;
  const candidates = Array.isArray(outputRoot) ? outputRoot : outputRoot == null ? [] : [outputRoot];
  const outputs = [];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("http")) outputs.push(await fetchOutputUrl(candidate, 30000, auth));
    else if (candidate && typeof candidate === "object") {
      const item = candidate as Record<string, unknown>;
      if (typeof item.url === "string") outputs.push(await fetchOutputUrl(item.url, 30000, auth));
      if (typeof item.b64_json === "string") outputs.push(outputFromBase64(item.b64_json, typeof item.mimeType === "string" ? item.mimeType : "image/png"));
    }
  }
  const directUrl = nested(body, "data", "url") ?? (body as Record<string, unknown>).url ?? nested(body, "data", "urls", "get") ?? nested(body, "urls", "get");
  if (typeof directUrl === "string") outputs.push(await fetchOutputUrl(directUrl, 30000, auth));
  const directB64 = nested(body, "data", "b64_json") ?? (body as Record<string, unknown>).b64_json;
  if (typeof directB64 === "string") outputs.push(outputFromBase64(directB64));
  return outputs;
}

export const gptsapiAdapter: ProviderAdapter = {
  kind: "gptsapi",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [
      { id: "gpt-image-2", label: "GPTsAPI GPT Image", capabilities: ["image.generate"], internal: { providerPath: "openai" } },
      { id: "gemini-3.1-flash-image-preview", label: "GPTsAPI Gemini Flash Image", capabilities: ["image.generate"], internal: { providerPath: "google" } },
      { id: "gemini-3-pro-image-preview", label: "GPTsAPI Gemini Pro Image", capabilities: ["image.generate"], internal: { providerPath: "google" } },
    ]);
  },
  async submit(context: ProviderContext, request: ProviderGenerationRequest) {
    if (request.action === "image.edit") throw new ProviderValidationError("gptsapi_image_edit_unsupported");
    const baseUrl = normalizeGptsApiRoot(String(context.config.baseUrl || ""));
    if (!baseUrl) throw new ProviderValidationError("missing_base_url");
    const providerPath = String(request.model.internal?.providerPath || context.config.providerPath || "openai");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v3/${providerPath}/${encodeURIComponent(request.model.id)}/text-to-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(context.secret.apiKey) },
        body: JSON.stringify(buildBody(providerPath, request)),
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) { classifySubmitNetwork(error); }
    await classifySubmitResponse(response!);
    const body = await response.json() as Record<string, unknown>;
    const remoteTaskId = String(body.taskId || body.id || body.remoteTaskId || nested(body, "data", "id") || "");
    const pollUrl = String(body.pollUrl || body.poll_url || nested(body, "data", "urls", "get") || "");
    if (!remoteTaskId || !pollUrl) throw new Error("gptsapi_missing_task");
    return { mode: "async", remoteTaskId, ticket: { pollUrl, providerPath, remoteTaskId }, nextPollMs: 3000 };
  },
  async poll(context, ticket) {
    const pollUrl = String(ticket.pollUrl || "");
    if (!pollUrl) throw new Error("missing_poll_url");
    const auth = authHeaders(context.secret.apiKey);
    let response: Response;
    try { response = await fetch(pollUrl, { headers: auth, signal: AbortSignal.timeout(30000) }); } catch { throw new (await import("../errors")).ProviderPollError("poll_network_error"); }
    await classifyPollResponse(response);
    const body = await response.json() as Record<string, unknown>;
    const status = String(body.status || nested(body, "data", "status") || body.state || nested(body, "data", "state") || "").toLowerCase();
    if (["succeeded", "success", "completed", "done"].includes(status)) return { status: "succeeded", ticket, outputs: await parseGptsApiOutputs(body, auth) };
    if (["failed", "error", "canceled"].includes(status)) return { status: "failed", error: String(body.error || status) };
    return { status: "pending", progress: typeof body.progress === "number" ? body.progress : undefined, ticket, nextPollMs: 3000 };
  },
  async fetchResult() {
    throw new Error("gptsapi_result_requires_poll_payload");
  },
};
