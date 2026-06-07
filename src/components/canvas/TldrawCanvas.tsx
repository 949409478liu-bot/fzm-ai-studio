"use client";

import { useEffect, useMemo } from "react";
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

// ─── Inner component to listen to selection changes ──────────────────

const SelectionListener = track(() => {
  const editor = useEditor();
  const setSelectedShape = useStudioStore((s) => s.setSelectedShape);

  useEffect(() => {
    const handleChange = () => {
      const ids = editor.getSelectedShapeIds();
      if (ids.length === 1) {
        const shape = editor.getShape(ids[0]);
        if (shape && shape.type === "image") {
          const assetId = shape.props.assetId;
          const asset = assetId ? editor.getAsset(assetId) : null;
          const info: SelectedShapeInfo = {
            id: shape.id,
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

// ─── Main canvas component ───────────────────────────────────────────

export function TldrawCanvas() {
  const setEditor = useStudioStore((s) => s.setEditor);

  // Create a fresh store each mount — no IndexedDB persistence,
  // so stale shape IDs from previous sessions won't cause errors.
  const store = useMemo(
    () => createTLStore({ shapeUtils: defaultShapeUtils }),
    []
  );

  return (
    <div className="flex-1 relative tldraw-dark-override">
      <Tldraw
        store={store}
        onMount={(editor) => {
          setEditor(editor);
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          // Reset gallery on fresh mount
          useStudioStore.setState({ results: [] });
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
        }}
      >
        <SelectionListener />
      </Tldraw>
    </div>
  );
}
