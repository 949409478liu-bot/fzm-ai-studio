import { badRequest, isUuid, notFound } from "@/v2/server/apiValidation";
import { listGenerations } from "@/v2/server/generations/repository";
import { createGenerationJob } from "@/v2/server/generations/service";
import { validateGenerationPayload } from "@/v2/server/generations/validation";
import { ProviderValidationError, redactProviderError } from "@/v2/server/providers/errors";

export const runtime = "nodejs";

interface Params { params: Promise<{ projectId: string }> }

export async function GET(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const url = new URL(request.url);
  const page = listGenerations(projectId, { nodeId: url.searchParams.get("nodeId"), status: url.searchParams.get("status"), limit: Number(url.searchParams.get("limit") || 50), cursor: url.searchParams.get("cursor") });
  return Response.json(page);
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  try {
    const input = validateGenerationPayload(await request.json().catch(() => null));
    const result = await createGenerationJob(projectId, input);
    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof ProviderValidationError && error.message === "project_not_found") return notFound();
    if (error instanceof ProviderValidationError) return badRequest(error.message);
    return Response.json({ error: redactProviderError(error) }, { status: 500 });
  }
}
