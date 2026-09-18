import type { CanvasTool, FloatingPosition } from "@/v2/types/canvas";

interface CanvasContextMenuProps {
  position: FloatingPosition;
  onAddNode: () => void;
  onFitView: () => void;
  onTool: (tool: CanvasTool) => void;
}

export function CanvasContextMenu({ position, onAddNode, onFitView, onTool }: CanvasContextMenuProps) {
  return (
    <div className="fzm-menu fzm-floating" style={{ left: position.x, top: position.y }} role="menu">
      <button className="fzm-menu__item" type="button" onClick={onAddNode}>Add Node</button>
      <button className="fzm-menu__item" type="button" onClick={onFitView}>Fit View</button>
      <div className="fzm-menu__sep" />
      <button className="fzm-menu__item" type="button" onClick={() => onTool("select")}>Select Tool <span>V</span></button>
      <button className="fzm-menu__item" type="button" onClick={() => onTool("hand")}>Hand Tool <span>H</span></button>
      <button className="fzm-menu__item" type="button" onClick={() => onTool("connect")}>Connect Tool <span>C</span></button>
      <div className="fzm-menu__sep" />
      <button className="fzm-menu__item" type="button" disabled>Assets <span>Phase 2</span></button>
    </div>
  );
}
