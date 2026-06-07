/**
 * OpenAI-Compatible Provider Adapter.
 * Supports official OpenAI,中转站, and any OpenAI-format proxies.
 *
 * V0.5.2: text connection test.
 * V0.5.3: image generation (text-to-image via /images/generations).
 */

import type {
  ProviderConfig,
  ImageGenerationRequest,
  ImageGenerationResponse,
  GeneratedAsset,
} from "./types";

const TEST_TIMEOUT_MS = 20_000;
const IMAGE_GEN_TIMEOUT_MS = 300_000;

// ─── Base URL normalization ──────────────────────────────────────────

const PATH_SUFFIXES_TO_STRIP = [
  "/chat/completions",
  "/images/generations",
  "/images/edits",
  "/images/variations",
  "/images",
  "/responses",
  "/embeddings",
  "/audio/transcriptions",
  "/completions",
];

/**
 * Strip known OpenAI endpoint suffixes from the base URL,
 * so users can paste any API doc URL and we normalize to the root.
 *
 * https://www.moyu.info/v1/images/generations → https://www.moyu.info/v1
 * https://api.openai.com/v1/chat/completions  → https://api.openai.com/v1
 */
export function normalizeBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");

  for (const suffix of PATH_SUFFIXES_TO_STRIP) {
    if (url.endsWith(suffix)) {
      url = url.slice(0, -suffix.length);
      break; // strip only the longest match, then we're done
    }
  }

  // Ensure the result ends with a version segment like /v1
  // but don't force-add if the user intentionally set a non-/v1 root
  return url.replace(/\/+$/, "");
}

// ─── Test connection ─────────────────────────────────────────────────

interface TestResult {
  ok: boolean;
  message: string;
}

export async function testOpenAiCompatibleConnection(
  config: ProviderConfig
): Promise<TestResult> {
  const { baseUrl, apiKey, defaultModel, name, capabilities } = config;

  // ── Pre-flight validation ──────────────────────────────────────────
  if (!baseUrl?.trim()) {
    return { ok: false, message: "未配置 Base URL。" };
  }
  if (!apiKey?.trim()) {
    return { ok: false, message: "未配置 API Key。" };
  }

  const normalizedBase = normalizeBaseUrl(baseUrl);

  // ── Decide test mode based on capabilities ─────────────────────────
  const caps = capabilities ?? [];
  const hasText = caps.includes("text");
  const hasImage =
    caps.includes("text-to-image") ||
    caps.includes("image-to-image") ||
    caps.includes("inpaint") ||
    caps.includes("remove-bg");

  // Image-only provider: don't test with chat/completions
  if (hasImage && !hasText) {
    if (!defaultModel?.trim()) {
      return { ok: false, message: "未配置默认模型名。" };
    }
    return {
      ok: true,
      message: `配置检查通过 — 模型 "${defaultModel}"，图片接口将在真实生成时验证`,
    };
  }

  // Text-capable provider: test with chat/completions
  if (hasText) {
    if (!defaultModel?.trim()) {
      return { ok: false, message: "未配置默认模型名。聊天测试需要一个文本模型。" };
    }
    return testChatCompletions(normalizedBase, apiKey, defaultModel, name);
  }

  // No recognized capabilities: basic field check
  if (!defaultModel?.trim()) {
    return { ok: false, message: "未配置默认模型名。" };
  }
  return {
    ok: true,
    message: "字段配置完整。请至少勾选一项能力以进行针对性测试。",
  };
}

