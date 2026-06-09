/**
 * GPTsAPI v3 Image Adapter (V0.5.5.8 → V0.5.5.9.1).
 *
 * Multi-model support. Each model declares a providerPath in its config.
 * Endpoint: POST {root}/api/v3/{providerPath}/{modelName}/text-to-image
 *
 * Supported models:
 *   - gpt-image-2                    (providerPath: openai)
 *   - gemini-3.1-flash-image-preview (providerPath: google)
 *   - gemini-3-pro-image-preview     (providerPath: google)
 */
import type {
  ProviderConfig,
  ProviderModelConfig,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedAsset,
} from "./types";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 180_000;

// ─── Aspect ratio mapping ──────────────────────────────────────────────

const SIZE_TO_ASPECT: Record<string, string> = {
  "1024x1024": "1:1",
  "1536x864": "16:9",
  "864x1536": "9:16",
  "1280x960": "4:3",
  "960x1280": "3:4",
};

function toAspectRatio(size: { width: number; height: number }): string {
  const key = `${size.width}x${size.height}`;
  return SIZE_TO_ASPECT[key] || "1:1";
}

// ─── Resolution mapping ────────────────────────────────────────────────

function toResolution(quality?: string): string {
  switch (quality) {
    case "low": return "1K";
    case "high": return "4K";
    case "medium":
    case "auto":
    default: return "2K";
  }
}

// ─── Base URL normalization for GPTsAPI ─────────────────────────────────

/**
 * GPTsAPI v3 endpoints live at /api/v3/..., not under /v1.
 * Strip /v1 suffix so the root is e.g. https://api.gptsapi.net
 */
function normalizeGptsApiRoot(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (url.endsWith("/v1")) {
    url = url.slice(0, -3);
  }
  return url.replace(/\/+$/, "");
}

// ─── Safe nested access for dynamic JSON ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nested(obj: any, ...path: string[]): any {
  let cur = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[key];
  }
  return cur;
}

// ─── Async polling ─────────────────────────────────────────────────────

interface PollResult {
  assets: GeneratedAsset[];
  width: number;
  height: number;
}

const RESOLUTION_DIMS: Record<string, { w: number; h: number }> = {
  "1K": { w: 1024, h: 1024 },
  "2K": { w: 2048, h: 2048 },
  "4K": { w: 4096, h: 4096 },
};

