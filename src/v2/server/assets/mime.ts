import "server-only";

export interface VerifiedMime {
  kind: "image" | "video" | "audio";
  mimeType: string;
  extension: string;
}

export function verifyMagic(buffer: Buffer): VerifiedMime | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "image", mimeType: "image/png", extension: ".png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { kind: "image", mimeType: "image/jpeg", extension: ".jpg" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { kind: "image", mimeType: "image/webp", extension: ".webp" };
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return { kind: "image", mimeType: "image/gif", extension: ".gif" };
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 16).toString("ascii");
    if (brand.includes("qt")) return { kind: "video", mimeType: "video/quicktime", extension: ".mov" };
    if (brand.includes("M4A")) return { kind: "audio", mimeType: "audio/mp4", extension: ".m4a" };
    return { kind: "video", mimeType: "video/mp4", extension: ".mp4" };
  }
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { kind: "video", mimeType: "video/webm", extension: ".webm" };
  if (buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return { kind: "audio", mimeType: "audio/mpeg", extension: ".mp3" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") return { kind: "audio", mimeType: "audio/wav", extension: ".wav" };
  return null;
}
