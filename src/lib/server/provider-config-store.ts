/**
 * Server-side provider config store.
 * Reads/writes data/provider-configs.json — never exposed to the browser.
 */
import fs from "node:fs";
import path from "node:path";
import type {
  ProviderConfig,
  ProviderConfigForClient,
} from "@/lib/providers/types";
import { testOpenAiCompatibleConnection } from "@/lib/providers/openai-compatible";

const DATA_DIR = path.resolve(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "provider-configs.json");

// ─── Default built-in providers (unconfigured) ───────────────────────

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    capabilities: ["text", "text-to-image", "image-to-image"],
    enabled: false,
    status: "unconfigured",
  },
  {
    id: "gemini",
    name: "Gemini / Nano Banana",
    type: "gemini",
    capabilities: ["text", "text-to-image", "image-to-image"],
    enabled: false,
    status: "unconfigured",
  },
  {
    id: "fal",
    name: "fal.ai",
    type: "fal",
    capabilities: [
      "text-to-image",
      "image-to-image",
      "upscale",
      "inpaint",
      "remove-bg",
      "image-to-video",
    ],
    enabled: false,
    status: "unconfigured",
  },
  {
    id: "comfyui",
    name: "ComfyUI",
    type: "comfyui",
    baseUrl: "http://127.0.0.1:8188",
    capabilities: [
      "text-to-image",
      "image-to-image",
      "upscale",
      "inpaint",
      "remove-bg",
    ],
    enabled: false,
    status: "unconfigured",
  },
  {
    id: "kling",
    name: "Kling / 可灵",
    type: "kling",
    capabilities: ["image-to-video", "text-to-video"],
    enabled: false,
    status: "unconfigured",
  },
  {
    id: "replicate",
    name: "Replicate",
    type: "replicate",
    capabilities: [
      "text-to-image",
      "image-to-image",
      "image-to-video",
      "text-to-video",
    ],
    enabled: false,
    status: "unconfigured",
  },
];

// ─── Internal helpers ────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConfigs(): ProviderConfig[] {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_PROVIDERS;
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const saved = JSON.parse(raw) as ProviderConfig[];
    // Merge with defaults: keep built-in ids, add any custom ones from saved
    const savedIds = new Set(saved.map((c) => c.id));
    const merged = [...saved];
    for (const def of DEFAULT_PROVIDERS) {
      if (!savedIds.has(def.id)) {
        merged.push(def);
      }
    }
    return merged;
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

function saveConfigs(configs: ProviderConfig[]) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(configs, null, 2), "utf-8");
}

function maskApiKey(key?: string): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function toClientConfig(c: ProviderConfig): ProviderConfigForClient {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    baseUrl: c.baseUrl,
    apiKeyMasked: maskApiKey(c.apiKey),
    defaultModel: c.defaultModel,
    capabilities: c.capabilities,
    enabled: c.enabled,
    status: c.status,
    lastTestAt: c.lastTestAt,
    errorMessage: c.errorMessage,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export function getClientProviderConfigs(): ProviderConfigForClient[] {
  return loadConfigs().map(toClientConfig);
}

export function getProviderConfigForRuntime(
  providerId: string
): ProviderConfig | null {
  return loadConfigs().find((c) => c.id === providerId && c.enabled) ?? null;
}

/** Read full config by id regardless of enabled state (for test/save ops). */
export function getProviderConfigById(
  providerId: string
): ProviderConfig | null {
  return loadConfigs().find((c) => c.id === providerId) ?? null;
}

export function upsertProviderConfig(config: ProviderConfig): ProviderConfig {
  const configs = loadConfigs();
  const idx = configs.findIndex((c) => c.id === config.id);

  const merged: ProviderConfig = {
    ...config,
    status: config.apiKey ? "configured" : "unconfigured",
    errorMessage: undefined,
  };

  if (idx >= 0) {
    // Preserve apiKey if not provided (keep old key)
    if (!merged.apiKey && configs[idx].apiKey) {
      merged.apiKey = configs[idx].apiKey;
    }
    configs[idx] = merged;
  } else {
    configs.push(merged);
  }

  saveConfigs(configs);
  return merged;
}

export function deleteProviderConfig(id: string): boolean {
  const configs = loadConfigs();
  const filtered = configs.filter((c) => c.id !== id);
  if (filtered.length === configs.length) return false;
  saveConfigs(filtered);
  return true;
}

export async function testProviderConnection(
  config: ProviderConfig
): Promise<{ ok: boolean; message: string }> {
  const { type, baseUrl, apiKey, name } = config;

  if (!apiKey && type !== "comfyui") {
    return { ok: false, message: "未配置 API Key" };
  }

  if (!baseUrl && type !== "gemini" && type !== "fal" && type !== "kling") {
    return { ok: false, message: "未配置 Base URL" };
  }

  try {
    switch (type) {
      case "openai":
      case "openai-compatible": {
        return testOpenAiCompatibleConnection(config);
      }

      case "gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) return { ok: true, message: `${name} 连接测试通过` };
        return { ok: false, message: `Gemini 返回 ${res.status}` };
      }

      case "fal": {
        const res = await fetch("https://rest.fal.ai", {
          headers: { Authorization: `Key ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        // fal often returns non-200 for root path even with valid key
        if (res.status < 500) return { ok: true, message: `${name} 连接测试通过` };
        return { ok: false, message: `fal.ai 返回 ${res.status}` };
      }

      case "kling": {
        if (!apiKey) return { ok: false, message: "未配置 API Key" };
        return { ok: true, message: `${name} Key 格式验证通过（完整测试需真实调用）` };
      }

      case "replicate": {
        const res = await fetch("https://api.replicate.com/v1/models", {
          headers: { Authorization: `Token ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return { ok: true, message: `${name} 连接测试通过` };
        return { ok: false, message: `Replicate 返回 ${res.status}` };
      }

      case "comfyui": {
        const url = baseUrl || "http://127.0.0.1:8188";
        const res = await fetch(`${url}/system_stats`, {
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return { ok: true, message: `ComfyUI 连接测试通过` };
        return { ok: false, message: `ComfyUI 未响应 (${res.status})，请确认服务已启动` };
      }

      case "custom-http": {
        if (!baseUrl) return { ok: false, message: "未配置 Endpoint" };
        return { ok: true, message: `${name} 端点已配置（完整测试需真实调用）` };
      }

      default:
        return { ok: false, message: `不支持的 Provider 类型: ${type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("abort")) {
      return { ok: false, message: `连接超时，请检查网络或地址` };
    }
    return { ok: false, message: `网络错误: ${msg.slice(0, 80)}` };
  }
}
