"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type OnConnect,
  BackgroundVariant,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

import { SummitNodeComponent } from "./nodes/summit-node";
import { SummitEdgeComponent } from "./edges/summit-edge";
import { SummitConnectionLineComponent } from "./edges/summit-connection-line";
import { CanvasTopBar } from "./top-bar";
import { BottomNodeSelector } from "./bottom-node-selector";
import { DeployPaletteModal } from "./deploy-palette";
import { NodeChooserDialogs } from "./node-chooser-dialogs";
import { ConfigInspector } from "./config-inspector";
import { DeploymentDialog } from "./deployment-dialog";
import { useAuth } from "@/components/auth/auth-context";
import {
  loadProjectArchitecture,
  saveProjectArchitecture,
  createNodeByOptionId,
} from "@/lib/canvas/initial-graph";
import type {
  SummitNode,
  SummitNodeData,
  Environment,
  ProjectArchitecture,
} from "@/lib/canvas/types";

// Registered custom node & edge definitions
const nodeTypes = {
  summitNode: SummitNodeComponent,
};

const edgeTypes = {
  default: SummitEdgeComponent,
};

/**
 * Robust non-overlapping placement calculator
 * Scans candidate positions and increments cleanly to guarantee zero node overlaps.
 */
function findNonOverlappingPosition(
  candidate: { x: number; y: number },
  existingNodes: SummitNode[],
  stepY: number = 130,
  stepX: number = 360
): { x: number; y: number } {
  let pos = { ...candidate };
  const NODE_WIDTH = 280;
  const NODE_HEIGHT = 115;
  const PADDING = 24;

  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    const collides = existingNodes.some((node) => {
      const dx = Math.abs(node.position.x - pos.x);
      const dy = Math.abs(node.position.y - pos.y);
      return dx < NODE_WIDTH + PADDING && dy < NODE_HEIGHT + PADDING;
    });

    if (!collides) {
      return pos;
    }

    pos.y += stepY;
    attempts++;

    // After 4 vertical tiers in a column, step to the right and reset y
    if (attempts % 4 === 0) {
      pos.x += stepX;
      pos.y = candidate.y;
    }
  }

  return pos;
}

/**
 * Intelligent automatic connection & positioning resolver
 * Implements deterministic infrastructure relationship rules:
 * - Application -> Database
 * - Application -> Cache
 * - Application -> Worker
 * - Worker -> Cache
 * - Repository -> Application
 * - Docker Image -> Application
 */
