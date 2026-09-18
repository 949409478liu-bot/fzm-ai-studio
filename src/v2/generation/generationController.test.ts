import { afterEach, describe, expect, it, vi } from "vitest";
import { payloadHashFromDraft, paramsFromDraft, submitGenerationDraft } from "./generationController";
import { draftKey, useGenerationStore, type PromptDraft } from "./generationStore";

function draft(patch: Partial<PromptDraft>): PromptDraft {
  return { targetNodeId: "node", action: "image.generate", prompt: "test", providerId: "provider", modelId: "model", references: [], aspectRatio: "1:1", quality: "auto", count: 1, ...patch };
}

describe("generationController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useGenerationStore.setState({ draftByNode: {}, activeProjectId: null, activeTargetNodeId: null, jobs: {}, jobNode: {}, nodeJob: {}, terminalNodeJob: {}, submittingNodeIds: {}, submitTransactions: {}, lastSelectionByAction: {}, serverRevisionHandler: null });
  });

  it("maps friendly ratios to dimensions", () => {
    expect(paramsFromDraft(draft({ aspectRatio: "16:9", quality: "high", count: 4 }))).toEqual({ width: 1536, height: 864, quality: "high", count: 4 });
    expect(paramsFromDraft(draft({ aspectRatio: "3:4", quality: "medium", count: 2 }))).toEqual({ width: 960, height: 1280, quality: "medium", count: 2 });
  });

  it("keeps one requestId for an ambiguous retry", async () => {
    const projectId = "project";
    const input = draft({ targetNodeId: "node-a" });
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("request-one" as `${string}-${string}-${string}-${string}-${string}`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("network dropped")).mockRejectedValueOnce(new TypeError("network dropped again"));
    await expect(submitGenerationDraft(projectId, input)).rejects.toThrow("ambiguous_submit");
    const transaction = useGenerationStore.getState().submitTransactions[draftKey(projectId, input.targetNodeId)];
    expect(transaction).toMatchObject({ requestId: "request-one", state: "response-unknown", payloadHash: payloadHashFromDraft(projectId, input) });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ generation: { id: "gen", projectId, nodeId: input.targetNodeId, requestId: "request-one", action: "image.generate", providerId: "provider", modelId: "model", prompt: "test", references: [], params: {}, outputAssetIds: [], selectedVariantIndex: 0, status: "queued", createdAt: "now", updatedAt: "now", finishedAt: null }, job: { id: "job", generationId: "gen", nodeId: input.targetNodeId, status: "queued", phase: "queued", progress: null, providerId: "provider", modelId: "model", createdAt: "now", updatedAt: "now", finishedAt: null, error: null } }), { status: 202 }));
    const result = await submitGenerationDraft(projectId, input);
    expect(result.job.id).toBe("job");
    expect(fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)).requestId)).toEqual(["request-one", "request-one", "request-one"]);
    expect(useGenerationStore.getState().submitTransactions[draftKey(projectId, input.targetNodeId)].state).toBe("accepted");
  });
});
