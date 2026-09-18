import type { FloatingPosition, V2NodeKind } from "@/v2/types/canvas";

interface CreateFromHandleMenuProps {
  position: FloatingPosition;
  onCreate: (kind: Extract<V2NodeKind, "text" | "image" | "video">) => void;
}

export function CreateFromHandleMenu({ position, onCreate }: CreateFromHandleMenuProps) {
  return (
    <div className="fzm-menu fzm-floating" style={{ left: position.x, top: position.y }} role="menu">
      <div className="fzm-menu__label">Create connected</div>
      <button className="fzm-menu__item" type="button" onClick={() => onCreate("text")}>Create Text</button>
      <button className="fzm-menu__item" type="button" onClick={() => onCreate("image")}>Create Image</button>
      <button className="fzm-menu__item" type="button" onClick={() => onCreate("video")}>Create Video</button>
    </div>
  );
}
