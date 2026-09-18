"use client";

import { createGeneration } from "./generationApi";
import { draftKey, useGenerationStore, type PromptDraft, type SubmitTransaction } from "./generationStore";
import { toGenerationReferences } from "./referenceResolver";
import type { GenerationActionId } from "./types";

const ratioDimensions = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1280, height: 960 },
  "3:4": { width: 960, height: 1280 },
  "16:9": { width: 1536, height: 864 },
  "9:16": { width: 864, height: 1536 },
} satisfies Record<PromptDraft["aspectRatio"], { width: number; height: number }>;

export function paramsFromDraft(draft: PromptDraft) {
  return { ...ratioDimensions[draft.aspectRatio], quality: draft.quality, count: draft.count };
}

export function payloadHashFromDraft(projectId: string, draft: PromptDraft, action: GenerationActionId = draft.action) {
  return JSON.stringify({ projectId, nodeId: draft.targetNodeId, action, prompt: draft.prompt, providerId: draft.providerId, modelId: draft.modelId, references: toGenerationReferences(draft.references), params: paramsFromDraft(draft) });
}

function nextTransaction(projectId: string, draft: PromptDraft, payloadHash: string): SubmitTransaction {
  const existing = useGenerationStore.getState().submitTransactions[draftKey(projectId, draft.targetNodeId)];
  if (existing && existing.payloadHash === payloadHash && (existing.state === "response-unknown" || existing.state === "submitting")) return { ...existing, state: "submitting" };
  return { targetNodeId: draft.targetNodeId, requestId: globalThis.crypto.randomUUID(), payloadHash, state: "submitting", startedAt: Date.now() };
}

export async function submitGenerationDraft(projectId: string, draft: PromptDraft, action: GenerationActionId = draft.action) {
  const state = useGenerationStore.getState();
  if (state.submittingNodeIds[draft.targetNodeId]) throw new Error("submit_in_progress");
  if (!draft.providerId || !draft.modelId) throw new Error("provider_model_required");
  const payloadHash = payloadHashFromDraft(projectId, draft, action);
  const transaction = nextTransaction(projectId, draft, payloadHash);
  state.setSubmitTransaction(projectId, draft.targetNodeId, transaction);
  state.setSubmitting(draft.targetNodeId, true);
  try {
    const result = await createGeneration({ projectId, nodeId: draft.targetNodeId, requestId: transaction.requestId, action, prompt: draft.prompt, providerId: draft.providerId, modelId: draft.modelId, references: toGenerationReferences(draft.references), params: paramsFromDraft(draft) });
    useGenerationStore.getState().registerJob(draft.targetNodeId, result.job);
    useGenerationStore.getState().setLastSelection(action, draft.providerId, draft.modelId);
    useGenerationStore.getState().setSubmitTransaction(projectId, draft.targetNodeId, { ...transaction, state: "accepted" });
    return result;
  } catch (error) {
    const response = (error as { response?: Response }).response;
    useGenerationStore.getState().setSubmitTransaction(projectId, draft.targetNodeId, { ...transaction, state: response ? "failed-definitive" : "response-unknown" });
    if (!response) throw new Error("ambiguous_submit");
    throw error;
  } finally {
    useGenerationStore.getState().setSubmitting(draft.targetNodeId, false);
  }
}
