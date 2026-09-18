"use client";

import { useEffect, useState } from "react";
import { Archive, Pencil, Plus, Sparkles } from "lucide-react";
import { createProject, deleteProject, listProjects, renameProject } from "./projectApi";
import type { V2Project } from "./types";

interface ProjectListProps {
  onOpen: (projectId: string) => void;
}

export function ProjectList({ onOpen }: ProjectListProps) {
  const [projects, setProjects] = useState<V2Project[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setProjects(await listProjects());

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, []);

  const add = async () => {
    setBusy(true);
    try {
      const project = await createProject("未命名画布");
      onOpen(project.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="fzm-project-home" aria-label="FZM AI Studio projects">
      <section className="fzm-project-hero">
        <div>
          <span className="fzm-project-kicker"><Sparkles size={15} /> Local-first Canvas</span>
          <h1>FZM AI Studio</h1>
          <p>我的画布</p>
        </div>
        <button className="fzm-primary-button" type="button" onClick={add} disabled={busy}><Plus size={18} /> 新建画布</button>
      </section>
      <section className="fzm-project-grid">
        {projects.map((project) => (
          <article className="fzm-project-card" key={project.id}>
            <button className="fzm-project-open" type="button" onClick={() => onOpen(project.id)}>
              <strong>{project.name}</strong>
              <span>{new Date(project.updatedAt).toLocaleString()}</span>
            </button>
            <div className="fzm-project-actions">
              <button className="fzm-button" type="button" onClick={async () => { const name = window.prompt("Rename project", project.name); if (name != null) { await renameProject(project.id, name); await refresh(); } }}><Pencil size={14} /> Rename</button>
              <button className="fzm-button" type="button" onClick={async () => { await deleteProject(project.id); await refresh(); }}><Archive size={14} /> Archive</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
