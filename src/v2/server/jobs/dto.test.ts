import { describe, expect, it } from "vitest";
import { toJobDto } from "./dto";

describe("job DTO diagnostics", () => {
  it("exposes retry diagnostics without secrets or remote tickets", () => {
    const dto = toJobDto({
      id: "job-1", generationId: "generation-1", projectId: "project-1", nodeId: null,
      executionToken: "execution-secret", providerId: "provider-1", modelId: "model-1",
      remoteTaskId: "remote-ticket-secret", status: "rate_limited", phase: "rate_limited", progress: null,
      attempt: 2, nextRetryAt: "2026-09-18T12:00:00.000Z", deadlineAt: null,
      ticket: { token: "remote-ticket-secret" }, stagedOutputAssetIds: [],
      error: "Bearer sk-super-secret https://provider.test/jobs/remote-ticket-secret?api_key=secret",
      errorCode: "provider_rate_limited", httpStatus: 429,
      createdAt: "2026-09-18T11:00:00.000Z", updatedAt: "2026-09-18T11:30:00.000Z", finishedAt: null,
    });
    expect(dto).toMatchObject({ attempt: 2, nextRetryAt: "2026-09-18T12:00:00.000Z", errorCode: "provider_rate_limited", httpStatus: 429 });
    expect(dto.error).toContain("[REDACTED]");
    expect(JSON.stringify(dto)).not.toContain("execution-secret");
    expect(JSON.stringify(dto)).not.toContain("remote-ticket-secret");
    expect(JSON.stringify(dto)).not.toContain("api_key=secret");
    expect(dto).not.toHaveProperty("remoteTaskId");
    expect(dto).not.toHaveProperty("ticket");
  });

  it("derives historical HTTP codes without modifying stored jobs", () => {
    const common = { id: "job", generationId: "g", projectId: "p", nodeId: null, executionToken: "hidden", providerId: "relay", modelId: "image", remoteTaskId: null, status: "failed", phase: "failed", progress: null, attempt: 0, nextRetryAt: null, deadlineAt: null, ticket: {}, stagedOutputAssetIds: [], errorCode: null, httpStatus: null, createdAt: "2026-09-18T11:00:00Z", updatedAt: "2026-09-18T11:00:00Z", finishedAt: null };
    for (const status of [400, 401, 429]) {
      const error = `openai_compatible_submit_failed_${status}`;
      expect(toJobDto({ ...common, error })).toMatchObject({ errorCode: error, httpStatus: status });
    }
    expect(toJobDto({ ...common, error: "openai_compatible_submit_failed_999" })).toMatchObject({ errorCode: null, httpStatus: null });
    expect(toJobDto({ ...common, error: "openai_compatible_submit_failed_400_token=secret" })).toMatchObject({ errorCode: null, httpStatus: null });
  });
  it("rejects unsafe diagnostic values", () => {
    const dto = toJobDto({
      id: "job-1", generationId: "generation-1", projectId: "project-1", nodeId: null,
      executionToken: "secret", providerId: "provider-1", modelId: "model-1", remoteTaskId: null,
      status: "failed", phase: "failed", progress: null, attempt: -1, nextRetryAt: "not-a-date",
      deadlineAt: null, ticket: {}, stagedOutputAssetIds: [], error: "safe", errorCode: "bad code; secret",
      httpStatus: 999, createdAt: "2026-09-18T11:00:00.000Z", updatedAt: "2026-09-18T11:00:00.000Z", finishedAt: null,
    });
    expect(dto.attempt).toBe(0);
    expect(dto.nextRetryAt).toBeNull();
    expect(dto.errorCode).toBeNull();
    expect(dto.httpStatus).toBeNull();
  });
  it("redacts raw authorization and signed query secrets before serializing", () => {
    const common = { id: "job-1", generationId: "g", projectId: "p", nodeId: null, executionToken: "hidden", providerId: "provider", modelId: "model", remoteTaskId: null, status: "failed", phase: "failed", progress: null, attempt: 1, nextRetryAt: null, deadlineAt: null, ticket: {}, stagedOutputAssetIds: [], errorCode: null, httpStatus: 401, createdAt: "2026-09-18T11:00:00Z", updatedAt: "2026-09-18T11:00:00Z", finishedAt: null };
    for (const error of ["Authorization: Bearer raw-token", "api_key=raw-key", "https://relay.test/image?token=raw-token", "password: raw-password"]) {
      const dto = toJobDto({ ...common, error });
      expect(dto.error).not.toContain("raw-");
    }
  });
});
