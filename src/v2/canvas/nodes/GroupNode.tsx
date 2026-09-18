import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { BaseNodeFrame } from "./BaseNodeFrame";
import type { V2FlowNode } from "@/v2/types/canvas";

export function GroupNode({ data, selected }: NodeProps<V2FlowNode>) {
  return (
    <>
      <NodeResizer minWidth={260} minHeight={160} isVisible={selected} color="var(--fzm-accent)" />
      <BaseNodeFrame title={data.title} className="fzm-group-node">
        <span>Frame visual. Manual grouping in Phase 1.</span>
      </BaseNodeFrame>
    </>
  );
}
