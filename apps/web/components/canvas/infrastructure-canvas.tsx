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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

import { SummitNodeComponent } from "./nodes/summit-node";
import { SummitEdgeComponent } from "./edges/summit-edge";
import { CanvasTopBar } from "./top-bar";
import { NodeSelectorDialog } from "./node-selector-dialog";
import { ConfigInspector } from "./config-inspector";
import { DeploymentDialog } from "./deployment-dialog";
import {
  loadProjectArchitecture,
  saveProjectArchitecture,
  createNodeFromTemplate,
} from "@/lib/canvas/initial-graph";
import type {
  SummitNode,
  SummitNodeData,
  Environment,
  ProjectArchitecture,
  ResourceTemplate,
} from "@/lib/canvas/types";

// Registered custom node & edge definitions
const nodeTypes = {
  summitNode: SummitNodeComponent,
};

const edgeTypes = {
  default: SummitEdgeComponent,
};

function CanvasContent({ projectId: initialProjectId = "default" }: { projectId?: string }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const [projectId] = useState<string>(initialProjectId);
  const [projectName, setProjectName] = useState<string>("Untitled Architecture");
  const [environment, setEnvironment] = useState<Environment>("production");
  const [isSaving, setIsSaving] = useState(false);

  // Core Graph State (starts empty by default!)
  const [nodes, setNodes, onNodesChange] = useNodesState<SummitNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modals & Panels
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
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

  // Handle Edge connection from source to target handle
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      // Disallow self-connections
      if (params.source === params.target) return;

      // Disallow duplicate connections
      const exists = edges.some(
        (e) => e.source === params.source && e.target === params.target
      );
      if (exists) return;

      const newEdge: Edge = {
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: "default",
      };

      setEdges((eds) => addEdge(newEdge, eds));
    },
    [edges, setEdges]
  );

  // Handle Edge deletion custom event from edge component
  useEffect(() => {
    const handleEdgeDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      const edgeId = customEvent.detail?.id;
      if (edgeId) {
        setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
      }
    };
    window.addEventListener("summit:delete-edge", handleEdgeDelete);
    return () =>
      window.removeEventListener("summit:delete-edge", handleEdgeDelete);
  }, [setEdges]);

  // Node selection handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: SummitNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

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

  // Add node from Node Selector (placed cleanly in center of viewport)
  const handleAddNodeFromTemplate = useCallback(
    (template: ResourceTemplate) => {
      let position = { x: 300, y: 200 };

      if (reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        // Screen center converted to flow coordinates
        const center = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });

        // Smart stagger if a node is already at this exact position
        const collision = nodes.some(
          (n) => Math.hypot(n.position.x - center.x, n.position.y - center.y) < 60
        );

        position = collision
          ? { x: center.x + (nodes.length % 5) * 35, y: center.y + (nodes.length % 5) * 35 }
          : { x: center.x - 100, y: center.y - 30 };
      }

      const newNode = createNodeFromTemplate(template, position);
      setNodes((nds) => [...nds, newNode]);
      setIsNodeSelectorOpen(false);
      setSelectedNodeId(newNode.id);
    },
    [nodes, screenToFlowPosition, setNodes]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 'A' or '+' opens Node Selector
      if (e.key === "a" || e.key === "A" || e.key === "+") {
        e.preventDefault();
        setIsNodeSelectorOpen(true);
      }

      // Escape deselects and closes panels
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setIsNodeSelectorOpen(false);
        setIsDeployModalOpen(false);
      }

      // Delete or Backspace deletes selected node or edge
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedNodeId) {
          e.preventDefault();
          handleDeleteNode(selectedNodeId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, handleDeleteNode]);

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
        onOpenNodeSelector={() => setIsNodeSelectorOpen(true)}
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
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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

        {/* Empty Canvas State: "Start with a node" */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10 animate-in fade-in duration-200">
            <p className="text-[14px] font-sans text-[#70706C] tracking-[-0.01em]">
              Start with a node
            </p>
            <button
              type="button"
              onClick={() => setIsNodeSelectorOpen(true)}
              className="mt-3.5 pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#161615] hover:bg-[#1E1E1C] border border-[#282826] hover:border-[#3E3E3B] text-[12.5px] font-sans text-[#FAF8F5] transition-all shadow-lg group cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-accent-orange group-hover:scale-110 transition-transform" />
              <span>+ Add node</span>
            </button>
          </div>
        )}

        {/* Floating Minimal Controls (Bottom-Left) */}
        <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1 bg-[#121211]/90 backdrop-blur-sm border border-[#242422] rounded-[8px] p-1 shadow-xl">
          <button
            type="button"
            onClick={() => setIsNodeSelectorOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] text-[12px] font-sans text-[#D1CFCA] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors"
            title="Add Node (A)"
          >
            <Plus className="w-3.5 h-3.5 text-accent-orange" />
            <span className="hidden sm:inline">Add node</span>
          </button>

          <div className="w-px h-4 bg-[#262624] mx-0.5" />

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

          <button
            type="button"
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[#8E8C86] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors"
            title="Fit to View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Contextual Configuration Inspector */}
        <ConfigInspector
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
        />
      </div>

      {/* Floating Node Selector Dialog */}
      <NodeSelectorDialog
        isOpen={isNodeSelectorOpen}
        onClose={() => setIsNodeSelectorOpen(false)}
        onSelect={handleAddNodeFromTemplate}
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

export function InfrastructureCanvas({ projectId = "default" }: { projectId?: string }) {
  return (
    <ReactFlowProvider>
      <CanvasContent projectId={projectId} />
    </ReactFlowProvider>
  );
}
