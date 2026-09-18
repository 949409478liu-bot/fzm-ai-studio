import "server-only";
import { redactProviderError } from "@/v2/server/providers/errors";
import { legacyProviderDiagnostic } from "@/v2/server/providers/diagnostic";
import type { JobRecord } from "./repository";

export type JobDto = {
  id: string;
  generationId: string;
  nodeId: string | null;
  status: string;
  phase: string;
  progress: number | null;
  providerId: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  error: string | null;
  attempt: number;
  nextRetryAt: string | null;
  errorCode: string | null;
  httpStatus: number | null;
};

function safeAttempt(value: number) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function safeRetryAt(value: string | null) {
  return value != null && !Number.isNaN(Date.parse(value)) ? value : null;
}

function safeErrorCode(value: string | null) {
  return value != null && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : null;
}

function safeHttpStatus(value: number | null) {
  return value != null && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

export function toJobDto(job: JobRecord): JobDto {
  const legacy = legacyProviderDiagnostic(job.error);
  return {
    id: job.id,
    generationId: job.generationId,
    nodeId: job.nodeId,
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    providerId: job.providerId,
    modelId: job.modelId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
    error: job.error ? redactProviderError(job.error) : null,
    attempt: safeAttempt(job.attempt),
    nextRetryAt: safeRetryAt(job.nextRetryAt),
    errorCode: safeErrorCode(job.errorCode) ?? legacy.errorCode,
    httpStatus: safeHttpStatus(job.httpStatus) ?? legacy.httpStatus,
  };
}
