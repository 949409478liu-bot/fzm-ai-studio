import "server-only";
import type Database from "better-sqlite3";

export function migration001Initial(db: Database.Database) {
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      viewport_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL
    );

    CREATE TABLE assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      original_name TEXT,
      byte_size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      duration REAL,
      sha256 TEXT NOT NULL,
      thumbnail_path TEXT,
      source TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX assets_project_sha_idx ON assets(project_id, sha256);
    CREATE INDEX assets_project_cursor_idx ON assets(project_id, created_at DESC, id DESC);

    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      asset_id TEXT NULL,
      generation_id TEXT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );
    CREATE INDEX nodes_project_idx ON nodes(project_id);

    CREATE TABLE edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      role TEXT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );
    CREATE INDEX edges_project_idx ON edges(project_id);

    CREATE TABLE generations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, created_at TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
    CREATE TABLE jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
    CREATE TABLE workflows (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);
    CREATE TABLE provider_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
  `);
}
