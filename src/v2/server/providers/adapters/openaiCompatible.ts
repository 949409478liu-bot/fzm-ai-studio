import "server-only";
import type { ProviderAdapter } from "../types";
import { ProviderValidationError } from "../errors";
import { authHeaders, configuredModels, outputsFromJson } from "./shared";

export const openAiCompatibleAdapter: ProviderAdapter = {
  kind: "openai-compatible",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [{ id: "gpt-image-1", label: "OpenAI Compatible Image", capabilities: ["image.generate", "image.edit"] }]);
  },
  async submit(context, request) {
    const baseUrl = String(context.config.baseUrl || "").replace(/\/$/, "");
    if (!baseUrl) throw new ProviderValidationError("missing_base_url");
    const response = await fetch(`${baseUrl}/images/${request.action === "image.edit" ? "edits" : "generations"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(context.secret.apiKey) },
      body: JSON.stringify({ model: request.model.id, prompt: request.prompt, references: request.references.map((ref) => ({ mimeType: ref.mimeType, data: ref.bytes.toString("base64") })), ...request.params }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`openai_compatible_submit_failed_${response.status}`);
    const outputs = await outputsFromJson(await response.json());
    if (outputs.length === 0) throw new Error("openai_compatible_no_outputs");
    return { mode: "completed", outputs };
  },
};
