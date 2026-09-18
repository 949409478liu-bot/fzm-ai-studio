import type { V2NodeKind } from "@/v2/types/canvas";

interface EmptyStateProps {
  onCreate: (kind: V2NodeKind) => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="fzm-empty-state">
      <strong>Double-click the canvas to start creating</strong>
      <div className="fzm-empty-actions">
        <button className="fzm-button" type="button" onClick={() => onCreate("text")}>Text</button>
        <button className="fzm-button" type="button" onClick={() => onCreate("image")}>Image</button>
        <button className="fzm-button" type="button" onClick={() => onCreate("video")}>Video</button>
      </div>
    </div>
  );
}
