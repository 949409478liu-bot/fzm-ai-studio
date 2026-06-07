import { create } from "zustand";
import type {
  ToolType,
  ApiSettings,
  GalleryResult,
  SelectedShapeInfo,
  CanvasConnection,
} from "@/types";
import type { Editor, TLAssetId, TLShapeId } from "@tldraw/tldraw";

interface StudioState {
  // Editor reference
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;

  // Selected shape info (for right panel)
  selectedShape: SelectedShapeInfo | null;
  setSelectedShape: (info: SelectedShapeInfo | null) => void;

  // Active tool
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;

  // Bottom gallery results
  results: GalleryResult[];
  addResult: (r: GalleryResult) => void;

  connections: CanvasConnection[];
  addConnection: (connection: CanvasConnection) => void;
  removeConnection: (id: TLShapeId) => void;

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

  selectedShape: null,
  setSelectedShape: (info) => set({ selectedShape: info }),

  activeTool: "select",
  setActiveTool: (tool) => set({ activeTool: tool }),

  results: [],
  addResult: (r) => set((s) => ({ results: [r, ...s.results] })),

  connections: [],
  addConnection: (connection) =>
    set((s) => ({ connections: [...s.connections, connection] })),
  removeConnection: (id) =>
    set((s) => ({
      connections: s.connections.filter((connection) => connection.id !== id),
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
