"use client";

import { useEffect, useState } from "react";
import { assetContentUrl } from "@/v2/assets/assetApi";
import { getGeneration, listGenerations, listProjectJobs } from "../generationApi";
import type { GenerationRecordDto, JobDto } from "../types";
import { formatJobError, translateJobStatus } from "../errorMessages";
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

function GenerationRow({ generation, job, onLoad }: { generation: GenerationRecordDto; job?: JobDto; onLoad: (generation: GenerationRecordDto) => void }) {
  return <button className="fzm-inspect__run" type="button" onClick={() => onLoad(generation)}>
    <strong>{translateJobStatus(job?.status ?? generation.status)}</strong>
    <strong>{generation.providerId} / {generation.modelId}</strong>
    {job?.status === "failed" ? <small>错误原因：{formatJobError(job.errorCode ?? job.httpStatus ?? job.error)}</small> : null}
    <small>{preview(generation.prompt || "暂无提示词")}</small>
  </button>;
}

export function GenerationInspect({ projectId, nodeId, generationId, position, onLoad, onClose }: Props) {
  const [current, setCurrent] = useState<GenerationRecordDto | null>(null);
  const [runs, setRuns] = useState<GenerationRecordDto[]>([]);
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      generationId ? getGeneration(generationId).then((body) => body.generation).catch(() => null) : Promise.resolve(null),
      listGenerations(projectId, { nodeId, limit: 10 }).catch(() => ({ generations: [], nextCursor: null })),
      listProjectJobs(projectId, undefined, { limit: 100 }).catch(() => ({ jobs: [], nextCursor: null })),
    ]).then(([nextCurrent, page, jobPage]) => {
      if (!alive) return;
      setCurrent(nextCurrent);
      setRuns(page.generations);
      setJobs(jobPage.jobs);
      setCursor(page.nextCursor);
    });
    return () => { alive = false; };
  }, [generationId, nodeId, projectId]);

  const loadMore = async () => {
    const page = await listGenerations(projectId, { nodeId, limit: 10, cursor });
    setRuns((items) => [...items, ...page.generations]);
    setCursor(page.nextCursor);
  };

  return <section className="fzm-inspect fzm-floating" style={{ left: position.x, top: position.y }} aria-label="生成记录">
    <div className="fzm-inspect__head"><strong>生成记录</strong><button className="fzm-button" type="button" onClick={onClose}>关闭</button></div>
    {current ? <div className="fzm-inspect__current">
      <span>当前生成</span>
      <strong>{translateJobStatus(jobs.find((job) => job.generationId === current.id)?.status ?? current.status)} · {current.providerId} / {current.modelId}</strong>
      {jobs.find((job) => job.generationId === current.id)?.status === "failed" ? <p>错误原因：{formatJobError((() => { const job = jobs.find((item) => item.generationId === current.id); return job?.errorCode ?? job?.httpStatus ?? job?.error; })())}</p> : null}
      <small>{new Date(current.createdAt).toLocaleString()}</small>
      <p>{preview(current.prompt || "暂无提示词")}</p>
      <dl><dt>参考图</dt><dd>{current.references.length}</dd><dt>生成结果</dt><dd>{current.outputAssetIds.length}</dd><dt>当前选中</dt><dd>#{current.selectedVariantIndex + 1}</dd></dl>
      <div className="fzm-inspect__thumbs">{current.references.slice(0, 4).map((reference) => <img key={reference.assetId} src={assetContentUrl(reference.assetId, "thumbnail")} alt="Reference" />)}</div>
      <button className="fzm-button" type="button" onClick={() => onLoad(current)}>载入提示词</button>
    </div> : <p className="fzm-inspect__empty">暂无当前生成记录。</p>}
    <div className="fzm-inspect__runs"><span>最近生成</span>{runs.map((generation) => <GenerationRow key={generation.id} generation={generation} job={jobs.find((job) => job.generationId === generation.id)} onLoad={onLoad} />)}</div>
    {cursor ? <button className="fzm-button" type="button" onClick={() => void loadMore()}>加载更多</button> : null}
  </section>;
}
