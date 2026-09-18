import { afterEach, describe, expect, it, vi } from "vitest";
import { moyuAdapter } from "./moyu";
import { geminiNativeAdapter } from "./geminiNative";
import type { ProviderContext, ProviderGenerationRequest } from "../types";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

afterEach(() => vi.restoreAllMocks());

function ctx(baseUrl = "https://www.moyu.info/v1"): ProviderContext {
  return { provider: { id: "p", kind: "moyu", name: "p", enabled: true, config: { baseUrl }, secret: { apiKey: "k" }, createdAt: "", updatedAt: "" }, config: { baseUrl }, secret: { apiKey: "k" } };
}

function req(action: "image.generate" | "image.edit", protocol = "openai-images"): ProviderGenerationRequest {
  return { generationId: "g", jobId: "j", action, model: { id: protocol === "gemini-native" ? "gemini-3-pro-image-preview" : "gpt-image-2", label: "m", capabilities: ["image.generate", "image.edit"], internal: { protocol, authMode: "bearer" } }, prompt: "p", references: action === "image.edit" ? [{ assetId: "a", role: "reference-image", order: 0, bytes: png, mimeType: "image/png", originalName: "ref.png" }] : [], params: { width: 1024, height: 1024, quality: "auto", count: 1 } };
}

describe("moyu and gemini protocol parity", () => {
  it("uses OpenAI /v1 without double prefix and multipart edit original bytes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://www.moyu.info/v1/images/edits");
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init!.body as FormData;
      const file = form.get("image") as File;
      expect(Buffer.from(await file.arrayBuffer()).equals(png)).toBe(true);
      return Response.json({ data: [{ b64_json: png.toString("base64") }] });
    }));
    const result = await moyuAdapter.submit(ctx(), req("image.edit"));
    expect(result.mode).toBe("completed");
  });

  it("uses Gemini native bearer body for Moyu Gemini", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://www.moyu.info/v1beta/models/gemini-3-pro-image-preview:generateContent");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer k");
      const body = JSON.parse(String(init?.body));
      expect(body.generationConfig.responseModalities).toEqual(["IMAGE"]);
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }] } }] });
    }));
    const result = await moyuAdapter.submit(ctx(), req("image.generate", "gemini-native"));
    expect(result.mode).toBe("completed");
  });

  it("supports official query key and proxy bearer auth for Gemini native", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (urls.length === 1) expect(url).toContain("?key=k");
      if (urls.length === 2) expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer k");
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }] } }] });
    }));
    await geminiNativeAdapter.submit(ctx("https://generativelanguage.googleapis.com/v1"), { ...req("image.generate", "gemini-native"), model: { ...req("image.generate", "gemini-native").model, internal: { protocol: "gemini-native", authMode: "query-key" } } });
    await geminiNativeAdapter.submit(ctx("https://proxy.example/v1"), { ...req("image.generate", "gemini-native"), model: { ...req("image.generate", "gemini-native").model, internal: { protocol: "gemini-native", authMode: "bearer" } } });
  });
});
