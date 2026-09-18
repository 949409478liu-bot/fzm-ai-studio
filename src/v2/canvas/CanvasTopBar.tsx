import { ArrowLeft, Box, Database, Film, KeyRound, Sparkles } from "lucide-react";

interface CanvasTopBarProps {
  onMessage: (message: string) => void;
}

export function CanvasTopBar({ onMessage }: CanvasTopBarProps) {
  return (
    <header className="fzm-topbar fzm-floating">
      <div className="fzm-topbar__left">
        <button className="fzm-button fzm-icon-button" type="button" aria-label="Back">
          <ArrowLeft size={15} />
        </button>
        <div className="fzm-project">
          <strong>FZM AI Studio / V2 Canvas</strong>
          <span>Local changes</span>
        </div>
      </div>
      <nav className="fzm-topbar__right" aria-label="V2 placeholders">
        <button className="fzm-button" type="button" onClick={() => onMessage("Provider integration begins in Phase 3")}> <KeyRound size={14} /> Model/API</button>
        <button className="fzm-button" type="button" onClick={() => onMessage("Asset system begins in Phase 2")}> <Database size={14} /> Assets</button>
        <button className="fzm-button" type="button" disabled><Film size={14} /> Timeline</button>
        <button className="fzm-button" type="button" disabled><Sparkles size={14} /> Agent</button>
        <button className="fzm-button" type="button" disabled><Box size={14} /> Workflow</button>
      </nav>
    </header>
  );
}
