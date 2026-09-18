import type { Viewport } from "@xyflow/react";
import type { V2NodeKind } from "@/v2/types/canvas";

export interface V2Project {
  id: string;
  name: string;
  viewport: Viewport;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DomainCanvasNode {
  id: string;
  type: V2NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  assetId: string | null;
  generationId: string | null;
  data: Record<string, unknown>;
}

export interface DomainCanvasEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  role: string | null;
  status: string;
}

export interface DomainCanvasSnapshot {
  project: V2Project;
  nodes: DomainCanvasNode[];
  edges: DomainCanvasEdge[];
  viewport: Viewport;
  revision: number;
}

export type SaveState = "idle" | "saved" | "saving" | "conflict" | "failed";
