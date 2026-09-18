"use client";

import { useEffect, useMemo } from "react";
import { Paperclip, Square, WandSparkles } from "lucide-react";
import { getActionDescriptor } from "../actionRegistry";
import { submitGenerationDraft } from "../generationController";
import { useGenerationStore, getNodeActiveJob } from "../generationStore";
import { isTerminalJob } from "../jobPoller";
import type { PromptReference } from "../types";
import { useProviderStore } from "@/v2/providers/providerStore";
import { cancelJob } from "../generationApi";
import { humanGenerationError, jobStatusMessage } from "../errorMessages";
import { ModelPicker } from "./ModelPicker";
import { ProviderPicker } from "./ProviderPicker";
import { QualityPicker } from "./QualityPicker";
import { RatioPicker } from "./RatioPicker";
import { ReferenceStrip } from "./ReferenceStrip";

interface PromptBarProps {
  projectId: string;
  onSubmitted: (nodeId: string, jobId: string) => void;
  onBeforeSubmit: () => Promise<boolean>;
  onRemoveReference: (reference: PromptReference) => void;
  onOpenAssetPicker: () => void;
  onMessage: (message: string) => void;
}

const counts = [1, 2, 4] as const;

function statusLabel(status?: string) {
  switch (status) {
    case "queued": return "Preparing…";
    case "preparing":
    case "submitting": return "Starting…";
    case "polling": return "Generating…";
    case "downloading": return "Downloading…";
    case "finalizing": return "Finishing…";
    default: return null;
  }
}

