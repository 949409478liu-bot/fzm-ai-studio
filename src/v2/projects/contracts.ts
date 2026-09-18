import type { Project } from "@/v2/types/domain";

export interface ProjectSaveRequest {
  project: Project;
  expectedRevision: number;
}

export interface RevisionConflict {
  kind: "revision-conflict";
  currentRevision: number;
}
