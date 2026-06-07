import { useStudioStore } from "./store";
import { getProvider } from "./providers/dispatcher";
import type { ProviderName } from "./providers/types";
import type { ImageGenerationRequest, ImageGenerationResponse } from "./providers/types";
import type { TLAssetId, TLShapeId } from "@tldraw/tldraw";
import type { CanvasAction } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────

export interface GenerationTask {
  provider: ProviderName;
  action: CanvasAction;
  sourceShapeId: TLShapeId;
  sourceAssetId: TLAssetId;
  request: ImageGenerationRequest;
  onResult: (result: ImageGenerationResponse) => void;
  onError: (error: Error) => void;
}

// ─── Scheduler ───────────────────────────────────────────────────────

const MAX_CONCURRENT = 2;

interface QueueItem {
  task: GenerationTask;
}

const queue: QueueItem[] = [];
let running = 0;

export function enqueueGenerationTask(task: GenerationTask): void {
  queue.push({ task });
  processQueue();
}

function processQueue(): void {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift();
    if (!item) return;
    running++;
    executeTask(item);
  }
}

async function executeTask(item: QueueItem): Promise<void> {
  const { task } = item;
  const store = useStudioStore.getState();

  // queued → running
  store.updateActionStatus(task.action.id, "running");

  try {
    const provider = getProvider(task.provider);
    const result = await provider.generateImage(task.request);

    // running → completed
    store.updateActionStatus(task.action.id, "completed");

    // Write results back to canvas
    task.onResult(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn(`[api-scheduler] 任务失败 (${task.action.actionLabel})`, err.message);

    store.updateActionStatus(task.action.id, "failed");
    task.onError(err);
  } finally {
    running--;
    processQueue();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function getQueueLength(): number {
  return queue.length;
}

export function getRunningCount(): number {
  return running;
}
