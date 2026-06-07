/**
 * OpenAI-Compatible Provider Adapter.
 * Used for both official OpenAI and any OpenAI-format proxy/中转站.
 *
 * V0.5.2: text connection test only (no image generation yet).
 */

import type { ProviderConfig } from "./types";

const TEST_TIMEOUT_MS = 20_000;

interface TestResult {
  ok: boolean;
  message: string;
}

/**
 * Send a minimal chat/completions request to verify
 * the provider is reachable and the credentials are valid.
 */
export async function testOpenAiCompatibleConnection(
  config: ProviderConfig
): Promise<TestResult> {
  const { baseUrl, apiKey, defaultModel, name } = config;

  // ── Pre-flight validation ──────────────────────────────────────────
  if (!baseUrl?.trim()) {
    return {
      ok: false,
      message: "未配置 Base URL。请在 API 配置中心填写中转站地址。",
    };
  }
  if (!apiKey?.trim()) {
    return {
      ok: false,
      message: "未配置 API Key。请在 API 配置中心填写密钥。",
    };
  }
  if (!defaultModel?.trim()) {
    return {
      ok: false,
      message: "未配置默认模型名。请在 API 配置中心填写模型名（如 gpt-4o-mini）。",
    };
  }

  // ── Normalize baseUrl ──────────────────────────────────────────────
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  // ── Build request ──────────────────────────────────────────────────
  const endpoint = `${normalizedBase}/chat/completions`;
  const body = JSON.stringify({
    model: defaultModel,
    messages: [
      { role: "user", content: "请只回复两个字：连接" },
    ],
    max_tokens: 8,
    temperature: 0,
  });

  // ── Execute ────────────────────────────────────────────────────────
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
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return {
        ok: false,
        message: `连接超时（${TEST_TIMEOUT_MS / 1000}秒）。请检查 Base URL 是否可访问，或网络是否需要代理。`,
      };
    }
    if (msg.includes("fetch") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return {
        ok: false,
        message: `无法连接到 ${normalizedBase}。请检查地址是否正确、服务是否运行。`,
      };
    }
    return {
      ok: false,
      message: `网络错误: ${msg.slice(0, 100)}`,
    };
  }

  // ── Handle HTTP errors ─────────────────────────────────────────────
  if (response.status === 401) {
    return {
      ok: false,
      message: "API Key 无效 (401 Unauthorized)。请检查密钥是否正确。",
    };
  }
  if (response.status === 403) {
    return {
      ok: false,
      message: "访问被拒绝 (403 Forbidden)。API Key 可能没有权限，或账户余额不足。",
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      message: `接口路径不存在 (404)。请检查 Base URL 是否正确（当前: ${endpoint}）。`,
    };
  }
  if (response.status === 429) {
    return {
      ok: false,
      message: "请求过于频繁 (429 Rate Limit)。请稍后重试。",
    };
  }
  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.text();
      const parsed = JSON.parse(errBody);
      detail = parsed?.error?.message || errBody.slice(0, 120);
    } catch {
      detail = `HTTP ${response.status}`;
    }
    return {
      ok: false,
      message: `服务器返回错误 (${response.status}): ${detail}`,
    };
  }

  // ── Validate response format ───────────────────────────────────────
  try {
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return {
        ok: true,
        message: `${name || "Provider"} 连接成功 — 模型 "${defaultModel}" 正常响应`,
      };
    }
    return {
      ok: false,
      message: "服务器返回了非 OpenAI 格式的响应。请确认 Base URL 指向的是 OpenAI-Compatible 接口。",
    };
  } catch {
    return {
      ok: false,
      message: "服务器返回了无法解析的响应。请确认 Base URL 指向的是 OpenAI-Compatible 接口。",
    };
  }
}
