import fs from "node:fs";
import { badRequest, isUuid, notFound } from "@/v2/server/apiValidation";
import { resolveV2Path } from "@/v2/server/assets/paths";
import { getAsset } from "@/v2/server/assets/repository";

export const runtime = "nodejs";

interface Params { params: Promise<{ assetId: string }> }

export async function GET(request: Request, { params }: Params) {
  const { assetId } = await params;
  if (!isUuid(assetId)) return badRequest("invalid_asset_id");
  const asset = getAsset(assetId);
  if (!asset) return notFound();
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant") ?? "original";
  const relativePath = variant === "thumbnail" ? asset.thumbnailPath : asset.path;
  if (!relativePath) return notFound();
  const filePath = resolveV2Path(relativePath);
  const stat = fs.statSync(filePath);
  const mime = variant === "thumbnail" ? "image/webp" : asset.mimeType;
  const range = request.headers.get("range");
  if (range && (asset.kind === "video" || asset.kind === "audio")) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return badRequest("invalid_range");
    const [, rawStart, rawEnd] = match;
    if (!rawStart && !rawEnd) return badRequest("invalid_range");
    let start: number;
    let end: number;
    if (!rawStart) {
      const suffixLength = Number(rawEnd);
      if (suffixLength <= 0) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}`, "Accept-Ranges": "bytes" } });
      start = Math.max(stat.size - suffixLength, 0);
      end = stat.size - 1;
    } else {
      start = Number(rawStart);
      end = rawEnd ? Number(rawEnd) : stat.size - 1;
    }
    if (start >= stat.size || end >= stat.size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}`, "Accept-Ranges": "bytes" } });
    return new Response(fs.createReadStream(filePath, { start, end }) as unknown as BodyInit, {
      status: 206,
      headers: { "Content-Type": mime, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Accept-Ranges": "bytes" },
    });
  }
  return new Response(fs.createReadStream(filePath) as unknown as BodyInit, { headers: { "Content-Type": mime, "Content-Length": String(stat.size), "Accept-Ranges": asset.kind === "video" || asset.kind === "audio" ? "bytes" : "none" } });
}
