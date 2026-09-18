import type { Connection, EdgeChange, NodeChange, Viewport } from "@xyflow/react";
import { applyEdgeChanges } from "@xyflow/react";
import { create } from "zustand";
import { canConnect } from "@/v2/canvas/graph/canConnect";
import { applyPositionChanges, createCanvasEdge, createCanvasNode, duplicateNode, makeHundredNodeFixture } from "@/v2/canvas/graph/graphUtils";
import { cloneSnapshot, createHistoryState, pushHistory, redoHistory, undoHistory } from "@/v2/stores/canvasHistory";
import type { CanvasHistoryState, CanvasTool, V2FlowEdge, V2FlowNode, V2NodeData, V2NodeKind } from "@/v2/types/canvas";

interface CanvasStoreState {
  history: CanvasHistoryState;
  activeTool: CanvasTool;
  previousTool: CanvasTool;
  isSpaceHand: boolean;
  viewport: Viewport;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  dragStartSnapshot: { nodes: V2FlowNode[]; edges: V2FlowEdge[] } | null;
  setTool: (tool: CanvasTool) => void;
  setSpaceHand: (active: boolean) => void;
  setViewport: (viewport: Viewport) => void;
  setSelected: (nodeIds: string[], edgeIds?: string[]) => void;
  onNodesChange: (changes: NodeChange<V2FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<V2FlowEdge>[]) => void;
  beginDrag: () => void;
  endDrag: () => void;
  addNode: (kind: V2NodeKind, x: number, y: number, data?: Partial<V2NodeData>) => V2FlowNode;
  addEdgeFromConnection: (connection: Connection) => boolean;
  addEdgeByIds: (source: string, target: string, role?: string) => boolean;
  updateNodeGenerationResult: (nodeId: string, assetId: string, generationId: string) => void;
  updateGenerationSelection: (nodeId: string, assetId: string, generationId: string) => void;
  updateNodeGenerationStatus: (nodeId: string, status: NonNullable<V2FlowEdge["data"]>["status"]) => void;
  updateConnectedEdgeStatus: (targetNodeId: string, status: NonNullable<V2FlowEdge["data"]>["status"]) => void;
  duplicateNodeById: (nodeId: string) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  disconnectNode: (nodeId: string) => void;
  removeEdgeById: (edgeId: string) => void;
  updateNodeBody: (nodeId: string, body: string) => void;
  undo: () => void;
  redo: () => void;
  seedHundredNodes: () => void;
  hydrateProject: (snapshot: { nodes: V2FlowNode[]; edges: V2FlowEdge[]; viewport: Viewport }) => void;
}

function currentSnapshot(state: CanvasStoreState) {
  return state.history.present;
}

