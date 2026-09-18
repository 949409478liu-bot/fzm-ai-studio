import "server-only";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@/v2/server/db/connection";

export interface JobRecord { id: string; generationId: string; projectId: string; nodeId: string | null; executionToken: string; providerId: string; modelId: string; remoteTaskId: string | null; status: string; phase: string; progress: number | null; attempt: number; nextRetryAt: string | null; deadlineAt: string | null; ticket: Record<string, unknown>; stagedOutputAssetIds: string[]; error: string | null; createdAt: string; updatedAt: string; finishedAt: string | null; }

function parseJson<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function now() { return new Date().toISOString(); }

export function mapJob(row: Record<string, unknown>): JobRecord {
  return { id: String(row.id), generationId: String(row.generation_id), projectId: String(row.project_id), nodeId: row.node_id ? String(row.node_id) : null, executionToken: String(row.execution_token), providerId: String(row.provider_id), modelId: String(row.model_id), remoteTaskId: row.remote_task_id ? String(row.remote_task_id) : null, status: String(row.status), phase: String(row.phase), progress: row.progress == null ? null : Number(row.progress), attempt: Number(row.attempt), nextRetryAt: row.next_retry_at ? String(row.next_retry_at) : null, deadlineAt: row.deadline_at ? String(row.deadline_at) : null, ticket: parseJson(String(row.ticket_json), {}), stagedOutputAssetIds: parseJson(String(row.staged_output_asset_ids_json ?? "[]"), []), error: row.error ? String(row.error) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at), finishedAt: row.finished_at ? String(row.finished_at) : null };
}

export function getJob(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapJob(row) : null;
}

export function getJobByGeneration(generationId: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM jobs WHERE generation_id = ?").get(generationId) as Record<string, unknown> | undefined;
  return row ? mapJob(row) : null;
}

export function listJobs(projectId: string, options: { status?: string | null; limit?: number; cursor?: string | null } = {}, db = getDb()) {
  const args: unknown[] = [projectId];
  const filters = ["project_id = ?"];
  if (options.status) { filters.push("status = ?"); args.push(options.status); }
  if (options.cursor) {
    const [createdAt, id] = Buffer.from(options.cursor, "base64url").toString("utf8").split("|");
    if (createdAt && id) { filters.push("(created_at < ? OR (created_at = ? AND id < ?))"); args.push(createdAt, createdAt, id); }
  }
  args.push(Math.min(Math.max(options.limit || 50, 1), 100));
  const rows = db.prepare(`SELECT * FROM jobs WHERE ${filters.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`).all(...args).map((row) => mapJob(row as Record<string, unknown>));
  const last = rows[rows.length - 1];
  return { jobs: rows, nextCursor: rows.length === Math.min(Math.max(options.limit || 50, 1), 100) && last ? Buffer.from(`${last.createdAt}|${last.id}`).toString("base64url") : null };
}

export function insertJob(input: Omit<JobRecord, "id" | "remoteTaskId" | "status" | "phase" | "progress" | "attempt" | "nextRetryAt" | "ticket" | "stagedOutputAssetIds" | "error" | "createdAt" | "updatedAt" | "finishedAt">, db: Database.Database) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(`INSERT INTO jobs (id, generation_id, project_id, node_id, execution_token, provider_id, model_id, status, phase, deadline_at, ticket_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 'queued', ?, '{}', ?, ?)`).run(id, input.generationId, input.projectId, input.nodeId, input.executionToken, input.providerId, input.modelId, input.deadlineAt, timestamp, timestamp);
  return getJob(id, db)!;
}

export function upsertNodeExecutionState(input: { projectId: string; nodeId: string; executionToken: string; jobId: string }, db: Database.Database) {
  db.prepare(`INSERT INTO node_execution_state (project_id, node_id, execution_token, job_id, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id, node_id) DO UPDATE SET execution_token = excluded.execution_token, job_id = excluded.job_id, updated_at = excluded.updated_at`).run(input.projectId, input.nodeId, input.executionToken, input.jobId, now());
}

export function claimNextJob(db = getDb()) {
  const transaction = db.transaction(() => {
    const row = db.prepare("SELECT * FROM jobs WHERE status IN ('queued','rate_limited','provider_busy','polling','downloading','finalizing') AND (next_retry_at IS NULL OR next_retry_at <= ?) ORDER BY created_at ASC LIMIT 1").get(now()) as Record<string, unknown> | undefined;
    if (!row) return null;
    const nextStatus = String(row.status) === "queued" || String(row.status) === "rate_limited" || String(row.status) === "provider_busy" ? "preparing" : String(row.status);
    const nextPhase = nextStatus;
    const result = db.prepare("UPDATE jobs SET status = ?, phase = ?, updated_at = ? WHERE id = ? AND status = ?").run(nextStatus, nextPhase, now(), row.id, row.status);
    return result.changes ? getJob(String(row.id), db) : null;
  });
  return transaction();
}

export function updateJob(id: string, patch: Partial<Pick<JobRecord, "status" | "phase" | "progress" | "attempt" | "nextRetryAt" | "remoteTaskId" | "ticket" | "stagedOutputAssetIds" | "error">>, db = getDb()) {
  const current = getJob(id, db);
  if (!current) return null;
  const next = { ...current, ...patch };
  const finished = ["succeeded", "failed", "canceled", "interrupted"].includes(next.status) ? now() : current.finishedAt;
  db.prepare(`UPDATE jobs SET remote_task_id = ?, status = ?, phase = ?, progress = ?, attempt = ?, next_retry_at = ?, ticket_json = ?, staged_output_asset_ids_json = ?, error = ?, updated_at = ?, finished_at = ? WHERE id = ?`).run(next.remoteTaskId, next.status, next.phase, next.progress, next.attempt, next.nextRetryAt, JSON.stringify(next.ticket), JSON.stringify(next.stagedOutputAssetIds), next.error, now(), finished, id);
  return getJob(id, db);
}

export function recoverJobs(db = getDb()) {
  db.prepare("UPDATE jobs SET status = 'queued', phase = 'queued', updated_at = ? WHERE status = 'preparing'").run(now());
  db.prepare("UPDATE jobs SET status = 'interrupted', phase = 'interrupted', error = 'ambiguous_submit', updated_at = ?, finished_at = ? WHERE status = 'submitting'").run(now(), now());
  db.prepare("UPDATE jobs SET status = 'interrupted', phase = 'interrupted', error = 'unsafe_downloading_recovery', updated_at = ?, finished_at = ? WHERE status = 'downloading' AND (remote_task_id IS NULL OR ticket_json = '{}')").run(now(), now());
  db.prepare("UPDATE jobs SET status = 'interrupted', phase = 'interrupted', error = 'unsafe_finalizing_recovery', updated_at = ?, finished_at = ? WHERE status = 'finalizing' AND staged_output_asset_ids_json = '[]'").run(now(), now());
}

export function cancelJob(id: string, db = getDb()) {
  const job = updateJob(id, { status: "canceled", phase: "canceled" }, db);
  if (job) db.prepare("UPDATE generations SET status = 'canceled', updated_at = ?, finished_at = ? WHERE id = ?").run(now(), now(), job.generationId);
  return job;
}
