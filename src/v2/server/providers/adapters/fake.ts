import "server-only";
import sharp from "sharp";
import type { ProviderAdapter, ProviderContext, ProviderGenerationRequest, ProviderModelDescriptor, ProviderPollResult, ProviderSubmission } from "../types";

const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");

function models(context: ProviderContext): ProviderModelDescriptor[] {
  const configured = Array.isArray(context.config.models) ? context.config.models : null;
  if (configured) return configured as ProviderModelDescriptor[];
  return [{ id: "fake-image", label: "Fake Image", capabilities: ["image.generate", "image.edit"], internal: { maxReferences: 4 } }];
}

async function fakePng(index: number) {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: (index * 70) % 255, g: (index * 110) % 255, b: (index * 150) % 255 } } }).png().toBuffer();
}

async function outputs(request: ProviderGenerationRequest) {
  const count = Math.min(Math.max(Number(request.params.count ?? 1), 1), 4);
  return Promise.all(Array.from({ length: count }, async (_, index) => ({ bytes: count === 1 ? onePixelPng : await fakePng(index + 1), mimeType: "image/png", suggestedName: `fake-${request.generationId}-${index}.png`, metadata: { fakeProvider: true, action: request.action, referenceCount: request.references.length, index } })));
}

export const fakeAdapter: ProviderAdapter = {
  kind: "custom",
  async test() { return { ok: true, message: "Fake provider ready", testMode: "config-only" }; },
  async listModels(context) { return models(context); },
  async submit(context, request): Promise<ProviderSubmission> {
    if (context.config.fail === true) throw new Error("fake_generation_failed");
    if (context.config.async === true) return { mode: "async", remoteTaskId: request.jobId, ticket: { polls: 0, request: { count: Number(request.params.count ?? 1), action: request.action, generationId: request.generationId, referenceCount: request.references.length } }, nextPollMs: 250 };
    return { mode: "completed", outputs: await outputs(request) };
  },
  async poll(_context, ticket): Promise<ProviderPollResult> {
    const polls = Number(ticket.polls ?? 0) + 1;
    if (polls < 2) return { status: "pending", progress: 0.5, nextPollMs: 250, ticket: { ...ticket, polls } };
    const request = ticket.request as { count?: number; action?: "image.generate" | "image.edit"; generationId?: string; referenceCount?: number } | undefined;
    const count = Math.min(Math.max(Number(request?.count ?? 1), 1), 4);
    return { status: "succeeded", outputs: await Promise.all(Array.from({ length: count }, async (_, index) => ({ bytes: count === 1 ? onePixelPng : await fakePng(index + 1), mimeType: "image/png", suggestedName: `fake-${request?.generationId ?? "async"}-${index}.png`, metadata: { fakeProvider: true, action: request?.action, referenceCount: request?.referenceCount, index } }))) };
  },
  async fetchResult() { return [{ bytes: onePixelPng, mimeType: "image/png", suggestedName: "fake-fetch.png", metadata: { fakeProvider: true } }]; },
};
