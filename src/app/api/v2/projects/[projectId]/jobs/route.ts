import { badRequest, isUuid } from "@/v2/server/apiValidation";
import { listJobs } from "@/v2/server/jobs/repository";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";
import { toJobDto } from "@/v2/server/jobs/dto";

export const runtime = "nodejs";

interface Params { params: Promise<{ projectId: string }> }

export async function GET(request: Request, { params }: Params) {
  ensureJobSchedulerStarted();
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const url = new URL(request.url);
  const page = listJobs(projectId, { status: url.searchParams.get("status"), limit: Number(url.searchParams.get("limit") || 50), cursor: url.searchParams.get("cursor") });
  return Response.json({ jobs: page.jobs.map(toJobDto), nextCursor: page.nextCursor });
}
