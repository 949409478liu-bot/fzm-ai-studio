"use client";

import type { PromptReference } from "./types";
import type { V2FlowEdge, V2FlowNode } from "@/v2/types/canvas";

export function resolveGraphReferences(targetNodeId: string, nodes: V2FlowNode[], edges: V2FlowEdge[]): PromptReference[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const references: PromptReference[] = [];
  edges
    .filter((edge) => edge.target === targetNodeId && (edge.data?.role ?? "reference-image") === "reference-image")
    .forEach((edge) => {
      const source = nodeById.get(edge.source);
      const assetId = typeof source?.data.assetId === "string" ? source.data.assetId : "";
      if (assetId) references.push({ assetId, role: "reference-image", order: references.length, source: "graph", edgeId: edge.id });
    });
  return references;
}

export function toGenerationReferences(references: PromptReference[]) {
  return references.map((reference, order) => ({ assetId: reference.assetId, role: reference.role, order }));
}

export function hasMissingGraphInput(targetNodeId: string, nodes: V2FlowNode[], edges: V2FlowEdge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return edges.some((edge) => edge.target === targetNodeId && (edge.data?.role ?? "reference-image") === "reference-image" && typeof nodeById.get(edge.source)?.data.assetId !== "string");
}
