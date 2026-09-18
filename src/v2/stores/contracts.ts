export interface CanvasUiState {
  activeProjectId: string | null;
  selectedNodeIds: string[];
  mode: "select" | "hand" | "connect";
}
