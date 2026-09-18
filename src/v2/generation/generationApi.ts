"use client";

import type { GenerationRecordDto, JobDto, SubmitGenerationInput } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) throw Object.assign(new Error("request_failed"), { response, body });
  return body;
}

export async function createGeneration(input: SubmitGenerationInput & { requestId: string }) {
  const post = () => fetch(`/api/v2/projects/${input.projectId}/generations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  try {
    return await parseJson<{ generation: GenerationRecordDto; job: JobDto }>(await post());
  } catch (error) {
    if ((error as { response?: Response }).response) throw error;
    return parseJson<{ generation: GenerationRecordDto; job: JobDto }>(await post());
  }
}

export async function getJob(jobId: string) {
  return parseJson<{ job: JobDto }>(await fetch(`/api/v2/jobs/${jobId}`, { cache: "no-store" }));
}

export async function cancelJob(jobId: string) {
  return parseJson<{ job: JobDto }>(await fetch(`/api/v2/jobs/${jobId}/cancel`, { method: "POST" }));
}

export async function listProjectJobs(projectId: string, status?: string, options: { limit?: number; cursor?: string | null } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const suffix = params.size ? `?${params}` : "";
  return parseJson<{ jobs: JobDto[]; nextCursor: string | null }>(await fetch(`/api/v2/projects/${projectId}/jobs${suffix}`, { cache: "no-store" }));
}

export async function getGeneration(generationId: string) {
  return parseJson<{ generation: GenerationRecordDto }>(await fetch(`/api/v2/generations/${generationId}`, { cache: "no-store" }));
}

export async function listGenerations(projectId: string, options: { nodeId?: string; status?: string; limit?: number; cursor?: string | null } = {}) {
  const params = new URLSearchParams();
  if (options.nodeId) params.set("nodeId", options.nodeId);
  if (options.status) params.set("status", options.status);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.size ? `?${params.toString()}` : "";
  return parseJson<{ generations: GenerationRecordDto[]; nextCursor: string | null }>(await fetch(`/api/v2/projects/${projectId}/generations${query}`, { cache: "no-store" }));
}

export async function selectGenerationVariant(generationId: string, selectedVariantIndex: number) {
  return parseJson<{ generation: GenerationRecordDto; assetId: string | null; revision: number | null }>(await fetch(`/api/v2/generations/${generationId}/selection`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedVariantIndex }) }));
}
