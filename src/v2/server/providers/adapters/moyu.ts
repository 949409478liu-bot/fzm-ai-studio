import "server-only";
import type { ProviderAdapter } from "../types";
import { ProviderValidationError } from "../errors";
import { authHeaders, configuredModels, outputsFromJson } from "./shared";

export const moyuAdapter: ProviderAdapter = {
  kind: "moyu",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [
      { id: "gpt-image-1", label: "Moyu OpenAI Images", capabilities: ["image.generate", "image.edit"], internal: { protocol: "openai-images" } },
      { id: "gemini-2.5-flash-image-preview", label: "Moyu Gemini Image", capabilities: ["image.generate", "image.edit"], internal: { protocol: "gemini-native" } },
    ]);
  },
  async submit(context, request) {
    const baseUrl = String(context.config.baseUrl || "").replace(/\/$/, "");
    if (!baseUrl) throw new ProviderValidationError("missing_base_url");
    const protocol = String(request.model.internal?.protocol || "openai-images");
    const endpoint = protocol === "gemini-native" ? `${baseUrl}/v1beta/models/${encodeURIComponent(request.model.id)}:generateContent` : `${baseUrl}/v1/images/${request.action === "image.edit" ? "edits" : "generations"}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(context.secret.apiKey) },
      body: JSON.stringify({ model: request.model.id, prompt: request.prompt, references: request.references.map((ref) => ({ mimeType: ref.mimeType, data: ref.bytes.toString("base64"), role: ref.role })), ...request.params }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`moyu_submit_failed_${response.status}`);
    const outputs = await outputsFromJson(await response.json());
    if (outputs.length === 0) throw new Error("moyu_no_outputs");
    return { mode: "completed", outputs };
  },
};
