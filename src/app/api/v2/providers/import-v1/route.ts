import { importLegacyProviders } from "@/v2/server/providers/legacyImport";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { overwrite?: unknown };
  return Response.json({ imported: importLegacyProviders({ overwrite: body.overwrite === true }) });
}
