import { notFound } from "@/v2/server/apiValidation";
import { cancelJob, getJob } from "@/v2/server/jobs/repository";
import { toJobDto } from "@/v2/server/jobs/dto";

export const runtime = "nodejs";

interface Params { params: Promise<{ jobId: string }> }

export async function POST(_: Request, { params }: Params) {
  const { jobId } = await params;
  if (!getJob(jobId)) return notFound();
  const job = cancelJob(jobId)!;
  return Response.json({ cancelMode: "local-only", job: toJobDto(job) });
}
