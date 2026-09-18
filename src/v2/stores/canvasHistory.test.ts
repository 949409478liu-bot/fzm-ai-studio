import { describe, expect, it } from "vitest";
import { createCanvasEdge, createCanvasNode } from "../canvas/graph/graphUtils";
import { createHistoryState, pushHistory, redoHistory, undoHistory } from "./canvasHistory";

describe("canvas history", () => {
  it("undoes and redoes add node", () => {
    const node = createCanvasNode("text", 0, 0);
    const history = pushHistory(createHistoryState(), { nodes: [node], edges: [] });
    expect(undoHistory(history).present.nodes).toHaveLength(0);
    expect(redoHistory(undoHistory(history)).present.nodes).toHaveLength(1);
  });

  it("undoes delete node", () => {
    const node = createCanvasNode("image", 0, 0);
    const added = pushHistory(createHistoryState(), { nodes: [node], edges: [] });
    const deleted = pushHistory(added, { nodes: [], edges: [] });
    expect(undoHistory(deleted).present.nodes[0]?.id).toBe(node.id);
  });

  it("undoes edge add", () => {
    const a = createCanvasNode("text", 0, 0);
    const b = createCanvasNode("image", 100, 0);
    const edge = createCanvasEdge(a.id, b.id);
    const base = createHistoryState({ nodes: [a, b], edges: [] });
    const withEdge = pushHistory(base, { nodes: [a, b], edges: [edge] });
    expect(undoHistory(withEdge).present.edges).toHaveLength(0);
  });

  it("undoes move", () => {
    const node = createCanvasNode("video", 0, 0);
    const moved = { ...node, position: { x: 80, y: 40 } };
    const base = createHistoryState({ nodes: [node], edges: [] });
    const history = pushHistory(base, { nodes: [moved], edges: [] });
    expect(undoHistory(history).present.nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });
});
