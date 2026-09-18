import type { CanvasEdge } from "@/v2/types/domain";

export interface EdgeValidationContext {
  edges: CanvasEdge[];
  sourceNodeId: string;
  targetNodeId: string;
}

export type EdgeValidationError = "self-edge" | "duplicate-edge" | "cycle";

export interface EdgeValidationResult {
  valid: boolean;
  error?: EdgeValidationError;
}
