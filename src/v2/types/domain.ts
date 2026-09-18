export type EntityId = string;
export type ISODateTime = string;

export type AssetKind = "image" | "video" | "audio" | "document";
export type AssetSource =
  | "uploaded"
  | "generated"
  | "workflow"
  | "extracted-frame"
  | "imported";

export type CanvasNodeType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "workflow"
  | "group";

export type ReferenceRole =
  | "reference-image"
  | "first-frame"
  | "last-frame"
  | "reference-video"
  | "reference-audio"
  | "person-identity"
  | "product-identity"
  | "composition"
  | "lighting"
  | "texture"
  | "haircolor";

export interface Reference {
  assetId: EntityId;
  role: ReferenceRole;
  order: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Project {
  id: EntityId;
  name: string;
  viewport: Viewport;
  revision: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Asset {
  id: EntityId;
  projectId: EntityId;
  kind: AssetKind;
  path: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  sha256: string;
  thumbnailPath: string | null;
  source: AssetSource;
  createdAt: ISODateTime;
}

export interface CanvasNode {
  id: EntityId;
  projectId: EntityId;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  assetId?: EntityId;
  generationId?: EntityId;
  data: Record<string, unknown>;
}

export type EdgeStatus =
  | "ready"
  | "running"
  | "missing-input"
  | "failed"
  | "disabled";

export interface CanvasEdge {
  id: EntityId;
  projectId: EntityId;
  sourceNodeId: EntityId;
  targetNodeId: EntityId;
  role: ReferenceRole;
  status: EdgeStatus;
}

export interface Generation {
  id: EntityId;
  projectId: EntityId;
  action: string;
  providerId: EntityId;
  modelId: string;
  prompt: string;
  references: Reference[];
  params: Record<string, unknown>;
  outputAssetIds: EntityId[];
  selectedVariantIndex: number;
  createdAt: ISODateTime;
}

export type JobStatus =
  | "queued"
  | "preparing"
  | "submitting"
  | "polling"
  | "downloading"
  | "finalizing"
  | "succeeded"
  | "failed"
  | "canceled"
  | "rate_limited"
  | "provider_busy"
  | "interrupted";

export interface Job {
  id: EntityId;
  generationId: EntityId;
  projectId: EntityId;
  nodeId: EntityId;
  executionToken: string;
  providerId: EntityId;
  remoteTaskId: string | null;
  status: JobStatus;
  phase: string;
  progress: number | null;
  attempt: number;
  nextRetryAt: ISODateTime | null;
  error: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  finishedAt: ISODateTime | null;
}

export interface Workflow {
  id: EntityId;
  projectId: EntityId;
  kind: "runninghub" | "comfyui-api" | "daxiong";
  externalId: string | null;
  name: string;
  definitionPath: string;
  parameterSchema: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ProviderKind =
  | "gptsapi"
  | "moyu"
  | "openai-compatible"
  | "gemini-native"
  | "runninghub"
  | "daxiong-bridge"
  | "z-api"
  | "anyu"
  | "custom";

export interface ProviderConfig {
  id: EntityId;
  kind: ProviderKind;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
