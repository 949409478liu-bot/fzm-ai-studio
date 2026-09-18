import type { ProviderCapability, ProviderDto, ProviderModelDto } from "@/v2/providers/types";
import type { ReferenceRole } from "@/v2/types/domain";

export type GenerationActionId = "image.generate" | "image.edit";

export interface ActionDescriptor {
  id: GenerationActionId;
  label: string;
  icon: string;
  sourceKinds: Array<"image" | "text" | "video">;
  outputKind: "image";
  capability: ProviderCapability;
  referencePolicy: "none" | "optional" | "required";
  promptRequired: boolean;
  enabled: boolean;
}

export interface PromptReference {
  assetId: string;
  role: ReferenceRole;
  order: number;
  source: "graph" | "manual" | "history";
  edgeId?: string;
}

export interface GenerationSnapshotReference {
  assetId: string;
  role: ReferenceRole;
  order: number;
}

export interface GenerationRecordDto {
  id: string;
  projectId: string;
  nodeId: string | null;
  requestId: string;
  action: GenerationActionId;
  providerId: string;
  modelId: string;
  prompt: string;
  references: GenerationSnapshotReference[];
  params: Record<string, unknown>;
  outputAssetIds: string[];
  selectedVariantIndex: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface JobDto {
  id: string;
  generationId: string;
  nodeId?: string | null;
  status: string;
  phase: string;
  progress: number | null;
  providerId: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface ProviderSelection {
  provider: ProviderDto;
  model: ProviderModelDto;
}

export interface SubmitGenerationInput {
  projectId: string;
  nodeId: string;
  action: GenerationActionId;
  prompt: string;
  providerId: string;
  modelId: string;
  references: GenerationSnapshotReference[];
  params: Record<string, unknown>;
}
