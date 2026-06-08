/**
 * Gemini Native API adapter.
 * Uses Google Gemini generateContent endpoint (via 中转站 proxy).
 *
 * V0.5.5.7: text-to-image + image-to-image support.
 */

import type {
  ProviderConfig,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedAsset,
} from "./types";

const TIMEOUT_MS = 300_000;

/** Strip /v1 suffix to get root base URL for Gemini endpoint */
export function normalizeGeminiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "");
}

/** Build Gemini endpoint URL */
function geminiEndpoint(rootBase: string, model: string): string {
  return `${rootBase}/v1beta/models/${model}:generateContent`;
}

// ─── Text-to-image ───────────────────────────────────────────────────

export async function generateGeminiNativeImage(
  config: ProviderConfig,
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const { baseUrl, apiKey } = config;
  const model = request.model || config.defaultModel || "";
  const rootBase = normalizeGeminiBaseUrl(baseUrl || "");
  const endpoint = geminiEndpoint(rootBase, model);
  const startedAt = performance.now();

  const sizeStr =
    request.size.width && request.size.height
      ? `${request.size.width}:${request.size.height}`
      : "1:1";

  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: request.prompt || "Generate an image" }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: sizeStr },
    },
  });

  const response = await geminiFetch(endpoint, apiKey || "", body, TIMEOUT_MS);
  const result = parseGeminiResponse(response, model, startedAt, request.size.width, request.size.height);
  return result;
}

// ─── Image-to-image (with inlineData) ────────────────────────────────

export async function generateGeminiNativeImageEdit(
  config: ProviderConfig,
  imageBlob: Blob,
  params: {
    model: string;
    prompt: string;
    size?: string;
  }
): Promise<ImageGenerationResponse> {
  const { baseUrl, apiKey } = config;
  const model = params.model || config.defaultModel || "";
  const rootBase = normalizeGeminiBaseUrl(baseUrl || "");
  const endpoint = geminiEndpoint(rootBase, model);
  const startedAt = performance.now();

  // Convert image blob to base64
  const arrayBuf = await imageBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);
  const mimeType = imageBlob.type || "image/png";

  const sizeStr = params.size || "1:1";

  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: params.prompt || "Edit this image" },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: sizeStr },
    },
  });

  const response = await geminiFetch(endpoint, apiKey || "", body, TIMEOUT_MS);
  const result = parseGeminiResponse(response, model, startedAt, 1024, 1024);
  return result;
}

// ─── Shared fetch ────────────────────────────────────────────────────

async function geminiFetch(
  endpoint: string,
  apiKey: string,
  body: string,
  timeout: number
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      throw new Error(`Gemini 请求超时（${timeout / 1000}秒）`);
    }
    throw new Error(`网络错误: ${msg.slice(0, 100)}`);
  }

  if (response.status === 401) throw new Error("API Key 无效 (401)");
  if (response.status === 403) throw new Error("API Key 无权限 (403)");
  if (response.status === 404) throw new Error(`Gemini 接口不存在 (404): ${endpoint}`);
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.text();
      const parsed = JSON.parse(errBody);
      detail = parsed?.error?.message || errBody.slice(0, 200);
    } catch { /* use default */ }
    throw new Error(`Gemini 返回错误 (${response.status}): ${detail}`);
  }
  return response;
}

// ─── Response parsing ────────────────────────────────────────────────

function parseGeminiResponse(
  response: Response,
  model: string,
  startedAt: number,
  defaultW: number,
  defaultH: number
): Promise<ImageGenerationResponse> {
  return response.json().then((data: Record<string, unknown>) => {
    const candidates = data?.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates || candidates.length === 0) {
      throw new Error("Gemini 响应中没有返回生成结果 (candidates 为空)");
    }

    const parts = candidates[0]?.content as Record<string, unknown> | undefined;
    const partList = parts?.parts as Array<Record<string, unknown>> | undefined;
    if (!partList) {
      throw new Error("Gemini 响应格式异常，未找到 parts");
    }

    const assets: GeneratedAsset[] = [];
    for (const part of partList) {
      const inlineData = part.inlineData as Record<string, unknown> | undefined;
      if (inlineData?.data) {
        assets.push({
          url: "",
          width: defaultW,
          height: defaultH,
          mimeType: (inlineData.mimeType as string) || "image/png",
          b64Json: inlineData.data as string,
        });
      }
    }

    if (assets.length === 0) {
      throw new Error("Gemini 响应中没有返回图片数据 (inlineData.data 缺失)");
    }

    return {
      assets,
      provider: "gemini-native",
      model,
      metadata: { elapsed: Math.round(performance.now() - startedAt) },
    };
  });
}
