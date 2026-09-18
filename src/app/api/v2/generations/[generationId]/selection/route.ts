import { badRequest, notFound } from "@/v2/server/apiValidation";
import { selectGenerationVariant } from "@/v2/server/generations/repository";

export const runtime = "nodejs";

interface Params { params: Promise<{ generationId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const body = (await request.json().catch(() => null)) as { selectedVariantIndex?: unknown } | null;
  const selectedVariantIndex = Number(body?.selectedVariantIndex);
  if (!Number.isInteger(selectedVariantIndex)) return badRequest("invalid_selected_variant_index");
  try {
    const result = selectGenerationVariant((await params).generationId, selectedVariantIndex);
    return result ? Response.json(result) : notFound();
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    throw error;
  }
}
