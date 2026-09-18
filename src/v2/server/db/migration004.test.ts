import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeDbForTests, getDb } from "./connection";
import { createProject } from "@/v2/server/projects/repository";
import Database from "better-sqlite3";

const original = process.env.FZM_V2_DATA_DIR;
afterEach(() => {
  closeDbForTests();
  if (original === undefined) delete process.env.FZM_V2_DATA_DIR;
  else process.env.FZM_V2_DATA_DIR = original;
});

describe("migration 004 diagnostics", () => {
  it("initializes from zero and reopens idempotently", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-migration-004-"));
    try {
      process.env.FZM_V2_DATA_DIR = dir;
      const db = getDb();
      expect(db.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([1, 2, 3, 4].map((version) => ({ version })));
      expect((db.pragma("table_info(jobs)") as Array<{ name: string }>).map((row) => row.name)).toEqual(expect.arrayContaining(["error_code", "http_status"]));
      closeDbForTests();
      expect(getDb().prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toHaveLength(4);
    } finally { closeDbForTests(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
  it("upgrades an existing version 3 database without losing records", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-upgrade-004-"));
    try {
      process.env.FZM_V2_DATA_DIR = dir;
      const db = getDb();
      const project = createProject("Existing");
      db.prepare("DELETE FROM schema_migrations WHERE version = 4").run();
      // A fixture representing the previous schema, never the real local database.
      closeDbForTests();
      const fixture = new Database(path.join(dir, "fzm.db"));
      fixture.exec("ALTER TABLE jobs DROP COLUMN error_code; ALTER TABLE jobs DROP COLUMN http_status;");
      fixture.close();
      expect(getDb().prepare("SELECT name FROM projects WHERE id = ?").get(project.id)).toEqual({ name: "Existing" });
      expect(getDb().prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toHaveLength(4);
    } finally { closeDbForTests(); fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
