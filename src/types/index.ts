export type ToolType =
  | "select"
  | "image"
  | "text"
  | "generate"
  | "upscale"
  | "clean"
  | "inpaint"
  | "connection"
  | "video"
  | "assets";

export type ResultType =
  | "similar"
  | "img2img"
  | "upscale"
  | "clean"
  | "removeBg"
  | "video";

export type ActionStatus = "queued" | "running" | "completed" | "failed";

export interface GalleryResult {
  id: TLShapeId;
  imageUrl: string;
  type: ResultType;
  typeLabel: string;
  shapeId: TLShapeId;
}

export interface CanvasAction {
  id: string;
  sourceId: TLShapeId;
  targetId: TLShapeId;
  actionType: ResultType;
  actionLabel: string;
  createdAt: number;
  status: ActionStatus;
  provider?: string;
  error?: string;
}

export interface CanvasConnection {
  id: TLShapeId;
  sourceId: TLShapeId;
  targetId: TLShapeId;
  sourcePort: "output";
  targetPort: "input";
  type: "manual" | "auto";
  label?: string;
  createdAt: number;
}

export interface SelectedShapeInfo {
  id: TLShapeId;
  selectionId: TLShapeId;
  type: string;
  name: string;
  width: number;
  height: number;
  assetId: TLAssetId | "";
  imageUrl: string;
}

export type ModelOption =
  | "gemini"
  | "openai"
  | "comfyui"
  | "fal"
  | "kling";

export type OutputSize = "1024" | "1536" | "2048" | "4K";

export interface ApiSettings {
  geminiKey: string;
  openaiKey: string;
  falKey: string;
  comfyuiUrl: string;
  klingKey: string;
}
import type { TLAssetId, TLShapeId } from "@tldraw/tldraw";
