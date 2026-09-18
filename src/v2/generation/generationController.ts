"use client";

import { createGeneration } from "./generationApi";
import { useGenerationStore, type PromptDraft } from "./generationStore";
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

export async function submitGenerationDraft(projectId: string, draft: PromptDraft, action: GenerationActionId = draft.action) {
  const state = useGenerationStore.getState();
  if (state.submittingNodeIds[draft.targetNodeId]) throw new Error("submit_in_progress");
  if (!draft.providerId || !draft.modelId) throw new Error("provider_model_required");
  const requestId = globalThis.crypto.randomUUID();
  state.setSubmitting(draft.targetNodeId, true);
  try {
    const result = await createGeneration({ projectId, nodeId: draft.targetNodeId, requestId, action, prompt: draft.prompt, providerId: draft.providerId, modelId: draft.modelId, references: toGenerationReferences(draft.references), params: paramsFromDraft(draft) });
    useGenerationStore.getState().registerJob(draft.targetNodeId, result.job);
    return result;
  } finally {
    useGenerationStore.getState().setSubmitting(draft.targetNodeId, false);
  }
}
