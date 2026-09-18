import { notFound } from "@/v2/server/apiValidation";
import { getJob } from "@/v2/server/jobs/repository";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";
import { toJobDto } from "@/v2/server/jobs/dto";

export const runtime = "nodejs";

interface Params { params: Promise<{ jobId: string }> }


export async function GET(_: Request, { params }: Params) {
  ensureJobSchedulerStarted();
  const job = getJob((await params).jobId);
  return job ? Response.json({ job: toJobDto(job) }) : notFound();
}
