import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDbForTests, getDb } from "@/v2/server/db/connection";
import { claimNextJob, getJob, recoverJobs } from "./repository";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-v2-jobs-"));
  process.env.FZM_V2_DATA_DIR = dir;
  closeDbForTests();
});

afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.FZM_V2_DATA_DIR;
});

function seedJob(status: string, extra: Partial<{ remoteTaskId: string | null; ticket: Record<string, unknown>; staged: string[] }> = {}) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO projects (id, name, viewport_json, revision, created_at, updated_at) VALUES ('p', 'p', '{}', 0, ?, ?)").run(now, now);
  db.prepare("INSERT INTO provider_configs (id, kind, name, enabled, config_json, secret_json, created_at, updated_at) VALUES ('provider', 'gptsapi', 'p', 1, '{}', '{}', ?, ?)").run(now, now);
  db.prepare("INSERT INTO generations (id, project_id, request_id, action, provider_id, model_id, prompt, references_json, params_json, status, created_at, updated_at) VALUES ('g', 'p', ?, 'image.generate', 'provider', 'm', 'prompt', '[]', '{}', 'queued', ?, ?)").run(`r-${status}`, now, now);
  db.prepare("INSERT INTO jobs (id, generation_id, project_id, execution_token, provider_id, model_id, remote_task_id, status, phase, next_retry_at, deadline_at, ticket_json, staged_output_asset_ids_json, created_at, updated_at) VALUES (?, 'g', 'p', 't', 'provider', 'm', ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    `j-${status}`,
    extra.remoteTaskId ?? null,
    status,
    status,
    now,
    new Date(Date.now() + 60000).toISOString(),
    JSON.stringify(extra.ticket ?? {}),
    JSON.stringify(extra.staged ?? []),
    now,
    now,
  );
}

describe("job recovery and claiming", () => {
  it("claims polling jobs without resetting them to submit", () => {
    seedJob("polling", { remoteTaskId: "task-1", ticket: { pollUrl: "http://fake/poll" } });
    const job = claimNextJob();
    expect(job?.status).toBe("polling");
    expect(job?.remoteTaskId).toBe("task-1");
  });

  it("applies safe recovery matrix", () => {
    seedJob("preparing");
    recoverJobs();
    expect(getJob("j-preparing")?.status).toBe("queued");
    closeDbForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-v2-jobs-"));
    process.env.FZM_V2_DATA_DIR = dir;
    seedJob("submitting");
    recoverJobs();
    expect(getJob("j-submitting")?.status).toBe("interrupted");
  });

  it("keeps finalizing only when staged assets exist", () => {
    seedJob("finalizing", { staged: ["asset-1"] });
    recoverJobs();
    expect(getJob("j-finalizing")?.status).toBe("finalizing");
  });
});
