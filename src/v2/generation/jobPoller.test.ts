import { afterEach, describe, expect, it, vi } from "vitest";
import { __jobPollerStats, subscribeJob } from "./jobPoller";

vi.mock("./generationApi", () => ({ getJob: vi.fn(async () => ({ job: { id: "job", generationId: "gen", status: "succeeded", phase: "succeeded", progress: 1, providerId: "provider", modelId: "model", createdAt: "now", updatedAt: "now", finishedAt: "now", error: null } })) }));

describe("jobPoller", () => {
  afterEach(() => vi.useRealTimers());

  it("cleans terminal listeners", async () => {
    vi.useFakeTimers();
    subscribeJob("job", vi.fn());
    expect(__jobPollerStats()).toEqual({ timers: 1, listeners: 1 });
    await vi.runOnlyPendingTimersAsync();
    expect(__jobPollerStats()).toEqual({ timers: 0, listeners: 0 });
  });

  it("cleans explicit unsubscribe", () => {
    vi.useFakeTimers();
    const unsubscribe = subscribeJob("job-2", vi.fn());
    expect(__jobPollerStats()).toEqual({ timers: 1, listeners: 1 });
    unsubscribe();
    expect(__jobPollerStats()).toEqual({ timers: 0, listeners: 0 });
  });
});
