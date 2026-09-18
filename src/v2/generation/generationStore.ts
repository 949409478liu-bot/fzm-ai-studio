"use client";

import { create } from "zustand";
import type { GenerationActionId, JobDto, PromptReference } from "./types";

export interface PromptDraft {
  targetNodeId: string;
  action: GenerationActionId;
  prompt: string;
  providerId: string | null;
  modelId: string | null;
  references: PromptReference[];
  aspectRatio: "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
  quality: "auto" | "medium" | "high";
  count: 1 | 2 | 4;
}

interface GenerationRuntime {
  draftByNode: Record<string, PromptDraft>;
  activeTargetNodeId: string | null;
  jobs: Record<string, JobDto>;
  jobNode: Record<string, string>;
  nodeJob: Record<string, string>;
  submittingNodeIds: Record<string, boolean>;
  serverRevisionHandler: ((revision: number) => void) | null;
  setActiveTarget: (projectId: string, nodeId: string | null, action?: GenerationActionId, references?: PromptReference[]) => void;
  updateDraft: (nodeId: string, patch: Partial<Omit<PromptDraft, "targetNodeId">>) => void;
  registerJob: (nodeId: string, job: JobDto) => void;
  updateJob: (job: JobDto) => void;
  setSubmitting: (nodeId: string, submitting: boolean) => void;
  setServerRevisionHandler: (handler: ((revision: number) => void) | null) => void;
}

function createDraft(nodeId: string, action: GenerationActionId, references: PromptReference[] = []): PromptDraft {
  return { targetNodeId: nodeId, action, prompt: "", providerId: null, modelId: null, references, aspectRatio: "1:1", quality: "auto", count: 1 };
}

export const useGenerationStore = create<GenerationRuntime>((set) => ({
  draftByNode: {},
  activeTargetNodeId: null,
  jobs: {},
  jobNode: {},
  nodeJob: {},
  submittingNodeIds: {},
  serverRevisionHandler: null,
  setActiveTarget: (_projectId, nodeId, action = "image.generate", references = []) => set((state) => {
    if (!nodeId) return { activeTargetNodeId: null };
    const existing = state.draftByNode[nodeId];
    return { activeTargetNodeId: nodeId, draftByNode: { ...state.draftByNode, [nodeId]: existing ? { ...existing, action, references } : createDraft(nodeId, action, references) } };
  }),
  updateDraft: (nodeId, patch) => set((state) => ({ draftByNode: { ...state.draftByNode, [nodeId]: { ...(state.draftByNode[nodeId] ?? createDraft(nodeId, "image.generate")), ...patch } } })),
  registerJob: (nodeId, job) => set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, jobNode: { ...state.jobNode, [job.id]: nodeId }, nodeJob: { ...state.nodeJob, [nodeId]: job.id } })),
  updateJob: (job) => set((state) => ({ jobs: { ...state.jobs, [job.id]: job } })),
  setSubmitting: (nodeId, submitting) => set((state) => ({ submittingNodeIds: { ...state.submittingNodeIds, [nodeId]: submitting } })),
  setServerRevisionHandler: (handler) => set({ serverRevisionHandler: handler }),
}));

export function getNodeActiveJob(nodeId: string) {
  const state = useGenerationStore.getState();
  const jobId = state.nodeJob[nodeId];
  return jobId ? state.jobs[jobId] : null;
}
