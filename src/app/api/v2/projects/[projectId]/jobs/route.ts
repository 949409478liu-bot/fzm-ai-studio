import { badRequest, isUuid } from "@/v2/server/apiValidation";
import { listJobs } from "@/v2/server/jobs/repository";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";

export const runtime = "nodejs";

interface Params { params: Promise<{ projectId: string }> }

export async function GET(request: Request, { params }: Params) {
  ensureJobSchedulerStarted();
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const url = new URL(request.url);
  const jobs = listJobs(projectId, { status: url.searchParams.get("status"), limit: Number(url.searchParams.get("limit") || 50) });
  return Response.json({ jobs: jobs.map((job) => ({ id: job.id, generationId: job.generationId, status: job.status, phase: job.phase, progress: job.progress, providerId: job.providerId, modelId: job.modelId, createdAt: job.createdAt, updatedAt: job.updatedAt, finishedAt: job.finishedAt, error: job.error })) });
}
