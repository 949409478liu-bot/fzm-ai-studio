import { describe, expect, it } from "vitest";
import { extractProviderDiagnostic } from "./diagnostic";

function assertSafe(error: unknown) {
  const result = extractProviderDiagnostic(error);
  expect(JSON.stringify(result)).not.toMatch(/raw-secret|signed-secret|raw-token|request-body-secret/);
  return result;
}

describe("provider diagnostic extraction", () => {
  it("prefers structured status and safe code", () => {
    expect(assertSafe(Object.assign(new Error("openai_compatible_submit_failed_401"), { status: 400 }))).toMatchObject({ errorCode: "openai_compatible_submit_failed_401", httpStatus: 400 });
    expect(assertSafe({ message: "submit_failed", response: { status: 429 } })).toMatchObject({ errorCode: "submit_failed", httpStatus: 429 });
    expect(assertSafe({ message: "submit_failed", statusCode: 503 })).toMatchObject({ httpStatus: 503 });
  });
  it("parses allowlisted suffixes only and keeps malformed errors generic", () => {
    for (const status of [400, 401, 403, 404, 429, 500, 502, 503, 504]) expect(assertSafe(new Error(`openai_compatible_submit_failed_${status}`))).toMatchObject({ errorCode: `openai_compatible_submit_failed_${status}`, httpStatus: status });
    for (const message of ["openai_compatible_submit_failed_999", "openai_compatible_submit_failed_400_token=raw-secret"]) expect(assertSafe(new Error(message))).toMatchObject({ errorCode: null, httpStatus: null });
  });
  it("does not expose credentials, signed URLs or request bodies", () => {
    const result = assertSafe({ message: "Authorization: Bearer raw-token API key=raw-secret https://relay.test/out?token=signed-secret", status: 401, request: { body: "request-body-secret" } });
    expect(result.httpStatus).toBe(401);
  });
});
