import { createProject, listProjects } from "@/v2/server/projects/repository";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ projects: listProjects() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  return Response.json({ project: createProject(typeof body.name === "string" ? body.name : "") }, { status: 201 });
}
