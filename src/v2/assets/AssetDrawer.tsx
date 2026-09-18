"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { assetContentUrl, listProjectAssets, uploadProjectAssets } from "./assetApi";
import type { V2Asset } from "./types";

interface AssetDrawerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onAddToCanvas: (asset: V2Asset) => void;
}

const filters = ["all", "image", "video", "audio"] as const;

export function AssetDrawer({ projectId, open, onClose, onAddToCanvas }: AssetDrawerProps) {
  const [assets, setAssets] = useState<V2Asset[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const page = await listProjectAssets(projectId, { kind: filter, limit: 50 });
    setAssets(page.assets);
    setNextCursor(page.nextCursor);
  }, [filter, projectId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listProjectAssets(projectId, { kind: filter, limit: 50, cursor: nextCursor });
      setAssets((current) => {
        const seen = new Set(current.map((asset) => asset.id));
        return [...current, ...page.assets.filter((asset) => !seen.has(asset.id))];
      });
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, loadingMore, nextCursor, projectId]);

  useEffect(() => {
    if (open) void Promise.resolve().then(refresh);
  }, [open, refresh]);

  if (!open) return null;
  return (
    <aside className="fzm-asset-drawer fzm-floating" aria-label="Asset drawer">
      <div className="fzm-asset-drawer__head">
        <strong>Assets</strong>
        <button className="fzm-button fzm-icon-button" type="button" onClick={onClose} aria-label="Close assets"><X size={15} /></button>
      </div>
      <div className="fzm-asset-filters">
        {filters.map((item) => <button className="fzm-button" data-active={filter === item} type="button" key={item} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <button className="fzm-button fzm-upload-button" type="button" onClick={() => inputRef.current?.click()}><Upload size={15} /> Upload</button>
      <input ref={inputRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4" onChange={async (event) => { const input = event.currentTarget; const files = Array.from(input.files ?? []); if (files.length) { await uploadProjectAssets(projectId, files); await refresh(); input.value = ""; } }} />
      <div className="fzm-asset-grid">
        {assets.map((asset) => (
          <button className="fzm-asset-card" key={asset.id} type="button" draggable onDoubleClick={() => onAddToCanvas(asset)} onDragStart={(event) => event.dataTransfer.setData("application/fzm-asset", JSON.stringify(asset))}>
            {asset.kind === "image" ? <img src={assetContentUrl(asset.id, "thumbnail")} alt="" /> : <span>{asset.kind}</span>}
            <small>{asset.originalName ?? asset.mimeType}</small>
          </button>
        ))}
      </div>
      {nextCursor ? <button className="fzm-button fzm-upload-button" type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load More"}</button> : null}
    </aside>
  );
}
