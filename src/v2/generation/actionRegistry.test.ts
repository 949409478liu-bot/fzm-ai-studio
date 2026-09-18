import { describe, expect, it } from "vitest";
import { actionRegistry, defaultActionForReferences, getActionDescriptor } from "./actionRegistry";

describe("actionRegistry", () => {
  it("keeps generate and edit as actions, not node types", () => {
    expect(actionRegistry.map((action) => action.id)).toEqual(["image.generate", "image.edit"]);
    expect(getActionDescriptor("image.edit")).toMatchObject({ capability: "image.edit", sourceKinds: ["image"], outputKind: "image", enabled: true });
  });

  it("defaults to edit when references exist", () => {
    expect(defaultActionForReferences(0)).toBe("image.generate");
    expect(defaultActionForReferences(1)).toBe("image.edit");
  });
});
