import { NextResponse } from "next/server";
import { getProviderConfigById } from "@/lib/server/provider-config-store";
import { generateOpenAiCompatibleImageEdit } from "@/lib/providers/openai-compatible";
import { generateGeminiNativeImageEdit } from "@/lib/providers/gemini-native";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const providerId = formData.get("providerId") as string;
    const model = formData.get("model") as string;
    const prompt = formData.get("prompt") as string;
    const size = formData.get("size") as string;
    const quality = formData.get("quality") as string;
    const countStr = formData.get("count") as string;
    const imageFile = formData.get("image") as File | null;

    if (!providerId) {
      return NextResponse.json({ error: "缺少 providerId" }, { status: 400 });
    }
    if (!imageFile) {
      return NextResponse.json({ error: "缺少图片文件" }, { status: 400 });
    }

    const config = getProviderConfigById(providerId);
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "Provider 未配置或未启用" }, { status: 400 });
    }

    // Resolve model endpointMode
    const modelCfg = config.models?.find((m) => m.name === model);
    const endpointMode = modelCfg?.endpointMode || "openai-images";

    const startedAt = Date.now();

    try {
      if (endpointMode === "gptsapi-v3-image") {
        return NextResponse.json({
          error: "当前 GPTsAPI v3 图生图接口文档未配置，请先补充 image-to-image endpoint。",
        }, { status: 400 });
      }

      if (endpointMode === "gemini-native") {
        console.log("[api/providers/edit] Gemini Native", JSON.stringify({
          providerId, model, endpointMode,
          endpoint: `${config.baseUrl}/../v1beta/models/${model}:generateContent`,
          imageSize: imageFile.size,
        }));

        // Gemini uses JSON body, not multipart. Convert file inline.
        const result = await generateGeminiNativeImageEdit(config, imageFile, {
          model, prompt: prompt || "", size: size || "1:1",
        });

        console.log("[api/providers/edit] Gemini 完成", JSON.stringify({
          elapsedMs: Date.now() - startedAt, assetsCount: result.assets.length,
        }));
        return NextResponse.json(result);
      }

      // openai-images (default): multipart /images/edits
      console.log("[api/providers/edit] OpenAI Images", JSON.stringify({
        providerId, model, endpointMode,
        endpoint: `${config.baseUrl}/images/edits`,
        imageSize: imageFile.size,
      }));

      const result = await generateOpenAiCompatibleImageEdit(config, imageFile, {
        model, prompt: prompt || "Enhance this image",
        size: size || "auto", quality: quality || "auto",
        count: countStr ? parseInt(countStr) : 1,
      });

      console.log("[api/providers/edit] 完成", JSON.stringify({
        elapsedMs: Date.now() - startedAt, assetsCount: result.assets.length,
      }));
      return NextResponse.json(result);
    } catch (genErr) {
      console.error("[api/providers/edit] 失败", JSON.stringify({
        providerId, model, endpointMode, elapsedMs: Date.now() - startedAt,
        error: genErr instanceof Error ? genErr.message : String(genErr),
      }));
      throw genErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
