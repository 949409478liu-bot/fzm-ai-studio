import { describe, expect, it } from "vitest";
import { paramsFromDraft } from "./generationController";
import type { PromptDraft } from "./generationStore";

function draft(patch: Partial<PromptDraft>): PromptDraft {
  return { targetNodeId: "node", action: "image.generate", prompt: "test", providerId: "provider", modelId: "model", references: [], aspectRatio: "1:1", quality: "auto", count: 1, ...patch };
}

describe("generationController", () => {
  it("maps friendly ratios to dimensions", () => {
    expect(paramsFromDraft(draft({ aspectRatio: "16:9", quality: "high", count: 4 }))).toEqual({ width: 1536, height: 864, quality: "high", count: 4 });
    expect(paramsFromDraft(draft({ aspectRatio: "3:4", quality: "medium", count: 2 }))).toEqual({ width: 960, height: 1280, quality: "medium", count: 2 });
  });
});
