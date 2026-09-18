"use client";

import { useEffect, useState } from "react";
import { assetContentUrl } from "@/v2/assets/assetApi";
import { getGeneration, listGenerations } from "../generationApi";
import type { GenerationRecordDto } from "../types";
import type { FloatingPosition } from "@/v2/types/canvas";

interface Props {
  projectId: string;
  nodeId: string;
  generationId?: string | null;
  position: FloatingPosition;
  onLoad: (generation: GenerationRecordDto) => void;
  onClose: () => void;
}

function preview(text: string) { return text.length > 90 ? `${text.slice(0, 90)}...` : text; }

function GenerationRow({ generation, onLoad }: { generation: GenerationRecordDto; onLoad: (generation: GenerationRecordDto) => void }) {
  return <button className="fzm-inspect__run" type="button" onClick={() => onLoad(generation)}>
    <span>{generation.status}</span>
    <strong>{generation.providerId} / {generation.modelId}</strong>
    <small>{preview(generation.prompt || "No prompt")}</small>
  </button>;
}

export function GenerationInspect({ projectId, nodeId, generationId, position, onLoad, onClose }: Props) {
  const [current, setCurrent] = useState<GenerationRecordDto | null>(null);
  const [runs, setRuns] = useState<GenerationRecordDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      generationId ? getGeneration(generationId).then((body) => body.generation).catch(() => null) : Promise.resolve(null),
      listGenerations(projectId, { nodeId, limit: 10 }).catch(() => ({ generations: [], nextCursor: null })),
    ]).then(([nextCurrent, page]) => {
      if (!alive) return;
      setCurrent(nextCurrent);
      setRuns(page.generations);
      setCursor(page.nextCursor);
    });
    return () => { alive = false; };
  }, [generationId, nodeId, projectId]);

  const loadMore = async () => {
    const page = await listGenerations(projectId, { nodeId, limit: 10, cursor });
    setRuns((items) => [...items, ...page.generations]);
    setCursor(page.nextCursor);
  };

  return <section className="fzm-inspect fzm-floating" style={{ left: position.x, top: position.y }} aria-label="Generation inspect">
    <div className="fzm-inspect__head"><strong>Generation Inspect</strong><button className="fzm-button" type="button" onClick={onClose}>Close</button></div>
    {current ? <div className="fzm-inspect__current">
      <span>Current Generation</span>
      <strong>{current.status} · {current.providerId} / {current.modelId}</strong>
      <small>{new Date(current.createdAt).toLocaleString()}</small>
      <p>{preview(current.prompt || "No prompt")}</p>
      <dl><dt>References</dt><dd>{current.references.length}</dd><dt>Outputs</dt><dd>{current.outputAssetIds.length}</dd><dt>Keeper</dt><dd>#{current.selectedVariantIndex + 1}</dd></dl>
      <div className="fzm-inspect__thumbs">{current.references.slice(0, 4).map((reference) => <img key={reference.assetId} src={assetContentUrl(reference.assetId, "thumbnail")} alt="Reference" />)}</div>
      <button className="fzm-button" type="button" onClick={() => onLoad(current)}>Load into PromptBar</button>
    </div> : <p className="fzm-inspect__empty">No current generation.</p>}
    <div className="fzm-inspect__runs"><span>Recent Runs</span>{runs.map((generation) => <GenerationRow key={generation.id} generation={generation} onLoad={onLoad} />)}</div>
    {cursor ? <button className="fzm-button" type="button" onClick={() => void loadMore()}>查看更多</button> : null}
  </section>;
}
