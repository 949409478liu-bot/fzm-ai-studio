import "server-only";
import path from "node:path";
import { getV2DataRoot } from "@/v2/server/dataRoot";
import { assertInsideRoot, ensureDir } from "@/v2/server/fsUtils";
import type { AssetKind } from "@/v2/assets/types";

export function assetRoot() {
  const root = getV2DataRoot();
  for (const dir of ["assets/images", "assets/videos", "assets/audio", "assets/documents", "thumbnails", "workflows", "exports", "tmp"]) {
    ensureDir(path.join(root, dir));
  }
  return root;
}

export function resolveV2Path(relativePath: string): string {
  return assertInsideRoot(assetRoot(), relativePath);
}

export function relativeBlobPath(kind: AssetKind, sha256: string, extension: string): string {
  const folder = kind === "image" ? "images" : kind === "video" ? "videos" : kind === "audio" ? "audio" : "documents";
  return path.posix.join("assets", folder, sha256.slice(0, 2), `${sha256}${extension}`);
}

export function relativeThumbnailPath(sha256: string): string {
  return path.posix.join("thumbnails", `${sha256}-512.webp`);
}

export function tempPath(name: string): string {
  return resolveV2Path(path.posix.join("tmp", name));
}
