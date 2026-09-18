import { describe, expect, it } from "vitest";
import { humanGenerationError, jobStatusMessage } from "./errorMessages";

describe("generation error messages", () => {
  it("maps provider and ambiguous submit errors to human messages", () => {
    expect(humanGenerationError(Object.assign(new Error("request_failed"), { body: { error: "provider_disabled" } }))).toContain("Provider 已停用");
    expect(jobStatusMessage("interrupted", "ambiguous_submit")).toContain("避免重复扣费");
  });
});
