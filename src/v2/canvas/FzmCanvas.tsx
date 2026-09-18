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
import { FzmEdge } from "./edges/FzmEdge";
import { isValidConnection } from "./graph/canConnect";
import { CanvasContextMenu } from "./menus/CanvasContextMenu";
import { CreateFromHandleMenu } from "./menus/CreateFromHandleMenu";
import { clampMenuPosition } from "./menus/menuUtils";
import { NodeCatalog } from "./menus/NodeCatalog";
import { NodeContextMenu } from "./menus/NodeContextMenu";
import { GroupNode } from "./nodes/GroupNode";
import { ImageNode } from "./nodes/ImageNode";
import { TextNode } from "./nodes/TextNode";
import { VideoNode } from "./nodes/VideoNode";
import { selectCanvasEdges, selectCanvasNodes, useCanvasStore } from "@/v2/stores/canvasStore";
import type { CanvasTool, FloatingPosition, V2FlowEdge, V2FlowNode, V2NodeKind } from "@/v2/types/canvas";

const nodeTypes: NodeTypes = { text: TextNode, image: ImageNode, video: VideoNode, group: GroupNode };
const edgeTypes: EdgeTypes = { fzm: FzmEdge };

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

export function FzmCanvas() {
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
  const [handleMenu, setHandleMenu] = useState<(FloatingPosition & { sourceNodeId: string }) | null>(null);
  const [info, setInfo] = useState<(FloatingPosition & { text: string }) | null>(null);
  const connectingFrom = useRef<string | null>(null);

  const closeFloating = useCallback(() => {
    setCatalog(null);
    setCanvasMenu(null);
    setNodeMenu(null);
    setHandleMenu(null);
    setInfo(null);
  }, []);

  const screenToFlow = useCallback(
    (x: number, y: number) => flow?.screenToFlowPosition({ x, y }) ?? { x: 0, y: 0 },
    [flow],
  );

  const openCatalogAt = useCallback(
    (clientX: number, clientY: number) => {
      const flowPosition = screenToFlow(clientX, clientY);
      setCatalog(clampMenuPosition({ x: clientX, y: clientY, flowX: flowPosition.x, flowY: flowPosition.y }, 220, 260));
      setCanvasMenu(null);
    },
    [screenToFlow],
  );

  useEffect(() => {
    const handleDoubleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest(".fzm-v2-shell")) return;
      if (event.target.closest(".react-flow__node, .fzm-topbar, .fzm-bottom-toolbar, .fzm-menu, .fzm-empty-actions")) return;
      openCatalogAt(event.clientX, event.clientY);
    };
    document.addEventListener("dblclick", handleDoubleClick, true);
    return () => document.removeEventListener("dblclick", handleDoubleClick, true);
  }, [openCatalogAt]);

  const createNode = useCallback(
    (kind: V2NodeKind, position = catalog) => {
      const flowPosition = position?.flowX != null && position.flowY != null ? { x: position.flowX, y: position.flowY } : screenToFlow(window.innerWidth / 2, window.innerHeight / 2);
      const node = addNode(kind, flowPosition.x, flowPosition.y);
      setSelected([node.id]);
      closeFloating();
      return node;
    },
    [addNode, catalog, closeFloating, screenToFlow, setSelected],
  );

  const onPaneClick = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      closeFloating();
      if (event.detail === 2) openCatalogAt(event.clientX, event.clientY);
    },
    [closeFloating, openCatalogAt],
  );

  const onReactFlowDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".react-flow__node, .fzm-menu, .fzm-empty-actions")) return;
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

  const onShellClickCapture = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.detail !== 2) return;
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".react-flow__node, .fzm-topbar, .fzm-bottom-toolbar, .fzm-menu, .fzm-empty-actions")) return;
      openCatalogAt(event.clientX, event.clientY);
    },
    [openCatalogAt],
  );

  const onShellDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".react-flow__node, .fzm-topbar, .fzm-bottom-toolbar, .fzm-menu, .fzm-empty-actions")) return;
      openCatalogAt(event.clientX, event.clientY);
    },
    [openCatalogAt],
  );

  const effectiveTool: CanvasTool = isSpaceHand ? "hand" : activeTool;
  const panOnDrag = effectiveTool === "hand";

  const toolbar = useMemo(() => ({
    fit: () => flow?.fitView({ padding: 0.24, duration: 180 }),
    zoomIn: () => flow?.zoomIn({ duration: 140 }),
    zoomOut: () => flow?.zoomOut({ duration: 140 }),
  }), [flow]);

  return (
    <main
      className="fzm-v2-shell"
      aria-label="FZM AI Studio 2.0 canvas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onClickCapture={onShellClickCapture}
      onDoubleClick={onShellDoubleClick}
    >
      <ReactFlow<V2FlowNode, V2FlowEdge>
        className="fzm-v2-flow"
        data-tool={effectiveTool}
        data-space-hand={isSpaceHand}
        {...({ onDoubleClick: onReactFlowDoubleClick } as { onDoubleClick: (event: React.MouseEvent) => void })}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }) => setSelected(selectedNodes.map((node) => node.id), selectedEdges.map((edge) => edge.id))}
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

      <CanvasTopBar onMessage={(text) => setInfo({ x: window.innerWidth - 310, y: 76, text })} />
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
          onInspect={() => setInfo({ x: nodeMenu.x + 14, y: nodeMenu.y, text: `Node ${nodeMenu.nodeId}\nPhase 1 shell only. Provider, Job and Asset metadata start later.` })}
          onDelete={() => { deleteSelected(); closeFloating(); }}
        />
      ) : null}
      {handleMenu ? (
        <CreateFromHandleMenu
          position={handleMenu}
          onCreate={(kind) => {
            const node = createNode(kind, handleMenu);
            addEdgeByIds(handleMenu.sourceNodeId, node.id);
          }}
        />
      ) : null}
      {info ? <div className="fzm-node-info fzm-floating" style={{ left: info.x, top: info.y, whiteSpace: "pre-line" }}>{info.text}</div> : null}
      {process.env.NODE_ENV !== "production" ? (
        <button className="fzm-button" style={{ position: "absolute", right: 18, bottom: 18, zIndex: 30 }} type="button" onClick={seedHundredNodes}>Seed 100</button>
      ) : null}
    </main>
  );
}
