import type { ProviderConfig } from "@/v2/types/domain";

export interface ProviderModel {
  id: string;
  name: string;
  capabilities: string[];
}

export interface ProviderRequest {
  action: string;
  modelId: string;
  prompt: string;
  references: Array<{ assetId: string; role: string; order: number }>;
  params: Record<string, unknown>;
}

export interface ProviderTicket {
  remoteTaskId: string;
  status: string;
}

export interface ProviderResult {
  status: string;
  outputs: Array<{ url?: string; base64?: string; mimeType?: string }>;
}

export interface ProviderAdapter {
  test(config: ProviderConfig): Promise<void>;
  listModels(config: ProviderConfig): Promise<ProviderModel[]>;
  submit(request: ProviderRequest): Promise<ProviderTicket>;
  poll(ticket: ProviderTicket): Promise<ProviderTicket>;
  cancel?(ticket: ProviderTicket): Promise<void>;
  fetchResult(ticket: ProviderTicket): Promise<ProviderResult>;
}
