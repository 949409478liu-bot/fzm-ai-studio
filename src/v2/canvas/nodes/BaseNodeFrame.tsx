import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import { Info, MoreHorizontal } from "lucide-react";

interface BaseNodeFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
  onInfo?: () => void;
}

export function BaseNodeFrame({ title, children, className = "", onInfo }: BaseNodeFrameProps) {
  return (
    <section className={`fzm-node ${className}`}>
      <Handle className="fzm-handle fzm-handle--input" type="target" position={Position.Left} />
      <header className="fzm-node__header drag-handle">
        <span>{title}</span>
        <span className="fzm-node__toolbar nodrag nopan">
          <button className="fzm-button fzm-icon-button" type="button" aria-label="Info" onClick={onInfo}>
            <Info size={13} />
          </button>
          <button className="fzm-button fzm-icon-button" type="button" aria-label="More">
            <MoreHorizontal size={13} />
          </button>
        </span>
      </header>
      <div className="fzm-node__body">{children}</div>
      <Handle className="fzm-handle fzm-handle--output" type="source" position={Position.Right} />
    </section>
  );
}
