"use client";

import type { GenerationRecordDto, PromptReference } from "./types";
import type { PromptDraft } from "./generationStore";

const ratios = [
  ["1:1", 1],
  ["4:3", 4 / 3],
  ["3:4", 3 / 4],
  ["16:9", 16 / 9],
  ["9:16", 9 / 16],
] as const;

function ratioFromParams(params: Record<string, unknown>): PromptDraft["aspectRatio"] {
  const width = Number(params.width);
  const height = Number(params.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return "1:1";
  const actual = width / height;
  return ratios.reduce((best, next) => Math.abs(next[1] - actual) < Math.abs(best[1] - actual) ? next : best)[0];
}

function qualityFromParams(params: Record<string, unknown>): PromptDraft["quality"] {
  return params.quality === "medium" || params.quality === "high" ? params.quality : "auto";
}

function countFromParams(params: Record<string, unknown>): PromptDraft["count"] {
  return params.count === 2 || params.count === 4 ? params.count : 1;
}

export function draftFromGeneration(targetNodeId: string, generation: GenerationRecordDto, graphReferences: PromptReference[] = []): PromptDraft {
  const graphByAsset = new Map(graphReferences.map((reference) => [reference.assetId, reference]));
  const references = generation.references.map((reference, order): PromptReference => {
    const graph = graphByAsset.get(reference.assetId);
    return graph ? { ...graph, order } : { assetId: reference.assetId, role: reference.role, order, source: "history" };
  });
  return {
    targetNodeId,
    action: generation.action,
    prompt: generation.prompt,
    providerId: generation.providerId,
    modelId: generation.modelId,
    references,
    aspectRatio: ratioFromParams(generation.params),
    quality: qualityFromParams(generation.params),
    count: countFromParams(generation.params),
  };
}
