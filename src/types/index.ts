export type ToolType =
  | "select"
  | "image"
  | "text"
  | "generate"
  | "upscale"
  | "clean"
  | "inpaint"
  | "video"
  | "assets";

export type ResultType =
  | "similar"
  | "img2img"
  | "upscale"
  | "clean"
  | "removeBg"
  | "video";

export interface GalleryResult {
  id: TLShapeId;
  imageUrl: string;
  type: ResultType;
  typeLabel: string;
  shapeId: TLShapeId;
}

export interface CanvasConnection {
  id: TLShapeId;
  sourceId: TLShapeId;
  targetId: TLShapeId;
  type: ResultType;
  label: string;
}

export interface SelectedShapeInfo {
  id: TLShapeId;
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
