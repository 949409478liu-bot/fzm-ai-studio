import { ArrowLeft, Box, Database, Film, KeyRound, ScrollText, Sparkles } from "lucide-react";

interface CanvasTopBarProps {
  onMessage: (message: string) => void;
  projectName: string;
  saveState: "idle" | "saved" | "saving" | "conflict" | "failed";
  revision: number;
  onBack: () => void;
  onAssets: () => void;
  onProviders: () => void;
  onReloadLatest: () => void;
  onGenerationLog: () => void;
}

export function CanvasTopBar({ projectName, saveState, revision, onBack, onAssets, onProviders, onReloadLatest, onGenerationLog }: CanvasTopBarProps) {
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
        <button className="fzm-button" type="button" onClick={onProviders}> <KeyRound size={14} /> Model/API</button>
        <button className="fzm-button" type="button" onClick={onAssets}> <Database size={14} /> Assets</button>
        <button className="fzm-button" type="button" aria-label="生成日志" onClick={onGenerationLog}> <ScrollText size={14} /> 生成日志</button>
        <button className="fzm-button" type="button" disabled><Film size={14} /> Timeline</button>
        <button className="fzm-button" type="button" disabled><Sparkles size={14} /> Agent</button>
        <button className="fzm-button" type="button" disabled><Box size={14} /> Workflow</button>
      </nav>
    </header>
  );
}
