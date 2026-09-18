import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getV2DataRoot } from "@/v2/server/dataRoot";
import { ensureDir } from "@/v2/server/fsUtils";
import { migrateDatabase } from "./migrate";

type DbInstance = Database.Database;

const globalForDb = globalThis as typeof globalThis & { __fzmV2Db?: DbInstance; __fzmV2DbPath?: string };

export const V2_SCHEMA_VERSION = 2;

export function getDbPath(): string {
  return path.join(getV2DataRoot(), "fzm.db");
}

function backupBeforeFirstMigration(dbPath: string) {
  if (!fs.existsSync(dbPath)) return;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const hasMigrationTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    if (hasMigrationTable) return;
  } finally {
    db.close();
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(dbPath, `${dbPath}.bak.${stamp}`);
}

export function getDb(): DbInstance {
  const dbPath = getDbPath();
  if (globalForDb.__fzmV2Db && globalForDb.__fzmV2DbPath === dbPath) return globalForDb.__fzmV2Db;

  ensureDir(path.dirname(dbPath));
  backupBeforeFirstMigration(dbPath);
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  migrateDatabase(db, dbPath);
  globalForDb.__fzmV2Db = db;
  globalForDb.__fzmV2DbPath = dbPath;
  return db;
}

export function closeDbForTests() {
  globalForDb.__fzmV2Db?.close();
  globalForDb.__fzmV2Db = undefined;
  globalForDb.__fzmV2DbPath = undefined;
}
