import type { Edge } from "@xyflow/react";

export interface GraphConnection {
  source: string | null;
  target: string | null;
}

export type ConnectRejectReason = "self-edge" | "duplicate-edge" | "cycle" | "missing-endpoint";

export interface ConnectResult {
  ok: boolean;
  reason?: ConnectRejectReason;
}

function canReach(edges: Edge[], start: string, target: string): boolean {
  const visited = new Set<string>();
  const queue = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    if (current === target) return true;
    visited.add(current);

    for (const edge of edges) {
      if (edge.source === current && !visited.has(edge.target)) queue.push(edge.target);
    }
  }

  return false;
}

export function canConnect(edges: Edge[], connection: GraphConnection): ConnectResult {
  const source = connection.source;
  const target = connection.target;
  if (!source || !target) return { ok: false, reason: "missing-endpoint" };
  if (source === target) return { ok: false, reason: "self-edge" };
  if (edges.some((edge) => edge.source === source && edge.target === target)) {
    return { ok: false, reason: "duplicate-edge" };
  }
  if (canReach(edges, target, source)) return { ok: false, reason: "cycle" };
  return { ok: true };
}

export function isValidConnection(edges: Edge[], connection: GraphConnection): boolean {
  return canConnect(edges, connection).ok;
}