async function testChatCompletions(
  normalizedBase: string,
  apiKey: string,
  model: string,
  name?: string
): Promise<TestResult> {
  const endpoint = `${normalizedBase}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: "请只回复两个字：连接" }],
    max_tokens: 8,
    temperature: 0,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
  } catch (err) {
    return handleFetchError(err, normalizedBase);
  }

  return handleHttpResponse(response, endpoint, model, name);
}

function handleFetchError(err: unknown, baseUrl: string): TestResult {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("timeout") || msg.includes("abort")) {
    return {
      ok: false,
      message: `连接超时（${TEST_TIMEOUT_MS / 1000}秒）。请检查 Base URL 是否可访问。`,
    };
  }
  if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
    return {
      ok: false,
      message: `无法连接到 ${baseUrl}。请检查地址是否正确、服务是否运行。`,
    };
  }
  return { ok: false, message: `网络错误: ${msg.slice(0, 100)}` };
}

function handleHttpResponse(
  response: Response,
  endpoint: string,
  model: string,
  name?: string
): TestResult | Promise<TestResult> {
  if (response.status === 401) {
    return { ok: false, message: "API Key 无效 (401)。请检查密钥是否正确。" };
  }
  if (response.status === 403) {
    return { ok: false, message: "访问被拒绝 (403)。API Key 可能没有权限，或账户余额不足。" };
  }
  if (response.status === 404) {
    let hint = `接口路径不存在 (404)。当前请求: ${endpoint}`;
    if (endpoint.includes("/images/") && endpoint.includes("/chat/completions")) {
      hint =
        "Base URL 不应包含 /images 或 /images/generations。请改为接口根路径，例如 https://xxx.com/v1";
    } else if (endpoint.includes("/images/generations")) {
      hint = "该中转站可能不支持 /images/generations 接口，请联系服务商确认。";
    }
    return { ok: false, message: hint };
  }
  if (response.status === 429) {
    return { ok: false, message: "请求过于频繁 (429)。请稍后重试。" };
  }
  if (!response.ok) {
    return extractErrorDetail(response);
  }

  // Validate OpenAI chat format
  return validateChatResponse(response, model, name);
}

async function extractErrorDetail(response: Response): Promise<TestResult> {
  let detail = `HTTP ${response.status}`;
  try {
    const errBody = await response.text();
    const parsed = JSON.parse(errBody);
    detail = parsed?.error?.message || errBody.slice(0, 120);
  } catch {
    // use default
  }
  return { ok: false, message: `服务器返回错误 (${response.status}): ${detail}` };
}

async function validateChatResponse(
  response: Response,
  model: string,
  name?: string
): Promise<TestResult> {
  try {
    const data = await response.json();
    if (typeof data?.choices?.[0]?.message?.content === "string") {
      return {
        ok: true,
        message: `${name || "Provider"} 连接成功 — 模型 "${model}" 正常响应`,
      };
    }
    return {
      ok: false,
      message: "服务器返回了非 OpenAI 格式的响应。请确认 Base URL 指向的是 OpenAI-Compatible 接口。",
    };
  } catch {
    return {
      ok: false,
      message: "服务器返回了无法解析的响应。",
    };
  }
}

// ─── Image generation ────────────────────────────────────────────────

export async function generateOpenAiCompatibleImage(
  config: ProviderConfig,
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const { baseUrl, apiKey, defaultModel } = config;
  const normalizedBase = normalizeBaseUrl(baseUrl || "");
  const model = request.model || defaultModel || "gpt-image-2";

  const startedAt = performance.now();

  const sizeStr =
    request.size.width && request.size.height
      ? `${request.size.width}x${request.size.height}`
      : "1536x1024";

  const body = JSON.stringify({
    model,
    prompt: request.prompt || "生成一张高质量的图片",
    n: request.count ?? 1,
    size: sizeStr,
    quality: "medium",
  });

  const endpoint = `${normalizedBase}/images/generations`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      throw new Error(`图片生成超时（${IMAGE_GEN_TIMEOUT_MS / 1000}秒）`);
    }
    throw new Error(`网络错误: ${msg.slice(0, 100)}`);
  }

  // HTTP errors
  if (response.status === 401) throw new Error("API Key 无效 (401)");
  if (response.status === 403) throw new Error("API Key 无权限或余额不足 (403)");
  if (response.status === 404) throw new Error(`接口 /images/generations 不存在 (404)。请确认 Base URL 为根路径（如 https://xxx.com/v1）且中转站支持图片生成`);
  if (response.status === 503) throw new Error("服务暂时不可用 (503)，请稍后重试");
  if (response.status === 504) throw new Error("网关超时 (504)，模型可能过载，请稍后重试");
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = await response.text();
      const parsed = JSON.parse(errBody);
      detail = parsed?.error?.message || errBody.slice(0, 200);
    } catch { /* use default */ }
    if (detail.includes("无可用渠道") || detail.includes("no available")) {
      throw new Error(
        `模型无可用渠道，请检查模型名是否为 gpt-image-2，并确认当前 Key 分组已开通该模型。`
      );
    }
    throw new Error(`服务器返回错误 (${response.status}): ${detail}`);
  }

  // Parse response
  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    throw new Error("服务器返回了无法解析的响应");
  }

  const items = data?.data as Array<Record<string, unknown>> | undefined;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("响应中未包含生成的图片数据 (data 为空)");
  }

  const assets: GeneratedAsset[] = [];
  for (const item of items) {
    const b64 = item.b64_json as string | undefined;
    const url = item.url as string | undefined;

    if (b64) {
      // Return b64_json as a plain string — the client-side scheduler
      // will convert it to Blob and create a blob: URL for the canvas.
      assets.push({
        url: "", // filled by client after Blob conversion
        width: request.size.width,
        height: request.size.height,
        mimeType: "image/png",
        b64Json: b64,
      });
    } else if (url) {
      assets.push({
        url,
        width: request.size.width,
        height: request.size.height,
        mimeType: "image/png",
      });
    } else {
      throw new Error("生成的图片数据格式不支持（需要 b64_json 或 url）");
    }
  }

  return {
    assets,
    provider: "openai-compatible",
    model,
    metadata: {
      elapsed: Math.round(performance.now() - startedAt),
      size: sizeStr,
    },
  };
}
