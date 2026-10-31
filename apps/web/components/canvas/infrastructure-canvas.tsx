"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

import { SummitNodeComponent } from "./nodes/summit-node";
import { SummitEdgeComponent } from "./edges/summit-edge";
import { CanvasTopBar } from "./top-bar";
import { CanvasToolbar } from "./toolbar";
import { ConfigPanel } from "./config-panel";
import { DeploymentModal } from "./deployment-modal";
import {
  loadProjectArchitecture,
  saveProjectArchitecture,
  createNodeFromTemplate,
  exportProjectAsJson,
  importProjectFromJson,
  INITIAL_NODES,
  INITIAL_EDGES,
  type NodeTemplate,
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

function CanvasContent() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const [projectId, setProjectId] = useState<string>("default");
  const [projectName, setProjectName] = useState<string>("Meridian Studio");
  const [environment, setEnvironment] = useState<Environment>("production");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Core ReactFlow State
  const [nodes, setNodes, onNodesChange] = useNodesState<SummitNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Deployment Modal State
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  // Initial load from LocalStorage
  useEffect(() => {
    const arch = loadProjectArchitecture(projectId);
    setProjectName(arch.name);
    setEnvironment(arch.environment);
    setNodes(arch.nodes);
    setEdges(arch.edges);

    // Initial smooth fit to viewport
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 600 });
    }, 150);
  }, [projectId, setNodes, setEdges, fitView]);

  // Autosave on modifications
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (nodes.length === 0) return;

    setHasUnsavedChanges(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const arch: ProjectArchitecture = {
        id: projectId,
        name: projectName,
        environment,
        nodes,
        edges,
        updatedAt: new Date().toISOString(),
      };
      saveProjectArchitecture(arch);
      setHasUnsavedChanges(false);
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, projectName, environment, projectId]);

  // Edge deletion custom event listener
  useEffect(() => {
    const handleDeleteEdge = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id) {
        setEdges((eds) => eds.filter((edge) => edge.id !== customEvent.detail.id));
      }
    };

    window.addEventListener("summit:delete-edge", handleDeleteEdge);
    return () => window.removeEventListener("summit:delete-edge", handleDeleteEdge);
  }, [setEdges]);

  // Connection validation: prevent self-connections and duplicate edges
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) return false;
      const exists = edges.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      return !exists;
    },
    [edges]
  );

  // Connect handles
  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#D88762", strokeWidth: 1.8 },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Node selection handler
  const onNodeClick = useCallback((_event: React.MouseEvent, node: SummitNode) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Adding a node from template (via toolbar click or drag-and-drop)
  const handleAddNode = useCallback(
    (template: NodeTemplate, dropPosition?: { x: number; y: number }) => {
      let position = dropPosition;

      if (!position) {
        // Place near the center of the canvas
        const offsetX = 320 + Math.random() * 80;
        const offsetY = 200 + Math.random() * 80;
        position = { x: offsetX, y: offsetY };
      }

      const newNode = createNodeFromTemplate(template, position);
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [setNodes]
  );

  // Drag and drop support from toolbar onto canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const rawTemplate = event.dataTransfer.getData("application/summit-template");
      if (!rawTemplate) return;

      try {
        const template = JSON.parse(rawTemplate) as NodeTemplate;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        handleAddNode(template, position);
      } catch (err) {
        console.error("Failed to parse dropped template:", err);
      }
    },
    [screenToFlowPosition, handleAddNode]
  );

  // Node modifications
  const handleUpdateNodeData = useCallback(
    (nodeId: string, updatedData: Partial<SummitNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ...updatedData,
                updatedAt: new Date().toISOString(),
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [setNodes, setEdges, selectedNodeId]
  );

  const handleDuplicateNode = useCallback(
    (sourceNode: SummitNode) => {
      const randomSuffix = Math.random().toString(36).slice(2, 6);
      const newId = `node_${sourceNode.data.serviceType}_${randomSuffix}`;
      const duplicatedNode: SummitNode = {
        ...sourceNode,
        id: newId,
        position: {
          x: sourceNode.position.x + 40,
          y: sourceNode.position.y + 40,
        },
        data: {
          ...sourceNode.data,
          label: `${sourceNode.data.label}-copy`,
          updatedAt: new Date().toISOString(),
        },
      };

      setNodes((nds) => [...nds, duplicatedNode]);
      setSelectedNodeId(newId);
    },
    [setNodes]
  );

  // Deployment action
  const handleDeploy = useCallback(() => {
    setIsDeployModalOpen(true);
    setIsDeploying(true);

    // Set nodes to building state during deploy
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: n.data.serviceType === "repository" ? "live" : "building",
        },
      }))
    );
  }, [setNodes]);

  const handleCompleteDeployment = useCallback(() => {
    setIsDeploying(false);
    // Transition nodes to live
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: "live",
          metrics: {
            ...n.data.metrics,
            cpuPct: Math.floor(8 + Math.random() * 15),
            memoryMb: Math.floor(64 + Math.random() * 200),
            requestsPerSec: Math.floor(120 + Math.random() * 400),
          },
        },
      }))
    );
  }, [setNodes]);

  // Project Actions (Reset, Clear, Export, Import)
  const handleResetGraph = useCallback(() => {
    if (confirm("Reset canvas to the Meridian Platform starter architecture?")) {
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
      setSelectedNodeId(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    }
  }, [setNodes, setEdges, fitView]);

  const handleClearGraph = useCallback(() => {
    if (confirm("Clear all nodes and connections from the canvas?")) {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId(null);
    }
  }, [setNodes, setEdges]);

  const handleExportGraph = useCallback(() => {
    const arch: ProjectArchitecture = {
      id: projectId,
      name: projectName,
      environment,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };
    const jsonStr = exportProjectAsJson(arch);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-architecture.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projectId, projectName, environment, nodes, edges]);

  const handleImportGraph = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const content = re.target?.result as string;
        const imported = importProjectFromJson(content);
        if (imported) {
          setProjectName(imported.name);
          setEnvironment(imported.environment);
          setNodes(imported.nodes);
          setEdges(imported.edges);
          setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 150);
        } else {
          alert("Invalid architecture JSON format.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, fitView]);

  // Keyboard Shortcuts (⌘D to Deploy, Delete to remove selected node)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        handleDeploy();
      }
      if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeploy]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div
      data-lenis-prevent
      className="w-screen h-screen flex flex-col bg-[#111111] text-[#F5F5F3] overflow-hidden select-none"
    >
      {/* ---------------- Top Bar ---------------- */}
      <CanvasTopBar
        projectName={projectName}
        onRenameProject={setProjectName}
        environment={environment}
        onChangeEnvironment={setEnvironment}
        isDeploying={isDeploying}
        onDeploy={handleDeploy}
        hasUnsavedChanges={hasUnsavedChanges}
        onResetGraph={handleResetGraph}
        onClearGraph={handleClearGraph}
        onExportGraph={handleExportGraph}
        onImportGraph={handleImportGraph}
      />

      {/* ---------------- Main Canvas Workspace ---------------- */}
      <div ref={reactFlowWrapper} className="flex-1 w-full h-full relative">
        {/* Left Resource Toolbar */}
        <CanvasToolbar onAddNode={handleAddNode} />

        {/* Right Node Configuration Panel */}
        <ConfigPanel
          selectedNode={selectedNode}
          onUpdateNodeData={handleUpdateNodeData}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={handleDuplicateNode}
          onClose={() => setSelectedNodeId(null)}
          allNodes={nodes}
        />

        {/* ReactFlow Interactive Graph */}
        <ReactFlow<SummitNode, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onDragOver={onDragOver}
          onDrop={onDrop}
          minZoom={0.25}
          maxZoom={2.0}
          defaultViewport={{ x: 40, y: 40, zoom: 0.95 }}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode={["Meta", "Ctrl"]}
          proOptions={{ hideAttribution: true }}
          className="bg-[#0E0E0D]"
        >
          {/* Subtle Dotted Alpine Grid */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.2}
            color="#222220"
          />

          {/* Floating Canvas Controls */}
          <Controls
            showInteractive={false}
            className="!left-4 !bottom-4 !bg-[#161614] !border !border-[#2B2B28] !rounded-[8px] !shadow-2xl !p-1 [&>button]:!bg-transparent [&>button]:!border-none [&>button]:!text-[#A0A09C] [&>button:hover]:!text-[#FAF8F5] [&>button:hover]:!bg-[#22221F] [&>button]:!rounded-[4px] [&>button]:!transition-colors"
          />

          {/* Compact Dark MiniMap */}
          <MiniMap
            zoomable
            pannable
            nodeColor={(n) => {
              const node = n as unknown as SummitNode;
              if (node.data?.serviceType === "database") return "#83B69A";
              if (node.data?.serviceType === "repository") return "#D88762";
              return "#3A3A36";
            }}
            maskColor="rgba(14, 14, 13, 0.85)"
            className="!right-4 !bottom-4 !bg-[#141413] !border !border-[#262624] !rounded-[8px] !shadow-xl !overflow-hidden hidden sm:block"
            style={{ width: 140, height: 95 }}
          />
        </ReactFlow>
      </div>

      {/* ---------------- Deployment Simulation Drawer / Modal ---------------- */}
      <DeploymentModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        nodes={nodes}
        onCompleteDeployment={handleCompleteDeployment}
      />
    </div>
  );
}

export function InfrastructureCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
}
