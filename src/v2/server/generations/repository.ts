import "server-only";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@/v2/server/db/connection";

export interface GenerationRecord {
  id: string; projectId: string; nodeId: string | null; requestId: string; action: string; providerId: string; modelId: string; prompt: string; references: Array<{ assetId: string; role: string; order: number }>; params: Record<string, unknown>; outputAssetIds: string[]; selectedVariantIndex: number; status: string; createdAt: string; updatedAt: string; finishedAt: string | null;
}

function parseJson<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function now() { return new Date().toISOString(); }

export function mapGeneration(row: Record<string, unknown>): GenerationRecord {
  return { id: String(row.id), projectId: String(row.project_id), nodeId: row.node_id ? String(row.node_id) : null, requestId: String(row.request_id), action: String(row.action), providerId: String(row.provider_id), modelId: String(row.model_id), prompt: String(row.prompt), references: parseJson(String(row.references_json), []), params: parseJson(String(row.params_json), {}), outputAssetIds: parseJson(String(row.output_asset_ids_json), []), selectedVariantIndex: Number(row.selected_variant_index), status: String(row.status), createdAt: String(row.created_at), updatedAt: String(row.updated_at), finishedAt: row.finished_at ? String(row.finished_at) : null };
}

export function getGeneration(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapGeneration(row) : null;
}

export function getGenerationByRequest(projectId: string, requestId: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM generations WHERE project_id = ? AND request_id = ?").get(projectId, requestId) as Record<string, unknown> | undefined;
  return row ? mapGeneration(row) : null;
}

export function listGenerations(projectId: string, options: { nodeId?: string | null; status?: string | null; limit?: number; cursor?: string | null } = {}, db = getDb()) {
  const args: unknown[] = [projectId];
  const filters = ["project_id = ?"];
  if (options.nodeId) { filters.push("node_id = ?"); args.push(options.nodeId); }
  if (options.status) { filters.push("status = ?"); args.push(options.status); }
  if (options.cursor) {
    const [createdAt, id] = Buffer.from(options.cursor, "base64url").toString("utf8").split("|");
    if (createdAt && id) { filters.push("(created_at < ? OR (created_at = ? AND id < ?))"); args.push(createdAt, createdAt, id); }
  }
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  args.push(limit);
  const generations = db.prepare(`SELECT * FROM generations WHERE ${filters.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`).all(...args).map((row) => mapGeneration(row as Record<string, unknown>));
  const last = generations[generations.length - 1];
  return { generations, nextCursor: generations.length === limit && last ? Buffer.from(`${last.createdAt}|${last.id}`).toString("base64url") : null };
}

export function insertGeneration(input: Omit<GenerationRecord, "id" | "outputAssetIds" | "selectedVariantIndex" | "status" | "createdAt" | "updatedAt" | "finishedAt">, db: Database.Database) {
  const id = randomUUID();
  const timestamp = now();
  db.prepare(`INSERT INTO generations (id, project_id, node_id, request_id, action, provider_id, model_id, prompt, references_json, params_json, output_asset_ids_json, selected_variant_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, 'queued', ?, ?)`).run(id, input.projectId, input.nodeId, input.requestId, input.action, input.providerId, input.modelId, input.prompt, JSON.stringify(input.references), JSON.stringify(input.params), timestamp, timestamp);
  return getGeneration(id, db)!;
}

export function setGenerationStatus(id: string, status: string, outputAssetIds?: string[], db = getDb()) {
  const timestamp = now();
  db.prepare("UPDATE generations SET status = ?, output_asset_ids_json = COALESCE(?, output_asset_ids_json), updated_at = ?, finished_at = CASE WHEN ? IN ('succeeded','failed','canceled','interrupted') THEN ? ELSE finished_at END WHERE id = ?").run(status, outputAssetIds ? JSON.stringify(outputAssetIds) : null, timestamp, status, timestamp, id);
}

export function selectGenerationVariant(id: string, selectedVariantIndex: number, db = getDb()) {
  return db.transaction(() => {
    const generation = getGeneration(id, db);
    if (!generation) return null;
    if (generation.status !== "succeeded") throw new Error("generation_not_succeeded");
    if (!Number.isInteger(selectedVariantIndex) || selectedVariantIndex < 0 || selectedVariantIndex >= generation.outputAssetIds.length) throw new Error("selected_variant_out_of_bounds");
    const timestamp = now();
    db.prepare("UPDATE generations SET selected_variant_index = ?, updated_at = ? WHERE id = ?").run(selectedVariantIndex, timestamp, id);
    let revision: number | null = null;
    const assetId = generation.outputAssetIds[selectedVariantIndex] ?? null;
    if (generation.nodeId && assetId) {
      const node = db.prepare("SELECT generation_id FROM nodes WHERE project_id = ? AND id = ?").get(generation.projectId, generation.nodeId) as { generation_id: string | null } | undefined;
      if (node?.generation_id === generation.id) {
        db.prepare("UPDATE nodes SET asset_id = ? WHERE project_id = ? AND id = ?").run(assetId, generation.projectId, generation.nodeId);
        db.prepare("UPDATE projects SET revision = revision + 1, updated_at = ? WHERE id = ?").run(timestamp, generation.projectId);
        const project = db.prepare("SELECT revision FROM projects WHERE id = ?").get(generation.projectId) as { revision: number } | undefined;
        revision = project?.revision ?? null;
      }
    }
    return { generation: getGeneration(id, db)!, assetId, revision };
  })();
}
