"use client";

import { getCanvas } from "@/v2/projects/projectApi";
import { useCanvasStore } from "@/v2/stores/canvasStore";

export async function applyServerNodeResult(projectId: string, targetNodeId: string, setRevision: (revision: number) => void) {
  const latest = await getCanvas(projectId);
  const serverNode = latest.nodes.find((node) => node.id === targetNodeId);
  const localNode = useCanvasStore.getState().history.present.nodes.find((node) => node.id === targetNodeId);
  if (!serverNode || !localNode || !serverNode.assetId || !serverNode.generationId) {
    setRevision(latest.revision);
    return false;
  }
  useCanvasStore.getState().updateNodeGenerationResult(targetNodeId, serverNode.assetId, serverNode.generationId);
  setRevision(latest.revision);
  return true;
}
