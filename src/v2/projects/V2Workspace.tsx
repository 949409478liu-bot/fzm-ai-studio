"use client";

import { useCallback, useEffect, useState } from "react";
import { snapshotToFlow } from "./canvasMapper";
import { getCanvas } from "./projectApi";
import { ProjectList } from "./ProjectList";
import { useCanvasPersistence } from "./canvasPersistence";
import type { DomainCanvasSnapshot, SaveState } from "./types";
import { FzmCanvas } from "@/v2/canvas/FzmCanvas";
import { useCanvasStore } from "@/v2/stores/canvasStore";

function useProjectIdFromUrl() {
  const [projectId, setProjectId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void Promise.resolve().then(() => setProjectId(new URL(window.location.href).searchParams.get("project")));
  }, []);
  const openProject = useCallback((nextProjectId: string | null) => {
    const url = new URL(window.location.href);
    if (nextProjectId) url.searchParams.set("project", nextProjectId);
    else url.searchParams.delete("project");
    window.history.pushState({}, "", url);
    setProjectId(nextProjectId);
  }, []);
  return [projectId, openProject] as const;
}

function ProjectCanvas({ snapshot, onBack }: { snapshot: DomainCanvasSnapshot; onBack: () => void }) {
  const [revision, setRevision] = useState(snapshot.revision);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  useCanvasPersistence({ projectId: snapshot.project.id, revision, setRevision, setSaveState });
  return <FzmCanvas project={snapshot.project} revision={revision} saveState={saveState} onBack={onBack} onReloadLatest={() => window.location.reload()} />;
}

export function V2Workspace() {
  const [projectId, openProject] = useProjectIdFromUrl();
  const [snapshot, setSnapshot] = useState<DomainCanvasSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let active = true;
    void Promise.resolve().then(async () => {
      setLoading(true);
      try {
        const next = await getCanvas(projectId);
        if (!active) return;
        useCanvasStore.getState().hydrateProject(snapshotToFlow(next));
        setSnapshot(next);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [projectId]);

  if (projectId === undefined) return <main className="fzm-v2-shell"><div className="fzm-node-info fzm-floating" style={{ left: 24, top: 24 }}>Loading project...</div></main>;
  if (!projectId) return <ProjectList onOpen={openProject} />;
  if (loading || !snapshot) return <main className="fzm-v2-shell"><div className="fzm-node-info fzm-floating" style={{ left: 24, top: 24 }}>Loading project...</div></main>;
  return <ProjectCanvas snapshot={snapshot} onBack={() => openProject(null)} />;
}
