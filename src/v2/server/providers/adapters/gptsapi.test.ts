import { afterEach, describe, expect, it, vi } from "vitest";
import { gptsapiAdapter, normalizeGptsApiRoot } from "./gptsapi";
import type { ProviderContext, ProviderGenerationRequest } from "../types";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

afterEach(() => vi.restoreAllMocks());

function context(): ProviderContext {
  return { provider: { id: "p", kind: "gptsapi", name: "p", enabled: true, config: { baseUrl: "https://api.gptsapi.net/v1" }, secret: { apiKey: "FAKE_SECRET_123456" }, createdAt: "", updatedAt: "" }, config: { baseUrl: "https://api.gptsapi.net/v1" }, secret: { apiKey: "FAKE_SECRET_123456" } };
}

function request(): ProviderGenerationRequest {
  return { generationId: "g", jobId: "j", action: "image.generate", model: { id: "gpt-image-2", label: "m", capabilities: ["image.generate"], internal: { providerPath: "openai" } }, prompt: "p", references: [], params: { width: 1024, height: 1024, quality: "high", count: 1 } };
}

describe("gptsapi adapter protocol parity", () => {
  it("normalizes /v1 root", () => {
    expect(normalizeGptsApiRoot("https://api.gptsapi.net/v1")).toBe("https://api.gptsapi.net");
    expect(normalizeGptsApiRoot("https://api.gptsapi.net/")).toBe("https://api.gptsapi.net");
  });

  it("persists nested task id and poll url then multi-polls without output in ticket", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.includes("text-to-image")) return Response.json({ data: { id: "task-123", urls: { get: "http://fake/poll/task-123" } } });
      if (url.includes("/poll/")) return Response.json({ data: { status: calls.filter((item) => item.includes("/poll/")).length < 4 ? "processing" : "succeeded", outputs: ["http://fake/result.png"] } });
      if (url.includes("result.png")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer FAKE_SECRET_123456");
        return new Response(Buffer.from(pngBase64, "base64"), { headers: { "content-type": "image/png" } });
      }
      throw new Error("unexpected url");
    }));
    const submission = await gptsapiAdapter.submit(context(), request());
    expect(submission.mode).toBe("async");
    expect(submission.remoteTaskId).toBe("task-123");
    let ticket = submission.ticket;
    for (let index = 0; index < 3; index += 1) {
      const poll = await gptsapiAdapter.poll!(context(), ticket);
      expect(poll.status).toBe("pending");
      ticket = poll.ticket!;
      expect(JSON.stringify(ticket)).not.toContain("result.png");
      expect(JSON.stringify(ticket)).not.toContain("BASE64_SENTINEL_XYZ");
    }
    const done = await gptsapiAdapter.poll!(context(), ticket);
    expect(done.status).toBe("succeeded");
    if (done.status === "succeeded") expect(done.outputs).toHaveLength(1);
    expect(calls.filter((item) => item.includes("text-to-image"))).toHaveLength(1);
    expect(calls.filter((item) => item.includes("/poll/"))).toHaveLength(4);
  });
});
