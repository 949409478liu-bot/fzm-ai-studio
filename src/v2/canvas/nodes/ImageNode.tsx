import type { NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { BaseNodeFrame } from "./BaseNodeFrame";
import { assetContentUrl } from "@/v2/assets/assetApi";
import { getGeneration, selectGenerationVariant } from "@/v2/generation/generationApi";
import { useGenerationStore } from "@/v2/generation/generationStore";
import { isTerminalJob } from "@/v2/generation/jobPoller";
import { translateJobStatus } from "@/v2/generation/errorMessages";
import { VariantFilmstrip } from "@/v2/generation/components/VariantFilmstrip";
import { useCanvasStore } from "@/v2/stores/canvasStore";
import type { V2FlowNode } from "@/v2/types/canvas";

function jobLabel(status?: string) {
  return status ? translateJobStatus(status) : null;
}

export function ImageNode({ id, data }: NodeProps<V2FlowNode>) {
  const jobs = useGenerationStore((state) => state.jobs);
  const activeJob = useGenerationStore((state) => state.jobs[state.nodeJob[id] ?? ""] ?? null);
  const busy = Boolean(activeJob && !isTerminalJob(activeJob.status));
  const label = jobLabel(activeJob?.status);
  const [generation, setGeneration] = useState<{ outputAssetIds: string[]; selectedVariantIndex: number } | null>(null);

  useEffect(() => {
    if (!data.generationId) return;
    let alive = true;
    void getGeneration(data.generationId).then((body) => { if (alive) setGeneration({ outputAssetIds: body.generation.outputAssetIds, selectedVariantIndex: body.generation.selectedVariantIndex }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [data.generationId, data.assetId, jobs]);

  return (
    <BaseNodeFrame title={data.title}>
      <div className={`fzm-media-placeholder${busy ? " fzm-media-placeholder--busy" : ""}`}>
        {typeof data.assetId === "string" ? <img className="fzm-node-image" src={assetContentUrl(data.assetId, "thumbnail")} alt={data.originalName ?? "Image asset"} /> : <><ImageIcon size={24} /><span>Empty Image</span></>}
        {label ? <div className="fzm-node-status">{label}{activeJob?.status === "failed" ? <button type="button" className="fzm-button" onClick={(event) => { event.stopPropagation(); window.dispatchEvent(new CustomEvent("fzm-open-generation-log", { detail: { jobId: activeJob.id } })); }}>查看原因</button> : null}</div> : null}
      </div>
      {data.generationId && generation ? <VariantFilmstrip assetIds={generation.outputAssetIds} selectedIndex={generation.selectedVariantIndex} onSelect={async (index) => {
        if (!data.generationId) return;
        const result = await selectGenerationVariant(data.generationId, index);
        if (result.assetId) useCanvasStore.getState().updateGenerationSelection(id, result.assetId, data.generationId);
        if (typeof result.revision === "number") useGenerationStore.getState().serverRevisionHandler?.(result.revision);
        setGeneration({ outputAssetIds: result.generation.outputAssetIds, selectedVariantIndex: result.generation.selectedVariantIndex });
      }} /> : null}
    </BaseNodeFrame>
  );
}
