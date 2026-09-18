import "server-only";
import { getDb } from "@/v2/server/db/connection";
import { getProviderRegistry } from "@/v2/server/providers/registry";
import { ProviderAmbiguousSubmitError, ProviderBusyError, ProviderPollError, ProviderRateLimitError, redactProviderError } from "@/v2/server/providers/errors";
import { getGeneration, setGenerationStatus } from "@/v2/server/generations/repository";
import { resolveGenerationReferences } from "@/v2/server/generations/service";
import { ingestGeneratedOutput } from "@/v2/server/assets/ingestGenerated";
import { getJob, type JobRecord, updateJob } from "./repository";

function delayFrom(error: ProviderRateLimitError | ProviderBusyError, fallbackMs: number) {
  return new Date(Date.now() + Math.min(error.retryAfterMs ?? fallbackMs, 60000)).toISOString();
}

export async function runJob(job: JobRecord) {
  const generation = getGeneration(job.generationId);
  if (!generation) { updateJob(job.id, { status: "failed", phase: "failed", error: "generation_not_found" }); return; }
  if (job.deadlineAt && new Date(job.deadlineAt).getTime() < Date.now()) {
    updateJob(job.id, { status: "failed", phase: "failed", error: "job_deadline_exceeded" });
    setGenerationStatus(generation.id, "failed");
    return;
  }
  const registry = getProviderRegistry();
  const { provider, adapter, model } = await registry.validatePaidRequest({ providerId: job.providerId, modelId: job.modelId, action: generation.action as "image.generate" | "image.edit", referenceCount: generation.references.length });
  const context = registry.context(provider);
  try {
    let current = getJob(job.id)!;
    let outputs = [] as Awaited<ReturnType<NonNullable<typeof adapter.fetchResult>>>;
    if (current.status === "finalizing" && current.stagedOutputAssetIds.length > 0) {
      finalizeJob(job, generation.id, current.stagedOutputAssetIds);
      return;
    }
    if ((current.status === "polling" || current.status === "downloading") && current.remoteTaskId && adapter.poll) {
      current = updateJob(job.id, { status: "polling", phase: "polling" })!;
    } else {
      current = updateJob(job.id, { status: "submitting", phase: "submitting" })!;
      const references = await resolveGenerationReferences(job.projectId, generation.references);
      const submission = await adapter.submit(context, { generationId: generation.id, jobId: job.id, action: generation.action as "image.generate" | "image.edit", model, prompt: generation.prompt, references, params: generation.params });
      if (submission.mode === "completed") outputs = submission.outputs;
      else {
        current = updateJob(job.id, { status: "polling", phase: "polling", remoteTaskId: submission.remoteTaskId, ticket: submission.ticket })!;
      }
    }
    current = getJob(job.id)!;
    if (current.status === "polling") {
      if (!adapter.poll || !adapter.fetchResult) throw new Error("adapter_poll_missing");
      const poll = await adapter.poll(context, current.ticket);
      if (poll.status === "pending") { updateJob(job.id, { status: "polling", phase: "polling", progress: poll.progress ?? current.progress, ticket: poll.ticket ?? current.ticket, nextRetryAt: new Date(Date.now() + (poll.nextPollMs ?? 3000)).toISOString() }); return; }
      if (poll.status === "failed") throw new Error(poll.error);
      current = updateJob(job.id, { status: "downloading", phase: "downloading", ticket: poll.ticket ?? current.ticket })!;
      outputs = poll.outputs ?? await adapter.fetchResult(context, current.ticket);
    }
    if (outputs.length === 0) throw new Error("provider_no_outputs");
    const assets = [];
    try {
      for (const output of outputs) assets.push(await ingestGeneratedOutput({ projectId: job.projectId, generationId: generation.id, jobId: job.id, providerId: job.providerId, modelId: job.modelId, output }));
    } catch (error) {
      if (assets.length > 0) {
        const db = getDb();
        const ids = assets.map((asset) => asset.id);
        db.prepare(`UPDATE assets SET metadata_json = json_set(metadata_json, '$.orphanCandidate', true) WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
      }
      throw error;
    }
    const assetIds = assets.map((asset) => asset.id);
    updateJob(job.id, { status: "finalizing", phase: "finalizing", stagedOutputAssetIds: assetIds });
    finalizeJob(job, generation.id, assetIds);
  } catch (error) {
    if (error instanceof ProviderRateLimitError) {
      const attempts = job.attempt + 1;
      if (attempts > 3) { updateJob(job.id, { status: "failed", phase: "failed", attempt: attempts, error: "retry_exhausted" }); setGenerationStatus(generation.id, "failed"); return; }
      updateJob(job.id, { status: "rate_limited", phase: "rate_limited", attempt: attempts, nextRetryAt: delayFrom(error, 5000), error: redactProviderError(error) }); return;
    }
    if (error instanceof ProviderBusyError) {
      const attempts = job.attempt + 1;
      if (attempts > 5) { updateJob(job.id, { status: "failed", phase: "failed", attempt: attempts, error: "retry_exhausted" }); setGenerationStatus(generation.id, "failed"); return; }
      updateJob(job.id, { status: "provider_busy", phase: "provider_busy", attempt: attempts, nextRetryAt: delayFrom(error, 5000), error: redactProviderError(error) }); return;
    }
    if (error instanceof ProviderAmbiguousSubmitError) { updateJob(job.id, { status: "interrupted", phase: "interrupted", error: "ambiguous_submit" }); setGenerationStatus(generation.id, "interrupted"); return; }
    if (error instanceof ProviderPollError) { updateJob(job.id, { status: "polling", phase: "polling", attempt: job.attempt + 1, nextRetryAt: new Date(Date.now() + 3000).toISOString(), error: redactProviderError(error) }); return; }
    updateJob(job.id, { status: "failed", phase: "failed", error: redactProviderError(error) });
    setGenerationStatus(generation.id, "failed");
  }
}

function finalizeJob(job: JobRecord, generationId: string, assetIds: string[]) {
  getDb().transaction(() => {
    const fresh = getJob(job.id, getDb());
    if (!fresh || fresh.status === "canceled") return;
    setGenerationStatus(generationId, "succeeded", assetIds, getDb());
    updateJob(job.id, { status: "succeeded", phase: "succeeded", progress: 1 }, getDb());
    if (!job.nodeId) return;
    const state = getDb().prepare("SELECT execution_token FROM node_execution_state WHERE project_id = ? AND node_id = ?").get(job.projectId, job.nodeId) as { execution_token: string } | undefined;
    if (state?.execution_token !== job.executionToken) return;
    getDb().prepare("UPDATE nodes SET asset_id = ?, generation_id = ? WHERE project_id = ? AND id = ?").run(assetIds[0], generationId, job.projectId, job.nodeId);
    getDb().prepare("UPDATE projects SET revision = revision + 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), job.projectId);
  })();
}
