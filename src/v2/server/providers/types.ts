import type { ProviderKind } from "@/v2/types/domain";

export type ProviderCapability = "image.generate" | "image.edit" | "text.generate" | "video.generate" | "video.image-to-video";

export interface ProviderModelDescriptor {
  id: string;
  label: string;
  capabilities: ProviderCapability[];
  defaults?: Record<string, unknown>;
  internal?: Record<string, unknown>;
}

export interface ProviderConfigRecord {
  id: string;
  kind: ProviderKind;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  secret: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderClientDto {
  id: string;
  kind: ProviderKind;
  name: string;
  enabled: boolean;
  baseUrl?: string;
  apiKeyMasked?: string;
  models: Array<Omit<ProviderModelDescriptor, "internal">>;
  capabilities: ProviderCapability[];
  status: string;
}

export interface ProviderContext {
  provider: ProviderConfigRecord;
  config: Record<string, unknown>;
  secret: Record<string, unknown>;
}

export interface GenerationReferenceInput {
  assetId: string;
  role: string;
  order: number;
}

export interface ResolvedGenerationReference extends GenerationReferenceInput {
  bytes: Buffer;
  mimeType: string;
  originalName: string | null;
}

export interface ProviderGenerationRequest {
  generationId: string;
  jobId: string;
  action: ProviderCapability;
  model: ProviderModelDescriptor;
  prompt: string;
  references: ResolvedGenerationReference[];
  params: Record<string, unknown>;
}

export interface FetchedProviderOutput {
  bytes: Buffer;
  mimeType: string;
  suggestedName?: string;
  metadata?: Record<string, unknown>;
}

export type ProviderSubmission =
  | { mode: "async"; remoteTaskId: string; ticket: Record<string, unknown>; nextPollMs?: number }
  | { mode: "completed"; outputs: FetchedProviderOutput[] };

export type ProviderPollResult =
  | { status: "pending"; progress?: number; nextPollMs?: number; ticket?: Record<string, unknown> }
  | { status: "succeeded"; ticket?: Record<string, unknown>; outputs?: FetchedProviderOutput[] }
  | { status: "failed"; error: string };

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  testMode: "live-free-probe" | "config-only";
}

export interface ProviderAdapter {
  readonly kind: ProviderKind;
  test(context: ProviderContext): Promise<ProviderTestResult>;
  listModels(context: ProviderContext): Promise<ProviderModelDescriptor[]>;
  submit(context: ProviderContext, request: ProviderGenerationRequest): Promise<ProviderSubmission>;
  poll?(context: ProviderContext, ticket: Record<string, unknown>): Promise<ProviderPollResult>;
  fetchResult?(context: ProviderContext, ticket: Record<string, unknown>): Promise<FetchedProviderOutput[]>;
  cancel?(context: ProviderContext, ticket: Record<string, unknown>): Promise<{ cancelMode: "remote" | "local-only" }>;
}
