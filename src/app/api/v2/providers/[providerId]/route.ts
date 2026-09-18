import { badRequest, notFound } from "@/v2/server/apiValidation";
import { deleteProviderConfig, getProviderConfig, providerHasGenerationHistory, providerToClientDto, upsertProviderConfig } from "@/v2/server/providers/repository";
import { getProviderRegistry } from "@/v2/server/providers/registry";
import { normalizeEditableProviderPayload, toProviderValidationResponse } from "@/v2/server/providers/providerValidation";

export const runtime = "nodejs";

interface Params { params: Promise<{ providerId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { providerId } = await params;
  const existing = getProviderConfig(providerId);
  if (!existing) return notFound();
  const body = (await request.json().catch(() => null)) as null | Record<string, unknown>;
  if (!body) return badRequest("invalid_provider_payload");
  try {
    const input = normalizeEditableProviderPayload({ ...existing.config, ...body, kind: body.kind ?? existing.kind, name: body.name ?? existing.name, enabled: body.enabled ?? existing.enabled, baseUrl: body.baseUrl ?? existing.config.baseUrl }, existing);
    const provider = upsertProviderConfig({ id: providerId, ...input });
    return Response.json({ provider: providerToClientDto(provider, await getProviderRegistry().listModels(provider)) });
  } catch (error) {
    return toProviderValidationResponse(error);
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { providerId } = await params;
  const existing = getProviderConfig(providerId);
  if (!existing) return notFound();
  if (providerHasGenerationHistory(providerId)) return Response.json({ error: "provider_in_use" }, { status: 409 });
  deleteProviderConfig(providerId);
  return Response.json({ ok: true });
}
