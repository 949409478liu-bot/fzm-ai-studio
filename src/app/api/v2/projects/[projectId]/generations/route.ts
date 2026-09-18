import { badRequest, isUuid } from "@/v2/server/apiValidation";
import { createGenerationJob } from "@/v2/server/generations/service";
import { validateGenerationPayload } from "@/v2/server/generations/validation";
import { ProviderValidationError, redactProviderError } from "@/v2/server/providers/errors";

export const runtime = "nodejs";

interface Params { params: Promise<{ projectId: string }> }

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  try {
    const input = validateGenerationPayload(await request.json().catch(() => null));
    const result = await createGenerationJob(projectId, input);
    return Response.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof ProviderValidationError) return badRequest(error.message);
    return Response.json({ error: redactProviderError(error) }, { status: 500 });
  }
}
