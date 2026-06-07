import { NextResponse } from "next/server";
import { getProviderConfigById } from "@/lib/server/provider-config-store";
import { generateOpenAiCompatibleImageEdit } from "@/lib/providers/openai-compatible";

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

    const startedAt = Date.now();
    console.log("[api/providers/edit] 开始编辑", JSON.stringify({
      providerId,
      type: config.type,
      model,
      endpoint: `${config.baseUrl}/images/edits`,
      imageSize: imageFile.size,
      startTime: new Date().toISOString(),
    }));

    try {
      const result = await generateOpenAiCompatibleImageEdit(
        config,
        imageFile,
        {
          model,
          prompt: prompt || "Enhance this image",
          size: size || "auto",
          quality: quality || "auto",
          count: countStr ? parseInt(countStr) : 1,
        }
      );

      console.log("[api/providers/edit] 编辑完成", JSON.stringify({
        elapsedMs: Date.now() - startedAt,
        assetsCount: result.assets.length,
      }));

      return NextResponse.json(result);
    } catch (genErr) {
      console.error("[api/providers/edit] 编辑失败", JSON.stringify({
        elapsedMs: Date.now() - startedAt,
        error: genErr instanceof Error ? genErr.message : String(genErr),
      }));
      throw genErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
