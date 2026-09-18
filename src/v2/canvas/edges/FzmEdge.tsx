import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, getBezierPath } from "@xyflow/react";

export function FzmEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath(props);
  return <BaseEdge id={props.id} path={edgePath} />;
}
