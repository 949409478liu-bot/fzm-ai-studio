import { getProviderRegistry } from "@/v2/server/providers/registry";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";

export const runtime = "nodejs";

export async function GET() {
  ensureJobSchedulerStarted();
  return Response.json({ providers: await getProviderRegistry().listClientProviders() });
}
