import { NextResponse } from "next/server";
import {
  getProviderConfigById,
  upsertProviderConfig,
  testProviderConnection,
} from "@/lib/server/provider-config-store";
import type { ProviderConfig } from "@/lib/providers/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ProviderConfig;

    if (!body.id || !body.type) {
      return NextResponse.json(
        { error: "缺少必填字段: id, type" },
        { status: 400 }
      );
    }

    // If user did not enter a new apiKey, resolve the real key from
    // the stored config file.
    const stored = getProviderConfigById(body.id);
    const resolvedApiKey = body.apiKey || stored?.apiKey;

    // Merge: frontend body takes priority, but fill in apiKey from stored
    const configToTest: ProviderConfig = {
      ...stored,
      ...body,
      apiKey: resolvedApiKey,
    };

    // Debug log
    console.log("[test-provider]", JSON.stringify({
      id: configToTest.id,
      type: configToTest.type,
      model: configToTest.defaultModel,
      capabilities: configToTest.capabilities,
      testMode: configToTest.capabilities?.includes("text")
        ? "text-chat-test"
        : configToTest.capabilities?.some((c) =>
            ["text-to-image", "image-to-image", "inpaint", "remove-bg"].includes(c)
          )
          ? "image-config-check"
          : "config-only",
    }));

    const result = await testProviderConnection(configToTest);

    // Persist test status using the original body
    const updated = upsertProviderConfig({
      ...body,
      status: result.ok ? "ok" : "error",
      lastTestAt: new Date().toISOString(),
      errorMessage: result.ok ? undefined : result.message,
    });

    // Strip apiKey before sending response — never return the real key
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { apiKey: _key, ...safeProvider } = updated;

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      provider: safeProvider,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "测试请求处理失败" },
      { status: 500 }
    );
  }
}
