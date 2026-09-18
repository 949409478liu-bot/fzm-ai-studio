export interface AssetIngestRequest {
  projectId: string;
  sourceUrl?: string;
  base64?: string;
  expectedMimeType?: string;
}

export interface AssetIngestPipeline {
  ingest(request: AssetIngestRequest): Promise<{ assetId: string }>;
}
