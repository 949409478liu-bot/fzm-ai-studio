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
  id: string;
  imageUrl: string;
  type: ResultType;
  typeLabel: string;
  shapeId: string;
}

export interface SelectedShapeInfo {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
  assetId: string;
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
