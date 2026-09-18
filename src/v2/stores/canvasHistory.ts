import type { CanvasHistoryState, CanvasSnapshot } from "@/v2/types/canvas";

export function cloneSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({ ...node, data: { ...node.data }, position: { ...node.position } })),
    edges: snapshot.edges.map((edge) => ({ ...edge, data: edge.data ? { ...edge.data } : undefined })),
  };
}

export function createHistoryState(initial: CanvasSnapshot = { nodes: [], edges: [] }): CanvasHistoryState {
  return { past: [], present: cloneSnapshot(initial), future: [] };
}

export function pushHistory(state: CanvasHistoryState, next: CanvasSnapshot): CanvasHistoryState {
  return { past: [...state.past, cloneSnapshot(state.present)].slice(-80), present: cloneSnapshot(next), future: [] };
}

export function undoHistory(state: CanvasHistoryState): CanvasHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return { past: state.past.slice(0, -1), present: cloneSnapshot(previous), future: [cloneSnapshot(state.present), ...state.future] };
}

export function redoHistory(state: CanvasHistoryState): CanvasHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return { past: [...state.past, cloneSnapshot(state.present)].slice(-80), present: cloneSnapshot(next), future: state.future.slice(1) };
}
