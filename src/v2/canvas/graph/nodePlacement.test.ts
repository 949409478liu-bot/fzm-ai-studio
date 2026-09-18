import { describe, expect, it } from "vitest";
import { createCanvasNode } from "./graphUtils";
import { findAvailableNodePosition } from "./nodePlacement";

describe("findAvailableNodePosition", () => {
  it("keeps the preferred point when it is empty", () => {
    expect(findAvailableNodePosition({ nodes: [], preferredPoint: { x: 100, y: 100 }, width: 320, height: 250 })).toEqual({ x: 100, y: 100 });
  });

  it("places repeated toolbar-created nodes without exact overlap", () => {
    const nodes = [];
    const positions: string[] = [];

    for (let index = 0; index < 10; index += 1) {
      const position = findAvailableNodePosition({ nodes, preferredPoint: { x: 400, y: 300 }, width: 320, height: 250 });
      positions.push(`${position.x}:${position.y}`);
      nodes.push(createCanvasNode("image", position.x, position.y));
    }

    expect(new Set(positions).size).toBe(10);
  });
});
