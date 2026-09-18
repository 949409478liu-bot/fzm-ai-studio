import "server-only";
import type { ProviderAdapter } from "../types";
import { ProviderValidationError } from "../errors";
import { configuredModels, outputsFromJson } from "./shared";

export const geminiNativeAdapter: ProviderAdapter = {
  kind: "gemini-native",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [{ id: "gemini-2.5-flash-image-preview", label: "Gemini Image", capabilities: ["image.generate", "image.edit"], internal: { protocol: "gemini-native" } }]);
  },
  async submit(context, request) {
    const apiKey = String(context.secret.apiKey || "");
    if (!apiKey) throw new ProviderValidationError("missing_api_key");
    const root = String(context.config.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    const response = await fetch(`${root}/v1beta/models/${encodeURIComponent(request.model.id)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: request.prompt }, ...request.references.map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.bytes.toString("base64") } }))] }], generationConfig: request.params }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`gemini_submit_failed_${response.status}`);
    const outputs = await outputsFromJson(await response.json());
    if (outputs.length === 0) throw new Error("gemini_no_outputs");
    return { mode: "completed", outputs };
  },
};
