import type { ActionDescriptor, GenerationActionId } from "./types";

export const actionRegistry: ActionDescriptor[] = [
  { id: "image.generate", label: "生成图片", icon: "sparkles", sourceKinds: [], outputKind: "image", capability: "image.generate", referencePolicy: "none", promptRequired: true, enabled: true },
  { id: "image.edit", label: "编辑图片", icon: "wand", sourceKinds: ["image"], outputKind: "image", capability: "image.edit", referencePolicy: "required", promptRequired: true, enabled: true },
];

export const futureImageActions = ["生成变体", "高清修复", "扩图", "去背景"] as const;

export function getActionDescriptor(id: GenerationActionId): ActionDescriptor {
  const action = actionRegistry.find((item) => item.id === id);
  if (!action) throw new Error(`unknown_action:${id}`);
  return action;
}

export function defaultActionForReferences(referenceCount: number): GenerationActionId {
  return referenceCount > 0 ? "image.edit" : "image.generate";
}
