import { badRequest, isUuid, notFound } from "@/v2/server/apiValidation";
import { ingestAsset } from "@/v2/server/assets/ingest";
import { listAssets } from "@/v2/server/assets/repository";

export const runtime = "nodejs";

interface Params { params: Promise<{ projectId: string }> }

export async function GET(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return badRequest("invalid_limit");
  try {
    return Response.json(listAssets(projectId, { limit, cursor: url.searchParams.get("cursor"), kind: url.searchParams.get("kind") }));
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_cursor") return badRequest("invalid_cursor");
    throw error;
  }
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0 || files.length > 24) return badRequest("invalid_file_count");
  try {
    const assets = [];
    for (const file of files) assets.push(await ingestAsset(projectId, file, "upload"));
    return Response.json({ assets }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "project_not_found") return notFound();
    if (error instanceof Error && ["invalid_file_size", "unsupported_mime", "invalid_image"].includes(error.message)) return badRequest(error.message);
    throw error;
  }
}
