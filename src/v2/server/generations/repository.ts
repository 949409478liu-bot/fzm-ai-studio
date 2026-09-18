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
