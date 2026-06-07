import type {
  ProviderAdapter,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from "./types";

const ACTION_LABEL_SVG = {
  similar: "相似图",
  img2img: "图生图",
  upscale: "高清放大",
  clean: "已洗图",
  removeBg: "去背景",
  video: "视频",
} as const;

function createPlaceholderSvg(
  width: number,
  height: number,
  label: string
): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="14" fill="#151520" stroke="rgba(139,92,246,0.35)" stroke-width="2"/>
  <text x="${width / 2}" y="${height / 2 + 6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="600" fill="#a5b4fc">${label}</text>
</svg>`
  )}`;
}

function createVideoPlaceholderSvg(): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <rect x="1" y="1" width="318" height="198" rx="18" fill="#11111a" stroke="rgba(139,92,246,0.45)" stroke-width="2"/>
  <circle cx="160" cy="92" r="28" fill="rgba(139,92,246,0.18)" stroke="rgba(139,92,246,0.55)"/>
  <path d="M153 78 L153 106 L176 92 Z" fill="#a78bfa"/>
  <text x="160" y="145" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="600" fill="#d4d4d8">视频占位</text>
  <text x="160" y="168" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" fill="#71717a">Image to Video Mock</text>
</svg>`
  )}`;
}

export const mockProvider: ProviderAdapter = {
  name: "mock",

  async generateImage(
    req: ImageGenerationRequest
  ): Promise<ImageGenerationResponse> {
    const startedAt = performance.now();

    // Simulate API latency
    await new Promise((resolve) =>
      setTimeout(resolve, 700 + Math.random() * 300)
    );

    const count = Math.max(1, Math.min(req.count ?? 1, 4));
    const assets = Array.from({ length: count }, () => {
      if (req.actionType === "video") {
        return {
          url: createVideoPlaceholderSvg(),
          width: 320,
          height: 200,
          mimeType: "image/svg+xml",
        };
      }

      // For image actions with a reference, return the reference URL
      // (the canvas code will copy the source asset)
      if (req.referenceImage?.url) {
        return {
          url: req.referenceImage.url,
          width: req.size.width,
          height: req.size.height,
          mimeType: "image/png",
        };
      }

      // Fallback: placeholder SVG card
      const label =
        ACTION_LABEL_SVG[req.actionType as keyof typeof ACTION_LABEL_SVG] ??
        "生成结果";
      return {
        url: createPlaceholderSvg(req.size.width, req.size.height, label),
        width: req.size.width,
        height: req.size.height,
        mimeType: "image/svg+xml",
      };
    });

    return {
      assets,
      provider: "mock",
      model: req.model || "mock-model",
      metadata: {
        elapsed: Math.round(performance.now() - startedAt),
        seed: count > 1 ? Math.floor(Math.random() * 100000) : undefined,
      },
    };
  },
};
