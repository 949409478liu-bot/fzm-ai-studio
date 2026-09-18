import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDbForTests } from "@/v2/server/db/connection";
import { createProject } from "@/v2/server/projects/repository";
import { insertAsset } from "@/v2/server/assets/repository";
import { GET } from "./route";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "fzm-v2-range-"));
  process.env.FZM_V2_DATA_DIR = dir;
  closeDbForTests();
});

afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.FZM_V2_DATA_DIR;
});

function makeVideoAsset() {
  const project = createProject("Range");
  const rel = "assets/videos/aa/range.mp4";
  fs.mkdirSync(path.join(dir, "assets/videos/aa"), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), Buffer.from(Array.from({ length: 100 }, (_, index) => index)));
  return insertAsset({ projectId: project.id, kind: "video", path: rel, mimeType: "video/mp4", originalName: "range.mp4", byteSize: 100, width: null, height: null, duration: null, sha256: "a".repeat(64), thumbnailPath: null, source: "fixture" });
}

async function range(assetId: string, header: string) {
  return GET(new Request(`http://local/api/v2/assets/${assetId}/content`, { headers: { range: header } }), { params: Promise.resolve({ assetId }) });
}

describe("asset content range", () => {
  it("VR01-VR07 supports basic single ranges", async () => {
    const asset = makeVideoAsset();
    let response = await range(asset.id, "bytes=0-9");
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-9/100");
    expect(response.headers.get("Content-Length")).toBe("10");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    await response.arrayBuffer();

    response = await range(asset.id, "bytes=10-");
    expect(response.headers.get("Content-Range")).toBe("bytes 10-99/100");
    expect(response.headers.get("Content-Length")).toBe("90");
    await response.arrayBuffer();

    response = await range(asset.id, "bytes=-10");
    expect(response.headers.get("Content-Range")).toBe("bytes 90-99/100");
    expect(response.headers.get("Content-Length")).toBe("10");
    await response.arrayBuffer();

    response = await range(asset.id, "bytes=100-110");
    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */100");
  });
});
