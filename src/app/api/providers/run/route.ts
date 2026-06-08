import { NextResponse } from "next/server";
import { getProviderConfigById } from "@/lib/server/provider-config-store";
import { generateOpenAiCompatibleImage } from "@/lib/providers/openai-compatible";
import { generateGeminiNativeImage } from "@/lib/providers/gemini-native";
import type { ImageGenerationRequest } from "@/lib/providers/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      providerId: string;
      request: ImageGenerationRequest;
    };

    if (!body.providerId || !body.request) {
      return NextResponse.json({ error: "缺少必填字段: providerId, request" }, { status: 400 });
    }

    const config = getProviderConfigById(body.providerId);
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "Provider 未配置或未启用" }, { status: 400 });
    }

    // Resolve model endpointMode
    const modelName = body.request.model || config.defaultModel || "";
    const modelCfg = config.models?.find((m) => m.name === modelName);
    const endpointMode = modelCfg?.endpointMode || "openai-images";

    const startedAt = Date.now();

    try {
      if (endpointMode === "gemini-native") {
        console.log("[api/providers/run] Gemini Native", JSON.stringify({
          providerId: body.providerId, model: modelName,
          endpoint: `${config.baseUrl}/../v1beta/models/${modelName}:generateContent`,
        }));
        const result = await generateGeminiNativeImage(config, body.request);
        console.log("[api/providers/run] Gemini 完成", JSON.stringify({
          elapsedMs: Date.now() - startedAt, assetsCount: result.assets.length,
        }));
        return NextResponse.json(result);
      }

      // openai-images (default)
      console.log("[api/providers/run] OpenAI Images", JSON.stringify({
        providerId: body.providerId, type: config.type, model: modelName,
        endpointMode, endpoint: `${config.baseUrl}/images/generations`,
      }));
      const result = await generateOpenAiCompatibleImage(config, body.request);
      console.log("[api/providers/run] 完成", JSON.stringify({
        elapsedMs: Date.now() - startedAt, assetsCount: result.assets.length,
      }));
      return NextResponse.json(result);
    } catch (genErr) {
      console.error("[api/providers/run] 失败", JSON.stringify({
        providerId: body.providerId, model: modelName,
        endpointMode, elapsedMs: Date.now() - startedAt,
        error: genErr instanceof Error ? genErr.message : String(genErr),
      }));
      throw genErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
