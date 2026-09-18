"use client";

import { useCallback, useEffect, useRef } from "react";
import { flowEdgeToDomain, flowNodeToDomain } from "./canvasMapper";
import { saveCanvas } from "./projectApi";
import type { SaveState } from "./types";
import { useCanvasStore } from "@/v2/stores/canvasStore";

interface Options {
  projectId: string;
  revision: number;
  setRevision: (revision: number) => void;
  setSaveState: (state: SaveState) => void;
}

export function useCanvasPersistence({ projectId, revision, setRevision, setSaveState }: Options) {
  const revisionRef = useRef(revision);
  const tokenRef = useRef(0);
  const conflictLockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  const flushPendingSave = useCallback(async (): Promise<"saved" | "conflict" | "failed" | "locked"> => {
    if (conflictLockedRef.current) {
      setSaveState("conflict");
      return "locked";
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return "failed";
    }
    savingRef.current = true;
    pendingRef.current = false;
    setSaveState("saving");
    const state = useCanvasStore.getState();
    try {
      const snapshot = await saveCanvas(projectId, {
        expectedRevision: revisionRef.current,
        viewport: state.viewport,
        nodes: state.history.present.nodes.map(flowNodeToDomain),
        edges: state.history.present.edges.map(flowEdgeToDomain),
      });
      revisionRef.current = snapshot.revision;
      setRevision(snapshot.revision);
      setSaveState("saved");
      return "saved";
    } catch (error) {
      const body = (error as { body?: { error?: string } }).body;
      if (body?.error === "revision_conflict") {
        conflictLockedRef.current = true;
        setSaveState("conflict");
        return "conflict";
      }
      setSaveState("failed");
      return "failed";
    } finally {
      savingRef.current = false;
    }
  }, [projectId, setRevision, setSaveState]);

  const clearConflictLock = useCallback((nextRevision: number) => {
    conflictLockedRef.current = false;
    revisionRef.current = nextRevision;
    setRevision(nextRevision);
    setSaveState("saved");
  }, [setRevision, setSaveState]);

  useEffect(() => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    const flush = async () => {
      if (token !== tokenRef.current) return;
      if (conflictLockedRef.current) return;
      if (savingRef.current) {
        pendingRef.current = true;
        return;
      }
      const result = await flushPendingSave();
      if (result === "saved" && pendingRef.current && token === tokenRef.current) {
        pendingRef.current = false;
        schedule();
      }
    };

    const schedule = () => {
      if (conflictLockedRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(flush, 650);
    };

    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (state.dragStartSnapshot) return;
      if (state.history.present !== previous.history.present || state.viewport !== previous.viewport) schedule();
    });

    setSaveState("saved");
    return () => {
      tokenRef.current += 1;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      unsubscribe();
    };
  }, [flushPendingSave, projectId, setSaveState]);

  return { flushPendingSave, clearConflictLock };
}
