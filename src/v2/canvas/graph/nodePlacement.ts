import type { V2FlowNode } from "@/v2/types/canvas";

interface PlacementInput {
  nodes: V2FlowNode[];
  preferredPoint: { x: number; y: number };
  width: number;
  height: number;
}

const PADDING = 28;
const STEP = 32;
const MAX_RADIUS = 12;

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width + PADDING && a.x + a.width + PADDING > b.x && a.y < b.y + b.height + PADDING && a.y + a.height + PADDING > b.y;
}

function collides(nodes: V2FlowNode[], x: number, y: number, width: number, height: number): boolean {
  return nodes.some((node) =>
    rectsOverlap(
      { x, y, width, height },
      { x: node.position.x, y: node.position.y, width: node.width ?? width, height: node.height ?? height },
    ),
  );
}

export function findAvailableNodePosition({ nodes, preferredPoint, width, height }: PlacementInput): { x: number; y: number } {
  if (!collides(nodes, preferredPoint.x, preferredPoint.y, width, height)) return preferredPoint;

  for (let radius = 1; radius <= MAX_RADIUS; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = preferredPoint.x + dx * STEP;
        const y = preferredPoint.y + dy * STEP;
        if (!collides(nodes, x, y, width, height)) return { x, y };
      }
    }
  }

  const fallbackOffset = (nodes.length + 1) * STEP;
  return { x: preferredPoint.x + fallbackOffset, y: preferredPoint.y + fallbackOffset };
}
