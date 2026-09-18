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

export type SubmitTransactionState = "idle" | "submitting" | "response-unknown" | "accepted" | "failed-definitive";

export interface SubmitTransaction {
  targetNodeId: string;
  requestId: string;
  payloadHash: string;
  state: SubmitTransactionState;
  startedAt: number;
}

interface GenerationRuntime {
  draftByNode: Record<string, PromptDraft>;
  activeProjectId: string | null;
  activeTargetNodeId: string | null;
  jobs: Record<string, JobDto>;
  jobNode: Record<string, string>;
  nodeJob: Record<string, string>;
  terminalNodeJob: Record<string, JobDto>;
  submittingNodeIds: Record<string, boolean>;
  submitTransactions: Record<string, SubmitTransaction>;
  lastSelectionByAction: Partial<Record<GenerationActionId, { providerId: string; modelId: string }>>;
  serverRevisionHandler: ((revision: number) => void) | null;
  setActiveTarget: (projectId: string, nodeId: string | null, action?: GenerationActionId, references?: PromptReference[]) => void;
  updateDraft: (nodeId: string, patch: Partial<Omit<PromptDraft, "targetNodeId">>) => void;
  replaceDraft: (projectId: string, nodeId: string, draft: PromptDraft) => void;
  clearProjectRuntime: (projectId: string) => void;
  registerJob: (nodeId: string, job: JobDto) => void;
  updateJob: (job: JobDto) => void;
  setSubmitting: (nodeId: string, submitting: boolean) => void;
  setSubmitTransaction: (projectId: string, nodeId: string, transaction: SubmitTransaction) => void;
  setLastSelection: (action: GenerationActionId, providerId: string, modelId: string) => void;
  setServerRevisionHandler: (handler: ((revision: number) => void) | null) => void;
}

export function draftKey(projectId: string, nodeId: string) { return `${projectId}:${nodeId}`; }

function createDraft(nodeId: string, action: GenerationActionId, references: PromptReference[] = []): PromptDraft {
  return { targetNodeId: nodeId, action, prompt: "", providerId: null, modelId: null, references, aspectRatio: "1:1", quality: "auto", count: 1 };
}

export const useGenerationStore = create<GenerationRuntime>((set) => ({
  draftByNode: {},
  activeProjectId: null,
  activeTargetNodeId: null,
  jobs: {},
  jobNode: {},
  nodeJob: {},
  terminalNodeJob: {},
  submittingNodeIds: {},
  submitTransactions: {},
  lastSelectionByAction: {},
  serverRevisionHandler: null,
  setActiveTarget: (_projectId, nodeId, action = "image.generate", references = []) => set((state) => {
    if (!nodeId) return { activeProjectId: _projectId, activeTargetNodeId: null };
    const key = draftKey(_projectId, nodeId);
    const existing = state.draftByNode[key];
    return { activeProjectId: _projectId, activeTargetNodeId: nodeId, draftByNode: { ...state.draftByNode, [key]: existing ? { ...existing, action, references } : createDraft(nodeId, action, references) } };
  }),
  updateDraft: (nodeId, patch) => set((state) => {
    const projectId = state.activeProjectId;
    if (!projectId) return state;
    const key = draftKey(projectId, nodeId);
    return { draftByNode: { ...state.draftByNode, [key]: { ...(state.draftByNode[key] ?? createDraft(nodeId, "image.generate")), ...patch } } };
  }),
  replaceDraft: (projectId, nodeId, draft) => set((state) => ({ activeProjectId: projectId, activeTargetNodeId: nodeId, draftByNode: { ...state.draftByNode, [draftKey(projectId, nodeId)]: draft } })),
  clearProjectRuntime: (projectId) => set((state) => {
    const prefix = `${projectId}:`;
    return {
      draftByNode: Object.fromEntries(Object.entries(state.draftByNode).filter(([key]) => !key.startsWith(prefix))),
      submitTransactions: Object.fromEntries(Object.entries(state.submitTransactions).filter(([key]) => !key.startsWith(prefix))),
      activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
      activeTargetNodeId: state.activeProjectId === projectId ? null : state.activeTargetNodeId,
    };
  }),
  registerJob: (nodeId, job) => set((state) => ({ jobs: { ...state.jobs, [job.id]: job }, jobNode: { ...state.jobNode, [job.id]: nodeId }, nodeJob: { ...state.nodeJob, [nodeId]: job.id } })),
  updateJob: (job) => set((state) => {
    const nodeId = job.nodeId ?? state.jobNode[job.id];
    const terminalPatch = nodeId && ["succeeded", "failed", "canceled", "interrupted"].includes(job.status) ? { terminalNodeJob: { ...state.terminalNodeJob, [nodeId]: job } } : {};
    return { jobs: { ...state.jobs, [job.id]: job }, ...terminalPatch };
  }),
  setSubmitting: (nodeId, submitting) => set((state) => ({ submittingNodeIds: { ...state.submittingNodeIds, [nodeId]: submitting } })),
  setSubmitTransaction: (projectId, nodeId, transaction) => set((state) => ({ submitTransactions: { ...state.submitTransactions, [draftKey(projectId, nodeId)]: transaction } })),
  setLastSelection: (action, providerId, modelId) => set((state) => ({ lastSelectionByAction: { ...state.lastSelectionByAction, [action]: { providerId, modelId } } })),
  setServerRevisionHandler: (handler) => set({ serverRevisionHandler: handler }),
}));

export function getPromptDraft(projectId: string, nodeId: string) {
  return useGenerationStore.getState().draftByNode[draftKey(projectId, nodeId)];
}

export function getNodeActiveJob(nodeId: string) {
  const state = useGenerationStore.getState();
  const jobId = state.nodeJob[nodeId];
  return jobId ? state.jobs[jobId] : null;
}
