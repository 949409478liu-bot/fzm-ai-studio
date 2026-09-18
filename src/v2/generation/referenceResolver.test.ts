import { describe, expect, it } from "vitest";
import { hasMissingGraphInput, resolveGraphReferences, toGenerationReferences } from "./referenceResolver";
import type { V2FlowEdge, V2FlowNode } from "@/v2/types/canvas";

const nodes = [
  { id: "a", type: "image", position: { x: 0, y: 0 }, data: { kind: "image", title: "A", assetId: "asset-a" } },
  { id: "b", type: "image", position: { x: 0, y: 0 }, data: { kind: "image", title: "B" } },
  { id: "c", type: "image", position: { x: 0, y: 0 }, data: { kind: "image", title: "C" } },
] as V2FlowNode[];

const edges = [
  { id: "a-c", source: "a", target: "c", data: { role: "reference-image", status: "ready" } },
  { id: "b-c", source: "b", target: "c", data: { role: "reference-image", status: "missing-input" } },
] as V2FlowEdge[];

describe("referenceResolver", () => {
  it("resolves direct graph image references in stable order", () => {
    expect(resolveGraphReferences("c", nodes, edges)).toEqual([{ assetId: "asset-a", role: "reference-image", order: 0, source: "graph", edgeId: "a-c" }]);
  });

  it("snapshots references without UI-only source fields", () => {
    expect(toGenerationReferences(resolveGraphReferences("c", nodes, edges))).toEqual([{ assetId: "asset-a", role: "reference-image", order: 0 }]);
  });

  it("detects missing upstream assets before paid submit", () => {
    expect(hasMissingGraphInput("c", nodes, edges)).toBe(true);
  });
});
