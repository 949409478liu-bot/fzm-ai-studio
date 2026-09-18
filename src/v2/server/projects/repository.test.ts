import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCanvasEdge, createCanvasNode, makeHundredNodeFixture } from "@/v2/canvas/graph/graphUtils";
import { closeDbForTests, getDb } from "@/v2/server/db/connection";
import { createProject, getCanvasSnapshot, renameProject, saveCanvasSnapshot, softDeleteProject, RevisionConflictError, CanvasValidationError } from "./repository";
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
    expect(db.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([{ version: 1 }, { version: 2 }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('provider_configs', 'generations', 'jobs', 'node_execution_state')").all()).toHaveLength(4);
    closeDbForTests();
    const reopened = getDb();
    expect(reopened.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([{ version: 1 }, { version: 2 }]);
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

  it("RC01 prevents stale overwrite after revision conflict", () => {
    const project = createProject("Conflict");
    const a = createCanvasNode("text", 0, 0, { body: "A" });
    saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [a].map(flowNodeToDomain), edges: [] });
    const b = createCanvasNode("text", 20, 20, { body: "B stale" });
    expect(() => saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [b].map(flowNodeToDomain), edges: [] })).toThrow(RevisionConflictError);
    const latest = getCanvasSnapshot(project.id)!;
    expect(latest.revision).toBe(1);
    expect(latest.nodes[0].data.body).toBe("A");
  });

  it("CS01-CS06 syncs stable ids without full delete/reinsert semantics", () => {
    const project = createProject("Stable");
    const n1 = createCanvasNode("text", 0, 0);
    const n2 = createCanvasNode("image", 100, 0);
    const edge = createCanvasEdge(n1.id, n2.id);
    let saved = saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [n1, n2].map(flowNodeToDomain), edges: [edge].map(flowEdgeToDomain) });
    for (let index = 0; index < 10; index += 1) {
      n1.position.x += 5;
      saved = saveCanvasSnapshot({ projectId: project.id, expectedRevision: saved.revision, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [n1, n2].map(flowNodeToDomain), edges: [edge].map(flowEdgeToDomain) });
    }
    expect(saved.nodes.map((node) => node.id)).toEqual([n1.id, n2.id]);
    saved = saveCanvasSnapshot({ projectId: project.id, expectedRevision: saved.revision, viewport: { x: 0, y: 0, zoom: 1 }, nodes: [n1].map(flowNodeToDomain), edges: [] });
    expect(saved.nodes).toHaveLength(1);
    expect(saved.edges).toHaveLength(0);
  });

  it("CV01-CV06 rejects invalid canonical canvas payloads", () => {
    const project = createProject("Validation");
    const a = flowNodeToDomain(createCanvasNode("text", 0, 0));
    const b = flowNodeToDomain(createCanvasNode("text", 40, 0));
    const save = (nodes, edges) => saveCanvasSnapshot({ projectId: project.id, expectedRevision: 0, viewport: { x: 0, y: 0, zoom: 1 }, nodes, edges });
    expect(() => save([a, a], [])).toThrow(CanvasValidationError);
    expect(() => save([a], [{ id: "e", sourceNodeId: a.id, targetNodeId: "missing", role: null, status: "ready" }])).toThrow(CanvasValidationError);
    expect(() => save([a], [{ id: "e", sourceNodeId: a.id, targetNodeId: a.id, role: null, status: "ready" }])).toThrow(CanvasValidationError);
    expect(() => save([a, b], [{ id: "e1", sourceNodeId: a.id, targetNodeId: b.id, role: null, status: "ready" }, { id: "e2", sourceNodeId: b.id, targetNodeId: a.id, role: null, status: "ready" }])).toThrow(CanvasValidationError);
    expect(() => save([{ ...a, data: { url: "blob:http://local" } }], [])).toThrow(CanvasValidationError);
    expect(() => save([{ ...a, data: { body: "x".repeat(70_000) } }], [])).toThrow(CanvasValidationError);
  });
});
