import { create } from "zustand";
import type {
  ToolType,
  ApiSettings,
  GalleryResult,
  SelectedShapeInfo,
  CanvasConnection,
  CanvasAction,
  ActionStatus,
} from "@/types";
import type { Editor, TLAssetId, TLShapeId } from "@tldraw/tldraw";

interface StudioState {
  // Editor reference
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  isWorkspaceReady: boolean;
  setWorkspaceReady: (ready: boolean) => void;

  // Selected shape info (for right panel)
  selectedShape: SelectedShapeInfo | null;
  setSelectedShape: (info: SelectedShapeInfo | null) => void;

  // Active tool
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // Bottom gallery results
  results: GalleryResult[];
  addResult: (r: GalleryResult) => void;
  setResults: (results: GalleryResult[]) => void;

  connections: CanvasConnection[];
  addConnection: (connection: CanvasConnection) => void;
  removeConnection: (id: TLShapeId) => void;

  actions: CanvasAction[];
  addAction: (action: CanvasAction) => void;
  setActions: (actions: CanvasAction[]) => void;
  updateActionStatus: (id: string, status: ActionStatus) => void;

  // API settings
  isApiSettingsOpen: boolean;
  setApiSettingsOpen: (open: boolean) => void;
  apiSettings: ApiSettings;
  setApiSettings: (s: Partial<ApiSettings>) => void;
}

let nextId = 0;
export const uid = () => `shape:fzm-${Date.now()}-${++nextId}` as TLShapeId;
export const assetUid = () => `asset:fzm-${Date.now()}-${++nextId}` as TLAssetId;

export const useStudioStore = create<StudioState>((set) => ({
  editor: null,
  setEditor: (editor) => set({ editor }),
  isWorkspaceReady: false,
  setWorkspaceReady: (isWorkspaceReady) => set({ isWorkspaceReady }),

  selectedShape: null,
  setSelectedShape: (info) => set({ selectedShape: info }),

  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),

  results: [],
  addResult: (r) => set((s) => ({ results: [r, ...s.results] })),
  setResults: (results) => set({ results }),

  connections: [],
  addConnection: (connection) =>
    set((s) => ({ connections: [...s.connections, connection] })),
  removeConnection: (id) =>
    set((s) => ({
      connections: s.connections.filter((connection) => connection.id !== id),
    })),

  actions: [],
  addAction: (action) =>
    set((s) => ({ actions: [...s.actions, action] })),
  setActions: (actions) => set({ actions }),
  updateActionStatus: (id, status) =>
    set((s) => ({
      actions: s.actions.map((action) =>
        action.id === id ? { ...action, status } : action
      ),
    })),

  isApiSettingsOpen: false,
  setApiSettingsOpen: (open) => set({ isApiSettingsOpen: open }),

  apiSettings: {
    geminiKey: "",
    openaiKey: "",
    falKey: "",
    comfyuiUrl: "",
    klingKey: "",
  },
  setApiSettings: (partial) =>
    set((s) => ({ apiSettings: { ...s.apiSettings, ...partial } })),
}));
