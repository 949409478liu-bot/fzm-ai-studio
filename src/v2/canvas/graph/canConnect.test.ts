import { describe, expect, it } from "vitest";
import { canConnect } from "./canConnect";

const edges = [
  { id: "a-b", source: "a", target: "b" },
  { id: "b-c", source: "b", target: "c" },
];

describe("canConnect", () => {
  it("rejects self edges", () => {
    expect(canConnect([], { source: "a", target: "a" })).toEqual({ ok: false, reason: "self-edge" });
  });

  it("rejects duplicate edges", () => {
    expect(canConnect(edges, { source: "a", target: "b" })).toEqual({ ok: false, reason: "duplicate-edge" });
  });

  it("rejects cycles", () => {
    expect(canConnect(edges, { source: "c", target: "a" })).toEqual({ ok: false, reason: "cycle" });
  });

  it("accepts valid edges", () => {
    expect(canConnect(edges, { source: "a", target: "c" })).toEqual({ ok: true });
  });
});
