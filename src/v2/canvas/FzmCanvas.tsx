"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/v2/styles/tokens.css";
import "./canvas.css";
import { CanvasBottomToolbar } from "./CanvasBottomToolbar";
import { CanvasTopBar } from "./CanvasTopBar";
import { EmptyState } from "./EmptyState";
import { AssetDrawer } from "@/v2/assets/AssetDrawer";
import { ProviderSettings } from "@/v2/providers/ProviderSettings";
import { uploadProjectAssets } from "@/v2/assets/assetApi";
import type { V2Asset } from "@/v2/assets/types";
import { FzmEdge } from "./edges/FzmEdge";
import { isValidConnection } from "./graph/canConnect";
import { getNodeSize } from "./graph/graphUtils";
import { findAvailableNodePosition } from "./graph/nodePlacement";
import { CanvasContextMenu } from "./menus/CanvasContextMenu";
import { ActionPicker } from "./menus/ActionPicker";
import { CreateFromHandleMenu } from "./menus/CreateFromHandleMenu";
import { clampMenuPosition } from "./menus/menuUtils";
import { NodeCatalog } from "./menus/NodeCatalog";
import { NodeContextMenu } from "./menus/NodeContextMenu";
import { GroupNode } from "./nodes/GroupNode";
import { ImageNode } from "./nodes/ImageNode";
import { TextNode } from "./nodes/TextNode";
import { VideoNode } from "./nodes/VideoNode";
import { PromptBar } from "@/v2/generation/components/PromptBar";
import { GenerationInspect } from "@/v2/generation/components/GenerationInspect";
import { GenerationLogDrawer } from "@/v2/generation/components/GenerationLogDrawer";
import { defaultActionForReferences } from "@/v2/generation/actionRegistry";
import { applyServerNodeResult } from "@/v2/generation/reconciliation";
import { isTerminalJob, subscribeJob } from "@/v2/generation/jobPoller";
import { getGeneration, listProjectJobs } from "@/v2/generation/generationApi";
import { draftFromGeneration } from "@/v2/generation/draftFromGeneration";
import { resolveGraphReferences } from "@/v2/generation/referenceResolver";
import { getPromptDraft, useGenerationStore } from "@/v2/generation/generationStore";
import type { GenerationActionId, GenerationRecordDto, PromptReference } from "@/v2/generation/types";
import { selectCanvasEdges, selectCanvasNodes, useCanvasStore } from "@/v2/stores/canvasStore";
import type { SaveState, V2Project } from "@/v2/projects/types";
import type { CanvasTool, FloatingPosition, V2FlowEdge, V2FlowNode, V2NodeKind } from "@/v2/types/canvas";

const nodeTypes: NodeTypes = { text: TextNode, image: ImageNode, video: VideoNode, group: GroupNode };
const edgeTypes: EdgeTypes = { fzm: FzmEdge };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

interface FzmCanvasProps {
  project: V2Project;
  revision: number;
  saveState: SaveState;
  onBack: () => void;
  onReloadLatest: () => void;
  onServerRevision: (revision: number) => void;
  onFlushPendingSave: () => Promise<"saved" | "conflict" | "failed" | "locked">;
}

