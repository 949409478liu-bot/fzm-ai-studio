import { badRequest, isUuid, notFound } from "@/v2/server/apiValidation";
import { getProject, renameProject, softDeleteProject } from "@/v2/server/projects/repository";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const project = getProject(projectId);
  return project ? Response.json({ project }) : notFound();
}

export async function PATCH(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const project = renameProject(projectId, typeof body.name === "string" ? body.name : "");
  return project ? Response.json({ project }) : notFound();
}

export async function DELETE(_: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  return softDeleteProject(projectId) ? Response.json({ ok: true }) : notFound();
}
