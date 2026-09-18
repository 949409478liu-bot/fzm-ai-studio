"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listProjectJobs } from "../generationApi";
import { subscribeJob, isTerminalJob } from "../jobPoller";
import { formatJobError, translateJobPhase, translateJobStatus, redactSensitiveDiagnostics } from "../errorMessages";
import type { JobDto } from "../types";

export type GenerationLogFilter = "all" | "running" | "succeeded" | "failed";

interface Props {
  projectId: string;
  open: boolean;
  focusJobId?: string | null;
  onClose: () => void;
}

const runningStatuses = new Set(["queued", "preparing", "submitting", "polling", "downloading", "finalizing", "running", "processing", "rate_limited", "provider_busy"]);
const filterMatches = (job: JobDto, filter: GenerationLogFilter) => filter === "all" || filter === "running" && !isTerminalJob(job.status) || filter === "succeeded" && job.status === "succeeded" || filter === "failed" && job.status === "failed";

function duration(job: JobDto, now: number) {
  const ms = Math.max(0, (job.finishedAt ? new Date(job.finishedAt).getTime() : now) - new Date(job.createdAt).getTime());
  return `${job.finishedAt ? "耗时" : "已运行"} ${(ms / 1000).toFixed(1)} 秒`;
}

export function GenerationLogDrawer({ projectId, open, focusJobId, onClose }: Props) {
  const [jobs, setJobs] = useState<JobDto[]>([]);
  const [filter, setFilter] = useState<GenerationLogFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(focusJobId ?? null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open || !jobs.some((job) => !isTerminalJob(job.status))) return;
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, [open, jobs]);

  const refresh = useCallback(async () => {
    const collected: JobDto[] = [];
    let cursor: string | null = null;
    do {
      const page: { jobs: JobDto[]; nextCursor: string | null } = await listProjectJobs(projectId, undefined, { limit: 100, cursor }).catch(() => ({ jobs: [], nextCursor: null }));
      collected.push(...page.jobs);
      cursor = page.nextCursor;
    } while (cursor && collected.length < 1000);
    setJobs(collected);
  }, [projectId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (focusJobId) setExpanded(focusJobId); }, [focusJobId]);
  useEffect(() => {
    if (!open) return;
    const unsubs = jobs.filter((job) => runningStatuses.has(job.status)).map((job) => subscribeJob(job.id, (next) => setJobs((current) => current.map((item) => item.id === next.id ? next : item))));
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [open, jobs]);

  const visibleJobs = useMemo(() => jobs.filter((job) => filterMatches(job, filter)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [filter, jobs]);
  if (!open) return null;
  return <aside className="fzm-generation-log fzm-floating" aria-label="生成日志">
    <header className="fzm-generation-log__head"><div><strong>生成日志</strong><small>{jobs.length} 条记录</small></div><div><button className="fzm-button" type="button" aria-label="刷新生成日志" onClick={() => void refresh()}>刷新</button><button className="fzm-button" type="button" aria-label="关闭生成日志" onClick={onClose}>关闭</button></div></header>
    <div className="fzm-generation-log__filters" role="tablist" aria-label="日志筛选">{([["all", "全部"], ["running", "进行中"], ["succeeded", "已完成"], ["failed", "失败"]] as const).map(([value, label]) => <button key={value} className="fzm-button" type="button" role="tab" aria-selected={filter === value} data-active={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="fzm-generation-log__list">{visibleJobs.length === 0 ? <p className="fzm-generation-log__empty">暂无生成记录</p> : visibleJobs.map((job) => {
      const isFailed = job.status === "failed";
      const isOpen = expanded === job.id;
      return <article className="fzm-generation-log__item" key={job.id} data-job-id={job.id} data-status={job.status}>
        <button className="fzm-generation-log__summary" type="button" onClick={() => setExpanded(isOpen ? null : job.id)}><span className={`fzm-generation-log__dot fzm-generation-log__dot--${isFailed ? "failed" : job.status === "succeeded" ? "success" : "running"}`} /><span><strong>{translateJobStatus(job.status)}</strong><small>{new Date(job.createdAt).toLocaleString()} · {job.providerId} · {job.modelId}</small><small>阶段：{translateJobPhase(job.phase)} · {duration(job, now)}</small>{isFailed ? <small>错误原因：{formatJobError(job.errorCode ?? job.httpStatus ?? job.error)}</small> : null}</span><em>{job.nodeId ?? "—"}</em></button>
        {isOpen ? <div className="fzm-generation-log__details"><dl><dt>任务 ID</dt><dd>{job.id}</dd><dt>生成 ID</dt><dd>{job.generationId}</dd><dt>中转站</dt><dd>{job.providerId}</dd><dt>模型</dt><dd>{job.modelId}</dd><dt>阶段</dt><dd>{translateJobPhase(job.phase)}</dd>{job.status === "succeeded" ? <><dt>耗时</dt><dd>{duration(job, now)}</dd><dt>输出数量</dt><dd>见生成记录</dd></> : null}</dl>{isFailed ? <p className="fzm-generation-log__reason"><strong>错误原因：</strong>{formatJobError(job.errorCode ?? job.httpStatus ?? job.error, { detailed: true })}</p> : null}<details><summary>技术详情</summary><dl><dt>Job ID</dt><dd>{job.id}</dd><dt>Generation ID</dt><dd>{job.generationId}</dd><dt>Provider ID</dt><dd>{job.providerId}</dd><dt>Model ID</dt><dd>{job.modelId}</dd><dt>status</dt><dd>{job.status}</dd><dt>phase</dt><dd>{job.phase}</dd><dt>attempt</dt><dd>{job.attempt ?? 0}</dd><dt>HTTP status</dt><dd>{job.httpStatus ?? "—"}</dd><dt>safe error code</dt><dd>{redactSensitiveDiagnostics(job.errorCode ?? job.error)}</dd><dt>createdAt</dt><dd>{job.createdAt}</dd><dt>updatedAt</dt><dd>{job.updatedAt}</dd><dt>finishedAt</dt><dd>{job.finishedAt ?? "—"}</dd></dl></details></div> : null}
      </article>;
    })}</div>
  </aside>;
}
