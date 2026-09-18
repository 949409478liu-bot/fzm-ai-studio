import type { NodeProps } from "@xyflow/react";
import { Clapperboard } from "lucide-react";
import { BaseNodeFrame } from "./BaseNodeFrame";
import { assetContentUrl } from "@/v2/assets/assetApi";
import type { V2FlowNode } from "@/v2/types/canvas";

export function VideoNode({ data }: NodeProps<V2FlowNode>) {
  return (
    <BaseNodeFrame title={data.title}>
      <div className="fzm-media-placeholder">
        {typeof data.assetId === "string" ? <video className="fzm-node-video" src={assetContentUrl(data.assetId, "original")} controls preload="metadata" /> : <><Clapperboard size={24} /><span>Video shell</span></>}
      </div>
    </BaseNodeFrame>
  );
}
