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
    // the stored config file. Never use a masked key from the client.
    const stored = getProviderConfigById(body.id);
    const resolvedApiKey = body.apiKey || stored?.apiKey;
    const configToTest = { ...body, apiKey: resolvedApiKey };

    const result = await testProviderConnection(configToTest);

    // Persist test status using the original body (which may omit apiKey
    // to preserve the stored key), not configToTest which has the full key.
    const updated = upsertProviderConfig({
      ...body,
      status: result.ok ? "ok" : "error",
      lastTestAt: new Date().toISOString(),
      errorMessage: result.ok ? undefined : result.message,
    });

    return NextResponse.json({
      ok: result.ok,
      message: result.message,
      provider: updated,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "测试请求处理失败" },
      { status: 500 }
    );
  }
}
