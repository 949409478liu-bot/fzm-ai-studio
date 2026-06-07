import { NextResponse } from "next/server";
import { deleteProviderConfig } from "@/lib/server/provider-config-store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteProviderConfig(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "未找到该 Provider" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "删除 Provider 配置失败" },
      { status: 500 }
    );
  }
}