export function FzmCanvas({ project, revision, saveState, onBack, onReloadLatest, onServerRevision, onFlushPendingSave }: FzmCanvasProps) {
  const nodes = useCanvasStore(selectCanvasNodes);
  const edges = useCanvasStore(selectCanvasEdges);
  const activeTool = useCanvasStore((state) => state.activeTool);
  const isSpaceHand = useCanvasStore((state) => state.isSpaceHand);
  const viewport = useCanvasStore((state) => state.viewport);
  const canUndo = useCanvasStore((state) => state.history.past.length > 0);
  const canRedo = useCanvasStore((state) => state.history.future.length > 0);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const addNode = useCanvasStore((state) => state.addNode);
  const addEdgeFromConnection = useCanvasStore((state) => state.addEdgeFromConnection);
  const addEdgeByIds = useCanvasStore((state) => state.addEdgeByIds);
  const removeEdgeById = useCanvasStore((state) => state.removeEdgeById);
  const updateConnectedEdgeStatus = useCanvasStore((state) => state.updateConnectedEdgeStatus);
  const beginDrag = useCanvasStore((state) => state.beginDrag);
  const endDrag = useCanvasStore((state) => state.endDrag);
  const setTool = useCanvasStore((state) => state.setTool);
  const setSpaceHand = useCanvasStore((state) => state.setSpaceHand);
  const setViewport = useCanvasStore((state) => state.setViewport);
  const setSelected = useCanvasStore((state) => state.setSelected);
  const duplicateNodeById = useCanvasStore((state) => state.duplicateNodeById);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const disconnectNode = useCanvasStore((state) => state.disconnectNode);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const seedHundredNodes = useCanvasStore((state) => state.seedHundredNodes);

  const [flow, setFlow] = useState<ReactFlowInstance<V2FlowNode, V2FlowEdge> | null>(null);
  const [catalog, setCatalog] = useState<FloatingPosition | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<FloatingPosition | null>(null);
  const [nodeMenu, setNodeMenu] = useState<(FloatingPosition & { nodeId: string }) | null>(null);
  const [inspect, setInspect] = useState<(FloatingPosition & { nodeId: string; generationId?: string | null }) | null>(null);
  const [handleMenu, setHandleMenu] = useState<(FloatingPosition & { sourceNodeId: string }) | null>(null);
  const [actionMenu, setActionMenu] = useState<(FloatingPosition & { sourceNodeId: string; sourceKind: string }) | null>(null);
  const [info, setInfo] = useState<(FloatingPosition & { text: string }) | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [assetPickerMode, setAssetPickerMode] = useState<"canvas" | "reference">("canvas");
  const [providersOpen, setProvidersOpen] = useState(false);
  const [generationLogOpen, setGenerationLogOpen] = useState(false);
  const [generationLogJobId, setGenerationLogJobId] = useState<string | null>(null);
  const connectingFrom = useRef<string | null>(null);
  const jobUnsubscribers = useRef(new Map<string, () => void>());

  useEffect(() => {
    const openLog = (event: Event) => {
      const jobId = (event as CustomEvent<{ jobId: string }>).detail?.jobId;
      if (!jobId) return;
      setGenerationLogJobId(jobId);
      setGenerationLogOpen(true);
    };
    window.addEventListener("fzm-open-generation-log", openLog);
    return () => window.removeEventListener("fzm-open-generation-log", openLog);
  }, []);

  const closeFloating = useCallback(() => {
    setCatalog(null);
    setCanvasMenu(null);
    setNodeMenu(null);
    setInspect(null);
    setHandleMenu(null);
    setActionMenu(null);
    setInfo(null);
  }, []);

  const screenToFlow = useCallback(
    (x: number, y: number) => flow?.screenToFlowPosition({ x, y }) ?? { x: 0, y: 0 },
    [flow],
  );

  const openCatalogAt = useCallback(
    (clientX: number, clientY: number) => {
      const flowPosition = screenToFlow(clientX, clientY);
      if (process.env.NODE_ENV !== "production") {
        const globalObject = window as typeof window & { __FZM_V2_CATALOG_OPEN_COUNT?: number };
        globalObject.__FZM_V2_CATALOG_OPEN_COUNT = (globalObject.__FZM_V2_CATALOG_OPEN_COUNT ?? 0) + 1;
      }
      setCatalog(clampMenuPosition({ x: clientX, y: clientY, flowX: flowPosition.x, flowY: flowPosition.y }, 220, 260));
      setCanvasMenu(null);
    },
    [screenToFlow],
  );

  const createNode = useCallback(
    (kind: V2NodeKind, position = catalog, data = {}) => {
      const preferredPoint = position?.flowX != null && position.flowY != null ? { x: position.flowX, y: position.flowY } : screenToFlow(window.innerWidth / 2, window.innerHeight / 2);
      const size = getNodeSize(kind);
      const flowPosition = findAvailableNodePosition({ nodes, preferredPoint, ...size });
      const node = addNode(kind, flowPosition.x, flowPosition.y, data);
      setSelected([node.id]);
      if (kind === "image") useGenerationStore.getState().setActiveTarget(project.id, node.id, "image.generate", []);
      closeFloating();
      return node;
    },
    [addNode, catalog, closeFloating, nodes, project.id, screenToFlow, setSelected],
  );

  const createAssetNode = useCallback(
    (asset: V2Asset, position?: FloatingPosition) => {
      if (asset.kind !== "image" && asset.kind !== "video") {
        setInfo({ x: window.innerWidth - 330, y: 76, text: "Audio assets are stored in Phase 2, but AudioNode is deferred." });
        return;
      }
      createNode(asset.kind, position, { assetId: asset.id, originalName: asset.originalName ?? undefined, mimeType: asset.mimeType, title: asset.kind === "image" ? "Image" : "Video" });
    },
    [createNode],
  );

  const openPromptForNode = useCallback((nodeId: string, action?: GenerationActionId) => {
    const references = resolveGraphReferences(nodeId, useCanvasStore.getState().history.present.nodes, useCanvasStore.getState().history.present.edges);
    useGenerationStore.getState().setActiveTarget(project.id, nodeId, action ?? defaultActionForReferences(references.length), references);
  }, [project.id]);

  const loadGenerationIntoPrompt = useCallback((nodeId: string, generation: GenerationRecordDto) => {
    const references = resolveGraphReferences(nodeId, useCanvasStore.getState().history.present.nodes, useCanvasStore.getState().history.present.edges);
    useGenerationStore.getState().replaceDraft(project.id, nodeId, draftFromGeneration(nodeId, generation, references));
  }, [project.id]);

  const rerunNode = useCallback(async (nodeId: string) => {
    const node = useCanvasStore.getState().history.present.nodes.find((item) => item.id === nodeId);
    if (!node?.data.generationId) { openPromptForNode(nodeId); return; }
    const { generation } = await getGeneration(node.data.generationId);
    loadGenerationIntoPrompt(nodeId, generation);
  }, [loadGenerationIntoPrompt, openPromptForNode]);

  useEffect(() => {
    if (useCanvasStore.getState().selectedNodeIds.length !== 1) useGenerationStore.getState().setActiveTarget(project.id, null);
  }, [project.id]);

  useEffect(() => {
    useGenerationStore.getState().setServerRevisionHandler(onServerRevision);
    return () => useGenerationStore.getState().setServerRevisionHandler(null);
  }, [onServerRevision]);

  const uploadFilesAt = useCallback(
    async (files: File[], clientX: number, clientY: number) => {
      if (files.length === 0) return;
      const flowPosition = screenToFlow(clientX, clientY);
      const assets = await uploadProjectAssets(project.id, files);
      assets.forEach((asset, index) => createAssetNode(asset, { x: clientX, y: clientY, flowX: flowPosition.x + (index % 4) * 352, flowY: flowPosition.y + Math.floor(index / 4) * 282 }));
    },
    [createAssetNode, project.id, screenToFlow],
  );

  const onDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const assetPayload = event.dataTransfer.getData("application/fzm-asset");
    if (assetPayload) {
      const flowPosition = screenToFlow(event.clientX, event.clientY);
      createAssetNode(JSON.parse(assetPayload) as V2Asset, { x: event.clientX, y: event.clientY, flowX: flowPosition.x, flowY: flowPosition.y });
      return;
    }
    void uploadFilesAt(Array.from(event.dataTransfer.files), event.clientX, event.clientY);
  }, [createAssetNode, screenToFlow, uploadFilesAt]);

  const onPaste = useCallback((event: React.ClipboardEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) return;
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    void uploadFilesAt(files, window.innerWidth / 2, window.innerHeight / 2);
  }, [uploadFilesAt]);

  const onPaneClick = useCallback(
    () => {
      closeFloating();
    },
    [closeFloating],
  );

  const onCanvasStageDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".react-flow__node, .fzm-topbar, .fzm-bottom-toolbar, .fzm-menu, .fzm-empty-actions")) return;
      openCatalogAt(event.clientX, event.clientY);
    },
    [openCatalogAt],
  );
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      const flowPosition = screenToFlow(event.clientX, event.clientY);
      setCanvasMenu(clampMenuPosition({ x: event.clientX, y: event.clientY, flowX: flowPosition.x, flowY: flowPosition.y }, 220, 260));
      setCatalog(null);
    },
    [screenToFlow],
  );

  const onNodeContextMenu = useCallback((event: MouseEvent | React.MouseEvent, node: { id: string }) => {
    event.preventDefault();
    setSelected([node.id], []);
    setNodeMenu({ ...clampMenuPosition({ x: event.clientX, y: event.clientY }, 220, 260), nodeId: node.id });
  }, [setSelected]);

  const onConnectStart: OnConnectStart = useCallback((_, params) => {
    connectingFrom.current = params.nodeId ?? null;
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, state) => {
      const sourceNodeId = connectingFrom.current;
      connectingFrom.current = null;
      if (!sourceNodeId || state.isValid) return;
      if (!(event instanceof MouseEvent) && !(event instanceof TouchEvent)) return;
      const point = event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : { x: event.changedTouches[0]?.clientX ?? 0, y: event.changedTouches[0]?.clientY ?? 0 };
      const flowPosition = screenToFlow(point.x, point.y);
      setHandleMenu({ ...clampMenuPosition({ x: point.x, y: point.y, flowX: flowPosition.x, flowY: flowPosition.y }, 220, 190), sourceNodeId });
      const source = useCanvasStore.getState().history.present.nodes.find((node) => node.id === sourceNodeId);
      if (source?.data.kind === "image") {
        setActionMenu({ ...clampMenuPosition({ x: point.x, y: point.y, flowX: flowPosition.x, flowY: flowPosition.y }, 240, 260), sourceNodeId, sourceKind: "image" });
        setHandleMenu(null);
      }
    },
    [screenToFlow],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "z" && event.shiftKey) { event.preventDefault(); redo(); return; }
      if ((event.metaKey || event.ctrlKey) && key === "z") { event.preventDefault(); undo(); return; }
      if ((event.ctrlKey && key === "y")) { event.preventDefault(); redo(); return; }
      if (key === "delete" || key === "backspace") { event.preventDefault(); deleteSelected(); return; }
      if (key === "escape") { event.preventDefault(); closeFloating(); return; }
      if (key === "v") setTool("select");
      if (key === "h") setTool("hand");
      if (key === "c") setTool("connect");
      if (key === "f") flow?.fitView({ padding: 0.24, duration: 180 });
      if (event.code === "Space" && !isSpaceHand) { event.preventDefault(); setSpaceHand(true); }
    },
    [closeFloating, deleteSelected, flow, isSpaceHand, redo, setSpaceHand, setTool, undo],
  );

  const onKeyUp = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.code === "Space") setSpaceHand(false);
  }, [setSpaceHand]);

  const effectiveTool: CanvasTool = isSpaceHand ? "hand" : activeTool;
  const panOnDrag = effectiveTool === "hand";

  const toolbar = useMemo(() => ({
    fit: () => flow?.fitView({ padding: 0.24, duration: 180 }),
    zoomIn: () => flow?.zoomIn({ duration: 140 }),
    zoomOut: () => flow?.zoomOut({ duration: 140 }),
  }), [flow]);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: V2FlowNode[]; edges: V2FlowEdge[] }) => {
    setSelected(selectedNodes.map((node) => node.id), selectedEdges.map((edge) => edge.id));
    if (selectedNodes.length === 1 && selectedNodes[0]?.data.kind === "image") openPromptForNode(selectedNodes[0].id);
    else useGenerationStore.getState().setActiveTarget(project.id, null);
  }, [openPromptForNode, project.id, setSelected]);

  const beginJobWatch = useCallback((nodeId: string, jobId: string) => {
    if (jobUnsubscribers.current.has(jobId)) return;
    updateConnectedEdgeStatus(nodeId, "running");
    const unsubscribe = subscribeJob(jobId, (job) => {
      if (!isTerminalJob(job.status)) return;
      jobUnsubscribers.current.get(jobId)?.();
      jobUnsubscribers.current.delete(jobId);
      if (job.status === "succeeded") void Promise.resolve(onFlushPendingSave()).then(() => applyServerNodeResult(project.id, nodeId, onServerRevision));
      if (job.status === "failed") updateConnectedEdgeStatus(nodeId, "failed");
    });
    jobUnsubscribers.current.set(jobId, unsubscribe);
  }, [onFlushPendingSave, onServerRevision, project.id, updateConnectedEdgeStatus]);

  useEffect(() => () => {
    for (const unsubscribe of jobUnsubscribers.current.values()) unsubscribe();
    jobUnsubscribers.current.clear();
    useGenerationStore.getState().clearProjectRuntime(project.id);
  }, [project.id]);

  useEffect(() => {
    const activeStatuses = ["queued", "preparing", "submitting", "polling", "downloading", "finalizing", "rate_limited", "provider_busy", "succeeded", "failed", "interrupted", "canceled"];
    let alive = true;
    void Promise.all(activeStatuses.map((status) => listProjectJobs(project.id, status).catch(() => ({ jobs: [] })))).then((pages) => {
      if (!alive) return;
      for (const page of pages) {
        for (const job of page.jobs) {
          if (!job.nodeId) continue;
          useGenerationStore.getState().registerJob(job.nodeId, job);
          if (job.status === "succeeded") void applyServerNodeResult(project.id, job.nodeId, onServerRevision);
          else if (!isTerminalJob(job.status)) beginJobWatch(job.nodeId, job.id);
        }
      }
    });
    return () => { alive = false; };
  }, [beginJobWatch, onServerRevision, project.id]);

  return (
    <main
      className="fzm-v2-shell"
      aria-label="FZM AI Studio 2.0 canvas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onPaste={onPaste}
      onDoubleClickCapture={onCanvasStageDoubleClick}
    >
      <ReactFlow<V2FlowNode, V2FlowEdge>
        className="fzm-v2-flow"
        data-tool={effectiveTool}
        data-space-hand={isSpaceHand}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={handleSelectionChange}
        onNodeDragStart={beginDrag}
        onNodeDragStop={endDrag}
        onConnect={(connection: Connection) => addEdgeFromConnection(connection)}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={(connection) => isValidConnection(edges, connection)}
        connectionMode={ConnectionMode.Loose}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onMove={(_, nextViewport) => setViewport(nextViewport)}
        nodesDraggable={effectiveTool !== "hand"}
        nodesConnectable
        elementsSelectable={effectiveTool !== "hand"}
        selectionOnDrag={effectiveTool === "select"}
        panOnDrag={panOnDrag}
        zoomOnScroll
        zoomOnPinch
        minZoom={0.18}
        maxZoom={3}
        deleteKeyCode={null}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.11)" />
      </ReactFlow>

      <CanvasTopBar
        projectName={project.name}
        revision={revision}
        saveState={saveState}
        onBack={onBack}
        onReloadLatest={onReloadLatest}
        onAssets={() => setAssetsOpen((open) => !open)}
        onProviders={() => setProvidersOpen((open) => !open)}
        onGenerationLog={() => { setGenerationLogJobId(null); setGenerationLogOpen(true); }}
        onMessage={(text) => setInfo({ x: window.innerWidth - 310, y: 76, text })}
      />
      {nodes.length === 0 ? (
        <EmptyState
          onCreate={(kind) => {
            const center = screenToFlow(window.innerWidth / 2, window.innerHeight / 2);
            createNode(kind, { x: window.innerWidth / 2, y: window.innerHeight / 2, flowX: center.x, flowY: center.y });
          }}
        />
      ) : null}
      <CanvasBottomToolbar
        activeTool={activeTool}
        zoom={viewport.zoom}
        canUndo={canUndo}
        canRedo={canRedo}
        onAdd={() => openCatalogAt(window.innerWidth / 2, window.innerHeight / 2)}
        onTool={setTool}
        onUndo={undo}
        onRedo={redo}
        onFit={toolbar.fit}
        onZoomIn={toolbar.zoomIn}
        onZoomOut={toolbar.zoomOut}
        onHelp={() => setInfo({ x: 24, y: window.innerHeight - 210, text: "V Select · H Hand · C Connect · Space temporary hand · F Fit · Double-click to add" })}
      />

      {catalog ? <NodeCatalog position={catalog} onCreate={(kind) => createNode(kind)} onClose={closeFloating} /> : null}
      {canvasMenu ? <CanvasContextMenu position={canvasMenu} onAddNode={() => setCatalog(canvasMenu)} onFitView={toolbar.fit} onTool={setTool} /> : null}
      {nodeMenu ? (
        <NodeContextMenu
          position={nodeMenu}
          onDuplicate={() => { duplicateNodeById(nodeMenu.nodeId); closeFloating(); }}
          onDisconnect={() => { disconnectNode(nodeMenu.nodeId); closeFloating(); }}
          onRun={() => { openPromptForNode(nodeMenu.nodeId); closeFloating(); }}
          onRerun={() => { void rerunNode(nodeMenu.nodeId); closeFloating(); }}
          onInspect={() => { const node = nodes.find((item) => item.id === nodeMenu.nodeId); setInspect({ ...nodeMenu, generationId: node?.data.generationId }); setNodeMenu(null); }}
          onDelete={() => { deleteSelected(); closeFloating(); }}
        />
      ) : null}
      {actionMenu ? (
        <ActionPicker
          position={actionMenu}
          sourceKind={actionMenu.sourceKind}
          onChoose={(action) => {
            const node = createNode("image", actionMenu);
            addEdgeByIds(actionMenu.sourceNodeId, node.id, "reference-image");
            openPromptForNode(node.id, action);
            setActionMenu(null);
          }}
        />
      ) : null}
      {handleMenu ? (
        <CreateFromHandleMenu
          position={handleMenu}
          onCreate={(kind) => {
            const node = createNode(kind, handleMenu);
            addEdgeByIds(handleMenu.sourceNodeId, node.id, "reference-image");
          }}
        />
      ) : null}
      {inspect ? <GenerationInspect projectId={project.id} nodeId={inspect.nodeId} generationId={inspect.generationId} position={inspect} onLoad={(generation) => { loadGenerationIntoPrompt(inspect.nodeId, generation); setInspect(null); }} onClose={() => setInspect(null)} /> : null}
      <PromptBar
        projectId={project.id}
        onSubmitted={beginJobWatch}
        onBeforeSubmit={async () => (await onFlushPendingSave()) === "saved"}
        onRemoveReference={(reference: PromptReference) => {
          const draftNodeId = useGenerationStore.getState().activeTargetNodeId;
          if (!draftNodeId) return;
          if (reference.source === "graph" && reference.edgeId) removeEdgeById(reference.edgeId);
          const draft = getPromptDraft(project.id, draftNodeId);
          useGenerationStore.getState().updateDraft(draftNodeId, { references: draft.references.filter((item) => item !== reference) });
        }}
        onOpenAssetPicker={() => { setAssetPickerMode("reference"); setAssetsOpen(true); }}
        onMessage={(text) => setInfo({ x: window.innerWidth - 330, y: 76, text })}
        onViewJob={(jobId) => { setGenerationLogJobId(jobId); setGenerationLogOpen(true); }}
      />
      <GenerationLogDrawer projectId={project.id} open={generationLogOpen} focusJobId={generationLogJobId} onClose={() => { setGenerationLogOpen(false); setGenerationLogJobId(null); }} />
      {info ? <div className="fzm-node-info fzm-floating" style={{ left: info.x, top: info.y, whiteSpace: "pre-line" }}>{info.text}</div> : null}
      <AssetDrawer projectId={project.id} open={assetsOpen} onClose={() => { setAssetsOpen(false); setAssetPickerMode("canvas"); }} onAddToCanvas={(asset) => {
        if (assetPickerMode === "reference") {
          const nodeId = useGenerationStore.getState().activeTargetNodeId;
          if (nodeId && asset.kind === "image") {
            const draft = getPromptDraft(project.id, nodeId);
            const references = [...draft.references, { assetId: asset.id, role: "reference-image" as const, order: draft.references.length, source: "manual" as const }];
            useGenerationStore.getState().updateDraft(nodeId, { references, action: "image.edit" });
          }
          setAssetsOpen(false); setAssetPickerMode("canvas");
          return;
        }
        createAssetNode(asset);
      }} />
      <ProviderSettings open={providersOpen} onClose={() => setProvidersOpen(false)} />
      {process.env.NODE_ENV !== "production" ? (
        <button className="fzm-button" style={{ position: "absolute", right: 18, bottom: 18, zIndex: 30 }} type="button" onClick={seedHundredNodes}>Seed 100</button>
      ) : null}
    </main>
  );
}
