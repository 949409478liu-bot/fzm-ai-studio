"use client";

import { useEffect } from "react";
import { track, useEditor } from "@tldraw/tldraw";
import { useStudioStore, assetUid } from "@/lib/store";
import type { TLAssetId } from "@tldraw/tldraw";
import type { TLImageAsset } from "@tldraw/tldraw";

const seenStatus = new Map<string, string>();

export const StatusSynchronizer = track(() => {
  const editor = useEditor();
  const actions = useStudioStore((s) => s.actions);

  useEffect(() => {
    for (const action of actions) {
      const prev = seenStatus.get(action.id);
      if (prev === action.status) continue;
      seenStatus.set(action.id, action.status);

      if (!action.promptNodeId) continue;

      const promptShape = editor.getShape(action.promptNodeId);
      if (promptShape?.type !== "image") continue;

      const label =
        action.status === "queued" ? "排队中" :
        action.status === "running" ? "生成中" :
        action.status === "completed" ? "已完成" : "失败";
      const color =
        action.status === "completed" ? "#a7f3d0" :
        action.status === "running" ? "#c7d2fe" :
        action.status === "failed" ? "#fca5a5" : "#71717a";
      const modelHint = action.model || "";

      const svg = createStatusPromptSvg(action.actionLabel, label, modelHint, color);
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

      const newAssetId = assetUid();
      const asset: TLImageAsset = {
        id: newAssetId,
        typeName: "asset",
        type: "image",
        props: {
          name: `${action.actionLabel}-节点`,
          src: dataUrl,
          w: 280,
          h: 70,
          mimeType: "image/svg+xml",
          isAnimated: false,
        },
        meta: {},
      };
      editor.createAssets([asset]);

      editor.updateShape({
        id: action.promptNodeId,
        type: "image",
        props: { assetId: newAssetId, w: 280, h: 70 },
      });

      const oldAssetId = promptShape.props.assetId as TLAssetId | undefined;
      if (oldAssetId && oldAssetId !== newAssetId) {
        try { editor.deleteAssets([oldAssetId]); } catch { /* ignore */ }
      }
    }
  }, [actions, editor]);

  return null;
});

function createStatusPromptSvg(
  actionLabel: string,
  statusText: string,
  model: string,
  statusColor: string
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="70" viewBox="0 0 280 70">
  <rect x="1" y="1" width="278" height="68" rx="12" fill="#13131f" stroke="rgba(139,92,246,0.35)" stroke-width="1.5"/>
  <text x="14" y="22" font-family="Arial,sans-serif" font-size="12" font-weight="600" fill="#a5b4fc">${actionLabel}</text>
  <text x="14" y="40" font-family="Arial,sans-serif" font-size="11" fill="#71717a">${statusText}</text>
  <text x="14" y="56" font-family="Arial,sans-serif" font-size="10" fill="#52525b">${model}</text>
  <rect x="210" y="10" width="58" height="18" rx="6" fill="rgba(129,140,248,0.1)" stroke="rgba(129,140,248,0.2)"/>
  <text x="239" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="${statusColor}">${statusText}</text>
</svg>`;
}
