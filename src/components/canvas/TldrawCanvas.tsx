"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Tldraw,
  useEditor,
  track,
  createTLStore,
  defaultShapeUtils,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useStudioStore } from "@/lib/store";
import type { SelectedShapeInfo } from "@/types";
import { AiConnectionShapeUtil } from "./AiConnectionShape";
import { CanvasInteractionOverlay } from "./CanvasInteractionOverlay";
import { PromptComposerOverlay } from "./PromptComposerOverlay";
import { StatusSynchronizer } from "./StatusSynchronizer";
import { BottomPromptBar } from "./BottomPromptBar";
import { getImageFromShape } from "@/lib/shape-helpers";
import { synchronizeAiConnections } from "@/lib/connection-system";
import {
  restoreWorkspace,
  setupWorkspacePersistence,
} from "@/lib/workspace-persistence";

// ─── Inner component to listen to selection changes ──────────────────

const SelectionListener = track(() => {
  const editor = useEditor();
  const setSelectedShape = useStudioStore((s) => s.setSelectedShape);

  useEffect(() => {
    const handleChange = () => {
      const ids = editor.getSelectedShapeIds();
      if (ids.length === 1) {
        const selectionId = ids[0];
        const shape = getImageFromShape(editor, selectionId);
        if (shape) {
          const assetId = shape.props.assetId;
          const asset = assetId ? editor.getAsset(assetId) : null;
          const info: SelectedShapeInfo = {
            id: shape.id,
            selectionId,
            type: shape.type,
            name: (asset?.props as Record<string, unknown>)?.name as string || "未命名图片",
            width: Math.round(shape.props.w),
            height: Math.round(shape.props.h),
            assetId: assetId || "",
            imageUrl: (asset?.props as Record<string, unknown>)?.src as string || "",
          };
          setSelectedShape(info);
          return;
        }
      }
      setSelectedShape(null);
    };

    editor.on("change", handleChange);
    return () => {
      editor.off("change", handleChange);
    };
  }, [editor, setSelectedShape]);

  return null;
});

function ConnectionSynchronizer() {
  const editor = useEditor();

  useEffect(() => {
    let isSynchronizing = false;
    const handleChange = () => {
      if (isSynchronizing) return;
      isSynchronizing = true;
      synchronizeAiConnections(editor);
      const state = useStudioStore.getState();
      const results = state.results.filter(
        (result) =>
          Boolean(editor.getShape(result.id)) &&
          Boolean(editor.getShape(result.shapeId))
      );
      const actions = state.actions.filter(
        (action) =>
          Boolean(editor.getShape(action.sourceId)) &&
          Boolean(editor.getShape(action.targetId))
      );
      if (results.length !== state.results.length) state.setResults(results);
      if (actions.length !== state.actions.length) state.setActions(actions);
      isSynchronizing = false;
    };

    editor.on("change", handleChange);
    return () => {
      editor.off("change", handleChange);
    };
  }, [editor]);

  return null;
}

function WorkspacePersistence() {
  const editor = useEditor();
  const isWorkspaceReady = useStudioStore((state) => state.isWorkspaceReady);

  useEffect(() => {
    if (!isWorkspaceReady) return;
    return setupWorkspacePersistence(editor);
  }, [editor, isWorkspaceReady]);
  return null;
}

// ─── Main canvas component ───────────────────────────────────────────

export function TldrawCanvas() {
  const setEditor = useStudioStore((s) => s.setEditor);
  const restoreStarted = useRef(false);
  const shapeUtils = useMemo(
    () => [...defaultShapeUtils, AiConnectionShapeUtil],
    []
  );

  // Create a fresh store each mount — no IndexedDB persistence,
  // so stale shape IDs from previous sessions won't cause errors.
  const store = useMemo(
    () =>
      createTLStore({
        shapeUtils,
      }),
    [shapeUtils]
  );

  return (
    <div className="flex-1 relative tldraw-dark-override">
      <Tldraw
        store={store}
        shapeUtils={shapeUtils}
        onMount={(editor) => {
          if (restoreStarted.current) return;
          restoreStarted.current = true;
          useStudioStore.getState().setWorkspaceReady(false);
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          void restoreWorkspace(editor).then((restored) => {
            if (!restored) {
              useStudioStore.setState({
                results: [],
                connections: [],
                actions: [],
              });
            }
            setEditor(editor);
            useStudioStore.getState().setWorkspaceReady(true);
          });
        }}
        components={{
          // Hide all default tldraw UI — we use our own shell
          Toolbar: null,
          StylePanel: null,
          ActionsMenu: null,
          QuickActions: null,
          PageMenu: null,
          NavigationPanel: null,
          MainMenu: null,
          HelpMenu: null,
          DebugPanel: null,
          CursorChatBubble: null,
          TopPanel: null,
          MenuPanel: null,
          SharePanel: null,
          ContextMenu: null,
          KeyboardShortcutsDialog: null,
          InFrontOfTheCanvas: CanvasInteractionOverlay,
        }}
      >
        <SelectionListener />
        <ConnectionSynchronizer />
        <WorkspacePersistence />
        <PromptComposerOverlay />
        <StatusSynchronizer />
        <BottomPromptBar />
      </Tldraw>
    </div>
  );
}
