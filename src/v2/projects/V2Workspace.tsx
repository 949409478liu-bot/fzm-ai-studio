"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  return [projectId, openProject, setProjectId] as const;
}

function ProjectCanvas({ snapshot, onBack, onHydrated, onFlushReady }: { snapshot: DomainCanvasSnapshot; onBack: () => Promise<void>; onHydrated: (snapshot: DomainCanvasSnapshot) => void; onFlushReady: (flush: (() => Promise<"saved" | "conflict" | "failed" | "locked">) | null) => void }) {
  const [revision, setRevision] = useState(snapshot.revision);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const persistence = useCanvasPersistence({ projectId: snapshot.project.id, revision, setRevision, setSaveState });
  useEffect(() => {
    onFlushReady(persistence.flushPendingSave);
    return () => onFlushReady(null);
  }, [onFlushReady, persistence.flushPendingSave]);
  const reloadLatest = useCallback(async () => {
    const latest = await getCanvas(snapshot.project.id);
    useCanvasStore.getState().hydrateProject(snapshotToFlow(latest));
    onHydrated(latest);
    persistence.clearConflictLock(latest.revision);
  }, [onHydrated, persistence, snapshot.project.id]);
  const back = useCallback(async () => {
    const result = await persistence.flushPendingSave();
    if (result !== "saved") return;
    await onBack();
  }, [onBack, persistence]);
  return <FzmCanvas project={snapshot.project} revision={revision} saveState={saveState} onBack={back} onReloadLatest={reloadLatest} />;
}

export function V2Workspace() {
  const [projectId, openProject, setProjectIdFromUrl] = useProjectIdFromUrl();
  const [snapshot, setSnapshot] = useState<DomainCanvasSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const flushCurrentRef = useRef<(() => Promise<"saved" | "conflict" | "failed" | "locked">) | null>(null);
  const projectIdRef = useRef<string | null | undefined>(projectId);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const restoreCurrentUrl = useCallback(() => {
    const url = new URL(window.location.href);
    const current = projectIdRef.current;
    if (current) url.searchParams.set("project", current);
    else url.searchParams.delete("project");
    window.history.pushState({}, "", url);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const nextProjectId = new URL(window.location.href).searchParams.get("project");
      void Promise.resolve().then(async () => {
        const result = flushCurrentRef.current ? await flushCurrentRef.current() : "saved";
        if (result !== "saved") {
          restoreCurrentUrl();
          return;
        }
        setProjectIdFromUrl(nextProjectId);
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [restoreCurrentUrl, setProjectIdFromUrl]);

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
  const guardedOpenProject = async (nextProjectId: string | null) => {
    const result = flushCurrentRef.current ? await flushCurrentRef.current() : "saved";
    if (result !== "saved") return;
    openProject(nextProjectId);
  };

  if (!projectId) return <ProjectList onOpen={guardedOpenProject} />;
  if (loading || !snapshot) return <main className="fzm-v2-shell"><div className="fzm-node-info fzm-floating" style={{ left: 24, top: 24 }}>Loading project...</div></main>;
  return <ProjectCanvas key={snapshot.project.id} snapshot={snapshot} onHydrated={setSnapshot} onFlushReady={(flush) => { flushCurrentRef.current = flush; }} onBack={async () => openProject(null)} />;
}
