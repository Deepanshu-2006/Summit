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
  ConnectionMode,
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
 * Calculates a clean, non-overlapping canvas position for a newly added node.
 * Strictly avoids automatic connections — all connections are manually established by the user.
 */
function calculateNewNodePosition(
  existingNodes: SummitNode[],
  selectedNodeId: string | null,
  canvasCenter: { x: number; y: number }
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: canvasCenter.x - 135, y: canvasCenter.y - 53 };
  }

  const selectedNode = selectedNodeId
    ? existingNodes.find((n) => n.id === selectedNodeId)
    : null;

  let candidate: { x: number; y: number };
  if (selectedNode) {
    candidate = {
      x: selectedNode.position.x,
      y: selectedNode.position.y + 150,
    };
  } else {
    const lastNode = existingNodes[existingNodes.length - 1];
    candidate = {
      x: lastNode.position.x + 320,
      y: lastNode.position.y,
    };
  }

  return findNonOverlappingPosition(candidate, existingNodes);
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

  // Initial load from LocalStorage with sensible initial framing
  useEffect(() => {
    const arch = loadProjectArchitecture(projectId);
    setProjectName(arch.name);
    setEnvironment(arch.environment);
    setNodes(arch.nodes);
    setEdges(arch.edges);

    // Initial framing only on first open when nodes exist outside standard view
    if (arch.nodes && arch.nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, maxZoom: 1 });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [projectId, setNodes, setEdges, fitView]);

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

  // Validate connections: strictly enforce one single edge between any two nodes
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;

      // Never allow multiple connections between the same two nodes
      const alreadyConnected = edges.some(
        (e) =>
          (e.source === connection.source && e.target === connection.target) ||
          (e.source === connection.target && e.target === connection.source)
      );
      return !alreadyConnected;
    },
    [edges]
  );

  // Handle Edge connection from source to target handle (manual dragging)
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!isValidConnection(params)) return;

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      // Prefer explicitly dragged handles; otherwise choose optimal center handles based on geometric angle
      let sHandle = params.sourceHandle;
      let tHandle = params.targetHandle;

      if (!sHandle || !tHandle) {
        if (sourceNode && targetNode) {
          const dx = targetNode.position.x - sourceNode.position.x;
          const dy = targetNode.position.y - sourceNode.position.y;

          if (Math.abs(dy) > Math.abs(dx) * 0.75) {
            if (dy > 0) {
              sHandle = sHandle || "bottom";
              tHandle = tHandle || "top";
            } else {
              sHandle = sHandle || "top";
              tHandle = tHandle || "bottom";
            }
          } else {
            if (dx > 0) {
              sHandle = sHandle || "source";
              tHandle = tHandle || "target";
            } else {
              sHandle = sHandle || "target";
              tHandle = tHandle || "source";
            }
          }
        }
      }

      const newEdge: Edge = {
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: sHandle,
        targetHandle: tHandle,
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
    [isValidConnection, nodes, setEdges]
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

  // Add node from Bottom Floating Selector (Strictly Manual Connections)
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

      // Calculate clean non-overlapping position
      const position = calculateNewNodePosition(nodes, selectedNodeId, canvasCenter);
      const newNode = createNodeByOptionId(optionId, position, customData);

      // Add standalone node without any auto-connections — all connections are strictly manual
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(null);
    },
    [nodes, selectedNodeId, screenToFlowPosition, setNodes]
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
      className="relative w-full h-screen bg-[#0D0D0D] text-[#F2F0EC] flex flex-col overflow-hidden font-sans select-none"
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
      <div className="relative flex-1 w-full h-full overflow-hidden">
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
          connectionMode={ConnectionMode.Loose}
          connectionRadius={60}
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
          className="bg-[#0D0D0D]"
        >
          {/* Subtle Neutral Gray Dotted Blueprint Grid */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.25}
            color="#242424"
          />
        </ReactFlow>

        {/* Empty Canvas Railway Hero Prompt */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-4 pointer-events-none select-none animate-in fade-in duration-300">
            <div className="w-full max-w-[420px] bg-[#141414] border border-[#2A2A2A] rounded-[16px] p-6 text-center pointer-events-auto shadow-2xl">
              <div className="w-11 h-11 rounded-[12px] bg-[#191919] border border-[#2A2A2A] flex items-center justify-center text-[#E79570] mx-auto mb-3 shadow-md">
                <div className="grid grid-cols-2 gap-1 w-4 h-4">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#A09D98]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#A09D98]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#A09D98]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#E79570]" />
                </div>
              </div>
              <h3 className="font-sans text-[18px] font-semibold text-[#F2F0EC] tracking-[-0.02em]">
                New Service
              </h3>
              <p className="font-sans text-[12.5px] text-[#A09D98] mt-1 mb-4">
                Deploy your application, database, or worker to production effortlessly
              </p>

              <button
                type="button"
                onClick={() => setIsDeployPaletteOpen(true)}
                className="w-full h-10 px-3.5 bg-[#191919] hover:bg-[#202020] border border-[#242424] hover:border-[#2A2A2A] rounded-[9px] flex items-center justify-between text-[#A09D98] hover:text-[#F2F0EC] transition-all cursor-pointer text-[13px] group"
              >
                <span className="text-[#A09D98] group-hover:text-[#F2F0EC] transition-colors">
                  What are we going to deploy today?
                </span>
                <kbd className="px-2 py-0.5 rounded bg-[#141414] border border-[#242424] text-[10.5px] font-mono text-[#77746F]">
                  ⌘K
                </kbd>
              </button>

              <p className="font-mono text-[11px] text-[#77746F] mt-3">
                Press <span className="text-[#A09D98]">C</span> or <span className="text-[#A09D98]">⌘K</span>, or choose from the dock below
              </p>
            </div>
          </div>
        )}

        {/* Floating Node Selector */}
        <BottomNodeSelector
          onSelectOption={handleBottomBarClick}
          onOpenDeployPalette={() => setIsDeployPaletteOpen(true)}
        />

        {/* Minimal Floating Zoom Controls (Bottom-Right Pill Capsule) */}
        <div className="absolute bottom-6 right-6 z-30 flex items-center gap-0.5 bg-[#141414]/95 backdrop-blur-md border border-[#2A2A2A] rounded-full p-1 shadow-lg">
          <button
            type="button"
            onClick={() => zoomIn({ duration: 220 })}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#A09D98] hover:text-[#F2F0EC] hover:bg-[#202020] active:scale-[0.95] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E79570]/60"
            title="Zoom In (⌘+)"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => zoomOut({ duration: 220 })}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#A09D98] hover:text-[#F2F0EC] hover:bg-[#202020] active:scale-[0.95] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E79570]/60"
            title="Zoom Out (⌘-)"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-3.5 bg-[#242424] mx-0.5" />

          <button
            type="button"
            onClick={() => fitView({ padding: 0.25, duration: 350 })}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#A09D98] hover:text-[#F2F0EC] hover:bg-[#202020] active:scale-[0.95] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E79570]/60"
            title="Fit to View (⌘0)"
            aria-label="Fit to view"
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
