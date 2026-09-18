import { ArrowLeft, Box, Database, Film, KeyRound, Sparkles } from "lucide-react";

interface CanvasTopBarProps {
  onMessage: (message: string) => void;
  projectName: string;
  saveState: "idle" | "saved" | "saving" | "conflict" | "failed";
  revision: number;
  onBack: () => void;
  onAssets: () => void;
  onReloadLatest: () => void;
}

export function CanvasTopBar({ onMessage, projectName, saveState, revision, onBack, onAssets, onReloadLatest }: CanvasTopBarProps) {
  const status = saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : saveState === "conflict" ? "Conflict" : saveState === "failed" ? "Save failed" : "Local changes";
  return (
    <header className="fzm-topbar fzm-floating">
      <div className="fzm-topbar__left">
        <button className="fzm-button fzm-icon-button" type="button" aria-label="Back" onClick={onBack}>
          <ArrowLeft size={15} />
        </button>
        <div className="fzm-project">
          <strong>{projectName}</strong>
          <span data-save-state={saveState}>{status} · rev {revision}</span>
        </div>
        {saveState === "conflict" ? <button className="fzm-button" type="button" onClick={onReloadLatest}>Reload latest</button> : null}
      </div>
      <nav className="fzm-topbar__right" aria-label="V2 placeholders">
        <button className="fzm-button" type="button" onClick={() => onMessage("Provider integration begins in Phase 3")}> <KeyRound size={14} /> Model/API</button>
        <button className="fzm-button" type="button" onClick={onAssets}> <Database size={14} /> Assets</button>
        <button className="fzm-button" type="button" disabled><Film size={14} /> Timeline</button>
        <button className="fzm-button" type="button" disabled><Sparkles size={14} /> Agent</button>
        <button className="fzm-button" type="button" disabled><Box size={14} /> Workflow</button>
      </nav>
    </header>
  );
}
