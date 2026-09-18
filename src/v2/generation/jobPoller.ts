"use client";

import { getJob } from "./generationApi";
import { useGenerationStore } from "./generationStore";
import type { JobDto } from "./types";

const terminal = new Set(["succeeded", "failed", "canceled", "interrupted"]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Map<string, Set<(job: JobDto) => void>>();

function delayFor(job: JobDto) {
  if (["queued", "preparing", "submitting", "downloading", "finalizing"].includes(job.status)) return 1000;
  return 2000;
}

async function tick(jobId: string) {
  try {
    const { job } = await getJob(jobId);
    useGenerationStore.getState().updateJob(job);
    listeners.get(jobId)?.forEach((listener) => listener(job));
    if (!terminal.has(job.status) && listeners.has(jobId)) timers.set(jobId, setTimeout(() => void tick(jobId), delayFor(job)));
  } catch {
    if (listeners.has(jobId)) timers.set(jobId, setTimeout(() => void tick(jobId), 2500));
  }
}

export function subscribeJob(jobId: string, listener: (job: JobDto) => void) {
  const set = listeners.get(jobId) ?? new Set<(job: JobDto) => void>();
  set.add(listener);
  listeners.set(jobId, set);
  if (!timers.has(jobId)) timers.set(jobId, setTimeout(() => void tick(jobId), 100));
  return () => {
    const current = listeners.get(jobId);
    current?.delete(listener);
    if (current && current.size > 0) return;
    listeners.delete(jobId);
    const timer = timers.get(jobId);
    if (timer) clearTimeout(timer);
    timers.delete(jobId);
  };
}

export function isTerminalJob(status: string) {
  return terminal.has(status);
}
