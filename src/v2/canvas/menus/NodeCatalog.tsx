import type { V2NodeKind, FloatingPosition } from "@/v2/types/canvas";

interface NodeCatalogProps {
  position: FloatingPosition;
  onCreate: (kind: V2NodeKind) => void;
  onClose: () => void;
}

export function NodeCatalog({ position, onCreate }: NodeCatalogProps) {
  return (
    <div className="fzm-menu fzm-floating" style={{ left: position.x, top: position.y }} role="menu">
      <div className="fzm-menu__label">Basic</div>
      {(["text", "image", "video", "group"] as const).map((kind) => (
        <button className="fzm-menu__item" key={kind} type="button" onClick={() => onCreate(kind)}>
          <span>{kind[0].toUpperCase() + kind.slice(1)}</span>
        </button>
      ))}
      <div className="fzm-menu__sep" />
      <button className="fzm-menu__item" type="button" disabled>Audio <span>Future</span></button>
      <button className="fzm-menu__item" type="button" disabled>Workflow <span>Future</span></button>
    </div>
  );
}
