import "server-only";
import type { ProviderAdapter } from "../types";
import { ProviderValidationError } from "../errors";
import { aspectRatioFromParams, authHeaders, classifySubmitNetwork, classifySubmitResponse, configuredModels, normalizeGeminiBaseUrl, normalizeOpenAiBaseUrl, parseGeminiOutputs, parseOpenAiImageOutputs, sizeFromParams } from "./shared";

function openAiBody(model: string, prompt: string, params: Record<string, unknown>) {
  return { model, prompt, n: Number(params.count || 1), size: sizeFromParams(params), quality: String(params.quality || "auto") };
}

function geminiBody(prompt: string, references: Array<{ bytes: Buffer; mimeType: string }>, params: Record<string, unknown>) {
  return {
    contents: [{ parts: [...references.map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.bytes.toString("base64") } })), { text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspectRatioFromParams(params) } },
  };
}

export const moyuAdapter: ProviderAdapter = {
  kind: "moyu",
  async test() { return { ok: true, message: "Config validated", testMode: "config-only" }; },
  async listModels(context) {
    return configuredModels(context.config, [
      { id: "gpt-image-2", label: "Moyu OpenAI Images", capabilities: ["image.generate", "image.edit"], internal: { protocol: "openai-images" } },
      { id: "gemini-3-pro-image-preview", label: "Moyu Gemini Image", capabilities: ["image.generate", "image.edit"], internal: { protocol: "gemini-native", authMode: "bearer" } },
    ]);
  },
  async submit(context, request) {
    const protocol = String(request.model.internal?.protocol || "openai-images");
    const rawBaseUrl = String(context.config.baseUrl || "");
    if (!rawBaseUrl) throw new ProviderValidationError("missing_base_url");
    let response: Response;
    if (protocol === "gemini-native") {
      const baseUrl = normalizeGeminiBaseUrl(rawBaseUrl);
      try {
        response = await fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(request.model.id)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(context.secret.apiKey) },
          body: JSON.stringify(geminiBody(request.prompt, request.references, request.params)),
          signal: AbortSignal.timeout(30000),
        });
      } catch (error) { classifySubmitNetwork(error); }
      await classifySubmitResponse(response!);
      const outputs = parseGeminiOutputs(await response.json());
      if (outputs.length === 0) throw new Error("moyu_gemini_no_outputs");
      return { mode: "completed", outputs };
    }
    const baseUrl = normalizeOpenAiBaseUrl(rawBaseUrl);
    if (request.action === "image.edit") {
      if (request.references.length !== 1) throw new ProviderValidationError("moyu_edit_requires_single_reference");
      const form = new FormData();
      form.set("model", request.model.id);
      form.set("prompt", request.prompt);
      form.set("n", String(Number(request.params.count || 1)));
      form.set("size", sizeFromParams(request.params));
      form.set("quality", String(request.params.quality || "auto"));
      const bytes = request.references[0].bytes;
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      form.set("image", new Blob([arrayBuffer], { type: request.references[0].mimeType }), request.references[0].originalName || "reference.png");
      try {
        response = await fetch(`${baseUrl}/images/edits`, { method: "POST", headers: authHeaders(context.secret.apiKey), body: form, signal: AbortSignal.timeout(30000) });
      } catch (error) { classifySubmitNetwork(error); }
    } else {
      try {
        response = await fetch(`${baseUrl}/images/generations`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders(context.secret.apiKey) },
          body: JSON.stringify(openAiBody(request.model.id, request.prompt, request.params)),
          signal: AbortSignal.timeout(30000),
        });
      } catch (error) { classifySubmitNetwork(error); }
    }
    await classifySubmitResponse(response!);
    const outputs = await parseOpenAiImageOutputs(await response.json());
    if (outputs.length === 0) throw new Error("moyu_no_outputs");
    return { mode: "completed", outputs };
  },
};
