import "server-only";
import type Database from "better-sqlite3";

function tableCount(db: Database.Database, table: string) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

export function migration002ProviderJobs(db: Database.Database) {
  for (const table of ["generations", "jobs", "provider_configs"]) {
    if (tableCount(db, table) !== 0) throw new Error(`migration_002_${table}_not_empty`);
  }

  db.exec(`
    DROP TABLE provider_configs;
    DROP TABLE jobs;
    DROP TABLE generations;

    CREATE TABLE provider_configs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      config_json TEXT NOT NULL,
      secret_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE generations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      node_id TEXT NULL,
      request_id TEXT NOT NULL,
      action TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      references_json TEXT NOT NULL,
      params_json TEXT NOT NULL,
      output_asset_ids_json TEXT NOT NULL DEFAULT '[]',
      selected_variant_index INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL,
      FOREIGN KEY (provider_id) REFERENCES provider_configs(id)
    );
    CREATE UNIQUE INDEX generations_project_request_idx ON generations(project_id, request_id);
    CREATE INDEX generations_project_idx ON generations(project_id, created_at DESC, id DESC);

    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      generation_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      node_id TEXT NULL,
      execution_token TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      remote_task_id TEXT NULL,
      status TEXT NOT NULL,
      phase TEXT NOT NULL,
      progress REAL NULL,
      attempt INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT NULL,
      deadline_at TEXT NULL,
      ticket_json TEXT NOT NULL DEFAULT '{}',
      error TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finished_at TEXT NULL,
      FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL,
      FOREIGN KEY (provider_id) REFERENCES provider_configs(id)
    );
    CREATE INDEX jobs_project_status_idx ON jobs(project_id, status);
    CREATE INDEX jobs_generation_idx ON jobs(generation_id);
    CREATE INDEX jobs_provider_status_idx ON jobs(provider_id, status);
    CREATE INDEX jobs_next_retry_idx ON jobs(next_retry_at);

    CREATE TABLE node_execution_state (
      project_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      execution_token TEXT NOT NULL,
      job_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, node_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );
  `);
}