export function PromptBar({ projectId, onSubmitted, onBeforeSubmit, onRemoveReference, onOpenAssetPicker, onMessage }: PromptBarProps) {
  const activeTargetNodeId = useGenerationStore((state) => state.activeTargetNodeId);
  const activeProjectId = useGenerationStore((state) => state.activeProjectId);
  const draft = useGenerationStore((state) => activeTargetNodeId && activeProjectId ? state.draftByNode[`${activeProjectId}:${activeTargetNodeId}`] : null);
  const updateDraft = useGenerationStore((state) => state.updateDraft);
  const submitting = useGenerationStore((state) => activeTargetNodeId ? Boolean(state.submittingNodeIds[activeTargetNodeId]) : false);
  const transaction = useGenerationStore((state) => activeTargetNodeId && activeProjectId ? state.submitTransactions[`${activeProjectId}:${activeTargetNodeId}`] : null);
  const lastSelectionByAction = useGenerationStore((state) => state.lastSelectionByAction);
  const providers = useProviderStore((state) => state.providers);
  const loadingProviders = useProviderStore((state) => state.loading);
  const loadedProviders = useProviderStore((state) => state.loaded);
  const refreshProviders = useProviderStore((state) => state.refresh);
  const activeJob = activeTargetNodeId ? getNodeActiveJob(activeTargetNodeId) : null;
  const terminalJob = useGenerationStore((state) => activeTargetNodeId ? state.terminalNodeJob[activeTargetNodeId] : null);
  const busy = Boolean(activeJob && !isTerminalJob(activeJob.status));

  useEffect(() => { if (!loadedProviders && !loadingProviders) void refreshProviders(); }, [loadedProviders, loadingProviders, refreshProviders]);
  useEffect(() => { if (activeTargetNodeId) void refreshProviders(); }, [activeTargetNodeId, refreshProviders]);

  const action = draft ? getActionDescriptor(draft.action) : null;
  const compatibleProviders = useMemo(() => action ? providers.filter((provider) => provider.enabled && provider.models.some((model) => model.capabilities.includes(action.capability))) : [], [action, providers]);
  const selectedProvider = providers.find((provider) => provider.id === draft?.providerId);
  const selectedModel = selectedProvider?.models.find((model) => model.id === draft?.modelId);
  const providerUnavailable = Boolean(draft?.providerId && (!selectedProvider || !selectedProvider.enabled));
  const modelUnavailable = Boolean(draft?.modelId && (!selectedModel || !action || !selectedModel.capabilities.includes(action.capability)));

  useEffect(() => {
    if (!draft || !action || loadingProviders) return;
    if (draft.providerId && draft.modelId) return;
    const lastSelection = lastSelectionByAction[draft.action];
    const lastProvider = lastSelection ? compatibleProviders.find((item) => item.id === lastSelection.providerId) : null;
    const provider = draft.providerId ? compatibleProviders.find((item) => item.id === draft.providerId) : lastProvider ?? compatibleProviders[0];
    const model = provider?.models.find((item) => item.id === draft.modelId && item.capabilities.includes(action.capability)) ?? provider?.models.find((item) => item.capabilities.includes(action.capability));
    if (provider && model && (provider.id !== draft.providerId || model.id !== draft.modelId)) updateDraft(draft.targetNodeId, { providerId: provider.id, modelId: model.id });
  }, [action, compatibleProviders, draft, lastSelectionByAction, loadingProviders, updateDraft]);

  if (!draft || !action) return null;

  const disabledReason = !draft.prompt.trim() ? "请输入 Prompt" : action.referencePolicy === "required" && draft.references.length === 0 ? "请添加参考图" : providerUnavailable ? "历史 Provider 不可用，请重新选择" : modelUnavailable ? "历史 Model 不可用，请重新选择" : !draft.providerId || !draft.modelId ? "Provider 未启用" : null;
  const labelJob = terminalJob ?? activeJob;
  const label = jobStatusMessage(labelJob?.status, labelJob?.error) ?? statusLabel(labelJob?.status);
  const submit = async () => {
    if (disabledReason || busy || submitting) return;
    const ready = await onBeforeSubmit();
    if (!ready) { onMessage("请先解决保存冲突"); return; }
    try {
      const result = await submitGenerationDraft(projectId, draft);
      onSubmitted(draft.targetNodeId, result.job.id);
    } catch (error) {
      onMessage(humanGenerationError(error));
    }
  };

  return (
    <section className="fzm-promptbar fzm-floating" aria-label="Generation prompt" aria-busy={busy}>
      <ReferenceStrip references={draft.references} onRemove={onRemoveReference} />
      <label className="fzm-promptbar__input">
        <span className="sr-only">Prompt</span>
        <textarea
          value={draft.prompt}
          placeholder={draft.action === "image.edit" ? "描述你想如何编辑这张图片…" : "描述你想生成的内容…"}
          onChange={(event) => updateDraft(draft.targetNodeId, { prompt: event.target.value })}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (!disabledReason && !busy && !submitting) void submit();
            }
          }}
        />
      </label>
      <div className="fzm-promptbar__controls">
        <button className="fzm-button fzm-icon-button" type="button" aria-label="Attach reference" onClick={onOpenAssetPicker}><Paperclip size={14} /></button>
        <ProviderPicker capability={action.capability} providerId={draft.providerId} onChange={(providerId) => updateDraft(draft.targetNodeId, { providerId, modelId: null })} />
        <ModelPicker capability={action.capability} providerId={draft.providerId} modelId={draft.modelId} onChange={(modelId) => updateDraft(draft.targetNodeId, { modelId })} />
        <RatioPicker value={draft.aspectRatio} onChange={(aspectRatio) => updateDraft(draft.targetNodeId, { aspectRatio })} />
        <QualityPicker value={draft.quality} onChange={(quality) => updateDraft(draft.targetNodeId, { quality })} />
        <div className="fzm-segment" aria-label="Count">{counts.map((count) => <button key={count} type="button" data-active={draft.count === count} onClick={() => updateDraft(draft.targetNodeId, { count })}>{count}</button>)}</div>
        {busy ? <button className="fzm-button" type="button" onClick={async () => { if (activeJob) useGenerationStore.getState().updateJob((await cancelJob(activeJob.id)).job); }}><Square size={13} /> Cancel</button> : null}
        <button className="fzm-generate-button" type="button" disabled={Boolean(disabledReason) || busy || submitting} title={disabledReason ?? undefined} onClick={() => void submit()}>
          <WandSparkles size={15} /> {submitting ? "提交中…" : transaction?.state === "response-unknown" ? "重试确认" : "生成"}
        </button>
      </div>
      {providerUnavailable || modelUnavailable ? <div className="fzm-promptbar__status">历史选择不可用：{selectedProvider?.name ?? draft.providerId} / {draft.modelId}。请选择兼容 Provider。</div> : null}
      {label || disabledReason ? <div className="fzm-promptbar__status">{label ?? disabledReason}</div> : null}
    </section>
  );
}
