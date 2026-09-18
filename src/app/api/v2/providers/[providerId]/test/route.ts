import { notFound } from "@/v2/server/apiValidation";
import { getProviderConfig } from "@/v2/server/providers/repository";
import { getProviderRegistry } from "@/v2/server/providers/registry";
import { redactProviderError } from "@/v2/server/providers/errors";

export const runtime = "nodejs";

interface Params { params: Promise<{ providerId: string }> }

export async function POST(_: Request, { params }: Params) {
  const { providerId } = await params;
  const provider = getProviderConfig(providerId);
  if (!provider) return notFound();
  const registry = getProviderRegistry();
  try {
    const result = await registry.resolve(provider.kind).test(registry.context(provider));
    return Response.json({ result });
  } catch (error) {
    return Response.json({ result: { ok: false, message: redactProviderError(error), testMode: "config-only" } });
  }
}
