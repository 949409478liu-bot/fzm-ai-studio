export type AssetKind = "image" | "video" | "audio" | "document";

export interface V2Asset {
  id: string;
  projectId: string;
  kind: AssetKind;
  path: string;
  mimeType: string;
  originalName: string | null;
  byteSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  sha256: string;
  thumbnailPath: string | null;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
