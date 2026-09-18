import "server-only";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import sharp from "sharp";
import { relativeThumbnailPath, resolveV2Path, tempPath } from "./paths";

export async function inspectImage(filePath: string) {
  const metadata = await sharp(filePath, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error("invalid_image");
  return { width: metadata.width, height: metadata.height };
}

export async function ensureImageThumbnail(filePath: string, sha256: string): Promise<{ relativePath: string; created: boolean; tmpPath: string | null }> {
  const relativePath = relativeThumbnailPath(sha256);
  const output = resolveV2Path(relativePath);
  if (fsSync.existsSync(output)) return { relativePath, created: false, tmpPath: null };
  const tmp = tempPath(`${sha256}.thumbnail.${process.pid}.${Date.now()}.webp`);
  try {
    await sharp(filePath, { failOn: "error" }).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toFile(tmp);
    if (fsSync.existsSync(output)) {
      await fs.rm(tmp, { force: true });
      return { relativePath, created: false, tmpPath: null };
    }
    await fs.rename(tmp, output);
    return { relativePath, created: true, tmpPath: null };
  } catch (error) {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
}
