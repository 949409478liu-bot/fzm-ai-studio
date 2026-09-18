import "server-only";
import type Database from "better-sqlite3";

export function migration003JobRecoveryState(db: Database.Database) {
  db.exec(`
    ALTER TABLE jobs ADD COLUMN staged_output_asset_ids_json TEXT NOT NULL DEFAULT '[]';
    CREATE INDEX jobs_status_retry_idx ON jobs(status, next_retry_at);
  `);
}
