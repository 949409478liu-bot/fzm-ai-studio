import "server-only";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@/v2/server/db/connection";
import type { DomainCanvasEdge, DomainCanvasNode, DomainCanvasSnapshot, V2Project } from "@/v2/projects/types";
import { validateCanvasSnapshot } from "./canvasValidation";

function now() {
  return new Date().toISOString();
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapProject(row: Record<string, unknown>): V2Project {
  return {
    id: String(row.id),
    name: String(row.name),
    viewport: parseJson(String(row.viewport_json), { x: 0, y: 0, zoom: 1 }),
    revision: Number(row.revision),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  };
}

export function normalizeProjectName(input: unknown): string {
  const value = typeof input === "string" ? input.trim().slice(0, 80) : "";
  return value || "未命名画布";
}

export function listProjects(db = getDb()): V2Project[] {
  return db.prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY updated_at DESC, id DESC").all().map((row) => mapProject(row as Record<string, unknown>));
}

export function createProject(name: string, db = getDb()): V2Project {
  const id = randomUUID();
  const timestamp = now();
  const viewport = { x: 0, y: 0, zoom: 1 };
  db.prepare("INSERT INTO projects (id, name, viewport_json, revision, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)").run(
    id,
    normalizeProjectName(name),
    JSON.stringify(viewport),
    timestamp,
    timestamp,
  );
  return getProject(id, db)!;
}

export function getProject(id: string, db = getDb()): V2Project | null {
  const row = db.prepare("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL").get(id) as Record<string, unknown> | undefined;
  return row ? mapProject(row) : null;
}

export function renameProject(id: string, name: string, db = getDb()): V2Project | null {
  db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(normalizeProjectName(name), now(), id);
  return getProject(id, db);
}

export function softDeleteProject(id: string, db = getDb()): boolean {
  const result = db.prepare("UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").run(now(), now(), id);
  return result.changes > 0;
}

function listNodes(projectId: string, db: Database.Database): DomainCanvasNode[] {
  return db
    .prepare("SELECT * FROM nodes WHERE project_id = ? ORDER BY rowid ASC")
    .all(projectId)
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        type: String(item.type) as DomainCanvasNode["type"],
        x: Number(item.x),
        y: Number(item.y),
        width: Number(item.width),
        height: Number(item.height),
        assetId: item.asset_id ? String(item.asset_id) : null,
        generationId: item.generation_id ? String(item.generation_id) : null,
        data: parseJson(String(item.data_json), {}),
      };
    });
}

function listEdges(projectId: string, db: Database.Database): DomainCanvasEdge[] {
  return db
    .prepare("SELECT * FROM edges WHERE project_id = ? ORDER BY rowid ASC")
    .all(projectId)
    .map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: String(item.id),
        sourceNodeId: String(item.source_node_id),
        targetNodeId: String(item.target_node_id),
        role: item.role ? String(item.role) : null,
        status: String(item.status),
      };
    });
}

export function getCanvasSnapshot(projectId: string, db = getDb()): DomainCanvasSnapshot | null {
  const project = getProject(projectId, db);
  if (!project) return null;
  return { project, nodes: listNodes(projectId, db), edges: listEdges(projectId, db), viewport: project.viewport, revision: project.revision };
}

export class RevisionConflictError extends Error {
  constructor(public expectedRevision: number, public currentRevision: number) {
    super("revision_conflict");
  }
}

export class CanvasValidationError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

export function saveCanvasSnapshot(input: {
  projectId: string;
  expectedRevision: number;
  viewport: unknown;
  nodes: DomainCanvasNode[];
  edges: DomainCanvasEdge[];
}, db = getDb()): DomainCanvasSnapshot {
  const validation = validateCanvasSnapshot(input.nodes, input.edges);
  if (!validation.ok) throw new CanvasValidationError(validation.reason);
  const transaction = db.transaction(() => {
    const project = getProject(input.projectId, db);
    if (!project) throw new Error("project_not_found");
    if (project.revision !== input.expectedRevision) throw new RevisionConflictError(input.expectedRevision, project.revision);

    const incomingNodeIds = new Set(input.nodes.map((node) => node.id));
    const incomingEdgeIds = new Set(input.edges.map((edge) => edge.id));
    const existingNodeIds = (db.prepare("SELECT id FROM nodes WHERE project_id = ?").all(input.projectId) as Array<{ id: string }>).map((row) => row.id);
    const existingEdgeIds = (db.prepare("SELECT id FROM edges WHERE project_id = ?").all(input.projectId) as Array<{ id: string }>).map((row) => row.id);

    const upsertNode = db.prepare(`
      INSERT INTO nodes (id, project_id, type, x, y, width, height, asset_id, generation_id, data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        asset_id = excluded.asset_id,
        generation_id = excluded.generation_id,
        data_json = excluded.data_json
    `);
    for (const node of input.nodes) {
      upsertNode.run(node.id, input.projectId, node.type, node.x, node.y, node.width, node.height, node.assetId, node.generationId, JSON.stringify(node.data ?? {}));
    }

    const upsertEdge = db.prepare(`
      INSERT INTO edges (id, project_id, source_node_id, target_node_id, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_node_id = excluded.source_node_id,
        target_node_id = excluded.target_node_id,
        role = excluded.role,
        status = excluded.status
    `);
    for (const edge of input.edges) {
      upsertEdge.run(edge.id, input.projectId, edge.sourceNodeId, edge.targetNodeId, edge.role, edge.status || "ready");
    }

    const deleteEdge = db.prepare("DELETE FROM edges WHERE project_id = ? AND id = ?");
    for (const edgeId of existingEdgeIds) {
      if (!incomingEdgeIds.has(edgeId)) deleteEdge.run(input.projectId, edgeId);
    }
    const deleteNodeEdges = db.prepare("DELETE FROM edges WHERE project_id = ? AND (source_node_id = ? OR target_node_id = ?)");
    const deleteNode = db.prepare("DELETE FROM nodes WHERE project_id = ? AND id = ?");
    for (const nodeId of existingNodeIds) {
      if (!incomingNodeIds.has(nodeId)) {
        deleteNodeEdges.run(input.projectId, nodeId, nodeId);
        deleteNode.run(input.projectId, nodeId);
      }
    }

    db.prepare("UPDATE projects SET viewport_json = ?, revision = revision + 1, updated_at = ? WHERE id = ?").run(JSON.stringify(input.viewport), now(), input.projectId);
  });
  transaction();
  const snapshot = getCanvasSnapshot(input.projectId, db);
  if (!snapshot) throw new Error("project_not_found");
  return snapshot;
}
