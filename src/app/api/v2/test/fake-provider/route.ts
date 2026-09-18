export const runtime = "nodejs";

function forbidden() { return Response.json({ error: "forbidden" }, { status: 403 }); }

function stats() {
  const globalObject = globalThis as typeof globalThis & { __FZM_FAKE_PROVIDER_STATS?: Record<string, number> };
  globalObject.__FZM_FAKE_PROVIDER_STATS ??= {};
  return globalObject.__FZM_FAKE_PROVIDER_STATS;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") return forbidden();
  return Response.json({ stats: stats() });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") return forbidden();
  const globalObject = globalThis as typeof globalThis & { __FZM_FAKE_PROVIDER_STATS?: Record<string, number> };
  globalObject.__FZM_FAKE_PROVIDER_STATS = {};
  return Response.json({ ok: true });
}
