import { create } from "zustand";
import type {
  ToolType,
  ApiSettings,
  GalleryResult,
  SelectedShapeInfo,
  CanvasConnection,
  CanvasAction,
  ActionStatus,
  ResultType,
} from "@/types";
import type { Editor, TLAssetId, TLShapeId } from "@tldraw/tldraw";
import type { ProviderConfigForClient, ProviderCapability } from "./providers/types";

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

  // Provider cache (loaded from API)
  providers: ProviderConfigForClient[];
  setProviders: (providers: ProviderConfigForClient[]) => void;
  getDefaultProviderForCapability: (cap: ProviderCapability) => ProviderConfigForClient | null;

  // Prompt composer
  promptComposer: {
    open: boolean;
    actionType: ResultType | "text-to-image";
    actionLabel: string;
    sourceShapeId: TLShapeId | null;
    sourceAssetId: TLAssetId | null;
    sourceName: string;
  };
  openPromptComposer: (params: {
    actionType: ResultType | "text-to-image";
    actionLabel: string;
    sourceShapeId?: TLShapeId;
    sourceAssetId?: TLAssetId;
    sourceName?: string;
  }) => void;
  closePromptComposer: () => void;
  executePromptGeneration: (params: {
    prompt: string;
    providerId: string;
    model: string;
    size: string;
    quality: string;
    actionType: ResultType | "text-to-image";
    actionLabel: string;
    sourceShapeId?: TLShapeId;
    sourceAssetId?: TLAssetId;
  }) => Promise<void>;

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

  providers: [],
  setProviders: (providers) => set({ providers }),
  getDefaultProviderForCapability: () => null, // overridden below

  promptComposer: {
    open: false,
    actionType: "similar",
    actionLabel: "",
    sourceShapeId: null,
    sourceAssetId: null,
    sourceName: "",
  },
  openPromptComposer: (params) =>
    set({
      promptComposer: {
        open: true,
        actionType: params.actionType,
        actionLabel: params.actionLabel,
        sourceShapeId: params.sourceShapeId ?? null,
        sourceAssetId: params.sourceAssetId ?? null,
        sourceName: params.sourceName ?? "",
      },
    }),
  closePromptComposer: () =>
    set((s) => ({ promptComposer: { ...s.promptComposer, open: false } })),
  executePromptGeneration: async () => {
    // Stub - real implementation injected below
  },

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

// Override with real implementations
useStudioStore.setState({
  getDefaultProviderForCapability: (cap: ProviderCapability) => {
    const { providers } = useStudioStore.getState();
    const match = providers.find(
      (p) => p.enabled && p.capabilities.includes(cap)
    );
    return match ?? null;
  },
  executePromptGeneration: async (params) => {
    const { executePromptGeneration: fn } = await import("./canvas-actions");
    return fn(params);
  },
});
