import "server-only";
import { claimNextJob, recoverJobs } from "./repository";
import { runJob } from "./runner";

const globalForScheduler = globalThis as typeof globalThis & { __fzmV2JobScheduler?: { started: boolean; busy: boolean; timer: ReturnType<typeof setTimeout> | null } };

function state() {
  globalForScheduler.__fzmV2JobScheduler ??= { started: false, busy: false, timer: null };
  return globalForScheduler.__fzmV2JobScheduler;
}

async function tick() {
  const current = state();
  if (current.busy) return schedule();
  current.busy = true;
  try {
    const job = claimNextJob();
    if (job) await runJob(job);
  } finally {
    current.busy = false;
    schedule();
  }
}

function schedule() {
  const current = state();
  if (!current.started) return;
  if (current.timer) clearTimeout(current.timer);
  current.timer = setTimeout(() => { void tick(); }, 1000);
}

export function ensureJobSchedulerStarted() {
  const current = state();
  if (current.started) return;
  recoverJobs();
  current.started = true;
  schedule();
}

export function stopJobSchedulerForTests() {
  const current = state();
  current.started = false;
  if (current.timer) clearTimeout(current.timer);
  current.timer = null;
}
