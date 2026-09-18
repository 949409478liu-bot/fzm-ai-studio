import "server-only";
import type Database from "better-sqlite3";

export function migration004JobDiagnostics(db: Database.Database) {
  db.exec(`
    ALTER TABLE jobs ADD COLUMN error_code TEXT NULL;
    ALTER TABLE jobs ADD COLUMN http_status INTEGER NULL;
  `);
}