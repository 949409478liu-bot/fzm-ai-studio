import "server-only";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { findProjectAssetBySha, insertAsset } from "./repository";
import { verifyMagic } from "./mime";
import { assetRoot, relativeBlobPath, resolveV2Path, tempPath } from "./paths";
import { ensureImageThumbnail, inspectImage } from "./thumbnail";
import { getProject } from "@/v2/server/projects/repository";
import type { V2Asset } from "@/v2/assets/types";

const DEFAULT_MAX_UPLOAD_BYTES = 160 * 1024 * 1024;

function maxUploadBytes() {
  const parsed = Number(process.env.FZM_V2_MAX_UPLOAD_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = fsSync.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function removeIfExists(filePath: string | null) {
  if (!filePath) return;
  await fs.rm(filePath, { force: true }).catch(() => undefined);
}

export async function ingestAsset(projectId: string, file: File, source = "upload"): Promise<V2Asset> {
  assetRoot();
  if (!getProject(projectId)) throw new Error("project_not_found");
  if (file.size <= 0 || file.size > maxUploadBytes()) throw new Error("invalid_file_size");

  const temp = tempPath(`${randomUUID()}.upload`);
  let movedOriginal: string | null = null;
  let createdThumbnail: string | null = null;
  let targetPreExisted = false;

  try {
    await fs.writeFile(temp, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const header = await fs.readFile(temp).then((buffer) => buffer.subarray(0, 64));
    const verified = verifyMagic(header);
    if (!verified) throw new Error("unsupported_mime");
    const sha256 = await sha256File(temp);
    const existing = findProjectAssetBySha(projectId, sha256);
    if (existing) {
      await removeIfExists(temp);
      return existing;
    }

    const relativePath = relativeBlobPath(verified.kind, sha256, verified.extension);
    const target = resolveV2Path(relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    targetPreExisted = fsSync.existsSync(target);
    if (targetPreExisted) await removeIfExists(temp);
    else {
      await fs.rename(temp, target);
      movedOriginal = target;
    }

    let width: number | null = null;
    let height: number | null = null;
    let thumbnailPath: string | null = null;
    if (verified.kind === "image") {
      const metadata = await inspectImage(target);
      width = metadata.width;
      height = metadata.height;
      const thumbnail = await ensureImageThumbnail(target, sha256);
      thumbnailPath = thumbnail.relativePath;
      createdThumbnail = thumbnail.created ? resolveV2Path(thumbnail.relativePath) : null;
    }

    return insertAsset({
      projectId,
      kind: verified.kind,
      path: relativePath,
      mimeType: verified.mimeType,
      originalName: file.name || null,
      byteSize: file.size,
      width,
      height,
      duration: null,
      sha256,
      thumbnailPath,
      source,
      metadata: {},
    });
  } catch (error) {
    await removeIfExists(temp);
    if (!targetPreExisted) await removeIfExists(movedOriginal);
    await removeIfExists(createdThumbnail);
    throw error;
  }
}
