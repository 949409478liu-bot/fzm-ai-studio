import { badRequest, notFound } from "@/v2/server/apiValidation";
import { getProviderConfig, upsertProviderConfig } from "@/v2/server/providers/repository";
import { getProviderRegistry } from "@/v2/server/providers/registry";

export const runtime = "nodejs";

interface Params { params: Promise<{ providerId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { providerId } = await params;
  const existing = getProviderConfig(providerId);
  if (!existing) return notFound();
  const body = (await request.json().catch(() => null)) as null | { name?: unknown; enabled?: unknown; baseUrl?: unknown; apiKey?: unknown };
  if (!body) return badRequest("invalid_provider_payload");
  const provider = upsertProviderConfig({
    id: providerId,
    kind: existing.kind,
    name: typeof body.name === "string" ? body.name.slice(0, 80) : existing.name,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
    config: { ...existing.config, ...(typeof body.baseUrl === "string" ? { baseUrl: body.baseUrl } : {}) },
    secret: typeof body.apiKey === "string" && body.apiKey ? { ...existing.secret, apiKey: body.apiKey } : existing.secret,
  });
  const models = await getProviderRegistry().listModels(provider);
  return Response.json({ provider: (await getProviderRegistry().listClientProviders()).find((item) => item.id === provider.id) ?? { id: provider.id, models } });
}
