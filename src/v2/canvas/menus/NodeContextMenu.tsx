import type { FloatingPosition } from "@/v2/types/canvas";

interface NodeContextMenuProps {
  position: FloatingPosition;
  onRun: () => void;
  onRerun: () => void;
  onDuplicate: () => void;
  onDisconnect: () => void;
  onInspect: () => void;
  onDelete: () => void;
}

export function NodeContextMenu({ position, onRun, onRerun, onDuplicate, onDisconnect, onInspect, onDelete }: NodeContextMenuProps) {
  return (
    <div className="fzm-menu fzm-floating" style={{ left: position.x, top: position.y }} role="menu">
      <button className="fzm-menu__item" type="button" onClick={onRun}>Run</button>
      <button className="fzm-menu__item" type="button" onClick={onRerun}>Re-run</button>
      <div className="fzm-menu__sep" />
      <button className="fzm-menu__item" type="button" onClick={onDuplicate}>Duplicate</button>
      <button className="fzm-menu__item" type="button" onClick={onDisconnect}>Disconnect</button>
      <button className="fzm-menu__item" type="button" onClick={onInspect}>Inspect</button>
      <button className="fzm-menu__item" type="button" onClick={onDelete}>Delete</button>
    </div>
  );
}
