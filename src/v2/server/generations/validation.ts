import "server-only";
import { ProviderValidationError } from "@/v2/server/providers/errors";

export function validateGenerationPayload(body: unknown) {
  const value = body as Record<string, unknown> | null;
  if (!value || typeof value !== "object") throw new ProviderValidationError("invalid_generation_payload");
  const requestId = typeof value.requestId === "string" ? value.requestId : "";
  const action = typeof value.action === "string" ? value.action : "";
  const providerId = typeof value.providerId === "string" ? value.providerId : "";
  const modelId = typeof value.modelId === "string" ? value.modelId : "";
  const prompt = typeof value.prompt === "string" ? value.prompt.trim() : "";
  const nodeId = typeof value.nodeId === "string" ? value.nodeId : null;
  if (!requestId || !action || !providerId || !modelId || !prompt) throw new ProviderValidationError("missing_required_generation_field");
  if (prompt.length > 8000) throw new ProviderValidationError("prompt_too_long");
  if (!["image.generate", "image.edit"].includes(action)) throw new ProviderValidationError("unsupported_action");
  const references = Array.isArray(value.references) ? value.references.map((item) => {
    const ref = item as Record<string, unknown>;
    return { assetId: String(ref.assetId || ""), role: String(ref.role || "reference-image"), order: Number(ref.order ?? 0) };
  }) : [];
  if (references.some((ref) => !ref.assetId || !Number.isFinite(ref.order))) throw new ProviderValidationError("invalid_references");
  references.sort((a, b) => a.order - b.order);
  const params = typeof value.params === "object" && value.params ? value.params as Record<string, unknown> : {};
  const count = Number(params.count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 4) throw new ProviderValidationError("invalid_count");
  for (const key of ["width", "height"]) {
    if (params[key] == null) continue;
    const dimension = Number(params[key]);
    if (!Number.isInteger(dimension) || dimension < 64 || dimension > 4096) throw new ProviderValidationError(`invalid_${key}`);
  }
  if (params.quality != null && !["auto", "low", "medium", "high"].includes(String(params.quality))) throw new ProviderValidationError("invalid_quality");
  return { requestId, action: action as "image.generate" | "image.edit", providerId, modelId, prompt, nodeId, references, params: { ...params, count } };
}
