import "server-only";
import type Database from "better-sqlite3";
import fs from "node:fs";
import { migration001Initial } from "./migrations/001_initial";
import { migration002ProviderJobs } from "./migrations/002_provider_jobs";
import { migration003JobRecoveryState } from "./migrations/003_job_recovery_state";
import { migration004JobDiagnostics } from "./migrations/004_job_diagnostics";

interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  { version: 1, name: "initial", up: migration001Initial },
  { version: 2, name: "provider_jobs", up: migration002ProviderJobs },
  { version: 3, name: "job_recovery_state", up: migration003JobRecoveryState },
  { version: 4, name: "job_diagnostics", up: migration004JobDiagnostics },
];

function backupBeforeSchema2(dbPath?: string) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.bak.pre-v2-schema-2.${stamp}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

export function migrateDatabase(db: Database.Database, dbPath?: string) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((row) => (row as { version: number }).version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    if (migration.version === 2 || migration.version === 3) backupBeforeSchema2(dbPath);
    const run = db.transaction(() => {
      migration.up(db);
      db.prepare("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)").run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
    run();
  }
}