async function pollForResult(
  pollUrl: string,
  apiKey: string,
  resolution: string
): Promise<PollResult> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    let res: Response;
    try {
      res = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      continue; // network hiccup, retry
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`轮询结果接口返回 ${res.status}: ${text.slice(0, 200)}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = await res.json();
    } catch {
      continue; // malformed response, retry
    }

    const status = String(data?.status ?? nested(data, "data", "status") ?? "").toLowerCase();
    if (status === "failed" || status === "error") {
      const errMsg = data?.error ?? nested(data, "data", "error") ?? "未知错误";
      throw new Error(`GPTsAPI 生成失败: ${errMsg}`);
    }

    if (status === "succeeded" || status === "completed" || status === "success") {
      return parsePollResponse(data, resolution);
    }

    // Still processing, continue polling
  }

  throw new Error(`GPTsAPI 轮询超时（${POLL_TIMEOUT_MS / 1000}秒）`);
}

function parsePollResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  resolution: string
): PollResult {
  const dims = RESOLUTION_DIMS[resolution] || { w: 2048, h: 2048 };
  const dw = dims.w;
  const dh = dims.h;

  // Try multiple response formats (documentation is not final)
  const outputs = nested(data, "data", "outputs") ?? data?.outputs ?? data?.output;
  const firstOutput = Array.isArray(outputs) ? outputs[0] : outputs;

  // outputs[0] is a URL string (most common GPTsAPI format)
  if (typeof firstOutput === "string" && firstOutput.startsWith("http")) {
    return { assets: [{ url: firstOutput, width: dw, height: dh, mimeType: "image/png" }], width: dw, height: dh };
  }

  if (firstOutput && typeof firstOutput === "object") {
    const b64 = firstOutput.b64_json as string | undefined;
    const url = firstOutput.url as string | undefined;
    if (b64) {
      return { assets: [{ url: "", width: dw, height: dh, mimeType: "image/png", b64Json: b64 }], width: dw, height: dh };
    }
    if (url) {
      return { assets: [{ url, width: dw, height: dh, mimeType: "image/png" }], width: dw, height: dh };
    }
  }

  // Fallback: data.url
  const directUrl = nested(data, "data", "url") ?? data?.url;
  if (typeof directUrl === "string") {
    return { assets: [{ url: directUrl, width: dw, height: dh, mimeType: "image/png" }], width: dw, height: dh };
  }

  // Fallback: urls.get
  const resultUrl = nested(data, "data", "urls", "get") ?? nested(data, "urls", "get");
  if (typeof resultUrl === "string") {
    return { assets: [{ url: resultUrl, width: dw, height: dh, mimeType: "image/png" }], width: dw, height: dh };
  }

  throw new Error("GPTsAPI 返回了无法识别的结果格式");
}

// ─── Body construction per provider ────────────────────────────────────

function buildRequestBody(
  providerPath: string,
  prompt: string,
  aspectRatio: string,
  quality?: string
): Record<string, string> {
  switch (providerPath) {
    case "google":
      return { prompt, aspect_ratio: aspectRatio, output_format: "png" };
    case "openai":
    default:
      return { prompt, aspect_ratio: aspectRatio, resolution: toResolution(quality) };
  }
}

function getResolutionLabel(providerPath: string, quality?: string): string {
  return providerPath === "google" ? "default" : toResolution(quality);
}

// ─── Public API ────────────────────────────────────────────────────────

export async function generateGptsApiV3TextToImage(
  config: ProviderConfig,
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const { baseUrl, apiKey } = config;
  const root = normalizeGptsApiRoot(baseUrl || "");
  const modelName = request.model || config.defaultModel || "gpt-image-2";
  const modelCfg: ProviderModelConfig | undefined = config.models?.find((m) => m.name === modelName);
  const providerPath = modelCfg?.providerPath || "openai";
  const aspectRatio = toAspectRatio(request.size);
  const resolution = getResolutionLabel(providerPath, request.quality);

  const endpoint = `${root}/api/v3/${providerPath}/${modelName}/text-to-image`;

  console.log("[gptsapi-v3] 最终请求 URL", JSON.stringify({
    rawBaseUrl: baseUrl,
    normalizedRoot: root,
    providerPath,
    model: modelName,
    finalEndpoint: endpoint,
    resolution,
    aspectRatio,
  }));

  const startedAt = performance.now();

  // Step 1: Create async task
  const body = JSON.stringify(
    buildRequestBody(providerPath, request.prompt || "生成一张高质量的图片", aspectRatio, request.quality)
  );

  let createRes: Response;
  try {
    createRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      throw new Error("GPTsAPI 创建任务超时（30秒）");
    }
    throw new Error(`GPTsAPI 网络错误: ${msg.slice(0, 100)}`);
  }

  if (resIsAuthError(createRes)) throwAuthError(createRes);
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    let msg = `GPTsAPI 返回 ${createRes.status}`;
    try {
      const parsed = JSON.parse(detail);
      msg = parsed?.error?.message || parsed?.message || detail.slice(0, 200);
    } catch { msg = detail.slice(0, 200) || msg; }
    throw new Error(msg);
  }

  let createData: Record<string, unknown>;
  try {
    createData = await createRes.json();
  } catch {
    throw new Error("GPTsAPI 返回了无法解析的响应");
  }

  const taskId = nested(createData, "data", "id") as string | undefined;
  const pollUrl = nested(createData, "data", "urls", "get") as string | undefined;

  if (!taskId || !pollUrl) {
    throw new Error(
      `GPTsAPI 响应缺少 task id 或 poll url。响应: ${JSON.stringify(createData).slice(0, 300)}`
    );
  }

  console.log("[gptsapi-v3] 任务已创建", JSON.stringify({
    taskId, model: modelName, providerPath, resolution, aspectRatio, pollUrl,
  }));

  // Step 2: Poll for result
  let pollResult: PollResult;
  try {
    pollResult = await pollForResult(pollUrl, apiKey!, resolution);
  } catch (err) {
    console.error("[gptsapi-v3] 轮询失败", JSON.stringify({
      taskId, pollUrl,
      error: err instanceof Error ? err.message : String(err),
    }));
    throw err;
  }

  // Step 3: If result is a URL (not b64_json), fetch & convert to base64
  const assets = await resolveAssets(pollResult.assets, apiKey!);

  console.log("[gptsapi-v3] 生成完成", JSON.stringify({
    taskId, elapsedMs: Math.round(performance.now() - startedAt),
    assetsCount: assets.length,
  }));

  return {
    assets,
    provider: "openai-compatible",
    model: modelName,
    metadata: {
      elapsed: Math.round(performance.now() - startedAt),
      size: resolution,
    },
  };
}

async function resolveAssets(
  assets: GeneratedAsset[],
  apiKey: string
): Promise<GeneratedAsset[]> {
  const resolved: GeneratedAsset[] = [];
  for (const a of assets) {
    if (a.b64Json) {
      resolved.push(a);
    } else if (a.url) {
      try {
        const imgRes = await fetch(a.url, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(30_000),
        });
        if (!imgRes.ok) {
          resolved.push(a);
          continue;
        }
        const resContentType = imgRes.headers.get("content-type") || "";
        // Skip non-image responses (e.g. JSON from a failed parse)
        if (resContentType.includes("application/json") || resContentType.includes("text/")) {
          resolved.push(a);
          continue;
        }
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        const b64 = imgBuffer.toString("base64");
        const mimeType = detectMimeType(b64, resContentType);
        resolved.push({
          url: "",
          width: a.width,
          height: a.height,
          mimeType,
          b64Json: b64,
        });
      } catch {
        resolved.push(a);
      }
    }
  }
  return resolved.length > 0 ? resolved : assets;
}

/** Detect MIME type from base64 magic bytes, falling back to content-type header. */
function detectMimeType(b64: string, fallback: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return fallback || "image/png";
}

// ─── Helpers ────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resIsAuthError(res: Response) {
  return res.status === 401 || res.status === 403;
}

function throwAuthError(res: Response): never {
  if (res.status === 401) throw new Error("GPTsAPI Key 无效 (401)");
  throw new Error("GPTsAPI Key 无权限或余额不足 (403)");
}
