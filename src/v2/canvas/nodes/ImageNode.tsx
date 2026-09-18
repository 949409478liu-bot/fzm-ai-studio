import type { NodeProps } from "@xyflow/react";
import { ImageIcon } from "lucide-react";
import { BaseNodeFrame } from "./BaseNodeFrame";
import type { V2FlowNode } from "@/v2/types/canvas";

export function ImageNode({ data }: NodeProps<V2FlowNode>) {
  return (
    <BaseNodeFrame title={data.title}>
      <div className="fzm-media-placeholder">
        <ImageIcon size={24} />
        <span>Image shell</span>
      </div>
    </BaseNodeFrame>
  );
}
