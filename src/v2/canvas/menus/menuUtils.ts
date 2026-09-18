import type { FloatingPosition } from "@/v2/types/canvas";

export function clampMenuPosition(position: FloatingPosition, width = 220, height = 260): FloatingPosition {
  if (typeof window === "undefined") return position;
  const margin = 12;
  return {
    ...position,
    x: Math.min(Math.max(position.x, margin), window.innerWidth - width - margin),
    y: Math.min(Math.max(position.y, margin), window.innerHeight - height - margin),
  };
}
