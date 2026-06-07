import { NextResponse } from "next/server";
import {
  getClientProviderConfigs,
  upsertProviderConfig,
} from "@/lib/server/provider-config-store";
import type { ProviderConfig } from "@/lib/providers/types";

export async function GET() {
  try {
    const configs = getClientProviderConfigs();
    return NextResponse.json({ providers: configs });
  } catch {
    return NextResponse.json(
      { error: "读取 Provider 配置失败" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = body as ProviderConfig;

    if (!config.id || !config.name || !config.type) {
      return NextResponse.json(
        { error: "缺少必填字段: id, name, type" },
        { status: 400 }
      );
    }

    const saved = upsertProviderConfig(config);
    return NextResponse.json({ provider: saved });
  } catch {
    return NextResponse.json(
      { error: "保存 Provider 配置失败" },
      { status: 500 }
    );
  }
}
