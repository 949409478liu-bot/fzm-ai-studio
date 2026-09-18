import type { NodeChange } from "@xyflow/react";
import { applyNodeChanges } from "@xyflow/react";
import type { V2FlowEdge, V2FlowNode, V2NodeData, V2NodeKind } from "@/v2/types/canvas";

let idCounter = 0;

export function createNodeId(kind: V2NodeKind): string {
  idCounter += 1;
  return `v2-${kind}-${Date.now().toString(36)}-${idCounter}`;
}

export function createEdgeId(source: string, target: string): string {
  idCounter += 1;
  return `v2-edge-${source}-${target}-${idCounter}`;
}

export function createCanvasNode(kind: V2NodeKind, x: number, y: number, data: Partial<V2NodeData> = {}): V2FlowNode {
  const { width, height } = getNodeSize(kind);
  const title = kind === "text" ? "Text" : kind === "image" ? "Image" : kind === "video" ? "Video" : "Group";
  return {
    id: createNodeId(kind),
    type: kind,
    position: { x, y },
    dragHandle: ".drag-handle",
    width,
    height,
    data: { kind, title, body: kind === "text" ? "Write a prompt, note, or direction..." : undefined, ...data },
  };
}

export function getNodeSize(kind: V2NodeKind): { width: number; height: number } {
  return {
    width: kind === "group" ? 420 : kind === "text" ? 300 : 320,
    height: kind === "group" ? 280 : kind === "text" ? 190 : 250,
  };
}

export function createCanvasEdge(source: string, target: string): V2FlowEdge {
  return { id: createEdgeId(source, target), source, target, type: "fzm", data: { status: "ready" } };
}

export function duplicateNode(node: V2FlowNode): V2FlowNode {
  return {
    ...node,
    id: createNodeId(node.data.kind),
    selected: false,
    position: { x: node.position.x + 32, y: node.position.y + 32 },
    data: { ...node.data, title: `${node.data.title} Copy` },
  };
}

export function applyPositionChanges(nodes: V2FlowNode[], changes: NodeChange<V2FlowNode>[]): V2FlowNode[] {
  return applyNodeChanges(changes, nodes) as V2FlowNode[];
}

export function makeHundredNodeFixture(): { nodes: V2FlowNode[]; edges: V2FlowEdge[] } {
  const nodes = Array.from({ length: 100 }, (_, index) => {
    const kind: V2NodeKind = index % 3 === 0 ? "text" : index % 3 === 1 ? "image" : "video";
    return createCanvasNode(kind, (index % 10) * 380, Math.floor(index / 10) * 310);
  });
  const edges = nodes.slice(0, 99).map((node, index) => createCanvasEdge(node.id, nodes[index + 1].id));
  return { nodes, edges };
}
