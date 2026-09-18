import { getProviderRegistry } from "@/v2/server/providers/registry";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";
import { providerToClientDto, upsertProviderConfig } from "@/v2/server/providers/repository";
import { normalizeEditableProviderPayload, toProviderValidationResponse } from "@/v2/server/providers/providerValidation";

export const runtime = "nodejs";

export async function GET() {
  ensureJobSchedulerStarted();
  return Response.json({ providers: await getProviderRegistry().listClientProviders() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (process.env.NODE_ENV !== "production" && body?.kind === "custom" && body.fake === true) {
    const provider = upsertProviderConfig({ id: typeof body.id === "string" ? body.id : undefined, kind: "custom", name: typeof body.name === "string" ? body.name : "Fake Provider", enabled: body.enabled !== false, config: { fake: true, async: body.async === true, fail: body.fail === true, interrupt: body.interrupt === true, models: Array.isArray(body.models) ? body.models : undefined }, secret: {} });
    return Response.json({ provider: providerToClientDto(provider, await getProviderRegistry().listModels(provider)) }, { status: 201 });
  }
  try {
    const input = normalizeEditableProviderPayload(body);
    const provider = upsertProviderConfig(input);
    return Response.json({ provider: providerToClientDto(provider, await getProviderRegistry().listModels(provider)) }, { status: 201 });
  } catch (error) {
    return toProviderValidationResponse(error);
  }
}
