import "server-only";
import type { ProviderAdapter, ProviderContext, ProviderGenerationRequest } from "../types";
import { ProviderValidationError } from "../errors";
import { authHeaders, configuredModels, fetchOutputUrl, outputFromBase64, outputsFromJson } from "./shared";

export const gptsapiAdapter: ProviderAdapter = {
  kind: "gptsapi",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [{ id: "gpt-image-1", label: "GPTsAPI Image", capabilities: ["image.generate"], internal: { providerPath: "openai" } }]);
  },
  async submit(context: ProviderContext, request: ProviderGenerationRequest) {
    if (request.action === "image.edit") throw new ProviderValidationError("gptsapi_image_edit_unsupported");
    const baseUrl = String(context.config.baseUrl || "").replace(/\/$/, "");
    if (!baseUrl) throw new ProviderValidationError("missing_base_url");
    const providerPath = String(request.model.internal?.providerPath || context.config.providerPath || "openai");
    const response = await fetch(`${baseUrl}/api/v3/${providerPath}/${encodeURIComponent(request.model.id)}/text-to-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(context.secret.apiKey) },
      body: JSON.stringify({ prompt: request.prompt, ...request.params }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`gptsapi_submit_failed_${response.status}`);
    const body = await response.json() as Record<string, unknown>;
    const remoteTaskId = String(body.taskId || body.id || body.remoteTaskId || "");
    const pollUrl = String(body.pollUrl || body.poll_url || "");
    if (!remoteTaskId || !pollUrl) throw new Error("gptsapi_missing_task");
    return { mode: "async", remoteTaskId, ticket: { pollUrl, providerPath, remoteTaskId }, nextPollMs: 3000 };
  },
  async poll(context, ticket) {
    const pollUrl = String(ticket.pollUrl || "");
    if (!pollUrl) throw new Error("missing_poll_url");
    const response = await fetch(pollUrl, { headers: authHeaders(context.secret.apiKey), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`gptsapi_poll_failed_${response.status}`);
    const body = await response.json() as Record<string, unknown>;
    const status = String(body.status || body.state || "").toLowerCase();
    const nextTicket = { ...ticket, result: body };
    if (["succeeded", "success", "completed", "done"].includes(status)) return { status: "succeeded", ticket: nextTicket };
    if (["failed", "error", "canceled"].includes(status)) return { status: "failed", error: String(body.error || status) };
    return { status: "pending", progress: typeof body.progress === "number" ? body.progress : undefined, ticket: nextTicket, nextPollMs: 3000 };
  },
  async fetchResult(_context, ticket) {
    const result = ticket.result as Record<string, unknown> | undefined;
    const outputs = await outputsFromJson(result || {});
    if (outputs.length > 0) return outputs;
    if (typeof result?.url === "string") return [await fetchOutputUrl(result.url)];
    if (typeof result?.b64_json === "string") return [outputFromBase64(result.b64_json)];
    throw new Error("gptsapi_no_outputs");
  },
};
