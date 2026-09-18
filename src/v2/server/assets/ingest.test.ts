import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDbForTests } from "@/v2/server/db/connection";
import { createProject } from "@/v2/server/projects/repository";
import { assertInsideRoot } from "@/v2/server/fsUtils";
import { ingestAsset } from "./ingest";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-v2-assets-"));
  process.env.FZM_V2_DATA_DIR = dir;
  closeDbForTests();
});

afterEach(async () => {
  closeDbForTests();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      break;
    } catch {
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  delete process.env.FZM_V2_DATA_DIR;
});

async function imageFile(format: "png" | "jpeg" | "webp", name = `sample.${format}`) {
  const buffer = await sharp({ create: { width: 18, height: 12, channels: 3, background: "#d88ac8" } }).toFormat(format).toBuffer();
  return new File([buffer], name, { type: `image/${format}` });
}

describe("asset ingestion", () => {
  it("AS01-AS08 records image metadata, original and thumbnail", async () => {
    const project = createProject("Assets");
    const asset = await ingestAsset(project.id, await imageFile("png"));
    expect(asset.mimeType).toBe("image/png");
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.width).toBe(18);
    expect(asset.height).toBe(12);
    expect(fs.existsSync(path.join(dir, asset.path))).toBe(true);
    expect(asset.thumbnailPath && fs.existsSync(path.join(dir, asset.thumbnailPath))).toBe(true);
  });

  it("AS02-AS04 accepts JPEG/WebP and normalizes fake extensions safely", async () => {
    const project = createProject("Mime");
    expect((await ingestAsset(project.id, await imageFile("jpeg", "fake.png"))).mimeType).toBe("image/jpeg");
    expect((await ingestAsset(project.id, await imageFile("webp", "fake.jpg"))).mimeType).toBe("image/webp");
  });

  it("AS09 deduplicates same project blob bytes", async () => {
    const project = createProject("Dedup");
    const file = await imageFile("png");
    const first = await ingestAsset(project.id, file);
    const second = await ingestAsset(project.id, file);
    expect(second.id).toBe(first.id);
    expect(second.path).toBe(first.path);
  });

  it("AS10 rejects path traversal", () => {
    expect(() => assertInsideRoot(dir, "../escape.png")).toThrow(/Path traversal/);
  });

  it("AS11-AS12 rejects corrupt image and cleans tmp", async () => {
    const project = createProject("Bad");
    await expect(ingestAsset(project.id, new File([Buffer.from("not an image")], "x.png", { type: "image/png" }))).rejects.toThrow(/unsupported_mime/);
    expect(fs.existsSync(path.join(dir, "tmp")) ? fs.readdirSync(path.join(dir, "tmp")) : []).toHaveLength(0);
  });
});
