import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvasEdge, createCanvasNode, makeHundredNodeFixture } from "@/v2/canvas/graph/graphUtils";
import { closeDbForTests, getDb } from "@/v2/server/db/connection";
import { createProject, getCanvasSnapshot, renameProject, saveCanvasSnapshot, softDeleteProject, RevisionConflictError } from "./repository";
import { flowEdgeToDomain, flowNodeToDomain } from "@/v2/projects/canvasMapper";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-v2-db-"));
  process.env.FZM_V2_DATA_DIR = dir;
  closeDbForTests();
});

afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.FZM_V2_DATA_DIR;
});

describe("SQLite project repository", () => {
  it("DB01-DB03 migrates idempotently with WAL and foreign keys", () => {
    const db = getDb();
    expect(db.prepare("SELECT version FROM schema_migrations").all()).toHaveLength(1);
    closeDbForTests();
    const reopened = getDb();
    expect(reopened.prepare("SELECT version FROM schema_migrations").all()).toHaveLength(1);
    expect(reopened.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(String(reopened.pragma("journal_mode", { simple: true })).toLowerCase()).toBe("wal");
  });

  it("DB04-DB10 creates, renames, soft deletes, saves, reloads and rejects stale revision", () => {
    const project = createProject("  Hair Board  ");
    expect(project.name).toBe("Hair Board");
    expect(renameProject(project.id, "Renamed")?.name).toBe("Renamed");
    const text = createCanvasNode("text", 10, 20);
    const image = createCanvasNode("image", 50, 80);
    const edge = createCanvasEdge(text.id, image.id);
    const saved = saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: { x: 11, y: 12, zoom: 0.8 }, nodes: [text, image].map(flowNodeToDomain), edges: [edge].map(flowEdgeToDomain) });
    expect(saved.revision).toBe(1);
    expect(getCanvasSnapshot(project.id)?.nodes).toHaveLength(2);
    expect(() => saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: saved.viewport, nodes: [], edges: [] })).toThrow(RevisionConflictError);
    expect(softDeleteProject(project.id)).toBe(true);
    expect(getCanvasSnapshot(project.id)).toBeNull();
  });

  it("DB11-DB12 persists 100 nodes, 99 edges and viewport", () => {
    const project = createProject("Large");
    const fixture = makeHundredNodeFixture();
    saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: { x: -220, y: 140, zoom: 0.42 }, nodes: fixture.nodes.map(flowNodeToDomain), edges: fixture.edges.map(flowEdgeToDomain) });
    const reloaded = getCanvasSnapshot(project.id)!;
    expect(reloaded.nodes).toHaveLength(100);
    expect(reloaded.edges).toHaveLength(99);
    expect(reloaded.viewport).toEqual({ x: -220, y: 140, zoom: 0.42 });
  });
});
