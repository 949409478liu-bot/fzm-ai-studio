import "server-only";
import type { ProviderAdapter } from "../types";
import { ProviderValidationError } from "../errors";
import { aspectRatioFromParams, authHeaders, classifySubmitNetwork, classifySubmitResponse, configuredModels, normalizeGeminiBaseUrl, parseGeminiOutputs } from "./shared";

function body(prompt: string, references: Array<{ bytes: Buffer; mimeType: string }>, params: Record<string, unknown>) {
  return {
    contents: [{ parts: [...references.map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.bytes.toString("base64") } })), { text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspectRatioFromParams(params) } },
  };
}

export const geminiNativeAdapter: ProviderAdapter = {
  kind: "gemini-native",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [{ id: "gemini-3-pro-image-preview", label: "Gemini Image", capabilities: ["image.generate", "image.edit"], internal: { protocol: "gemini-native", authMode: "query-key" } }]);
  },
  async submit(context, request) {
    const apiKey = String(context.secret.apiKey || "");
    if (!apiKey) throw new ProviderValidationError("missing_api_key");
    const root = normalizeGeminiBaseUrl(String(context.config.baseUrl || "https://generativelanguage.googleapis.com"));
    const authMode = String(request.model.internal?.authMode || context.config.authMode || "query-key");
    const url = `${root}/v1beta/models/${encodeURIComponent(request.model.id)}:generateContent${authMode === "query-key" ? `?key=${encodeURIComponent(apiKey)}` : ""}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authMode === "bearer" ? authHeaders(apiKey) : {}) },
        body: JSON.stringify(body(request.prompt, request.references, request.params)),
        signal: AbortSignal.timeout(30000),
      });
    } catch (error) { classifySubmitNetwork(error); }
    await classifySubmitResponse(response!);
    const outputs = parseGeminiOutputs(await response.json());
    if (outputs.length === 0) throw new Error("gemini_no_outputs");
    return { mode: "completed", outputs };
  },
};
