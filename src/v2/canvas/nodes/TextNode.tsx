import type { NodeProps } from "@xyflow/react";
import { BaseNodeFrame } from "./BaseNodeFrame";
import { useCanvasStore } from "@/v2/stores/canvasStore";
import type { V2FlowNode } from "@/v2/types/canvas";

export function TextNode({ id, data }: NodeProps<V2FlowNode>) {
  const updateNodeBody = useCanvasStore((state) => state.updateNodeBody);

  return (
    <BaseNodeFrame title={data.title}>
      <textarea
        className="fzm-textarea nodrag nopan"
        value={data.body ?? ""}
        onChange={(event) => updateNodeBody(id, event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        spellCheck={false}
      />
    </BaseNodeFrame>
  );
}
