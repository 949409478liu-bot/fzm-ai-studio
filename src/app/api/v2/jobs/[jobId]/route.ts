import { notFound } from "@/v2/server/apiValidation";
import { getJob } from "@/v2/server/jobs/repository";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";

export const runtime = "nodejs";

interface Params { params: Promise<{ jobId: string }> }

function jobDto(job: NonNullable<ReturnType<typeof getJob>>) {
  return { id: job.id, generationId: job.generationId, nodeId: job.nodeId, status: job.status, phase: job.phase, progress: job.progress, providerId: job.providerId, modelId: job.modelId, createdAt: job.createdAt, updatedAt: job.updatedAt, finishedAt: job.finishedAt, error: job.error };
}

export async function GET(_: Request, { params }: Params) {
  ensureJobSchedulerStarted();
  const job = getJob((await params).jobId);
  return job ? Response.json({ job: jobDto(job) }) : notFound();
}
