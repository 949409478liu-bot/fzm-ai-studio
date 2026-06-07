import { NextResponse } from "next/server";
import { getProviderConfigById } from "@/lib/server/provider-config-store";
import { generateOpenAiCompatibleImage } from "@/lib/providers/openai-compatible";
import type { ImageGenerationRequest } from "@/lib/providers/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      providerId: string;
      request: ImageGenerationRequest;
    };

    if (!body.providerId || !body.request) {
      return NextResponse.json(
        { error: "缺少必填字段: providerId, request" },
        { status: 400 }
      );
    }

    // Load full config with real apiKey from server file
    const config = getProviderConfigById(body.providerId);
    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: "Provider 未配置或未启用" },
        { status: 400 }
      );
    }

    // Route by config type
    const { type } = config;

    if (type === "openai" || type === "openai-compatible") {
      const startedAt = Date.now();
      console.log("[api/providers/run] 开始生成", JSON.stringify({
        providerId: body.providerId,
        type,
        model: body.request.model,
        actionType: body.request.actionType,
        endpoint: `${config.baseUrl}/images/generations`,
        startTime: new Date().toISOString(),
      }));

      try {
        const result = await generateOpenAiCompatibleImage(config, body.request);
        console.log("[api/providers/run] 生成完成", JSON.stringify({
          providerId: body.providerId,
          status: "completed",
          elapsedMs: Date.now() - startedAt,
          assetsCount: result.assets.length,
        }));
        return NextResponse.json(result);
      } catch (genErr) {
        console.error("[api/providers/run] 生成失败", JSON.stringify({
          providerId: body.providerId,
          status: "failed",
          elapsedMs: Date.now() - startedAt,
          error: genErr instanceof Error ? genErr.message : String(genErr),
        }));
        throw genErr;
      }
    }

    // For image-to-image / inpaint / remove-bg: not available yet
    const editActions = ["img2img", "clean", "removeBg", "inpaint"];
    if (editActions.includes(body.request.actionType)) {
      return NextResponse.json(
        { error: "图片编辑请使用 POST /api/providers/edit (multipart/form-data)" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Provider 类型 "${type}" 暂不支持实时生成` },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
