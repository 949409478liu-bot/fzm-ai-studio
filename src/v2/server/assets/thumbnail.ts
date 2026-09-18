import "server-only";
import sharp from "sharp";
import { relativeThumbnailPath, resolveV2Path } from "./paths";

export async function inspectImage(filePath: string) {
  const metadata = await sharp(filePath, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error("invalid_image");
  return { width: metadata.width, height: metadata.height };
}

export async function generateImageThumbnail(filePath: string, sha256: string): Promise<string> {
  const relativePath = relativeThumbnailPath(sha256);
  const output = resolveV2Path(relativePath);
  await sharp(filePath, { failOn: "error" }).rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toFile(output);
  return relativePath;
}
