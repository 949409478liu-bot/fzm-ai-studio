import type { Edge, Node, Viewport } from "@xyflow/react";

export type CanvasTool = "select" | "hand" | "connect";
export type V2NodeKind = "text" | "image" | "video" | "group";

export interface V2NodeData extends Record<string, unknown> {
  kind: V2NodeKind;
  title: string;
  body?: string;
  assetId?: string;
  originalName?: string;
  mimeType?: string;
}

export type V2FlowNode = Node<V2NodeData, V2NodeKind>;
export type V2FlowEdge = Edge<{ status?: "ready" | "running" | "missing-input" | "failed" | "disabled"; role?: string }>;

export interface CanvasSnapshot {
  nodes: V2FlowNode[];
  edges: V2FlowEdge[];
}

export interface CanvasHistoryState {
  past: CanvasSnapshot[];
  present: CanvasSnapshot;
  future: CanvasSnapshot[];
}

export type CanvasViewport = Viewport;

export interface Point {
  x: number;
  y: number;
}

export interface FloatingPosition extends Point {
  flowX?: number;
  flowY?: number;
}
