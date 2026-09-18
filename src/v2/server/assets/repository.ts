import "server-only";
import { randomUUID } from "node:crypto";
import type { V2Asset, AssetKind } from "@/v2/assets/types";
import { getDb } from "@/v2/server/db/connection";

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function mapAsset(row: Record<string, unknown>): V2Asset {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    kind: String(row.kind) as AssetKind,
    path: String(row.path),
    mimeType: String(row.mime_type),
    originalName: row.original_name ? String(row.original_name) : null,
    byteSize: Number(row.byte_size),
    width: row.width == null ? null : Number(row.width),
    height: row.height == null ? null : Number(row.height),
    duration: row.duration == null ? null : Number(row.duration),
    sha256: String(row.sha256),
    thumbnailPath: row.thumbnail_path ? String(row.thumbnail_path) : null,
    source: String(row.source),
    metadata: parseJson(String(row.metadata_json), {}),
    createdAt: String(row.created_at),
  };
}

export function getAsset(assetId: string, db = getDb()): V2Asset | null {
  const row = db.prepare("SELECT * FROM assets WHERE id = ?").get(assetId) as Record<string, unknown> | undefined;
  return row ? mapAsset(row) : null;
}

export function findProjectAssetBySha(projectId: string, sha256: string, db = getDb()): V2Asset | null {
  const row = db.prepare("SELECT * FROM assets WHERE project_id = ? AND sha256 = ?").get(projectId, sha256) as Record<string, unknown> | undefined;
  return row ? mapAsset(row) : null;
}

export function insertAsset(input: Omit<V2Asset, "id" | "createdAt" | "metadata"> & { metadata?: Record<string, unknown> }, db = getDb()): V2Asset {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO assets (id, project_id, kind, path, mime_type, original_name, byte_size, width, height, duration, sha256, thumbnail_path, source, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, input.projectId, input.kind, input.path, input.mimeType, input.originalName, input.byteSize, input.width, input.height, input.duration, input.sha256, input.thumbnailPath, input.source, JSON.stringify(input.metadata ?? {}), createdAt,
  );
  return getAsset(id, db)!;
}

export function listAssets(projectId: string, options: { limit: number; cursor?: string | null; kind?: string | null }, db = getDb()): { assets: V2Asset[]; nextCursor: string | null } {
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  const args: unknown[] = [projectId];
  const filters = ["project_id = ?"];
  if (options.kind && ["image", "video", "audio", "document"].includes(options.kind)) { filters.push("kind = ?"); args.push(options.kind); }
  if (options.cursor) {
    const [createdAt, id] = Buffer.from(options.cursor, "base64url").toString("utf8").split("|");
    if (!createdAt || !id) throw new Error("invalid_cursor");
    filters.push("(created_at < ? OR (created_at = ? AND id < ?))");
    args.push(createdAt, createdAt, id);
  }
  args.push(limit + 1);
  const rows = db.prepare(`SELECT * FROM assets WHERE ${filters.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`).all(...args).map((row) => mapAsset(row as Record<string, unknown>));
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { assets: page, nextCursor: rows.length > limit && last ? Buffer.from(`${last.createdAt}|${last.id}`).toString("base64url") : null };
}
