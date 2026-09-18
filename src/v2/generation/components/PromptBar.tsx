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
    case "failed": return "生成失败，可重新生成";
    case "interrupted": return "任务中断，可重新生成";
    case "canceled": return "已取消";
    default: return null;
  }
}

export function PromptBar({ projectId, onSubmitted, onBeforeSubmit, onRemoveReference, onOpenAssetPicker, onMessage }: PromptBarProps) {
  const activeTargetNodeId = useGenerationStore((state) => state.activeTargetNodeId);
  const draft = useGenerationStore((state) => activeTargetNodeId ? state.draftByNode[activeTargetNodeId] : null);
  const updateDraft = useGenerationStore((state) => state.updateDraft);
  const submitting = useGenerationStore((state) => activeTargetNodeId ? Boolean(state.submittingNodeIds[activeTargetNodeId]) : false);
  const providers = useProviderStore((state) => state.providers);
  const loadingProviders = useProviderStore((state) => state.loading);
  const loadedProviders = useProviderStore((state) => state.loaded);
  const refreshProviders = useProviderStore((state) => state.refresh);
  const activeJob = activeTargetNodeId ? getNodeActiveJob(activeTargetNodeId) : null;
  const busy = Boolean(activeJob && !isTerminalJob(activeJob.status));

  useEffect(() => { if (!loadedProviders && !loadingProviders) void refreshProviders(); }, [loadedProviders, loadingProviders, refreshProviders]);

  const action = draft ? getActionDescriptor(draft.action) : null;
  const compatibleProviders = useMemo(() => action ? providers.filter((provider) => provider.enabled && provider.models.some((model) => model.capabilities.includes(action.capability))) : [], [action, providers]);

  useEffect(() => {
    if (!draft || !action || loadingProviders) return;
    const provider = compatibleProviders.find((item) => item.id === draft.providerId) ?? compatibleProviders[0];
    const model = provider?.models.find((item) => item.id === draft.modelId && item.capabilities.includes(action.capability)) ?? provider?.models.find((item) => item.capabilities.includes(action.capability));
    if (provider && model && (provider.id !== draft.providerId || model.id !== draft.modelId)) updateDraft(draft.targetNodeId, { providerId: provider.id, modelId: model.id });
  }, [action, compatibleProviders, draft, loadingProviders, updateDraft]);

  if (!draft || !action) return null;

  const disabledReason = !draft.prompt.trim() ? "请输入 Prompt" : action.referencePolicy === "required" && draft.references.length === 0 ? "等待参考图" : !draft.providerId || !draft.modelId ? "Provider 未启用" : null;
  const label = statusLabel(activeJob?.status);
  const submit = async () => {
    if (disabledReason || busy || submitting) return;
    const ready = await onBeforeSubmit();
    if (!ready) { onMessage("请先解决保存冲突"); return; }
    const result = await submitGenerationDraft(projectId, draft);
    onSubmitted(draft.targetNodeId, result.job.id);
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
              if (!disabledReason && !busy && !submitting) void submit().catch((error) => onMessage(error instanceof Error ? error.message : "生成失败"));
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
        {busy ? <button className="fzm-button" type="button" onClick={async () => { if (activeJob) await cancelJob(activeJob.id); }}><Square size={13} /> Cancel</button> : null}
        <button className="fzm-generate-button" type="button" disabled={Boolean(disabledReason) || busy || submitting} title={disabledReason ?? undefined} onClick={() => void submit().catch((error) => onMessage(error instanceof Error ? error.message : "生成失败"))}>
          <WandSparkles size={15} /> {submitting ? "提交中…" : "生成"}
        </button>
      </div>
      {label || disabledReason ? <div className="fzm-promptbar__status">{label ?? disabledReason}</div> : null}
    </section>
  );
}
