import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { getDb } from "@/v2/server/db/connection";
import { getAsset } from "@/v2/server/assets/repository";
import { resolveV2Path } from "@/v2/server/assets/paths";
import { getProviderRegistry } from "@/v2/server/providers/registry";
import { ProviderValidationError } from "@/v2/server/providers/errors";
import type { ProviderCapability, ResolvedGenerationReference } from "@/v2/server/providers/types";
import { getGenerationByRequest, insertGeneration } from "./repository";
import { getJobByGeneration, insertJob, upsertNodeExecutionState } from "@/v2/server/jobs/repository";
import { ensureJobSchedulerStarted } from "@/v2/server/jobs/scheduler";

async function resolveReferences(projectId: string, refs: Array<{ assetId: string; role: string; order: number }>): Promise<ResolvedGenerationReference[]> {
  const resolved = [];
  for (const ref of refs) {
    const asset = getAsset(ref.assetId);
    if (!asset || asset.projectId !== projectId) throw new ProviderValidationError("reference_asset_not_found");
    if (asset.kind !== "image") throw new ProviderValidationError("reference_asset_kind_invalid");
    resolved.push({ ...ref, bytes: await fs.readFile(resolveV2Path(asset.path)), mimeType: asset.mimeType, originalName: asset.originalName });
  }
  return resolved;
}

export async function resolveGenerationReferences(projectId: string, refs: Array<{ assetId: string; role: string; order: number }>) {
  return resolveReferences(projectId, refs);
}

export async function createGenerationJob(projectId: string, input: { requestId: string; nodeId: string | null; action: ProviderCapability; providerId: string; modelId: string; prompt: string; references: Array<{ assetId: string; role: string; order: number }>; params: Record<string, unknown> }) {
  const existing = getGenerationByRequest(projectId, input.requestId);
  if (existing) return { generation: existing, job: getJobByGeneration(existing.id)! };

  const registry = getProviderRegistry();
  await registry.validatePaidRequest({ providerId: input.providerId, modelId: input.modelId, action: input.action, referenceCount: input.references.length });
  await resolveReferences(projectId, input.references);

  const db = getDb();
  const result = db.transaction(() => {
    const nodeExists = input.nodeId ? db.prepare("SELECT id FROM nodes WHERE id = ? AND project_id = ?").get(input.nodeId, projectId) : null;
    if (input.nodeId && !nodeExists) throw new ProviderValidationError("node_not_found");
    const generation = insertGeneration({ projectId, nodeId: input.nodeId, requestId: input.requestId, action: input.action, providerId: input.providerId, modelId: input.modelId, prompt: input.prompt, references: input.references, params: input.params }, db);
    const executionToken = randomUUID();
    const job = insertJob({ generationId: generation.id, projectId, nodeId: input.nodeId, executionToken, providerId: input.providerId, modelId: input.modelId, deadlineAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() }, db);
    if (input.nodeId) upsertNodeExecutionState({ projectId, nodeId: input.nodeId, executionToken, jobId: job.id }, db);
    return { generation, job };
  })();
  ensureJobSchedulerStarted();
  return result;
}
