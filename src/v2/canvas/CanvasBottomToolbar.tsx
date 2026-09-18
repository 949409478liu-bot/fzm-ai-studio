import { CircleHelp, Hand, Minus, MousePointer2, MoveRight, Plus, Redo2, Scan, Undo2 } from "lucide-react";
import type { CanvasTool } from "@/v2/types/canvas";

interface CanvasBottomToolbarProps {
  activeTool: CanvasTool;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onAdd: () => void;
  onTool: (tool: CanvasTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHelp: () => void;
}

export function CanvasBottomToolbar(props: CanvasBottomToolbarProps) {
  return (
    <div className="fzm-bottom-toolbar fzm-floating" aria-label="Canvas toolbar">
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onAdd} aria-label="Add"><Plus size={15} /></button>
      <div className="fzm-separator" />
      <button className="fzm-button" data-active={props.activeTool === "select"} type="button" onClick={() => props.onTool("select")}><MousePointer2 size={14} /> Select</button>
      <button className="fzm-button" data-active={props.activeTool === "hand"} type="button" onClick={() => props.onTool("hand")}><Hand size={14} /> Hand</button>
      <button className="fzm-button" data-active={props.activeTool === "connect"} type="button" onClick={() => props.onTool("connect")}><MoveRight size={14} /> Connect</button>
      <div className="fzm-separator" />
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onUndo} disabled={!props.canUndo} aria-label="Undo"><Undo2 size={15} /></button>
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onRedo} disabled={!props.canRedo} aria-label="Redo"><Redo2 size={15} /></button>
      <div className="fzm-separator" />
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onFit} aria-label="Fit"><Scan size={15} /></button>
      <div className="fzm-separator" />
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onZoomOut} aria-label="Zoom out"><Minus size={15} /></button>
      <span className="fzm-zoom-label">{Math.round(props.zoom * 100)}%</span>
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onZoomIn} aria-label="Zoom in"><Plus size={15} /></button>
      <div className="fzm-separator" />
      <button className="fzm-button fzm-icon-button" type="button" onClick={props.onHelp} aria-label="Help"><CircleHelp size={15} /></button>
    </div>
  );
}