function resolveAutoConnectAndPlacement(
  optionId: string,
  existingNodes: SummitNode[],
  existingEdges: Edge[],
  selectedNodeId: string | null,
  disconnectedPairs: Set<string>,
  canvasCenter: { x: number; y: number }
): {
  connection: {
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
    isNewNodeSource: boolean;
  } | null;
  position: { x: number; y: number };
} {
  // If canvas is empty, place directly at center
  if (existingNodes.length === 0) {
    return {
      connection: null,
      position: { x: canvasCenter.x - 130, y: canvasCenter.y - 50 },
    };
  }

  const selectedNode = selectedNodeId
    ? existingNodes.find((n) => n.id === selectedNodeId) || null
    : null;

  const getNodeType = (n: SummitNode): string => {
    return n.data.serviceType || (n.data as unknown as { resourceType?: string }).resourceType || "";
  };

  const isDisconnected = (idA: string, idB: string) => {
    return (
      disconnectedPairs.has(`${idA}->${idB}`) ||
      disconnectedPairs.has(`${idB}->${idA}`)
    );
  };

  const findNearest = (
    predicate: (n: SummitNode) => boolean,
    originPos?: { x: number; y: number }
  ): SummitNode | null => {
    const candidates = existingNodes.filter(predicate);
    if (candidates.length === 0) return null;
    if (!originPos) return candidates[candidates.length - 1];

    return candidates.reduce((best, curr) => {
      const distCurr = Math.hypot(
        curr.position.x - originPos.x,
        curr.position.y - originPos.y
      );
      const distBest = Math.hypot(
        best.position.x - originPos.x,
        best.position.y - originPos.y
      );
      return distCurr < distBest ? curr : best;
    }, candidates[0]);
  };

  let targetConnect: {
    anchorNode: SummitNode;
    isNewNodeSource: boolean;
  } | null = null;

  // RULE 1: Database (connects from Application, Worker, or Repository)
  if (optionId === "database") {
    if (
      selectedNode &&
      (getNodeType(selectedNode) === "application" ||
        getNodeType(selectedNode) === "worker" ||
        getNodeType(selectedNode) === "repository") &&
      !isDisconnected(selectedNode.id, "NEW")
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: false };
    } else {
      const anchor =
        findNearest(
          (n) => getNodeType(n) === "application",
          selectedNode?.position || canvasCenter
        ) ||
        findNearest(
          (n) => getNodeType(n) === "worker",
          selectedNode?.position || canvasCenter
        ) ||
        findNearest(
          (n) => getNodeType(n) === "repository",
          selectedNode?.position || canvasCenter
        );
      if (anchor && !isDisconnected(anchor.id, "NEW")) {
        targetConnect = { anchorNode: anchor, isNewNodeSource: false };
      }
    }
  }

  // RULE 2: Cache (connects from Application, Worker, or Repository)
  else if (optionId === "cache") {
    if (
      selectedNode &&
      (getNodeType(selectedNode) === "application" ||
        getNodeType(selectedNode) === "worker" ||
        getNodeType(selectedNode) === "repository") &&
      !isDisconnected(selectedNode.id, "NEW")
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: false };
    } else {
      const anchor =
        findNearest(
          (n) => getNodeType(n) === "application",
          selectedNode?.position || canvasCenter
        ) ||
        findNearest(
          (n) => getNodeType(n) === "worker",
          selectedNode?.position || canvasCenter
        ) ||
        findNearest(
          (n) => getNodeType(n) === "repository",
          selectedNode?.position || canvasCenter
        );
      if (anchor && !isDisconnected(anchor.id, "NEW")) {
        targetConnect = { anchorNode: anchor, isNewNodeSource: false };
      }
    }
  }

  // RULE 3: Worker (connects from Application, or feeds into Cache)
  else if (optionId === "worker") {
    if (
      selectedNode &&
      getNodeType(selectedNode) === "application" &&
      !isDisconnected(selectedNode.id, "NEW")
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: false };
    } else if (
      selectedNode &&
      (getNodeType(selectedNode) === "cache" ||
        getNodeType(selectedNode) === "database") &&
      !isDisconnected("NEW", selectedNode.id)
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: true };
    } else {
      const appAnchor = findNearest(
        (n) => getNodeType(n) === "application",
        canvasCenter
      );
      if (appAnchor && !isDisconnected(appAnchor.id, "NEW")) {
        targetConnect = { anchorNode: appAnchor, isNewNodeSource: false };
      } else {
        const cacheAnchor = findNearest(
          (n) => getNodeType(n) === "cache",
          canvasCenter
        );
        if (cacheAnchor && !isDisconnected("NEW", cacheAnchor.id)) {
          targetConnect = { anchorNode: cacheAnchor, isNewNodeSource: true };
        }
      }
    }
  }

  // RULE 4: Application (connects from Repository, Docker Image, or API)
  else if (optionId === "application") {
    if (
      selectedNode &&
      (getNodeType(selectedNode) === "repository" ||
        selectedNode.data.subType === "Docker Image") &&
      !isDisconnected(selectedNode.id, "NEW")
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: false };
    } else if (
      selectedNode &&
      getNodeType(selectedNode) === "application" &&
      !isDisconnected(selectedNode.id, "NEW")
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: false };
    } else {
      // Find an existing repository without an attached application
      const unattachedRepo = existingNodes.find(
        (n) =>
          getNodeType(n) === "repository" &&
          !existingEdges.some(
            (e) =>
              e.source === n.id &&
              getNodeType(existingNodes.find((t) => t.id === e.target)!) ===
                "application"
          ) &&
          !isDisconnected(n.id, "NEW")
      );

      if (unattachedRepo) {
        targetConnect = { anchorNode: unattachedRepo, isNewNodeSource: false };
      } else {
        const nearestRepo = findNearest(
          (n) => getNodeType(n) === "repository",
          canvasCenter
        );
        if (nearestRepo && !isDisconnected(nearestRepo.id, "NEW")) {
          targetConnect = { anchorNode: nearestRepo, isNewNodeSource: false };
        }
      }
    }
  }

  // RULE 5: GitHub Repository (connects to Application)
  else if (optionId === "github") {
    if (
      selectedNode &&
      getNodeType(selectedNode) === "application" &&
      !isDisconnected("NEW", selectedNode.id)
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: true };
    } else {
      // Find an existing application without an incoming repository
      const unattachedApp = existingNodes.find(
        (n) =>
          getNodeType(n) === "application" &&
          !existingEdges.some(
            (e) =>
              e.target === n.id &&
              getNodeType(existingNodes.find((s) => s.id === e.source)!) ===
                "repository"
          ) &&
          !isDisconnected("NEW", n.id)
      );

      if (unattachedApp) {
        targetConnect = { anchorNode: unattachedApp, isNewNodeSource: true };
      }
    }
  }

  // RULE 6: Docker Image (connects to Application)
  else if (optionId === "docker") {
    if (
      selectedNode &&
      getNodeType(selectedNode) === "application" &&
      !isDisconnected("NEW", selectedNode.id)
    ) {
      targetConnect = { anchorNode: selectedNode, isNewNodeSource: true };
    } else {
      const app = findNearest(
        (n) => getNodeType(n) === "application",
        canvasCenter
      );
      if (app && !isDisconnected("NEW", app.id)) {
        targetConnect = { anchorNode: app, isNewNodeSource: true };
      }
    }
  }

  // If a connection target was identified:
  if (targetConnect) {
    const { anchorNode, isNewNodeSource } = targetConnect;

    if (!isNewNodeSource) {
      // Anchor is source -> New Node is target (e.g. App -> Database or App -> Cache)
      const isVertical = optionId === "database";
      let candidateX: number;
      let candidateY: number;

      if (isVertical) {
        // Place vertically underneath the anchor node (Railway signature vertical layout)
        candidateX = anchorNode.position.x;
        candidateY = anchorNode.position.y + 190;
      } else {
        const existingChildren = existingEdges.filter(
          (e) => e.source === anchorNode.id
        ).length;
        candidateX = anchorNode.position.x + 360;
        candidateY = anchorNode.position.y + existingChildren * 140;
      }

      const cleanPos = findNonOverlappingPosition(
        { x: candidateX, y: candidateY },
        existingNodes,
        isVertical ? 170 : 140,
        360
      );

      return {
        connection: {
          sourceId: anchorNode.id,
          targetId: "PENDING_NEW_ID",
          sourceHandle: isVertical ? "bottom" : "source",
          targetHandle: isVertical ? "top" : "target",
          isNewNodeSource: false,
        },
        position: cleanPos,
      };
    } else {
      // New Node is source -> Anchor is target (e.g. New Repo -> App)
      const candidateX = anchorNode.position.x - 360;
      const candidateY = anchorNode.position.y;

      const cleanPos = findNonOverlappingPosition(
        { x: candidateX, y: candidateY },
        existingNodes,
        140,
        360
      );

      return {
        connection: {
          sourceId: "PENDING_NEW_ID",
          targetId: anchorNode.id,
          sourceHandle: "source",
          targetHandle: "target",
          isNewNodeSource: true,
        },
        position: cleanPos,
      };
    }
  }

  // If NO meaningful connection exists, place safely without overlapping
  const basePos = { x: canvasCenter.x - 130, y: canvasCenter.y - 50 };
  const cleanPos = findNonOverlappingPosition(basePos, existingNodes);

  return {
    connection: null,
    position: cleanPos,
  };
}

