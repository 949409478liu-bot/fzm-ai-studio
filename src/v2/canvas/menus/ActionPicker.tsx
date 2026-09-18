"use client";

import { ImagePlus, Sparkles, Wand2 } from "lucide-react";
import { futureImageActions } from "@/v2/generation/actionRegistry";
import type { GenerationActionId } from "@/v2/generation/types";
import type { FloatingPosition } from "@/v2/types/canvas";

interface ActionPickerProps {
  position: FloatingPosition;
  sourceKind: string;
  onChoose: (action: GenerationActionId) => void;
}

export function ActionPicker({ position, sourceKind, onChoose }: ActionPickerProps) {
  if (sourceKind !== "image") return null;
  return (
    <div className="fzm-action-picker fzm-menu fzm-floating" style={{ left: position.x, top: position.y }} role="menu" aria-label="Image actions">
      <div className="fzm-menu__label">基于当前图片</div>
      <button className="fzm-menu__item" type="button" onClick={() => onChoose("image.edit")}><span><Wand2 size={14} /> 编辑图片</span></button>
      <button className="fzm-menu__item" type="button" disabled><span><Sparkles size={14} /> 生成变体</span><em>Soon</em></button>
      <div className="fzm-menu__sep" />
      <div className="fzm-menu__label">图片</div>
      <button className="fzm-menu__item" type="button" onClick={() => onChoose("image.generate")}><span><ImagePlus size={14} /> 新生成图片</span></button>
      {futureImageActions.slice(1).map((label) => <button className="fzm-menu__item" type="button" disabled key={label}>{label}<em>Soon</em></button>)}
      <div className="fzm-menu__label">理解</div>
      <button className="fzm-menu__item" type="button" disabled>图片分析<em>Soon</em></button>
    </div>
  );
}
