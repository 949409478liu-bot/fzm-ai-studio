import "server-only";
import { canConnect } from "@/v2/canvas/graph/canConnect";
import type { DomainCanvasEdge, DomainCanvasNode } from "@/v2/projects/types";

const MAX_DATA_JSON_BYTES = 64 * 1024;
const nodeKinds = new Set(["text", "image", "video", "group"]);

function containsUnsafeValue(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith("blob:") || value.startsWith("data:");
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsUnsafeValue);
  return Object.values(value as Record<string, unknown>).some(containsUnsafeValue);
}

export function validateCanvasSnapshot(nodes: DomainCanvasNode[], edges: DomainCanvasEdge[]): { ok: true } | { ok: false; reason: string } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const node of nodes) {
    if (!nodeKinds.has(node.type)) return { ok: false, reason: "invalid_node_type" };
    if (nodeIds.has(node.id)) return { ok: false, reason: "duplicate_node_id" };
    nodeIds.add(node.id);
    const dataJson = JSON.stringify(node.data ?? {});
    if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_JSON_BYTES) return { ok: false, reason: "oversized_node_data" };
    if (containsUnsafeValue(node.data)) return { ok: false, reason: "unsafe_node_data" };
  }

  const graphEdges: Array<{ id: string; source: string; target: string }> = [];
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) return { ok: false, reason: "duplicate_edge_id" };
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) return { ok: false, reason: "edge_missing_node" };
    const check = canConnect(graphEdges, { source: edge.sourceNodeId, target: edge.targetNodeId });
    if (!check.ok) return { ok: false, reason: check.reason ?? "invalid_edge" };
    graphEdges.push({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId });
  }

  return { ok: true };
}
