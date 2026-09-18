import { getProviderRegistry } from "@/v2/server/providers/registry";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";
import { upsertProviderConfig } from "@/v2/server/providers/repository";

export const runtime = "nodejs";

export async function GET() {
  ensureJobSchedulerStarted();
  return Response.json({ providers: await getProviderRegistry().listClientProviders() });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "not_found" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.kind !== "custom" || body.fake !== true) return Response.json({ error: "invalid_provider_payload" }, { status: 400 });
  const provider = upsertProviderConfig({ id: typeof body.id === "string" ? body.id : undefined, kind: "custom", name: typeof body.name === "string" ? body.name : "Fake Provider", enabled: body.enabled !== false, config: { fake: true, async: body.async === true, fail: body.fail === true, models: Array.isArray(body.models) ? body.models : undefined }, secret: {} });
  return Response.json({ provider }, { status: 201 });
}
