import { notFound } from "@/v2/server/apiValidation";
import { getGeneration } from "@/v2/server/generations/repository";

export const runtime = "nodejs";

interface Params { params: Promise<{ generationId: string }> }

export async function GET(_: Request, { params }: Params) {
  const generation = getGeneration((await params).generationId);
  return generation ? Response.json({ generation }) : notFound();
}
