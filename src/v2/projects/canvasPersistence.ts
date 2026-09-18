"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  useEffect(() => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let saving = false;
    let pending = false;

    const flush = async () => {
      if (token !== tokenRef.current) return;
      if (saving) {
        pending = true;
        return;
      }
      saving = true;
      pending = false;
      setSaveState("saving");
      const state = useCanvasStore.getState();
      try {
        const snapshot = await saveCanvas(projectId, {
          expectedRevision: revisionRef.current,
          viewport: state.viewport,
          nodes: state.history.present.nodes.map(flowNodeToDomain),
          edges: state.history.present.edges.map(flowEdgeToDomain),
        });
        if (token !== tokenRef.current) return;
        revisionRef.current = snapshot.revision;
        setRevision(snapshot.revision);
        setSaveState("saved");
      } catch (error) {
        if (token !== tokenRef.current) return;
        const body = (error as { body?: { error?: string; currentRevision?: number } }).body;
        if (body?.error === "revision_conflict") {
          if (typeof body.currentRevision === "number") revisionRef.current = body.currentRevision;
          setSaveState("conflict");
        } else {
          setSaveState("failed");
        }
      } finally {
        saving = false;
        if (pending && token === tokenRef.current) schedule();
      }
    };

    const schedule = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(flush, 650);
    };

    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (state.dragStartSnapshot) return;
      if (state.history.present !== previous.history.present || state.viewport !== previous.viewport) schedule();
    });

    setSaveState("saved");
    return () => {
      tokenRef.current += 1;
      if (timeout) clearTimeout(timeout);
      unsubscribe();
    };
  }, [projectId, setRevision, setSaveState]);
}
