import type { V2Asset } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) throw Object.assign(new Error("request_failed"), { response, body });
  return body;
}

export async function listProjectAssets(projectId: string, options: { kind?: string; cursor?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams({ limit: String(options.limit ?? 50) });
  if (options.kind && options.kind !== "all") params.set("kind", options.kind);
  if (options.cursor) params.set("cursor", options.cursor);
  return parseJson<{ assets: V2Asset[]; nextCursor: string | null }>(await fetch(`/api/v2/projects/${projectId}/assets?${params}`, { cache: "no-store" }));
}

export async function uploadProjectAssets(projectId: string, files: File[]): Promise<V2Asset[]> {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  const body = await parseJson<{ assets: V2Asset[] }>(await fetch(`/api/v2/projects/${projectId}/assets`, { method: "POST", body: form }));
  return body.assets;
}

export function assetContentUrl(assetId: string, variant: "original" | "thumbnail" = "original") {
  return `/api/v2/assets/${assetId}/content?variant=${variant}`;
}
