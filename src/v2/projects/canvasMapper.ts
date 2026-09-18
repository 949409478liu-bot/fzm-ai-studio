import type { DomainCanvasEdge, DomainCanvasNode, DomainCanvasSnapshot } from "./types";
import type { V2FlowEdge, V2FlowNode, V2NodeData } from "@/v2/types/canvas";

type FlowEdgeStatus = NonNullable<V2FlowEdge["data"]>["status"];

const forbiddenDataKeys = new Set(["selected", "dragging", "measured", "internals"]);

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (forbiddenDataKeys.has(key)) continue;
    if (typeof value === "function") continue;
    if (typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"))) continue;
    safe[key] = value;
  }
  return safe;
}

export function flowNodeToDomain(node: V2FlowNode): DomainCanvasNode {
  const data = sanitizeData(node.data);
  delete data.assetId;
  return {
    id: node.id,
    type: node.data.kind,
    x: node.position.x,
    y: node.position.y,
    width: node.width ?? 320,
    height: node.height ?? 240,
    assetId: typeof node.data.assetId === "string" ? node.data.assetId : null,
    generationId: null,
    data,
  };
}

export function flowEdgeToDomain(edge: V2FlowEdge): DomainCanvasEdge {
  return {
    id: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    role: typeof edge.data?.role === "string" ? edge.data.role : null,
    status: edge.data?.status ?? "ready",
  };
}

export function domainNodeToFlow(node: DomainCanvasNode): V2FlowNode {
  const data = { ...node.data, kind: node.type, assetId: node.assetId ?? undefined } as V2NodeData;
  return {
    id: node.id,
    type: node.type,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    dragHandle: ".drag-handle",
    data,
  };
}

export function domainEdgeToFlow(edge: DomainCanvasEdge): V2FlowEdge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: "fzm",
    data: { status: edge.status as FlowEdgeStatus },
  };
}

export function snapshotToFlow(snapshot: DomainCanvasSnapshot) {
  return {
    nodes: snapshot.nodes.map(domainNodeToFlow),
    edges: snapshot.edges.map(domainEdgeToFlow),
    viewport: snapshot.viewport,
  };
}
