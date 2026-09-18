import { describe, expect, it } from "vitest";
import { draftFromGeneration } from "./draftFromGeneration";
import type { GenerationRecordDto } from "./types";

const base: GenerationRecordDto = { id: "gen", projectId: "project", nodeId: "node", requestId: "request", action: "image.edit", providerId: "provider-old", modelId: "model-old", prompt: "restore me", references: [{ assetId: "asset-a", role: "reference-image", order: 0 }], params: { width: 1536, height: 864, quality: "high", count: 4, future: true }, outputAssetIds: ["out"], selectedVariantIndex: 0, status: "succeeded", createdAt: "now", updatedAt: "now", finishedAt: "now" };

describe("draftFromGeneration", () => {
  it("restores prompt, provider, model, params, and durable references", () => {
    expect(draftFromGeneration("node", base)).toMatchObject({ action: "image.edit", prompt: "restore me", providerId: "provider-old", modelId: "model-old", aspectRatio: "16:9", quality: "high", count: 4, references: [{ assetId: "asset-a", source: "history" }] });
  });

  it("marks matching graph references as graph inputs", () => {
    const draft = draftFromGeneration("node", base, [{ assetId: "asset-a", role: "reference-image", order: 0, source: "graph", edgeId: "edge" }]);
    expect(draft.references[0]).toMatchObject({ source: "graph", edgeId: "edge" });
  });
});
