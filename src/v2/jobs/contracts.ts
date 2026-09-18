import type { JobStatus } from "@/v2/types/domain";

export const JOB_TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set([
  "succeeded",
  "failed",
  "canceled",
  "interrupted",
]);

export interface ExecutionIdentity {
  canvasId: string;
  nodeId: string;
  executionToken: string;
}

export const TIMEOUT_POLICY_MS = {
  llm: 3 * 60 * 1000,
  media: 15 * 60 * 1000,
} as const;
