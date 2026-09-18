import { badRequest, isUuid, notFound } from "@/v2/server/apiValidation";
import { getCanvasSnapshot, RevisionConflictError, saveCanvasSnapshot } from "@/v2/server/projects/repository";
import type { DomainCanvasEdge, DomainCanvasNode } from "@/v2/projects/types";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const snapshot = getCanvasSnapshot(projectId);
  return snapshot ? Response.json(snapshot) : notFound();
}

function isNode(value: unknown): value is DomainCanvasNode {
  const node = value as Partial<DomainCanvasNode>;
  return typeof node.id === "string" && ["text", "image", "video", "group"].includes(String(node.type)) && typeof node.x === "number" && typeof node.y === "number" && typeof node.width === "number" && typeof node.height === "number";
}

function isEdge(value: unknown): value is DomainCanvasEdge {
  const edge = value as Partial<DomainCanvasEdge>;
  return typeof edge.id === "string" && typeof edge.sourceNodeId === "string" && typeof edge.targetNodeId === "string";
}

export async function PUT(request: Request, { params }: Params) {
  const { projectId } = await params;
  if (!isUuid(projectId)) return badRequest("invalid_project_id");
  const body = (await request.json().catch(() => null)) as null | { expectedRevision?: unknown; viewport?: unknown; nodes?: unknown; edges?: unknown };
  if (!body || typeof body.expectedRevision !== "number" || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) return badRequest("invalid_canvas_payload");
  if (!body.nodes.every(isNode) || !body.edges.every(isEdge)) return badRequest("invalid_canvas_payload");
  try {
    return Response.json(
      saveCanvasSnapshot({
        projectId,
        expectedRevision: body.expectedRevision,
        viewport: body.viewport ?? { x: 0, y: 0, zoom: 1 },
        nodes: body.nodes,
        edges: body.edges,
      }),
    );
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      return Response.json({ error: "revision_conflict", expectedRevision: error.expectedRevision, currentRevision: error.currentRevision }, { status: 409 });
    }
    if (error instanceof Error && error.message === "project_not_found") return notFound();
    throw error;
  }
}
