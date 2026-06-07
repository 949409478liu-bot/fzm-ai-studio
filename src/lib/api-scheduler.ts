import { useStudioStore } from "./store";
import { getProvider } from "./providers/dispatcher";
import type { ProviderName } from "./providers/types";
import type { ImageGenerationRequest, ImageGenerationResponse } from "./providers/types";
import type { TLAssetId, TLShapeId } from "@tldraw/tldraw";
import type { CanvasAction } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────

export interface GenerationTask {
  provider: ProviderName;
  /** When using a real provider, set this to the config id from provider-configs.json */
  providerId?: string;
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
  console.log("[api-scheduler] 任务入队", JSON.stringify({
    taskId: task.action.id,
    providerId: task.providerId ?? "(none)",
    provider: task.request.provider,
    model: task.request.model,
    actionType: task.request.actionType,
    queueLength: queue.length,
  }));
  processQueue();
}

// Track stuck tasks
if (typeof window !== "undefined") {
  setInterval(() => {
    if (queue.length > 0) {
      const elapsed = Date.now() - queue[0].task.action.createdAt;
      if (elapsed > 1000) {
        console.warn(`[api-scheduler] 任务仍在队列中 (${elapsed}ms)，可能 scheduler 未启动`);
      }
    }
  }, 2000);
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

  const isReal = task.provider !== "mock" && !!task.providerId;
  console.log("[api-scheduler] executeTask·running", JSON.stringify({
    actionId: task.action.id,
    status: "running",
    useReal: isReal,
    willFetchApiRun: isReal,
    providerId: task.providerId ?? "(none)",
    model: task.request.model,
    actionType: task.request.actionType,
    prompt: task.request.prompt || "(none)",
  }));

  store.updateActionStatus(task.action.id, "running");

  try {
    let result: ImageGenerationResponse;

    if (!isReal) {
      // Local mock adapter
      const provider = getProvider(task.provider);
      result = await provider.generateImage(task.request);
    } else {
      // Real provider: call server-side API route
      const res = await fetch("/api/providers/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: task.providerId,
          request: task.request,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `服务器返回 ${res.status}`);
      }

      result = await res.json();

      // Convert b64Json → data: URL on the client side.
      // data: URLs survive page refresh and IndexedDB persistence;
      // blob: URLs would be lost when the page unloads.
      for (const asset of result.assets) {
        if (asset.b64Json && !asset.url) {
          asset.url = `data:${asset.mimeType || "image/png"};base64,${asset.b64Json}`;
        }
      }
    }

    store.updateActionStatus(task.action.id, "completed");
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