function CanvasContent({
  projectId: initialProjectId = "default",
}: {
  projectId?: string;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const [projectId] = useState<string>(initialProjectId);
  const [projectName, setProjectName] = useState<string>("Untitled Architecture");
  const [environment, setEnvironment] = useState<Environment>("production");
  const [isSaving, setIsSaving] = useState(false);

  // Authentication check
  const { user, isLoading: isAuthLoading, openAuthModal } = useAuth();
  const hasPromptedAuth = useRef(false);

  useEffect(() => {
    if (!isAuthLoading && !user && !hasPromptedAuth.current) {
      hasPromptedAuth.current = true;
      openAuthModal({
        mode: "signin",
        redirectTo: typeof window !== "undefined" ? window.location.pathname : "/dashboard/project/new",
      });
    }
  }, [user, isAuthLoading, openAuthModal]);

  // Core Graph State (starts empty by default!)
  const [nodes, setNodes, onNodesChange] = useNodesState<SummitNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Track user-disconnected pairs so deliberate deletions are never automatically reconnected
  const disconnectedPairsRef = useRef<Set<string>>(new Set());

  // Modals & Panels
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isDeployPaletteOpen, setIsDeployPaletteOpen] = useState(false);
  const [activeChooser, setActiveChooser] = useState<
    "none" | "github" | "application" | "database" | "docker"
  >("none");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");

  // Initial load from LocalStorage
  useEffect(() => {
    const arch = loadProjectArchitecture(projectId);
    setProjectName(arch.name);
    setEnvironment(arch.environment);
    setNodes(arch.nodes);
    setEdges(arch.edges);
  }, [projectId, setNodes, setEdges]);

  // Debounced autosave
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setIsSaving(true);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const nowStr = new Date().toISOString();
      const arch: ProjectArchitecture = {
        id: projectId,
        name: projectName,
        environment,
        nodes,
        edges,
        updatedAt: nowStr,
      };
      saveProjectArchitecture(arch);
      setLastSavedAt(nowStr);
      setIsSaving(false);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [projectId, projectName, environment, nodes, edges]);

  // Validate connections: prevent self-connections & duplicates
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) return false;
      const isDuplicate = edges.some(
        (e) =>
          e.source === connection.source &&
          e.target === connection.target &&
          e.sourceHandle === connection.sourceHandle &&
          e.targetHandle === connection.targetHandle
      );
      return !isDuplicate;
    },
    [edges]
  );

  // Handle Edge connection from source to target handle (manual dragging)
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params)) return;

      const newEdge: Edge = {
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: "default",
        data: {
          isNew: true,
          createdAt: Date.now(),
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("summit:connection-pulse", {
            detail: { sourceId: params.source, targetId: params.target },
          })
        );
      }
    },
    [isValidConnection, setEdges]
  );

  // Handle Edge deletion custom event from edge component
  useEffect(() => {
    const handleEdgeDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      const edgeId = customEvent.detail?.id;
      if (edgeId) {
        setEdges((eds) => {
          const edgeToDelete = eds.find((edge) => edge.id === edgeId);
          if (edgeToDelete) {
            disconnectedPairsRef.current.add(
              `${edgeToDelete.source}->${edgeToDelete.target}`
            );
            disconnectedPairsRef.current.add(
              `${edgeToDelete.target}->${edgeToDelete.source}`
            );
          }
          return eds.filter((edge) => edge.id !== edgeId);
        });
      }
    };
    window.addEventListener("summit:delete-edge", handleEdgeDelete);
    return () =>
      window.removeEventListener("summit:delete-edge", handleEdgeDelete);
  }, [setEdges]);

  // Node selection handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: SummitNode) => {
    setSelectedNodeId(node.id);
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
  }, [setEdges]);

  // Edge selection handler
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: e.id === edge.id,
      }))
    );
    setSelectedNodeId(null);
  }, [setEdges]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
  }, [setEdges]);

  // Update node data from Inspector
  const handleUpdateNode = useCallback(
    (nodeId: string, updatedFields: Partial<SummitNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedFields,
                updatedAt: new Date().toISOString(),
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  // Delete node and its attached edges
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [setNodes, setEdges]
  );

  // Add node from Bottom Floating Selector with Automatic Connection & Smart Placement
  const handleSelectBottomOption = useCallback(
    (optionId: string, customData?: Record<string, unknown>) => {
      let canvasCenter = { x: 300, y: 200 };

      if (reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        canvasCenter = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }

      // Calculate smart position and potential auto-connection
      const { connection, position } = resolveAutoConnectAndPlacement(
        optionId,
        nodes,
        edges,
        selectedNodeId,
        disconnectedPairsRef.current,
        canvasCenter
      );

      const newNode = createNodeByOptionId(optionId, position, customData);
      setNodes((nds) => [...nds, newNode]);
      // Do not auto-select to avoid unexpectedly sliding out the right inspector drawer
      setSelectedNodeId(null);

      if (connection) {
        const sourceId = connection.isNewNodeSource ? newNode.id : connection.sourceId;
        const targetId = connection.isNewNodeSource ? connection.targetId : newNode.id;

        const newEdge: Edge = {
          id: `e_${sourceId}_${targetId}_${Date.now()}`,
          source: sourceId,
          target: targetId,
          sourceHandle: connection.sourceHandle || (connection.isNewNodeSource ? "source" : "source"),
          targetHandle: connection.targetHandle || (connection.isNewNodeSource ? "target" : "target"),
          type: "default",
          data: {
            isNew: true,
            createdAt: Date.now(),
          },
        };

        setEdges((eds) => addEdge(newEdge, eds));

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("summit:connection-pulse", {
              detail: { sourceId, targetId },
            })
          );
        }
      }
    },
    [nodes, edges, selectedNodeId, screenToFlowPosition, setNodes, setEdges]
  );

  // Bottom selector item click: opens choosing dialogs matching the first screen
  const handleBottomBarClick = useCallback(
    (optionId: string) => {
      if (
        optionId === "github" ||
        optionId === "application" ||
        optionId === "database" ||
        optionId === "docker"
      ) {
        setActiveChooser(optionId);
      } else {
        handleSelectBottomOption(optionId);
      }
    },
    [handleSelectBottomOption]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+K / Ctrl+K opens Railway Deploy Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsDeployPaletteOpen((prev) => !prev);
        return;
      }

      // Single 'C' key opens Deploy Palette (when not in input)
      if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsDeployPaletteOpen(true);
        return;
      }

      // Escape deselects and closes panels
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setIsDeployModalOpen(false);
        setIsDeployPaletteOpen(false);
        setActiveChooser("none");
      }

      // Delete or Backspace deletes selected node or selected connection
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedNodeId) {
          e.preventDefault();
          handleDeleteNode(selectedNodeId);
        } else {
          setEdges((eds) => {
            const selectedEdges = eds.filter((edge) => edge.selected);
            if (selectedEdges.length > 0) {
              e.preventDefault();
              selectedEdges.forEach((edge) => {
                disconnectedPairsRef.current.add(`${edge.source}->${edge.target}`);
                disconnectedPairsRef.current.add(`${edge.target}->${edge.source}`);
              });
              return eds.filter((edge) => !edge.selected);
            }
            return eds;
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, handleDeleteNode, setEdges]);

  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div
      ref={reactFlowWrapper}
      data-lenis-prevent
      className="relative w-full h-screen bg-[#0C0B0A] text-[#FAF8F5] flex flex-col overflow-hidden font-sans select-none"
    >
      {/* Slim Top Bar */}
      <CanvasTopBar
        projectName={projectName}
        onRenameProject={setProjectName}
        environment={environment}
        onChangeEnvironment={setEnvironment}
        isSaving={isSaving}
        onDeploy={() => setIsDeployModalOpen(true)}
      />

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 w-full h-full">
        <ReactFlow<SummitNode, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionRadius={32}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineComponent={SummitConnectionLineComponent}
          isValidConnection={isValidConnection}
          elevateNodesOnSelect={true}
          elevateEdgesOnSelect={true}
          snapToGrid={false}
          selectNodesOnDrag={false}
          minZoom={0.2}
          maxZoom={2.2}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          className="bg-[#0C0B0A]"
        >
          {/* Subtle Dotted Grid */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.2}
            color="#20201E"
          />
        </ReactFlow>

        {/* Empty Canvas Railway Hero Prompt */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-4 pointer-events-none select-none animate-in fade-in duration-300">
            <div className="w-full max-w-[420px] bg-[#121113]/90 backdrop-blur-md border border-[#232127] rounded-[16px] p-6 text-center pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
              <div className="w-11 h-11 rounded-[12px] bg-[#1E1925] border border-[#3A2D4A] flex items-center justify-center text-[#CCA7E8] mx-auto mb-3 shadow-[0_0_20px_rgba(204,167,232,0.15)]">
                <div className="grid grid-cols-2 gap-1 w-4 h-4">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#CCA7E8]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#CCA7E8]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#CCA7E8]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-accent-orange" />
                </div>
              </div>
              <h3 className="font-sans text-[18px] font-semibold text-[#FAF8F5] tracking-[-0.02em]">
                New Service
              </h3>
              <p className="font-sans text-[12.5px] text-[#8E8C86] mt-1 mb-4">
                Deploy your application, database, or worker to production effortlessly
              </p>

              <button
                type="button"
                onClick={() => setIsDeployPaletteOpen(true)}
                className="w-full h-10 px-3.5 bg-[#18161D] hover:bg-[#1E1C24] border border-[#2B2932] hover:border-[#4B3B60] rounded-[9px] flex items-center justify-between text-[#7A7873] hover:text-[#FAF8F5] transition-all cursor-pointer text-[13px] group"
              >
                <span className="text-[#8E8C86] group-hover:text-[#FAF8F5] transition-colors">
                  What are we going to deploy today?
                </span>
                <kbd className="px-2 py-0.5 rounded bg-[#111014] border border-[#2A2832] text-[10.5px] font-mono text-[#8E8C86]">
                  ⌘K
                </kbd>
              </button>

              <p className="font-mono text-[11px] text-[#5A5854] mt-3">
                Press <span className="text-[#8E8C86]">C</span> or <span className="text-[#8E8C86]">⌘K</span>, or choose from the dock below
              </p>
            </div>
          </div>
        )}

        {/* Primary Bottom Floating Node Selector */}
        <BottomNodeSelector
          onSelectOption={handleBottomBarClick}
          onOpenDeployPalette={() => setIsDeployPaletteOpen(true)}
        />

        {/* Minimal Floating Zoom Controls (Bottom-Right) */}
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1 bg-[#121211]/90 backdrop-blur-sm border border-[#242422] rounded-[8px] p-1 shadow-xl">
          <button
            type="button"
            onClick={() => zoomIn({ duration: 250 })}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => zoomOut({ duration: 250 })}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-[#262624] mx-0.5" />

          <button
            type="button"
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors"
            title="Fit View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Contextual Configuration Inspector (Opens only when user clicks an existing node) */}
        <ConfigInspector
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* Node Choosing Modals matching the First Screen */}
      <NodeChooserDialogs
        activeChooser={activeChooser}
        onClose={() => setActiveChooser("none")}
        onConfirm={(optionId, customData) => {
          handleSelectBottomOption(optionId, customData);
        }}
      />

      {/* Railway-style Deploy Palette Modal */}
      <DeployPaletteModal
        isOpen={isDeployPaletteOpen}
        onClose={() => setIsDeployPaletteOpen(false)}
        onSelectOption={(optionId, customData) => {
          handleSelectBottomOption(optionId, customData);
        }}
      />

      {/* Honest Deployment Dialog */}
      <DeploymentDialog
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        architecture={{
          id: projectId,
          name: projectName,
          environment,
          nodes,
          edges,
          updatedAt: lastSavedAt,
        }}
      />
    </div>
  );
}

export function InfrastructureCanvas({
  projectId = "default",
}: {
  projectId?: string;
}) {
  return (
    <ReactFlowProvider>
      <CanvasContent projectId={projectId} />
    </ReactFlowProvider>
  );
}
