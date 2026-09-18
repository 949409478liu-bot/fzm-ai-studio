import type { DomainCanvasSnapshot, V2Project } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) throw Object.assign(new Error("request_failed"), { response, body });
  return body;
}

export async function listProjects(): Promise<V2Project[]> {
  const body = await parseJson<{ projects: V2Project[] }>(await fetch("/api/v2/projects", { cache: "no-store" }));
  return body.projects;
}

export async function createProject(name: string): Promise<V2Project> {
  const body = await parseJson<{ project: V2Project }>(await fetch("/api/v2/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }));
  return body.project;
}

export async function renameProject(projectId: string, name: string): Promise<V2Project> {
  const body = await parseJson<{ project: V2Project }>(await fetch(`/api/v2/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }));
  return body.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await parseJson(await fetch(`/api/v2/projects/${projectId}`, { method: "DELETE" }));
}

export async function getCanvas(projectId: string): Promise<DomainCanvasSnapshot> {
  return parseJson<DomainCanvasSnapshot>(await fetch(`/api/v2/projects/${projectId}/canvas`, { cache: "no-store" }));
}

export async function saveCanvas(projectId: string, payload: unknown): Promise<DomainCanvasSnapshot> {
  return parseJson<DomainCanvasSnapshot>(await fetch(`/api/v2/projects/${projectId}/canvas`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
}
