export const V2_SCHEMA_VERSION = 1;

export const V2_TABLES = [
  "projects",
  "assets",
  "nodes",
  "edges",
  "generations",
  "jobs",
  "workflows",
  "provider_configs",
] as const;

// Phase 0 draft only. Applying migrations and opening production data are Phase 2 work.
export const V2_SCHEMA_DRAFT = `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  viewport_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration REAL,
  sha256 TEXT NOT NULL,
  thumbnail_path TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  asset_id TEXT REFERENCES assets(id),
  generation_id TEXT,
  data_json TEXT NOT NULL
);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  references_json TEXT NOT NULL,
  params_json TEXT NOT NULL,
  output_asset_ids_json TEXT NOT NULL,
  selected_variant_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  execution_token TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  remote_task_id TEXT,
  status TEXT NOT NULL,
  phase TEXT NOT NULL,
  progress REAL,
  attempt INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  external_id TEXT,
  name TEXT NOT NULL,
  definition_path TEXT NOT NULL,
  parameter_schema_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE provider_configs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_assets_project ON assets(project_id, created_at);
CREATE INDEX idx_nodes_project ON nodes(project_id);
CREATE INDEX idx_edges_project ON edges(project_id);
CREATE INDEX idx_generations_project ON generations(project_id, created_at);
CREATE INDEX idx_jobs_project_status ON jobs(project_id, status, updated_at);
`;