function withHistory(state: CanvasStoreState, nodes: V2FlowNode[], edges: V2FlowEdge[]) {
  return { history: pushHistory(state.history, { nodes, edges }) };
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  history: createHistoryState(),
  activeTool: "select",
  previousTool: "select",
  isSpaceHand: false,
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeIds: [],
  selectedEdgeIds: [],
  dragStartSnapshot: null,

  setTool: (tool) => set({ activeTool: tool, previousTool: tool }),
  setSpaceHand: (active) => set((state) => ({ isSpaceHand: active, previousTool: active ? state.activeTool : state.previousTool })),
  setViewport: (viewport) => set({ viewport }),
  setSelected: (nodeIds, edgeIds = []) => set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),

  onNodesChange: (changes) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const nodes = applyPositionChanges(snapshot.nodes, changes);
      const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
      return { history: { ...state.history, present: { ...snapshot, nodes } }, selectedNodeIds };
    }),

  onEdgesChange: (changes) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const edges = applyEdgeChanges(changes, snapshot.edges) as V2FlowEdge[];
      const selectedEdgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id);
      return { history: { ...state.history, present: { ...snapshot, edges } }, selectedEdgeIds };
    }),

  beginDrag: () => set((state) => ({ dragStartSnapshot: cloneSnapshot(currentSnapshot(state)) })),
  endDrag: () =>
    set((state) => {
      if (!state.dragStartSnapshot) return { dragStartSnapshot: null };
      return {
        history: { past: [...state.history.past, state.dragStartSnapshot].slice(-80), present: cloneSnapshot(state.history.present), future: [] },
        dragStartSnapshot: null,
      };
    }),

  addNode: (kind, x, y, data) => {
    const node = createCanvasNode(kind, x, y, data);
    set((state) => {
      const snapshot = currentSnapshot(state);
      return withHistory(state, [...snapshot.nodes, node], snapshot.edges);
    });
    return node;
  },

  addEdgeFromConnection: (connection) => get().addEdgeByIds(connection.source ?? "", connection.target ?? "", "reference-image"),
  addEdgeByIds: (source, target, role = "reference-image") => {
    const state = get();
    const snapshot = currentSnapshot(state);
    if (!canConnect(snapshot.edges, { source, target }).ok) return false;
    set(withHistory(state, snapshot.nodes, [...snapshot.edges, createCanvasEdge(source, target, role)]));
    return true;
  },

  updateNodeGenerationResult: (nodeId, assetId, generationId) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const nodes = snapshot.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, assetId, generationId, title: node.data.title || "Image" } } : node));
      const edges = snapshot.edges.map((edge) => (edge.target === nodeId ? { ...edge, data: { ...edge.data, status: "ready" as const } } : edge));
      return { history: { ...state.history, present: { ...snapshot, nodes, edges } } };
    }),

  updateGenerationSelection: (nodeId, assetId, generationId) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const nodes = snapshot.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, assetId, generationId } } : node));
      return { history: { ...state.history, present: { ...snapshot, nodes } } };
    }),

  updateNodeGenerationStatus: (nodeId, status) => get().updateConnectedEdgeStatus(nodeId, status),

  updateConnectedEdgeStatus: (targetNodeId, status) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const edges = snapshot.edges.map((edge) => (edge.target === targetNodeId ? { ...edge, data: { ...edge.data, status } } : edge)) as V2FlowEdge[];
      return { history: { ...state.history, present: { ...snapshot, edges } } };
    }),

  duplicateNodeById: (nodeId) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const node = snapshot.nodes.find((item) => item.id === nodeId);
      if (!node) return state;
      return withHistory(state, [...snapshot.nodes, duplicateNode(node)], snapshot.edges);
    }),

  duplicateSelected: () =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const duplicates = snapshot.nodes.filter((node) => state.selectedNodeIds.includes(node.id)).map(duplicateNode);
      if (duplicates.length === 0) return state;
      return withHistory(state, [...snapshot.nodes, ...duplicates], snapshot.edges);
    }),

  deleteSelected: () =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const selectedNodes = new Set(state.selectedNodeIds);
      const selectedEdges = new Set(state.selectedEdgeIds);
      if (selectedNodes.size === 0 && selectedEdges.size === 0) return state;
      const nodes = snapshot.nodes.filter((node) => !selectedNodes.has(node.id));
      const edges = snapshot.edges.filter((edge) => !selectedEdges.has(edge.id) && !selectedNodes.has(edge.source) && !selectedNodes.has(edge.target));
      return { ...withHistory(state, nodes, edges), selectedNodeIds: [], selectedEdgeIds: [] };
    }),

  disconnectNode: (nodeId) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      return withHistory(state, snapshot.nodes, snapshot.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    }),

  removeEdgeById: (edgeId) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      return withHistory(state, snapshot.nodes, snapshot.edges.filter((edge) => edge.id !== edgeId));
    }),

  updateNodeBody: (nodeId, body) =>
    set((state) => {
      const snapshot = currentSnapshot(state);
      const nodes = snapshot.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, body } } : node));
      return { history: { ...state.history, present: { ...snapshot, nodes } } };
    }),

  undo: () => set((state) => ({ history: undoHistory(state.history), selectedNodeIds: [], selectedEdgeIds: [] })),
  redo: () => set((state) => ({ history: redoHistory(state.history), selectedNodeIds: [], selectedEdgeIds: [] })),
  seedHundredNodes: () => set((state) => ({ history: pushHistory(state.history, makeHundredNodeFixture()) })),
  hydrateProject: (snapshot) => set({ history: createHistoryState({ nodes: snapshot.nodes, edges: snapshot.edges }), viewport: snapshot.viewport, selectedNodeIds: [], selectedEdgeIds: [], dragStartSnapshot: null }),
}));

export const selectCanvasNodes = (state: CanvasStoreState) => state.history.present.nodes;
export const selectCanvasEdges = (state: CanvasStoreState) => state.history.present.edges;
