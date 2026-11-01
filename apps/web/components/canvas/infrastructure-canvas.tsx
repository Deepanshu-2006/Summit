"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Check,
  X,
  AlertCircle,
} from "lucide-react";

import { SummitNodeComponent } from "./nodes/summit-node";
import { SummitEdgeComponent } from "./edges/summit-edge";
import { SummitConnectionLineComponent } from "./edges/summit-connection-line";
import { CanvasTopBar } from "./top-bar";
import { BottomNodeSelector } from "./bottom-node-selector";
import { DeployPaletteModal } from "./deploy-palette";
import { NodeChooserDialogs } from "./node-chooser-dialogs";
import type { EnsureServiceTarget } from "./github-import-dialog";
import { ConfigInspector } from "./config-inspector";
import { DeploymentDialog } from "./deployment-dialog";
import { DeleteServiceDialog } from "./delete-service-dialog";
import { useAuth } from "@/components/auth/auth-context";
import {
  loadProjectArchitecture,
  saveProjectArchitecture,
} from "@/lib/canvas/initial-graph";
import { mergeServiceNodes, refreshServiceNodes, serviceNodeId } from "@/lib/canvas/service-nodes";
import {
  environmentStorageKey,
  pickEnvironmentId,
  servicesInEnvironment,
} from "@/lib/canvas/environments";
import { draftFromChooser, isAddonType } from "@/lib/canvas/service-draft";
import {
  createEnvironment,
  createService,
  deleteService,
  describeApiError,
  getProject,
  renameProject,
  type ProjectDetail,
  type ServiceSummary,
} from "@/lib/platform-api";
import type {
  SummitNode,
  SummitNodeData,
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
  const pos = { ...candidate };
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

type ProjectLoadState = "loading" | "ready" | "error";

function CanvasContent({
  projectId: initialProjectId = "default",
  autoOpenDeploy = false,
}: {
  projectId?: string;
  autoOpenDeploy?: boolean;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  const [projectId] = useState<string>(initialProjectId);
  const [projectName, setProjectName] = useState<string>("Untitled Architecture");
  // Real environment selection (backend environment id). Production by default.
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Authentication context
  const { session, isLoading: isAuthLoading, openAuthModal } = useAuth();
  const accessToken = session?.access_token;

  // Backend project (real services). Loaded after auth resolves.
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loadState, setLoadState] = useState<ProjectLoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const openDeployOnReadyRef = useRef(autoOpenDeploy);
  // Service the GitHub dialog should connect to; null = pick/create one.
  const [githubTargetServiceId, setGithubTargetServiceId] = useState<string | null>(null);

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  // Subtle Toast Notification listener
  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      if (detail?.message) {
        showToast(detail.message);
      }
    };
    window.addEventListener("summit:toast", handleToast);
    return () => {
      window.removeEventListener("summit:toast", handleToast);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [showToast]);

  // Stored layout: positions and UI-only nodes. Real services are merged in
  // below once the backend project has loaded.
  useEffect(() => {
    const arch = loadProjectArchitecture(projectId);
    let fitTimer: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      setProjectName(arch.name);
      setNodes(arch.nodes);
      setEdges(arch.edges);

      if (arch.nodes.length > 0) {
        fitTimer = window.setTimeout(() => {
          fitView({ padding: 0.25, maxZoom: 1 });
        }, 80);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (fitTimer !== undefined) window.clearTimeout(fitTimer);
    };
  }, [projectId, setNodes, setEdges, fitView]);

  // Backend project: real services are the source of truth for service nodes.
  useEffect(() => {
    if (isAuthLoading || !accessToken) return;
    let cancelled = false;
    getProject(accessToken, projectId)
      .then((detail) => {
        if (cancelled) return;
        setProject(detail);
        setProjectName(detail.name);
        const fromUrl = new URLSearchParams(window.location.search).get("env");
        const fromStorage = window.localStorage.getItem(environmentStorageKey(projectId));
        setSelectedEnvironmentId(pickEnvironmentId(detail.environments, fromUrl ?? fromStorage));
        setNodes((current) => mergeServiceNodes(current, detail.services));
        setLoadError(null);
        setLoadState("ready");
        if (openDeployOnReadyRef.current) {
          openDeployOnReadyRef.current = false;
          setIsDeployModalOpen(true);
        }
        window.setTimeout(() => fitView({ padding: 0.25, maxZoom: 1, duration: 250 }), 80);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(describeApiError(error, "Could not load this project."));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isAuthLoading, projectId, reloadKey, setNodes, fitView]);

  const viewState: ProjectLoadState | "signed-out" = isAuthLoading
    ? "loading"
    : !accessToken
    ? "signed-out"
    : loadState;

  const handleRetryLoad = useCallback(() => {
    setLoadState("loading");
    setReloadKey((key) => key + 1);
  }, []);

  // Re-read services (after connecting a repo or finishing a deployment).
  const refreshProject = useCallback(async (): Promise<ProjectDetail | null> => {
    if (!accessToken) return null;
    try {
      const detail = await getProject(accessToken, projectId);
      setProject(detail);
      setNodes((current) => refreshServiceNodes(current, detail.services));
      return detail;
    } catch (error) {
      showToast(describeApiError(error, "Could not refresh the project."));
      return null;
    }
  }, [accessToken, projectId, setNodes, showToast]);

  const environments = useMemo(() => project?.environments ?? [], [project]);
  const selectedEnvironment =
    environments.find((environment) => environment.id === selectedEnvironmentId) ?? null;
  const environmentServices = useMemo(
    () => servicesInEnvironment(project?.services ?? [], selectedEnvironmentId),
    [project, selectedEnvironmentId],
  );

  const handleChangeEnvironment = useCallback(
    (environmentId: string) => {
      setSelectedEnvironmentId(environmentId);
      setSelectedNodeId(null);
      window.localStorage.setItem(environmentStorageKey(projectId), environmentId);
      const url = new URL(window.location.href);
      url.searchParams.set("env", environmentId);
      window.history.replaceState(window.history.state, "", url);
    },
    [projectId],
  );

  const handleCreateEnvironment = useCallback(
    async (input: { name: string; type: "staging" | "preview" }) => {
      if (!accessToken) throw new Error("Sign in to create an environment.");
      // Errors propagate to the top bar form, which shows them inline.
      const created = await createEnvironment(accessToken, projectId, input);
      await refreshProject();
      handleChangeEnvironment(created.id);
      showToast(`Environment "${created.name}" created`);
    },
    [accessToken, projectId, refreshProject, handleChangeEnvironment, showToast],
  );

  // Service nodes outside the selected environment stay in state (so their
  // positions persist) but are hidden on the canvas.
  const visibleNodes = useMemo(() => {
    const visibleServiceIds = new Set(environmentServices.map((service) => service.id));
    return nodes.map((node) => {
      const serviceId = node.data.serviceId;
      const hidden = Boolean(serviceId) && !visibleServiceIds.has(serviceId as string);
      return node.hidden === hidden ? node : { ...node, hidden };
    });
  }, [nodes, environmentServices]);

  const handleRenameProject = useCallback(
    async (name: string) => {
      const previous = projectName;
      setProjectName(name);
      if (!accessToken || loadState !== "ready") return;
      try {
        const updated = await renameProject(accessToken, projectId, name);
        setProjectName(updated.name);
      } catch (error) {
        setProjectName(previous);
        showToast(describeApiError(error, "Could not rename the project."));
      }
    },
    [accessToken, loadState, projectId, projectName, showToast],
  );

  // Debounced autosave of layout + UI-only nodes. Never runs before the
  // backend project has loaded, so a failed load can't overwrite stored positions.
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedLayoutRef = useRef(false);

  useEffect(() => {
    if (loadState !== "ready") return;
    // The first ready render only reflects the merge of stored + backend data.
    if (!hasLoadedLayoutRef.current) {
      hasLoadedLayoutRef.current = true;
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
        environment: "production",
        nodes,
        edges,
        updatedAt: nowStr,
      };
      saveProjectArchitecture(arch);
      setIsSaving(false);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [loadState, projectId, projectName, nodes, edges]);

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

  // Real service pending deletion (confirmed in DeleteServiceDialog).
  const [deleteTarget, setDeleteTarget] = useState<ServiceSummary | null>(null);
  const [isDeletingService, setIsDeletingService] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const removeNodeLocally = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },
    [setNodes, setEdges],
  );

  // Delete node and its attached edges. Service nodes go through the API.
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const serviceId = nodes.find((n) => n.id === nodeId)?.data.serviceId;
      if (serviceId) {
        const service = project?.services.find((item) => item.id === serviceId) ?? null;
        if (!service) {
          showToast("This service is no longer available. Refreshing…");
          void refreshProject();
          return;
        }
        setDeleteError(null);
        setDeleteTarget(service);
        return;
      }
      removeNodeLocally(nodeId);
    },
    [nodes, project, removeNodeLocally, refreshProject, showToast]
  );

  const handleConfirmDeleteService = useCallback(async () => {
    if (!deleteTarget || !accessToken) return;
    setIsDeletingService(true);
    setDeleteError(null);
    try {
      await deleteService(accessToken, deleteTarget.id);
      const nodeId = nodes.find((n) => n.data.serviceId === deleteTarget.id)?.id;
      if (nodeId) removeNodeLocally(nodeId);
      showToast(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      await refreshProject();
    } catch (error) {
      setDeleteError(describeApiError(error, "Could not delete this service."));
    } finally {
      setIsDeletingService(false);
    }
  }, [deleteTarget, accessToken, nodes, removeNodeLocally, refreshProject, showToast]);

  const openGitHubChooser = useCallback((serviceId: string | null) => {
    setGithubTargetServiceId(serviceId);
    setIsDeployModalOpen(false);
    setActiveChooser("github");
  }, []);

  // Every dock / palette / chooser option creates a real backend service in the
  // selected environment; the node then renders from the API.
  const handleSelectBottomOption = useCallback(
    async (optionId: string, customData?: Record<string, unknown>) => {
      if (!accessToken) {
        openAuthModal({ mode: "signin" });
        return;
      }
      if (loadState !== "ready") {
        showToast("Wait for the project to load before adding services.");
        return;
      }

      let draft = draftFromChooser(optionId, customData);
      if (draft === null) {
        // Application templates are repository-built web services.
        const label = typeof customData?.label === "string" ? customData.label : "";
        if (!label) {
          openGitHubChooser(null);
          return;
        }
        const port = typeof customData?.port === "number" ? customData.port : undefined;
        draft = { ok: true, draft: { name: label, type: "web", port, connectRepository: true } };
      }
      if (!draft.ok) {
        showToast(draft.message);
        return;
      }

      let canvasCenter = { x: 300, y: 200 };
      if (reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        canvasCenter = screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
      const position = calculateNewNodePosition(
        visibleNodes.filter((node) => !node.hidden),
        selectedNodeId,
        canvasCenter,
      );

      try {
        const created = await createService(accessToken, projectId, {
          name: draft.draft.name,
          type: draft.draft.type,
          image: draft.draft.image,
          port: draft.draft.port,
          environmentId: selectedEnvironmentId ?? undefined,
        });
        // Seed the node at the chosen position; refresh fills in backend data.
        setNodes((current) =>
          mergeServiceNodes(
            [...current, { id: serviceNodeId(created.id), type: "summitNode", position, data: { serviceId: created.id } as SummitNodeData }],
            [...(project?.services ?? []).filter((service) => service.id !== created.id), created],
          ),
        );
        setSelectedNodeId(null);
        await refreshProject();
        showToast(
          isAddonType(created.type)
            ? `${created.name} created — open Deploy to provision it`
            : `${created.name} created`,
        );
        if (draft.draft.connectRepository) openGitHubChooser(created.id);
      } catch (error) {
        showToast(describeApiError(error, "Could not create the service."));
      }
    },
    [
      accessToken,
      loadState,
      openAuthModal,
      openGitHubChooser,
      projectId,
      project,
      refreshProject,
      screenToFlowPosition,
      selectedEnvironmentId,
      selectedNodeId,
      setNodes,
      showToast,
      visibleNodes,
    ]
  );

  const closeChooser = useCallback(() => {
    setActiveChooser("none");
    setGithubTargetServiceId(null);
  }, []);

  // Connect a repository to THIS project: reuse the chosen service, else the
  // first web service without a source, else create a web service named after
  // the repository.
  const ensureProjectService: EnsureServiceTarget = async (repository) => {
    if (!accessToken) throw new Error("Sign in to connect a repository.");
    if (githubTargetServiceId) return { serviceId: githubTargetServiceId };
    const fresh = await getProject(accessToken, projectId);
    const unconnected = servicesInEnvironment(fresh.services, selectedEnvironmentId).find(
      (service) => service.type === "web" && !service.source,
    );
    if (unconnected) return { serviceId: unconnected.id };
    const created = await createService(accessToken, projectId, {
      name: repository.name,
      type: "web",
      environmentId: selectedEnvironmentId ?? undefined,
    });
    return { serviceId: created.id };
  };

  const handleChooserConfirm = (optionId: string, customData?: Record<string, unknown>) => {
    if (optionId === "github") {
      // The service node comes from the API, not from the dialog payload.
      void refreshProject().then(() => {
        window.setTimeout(() => fitView({ padding: 0.25, maxZoom: 1, duration: 250 }), 80);
      });
      return;
    }
    void handleSelectBottomOption(optionId, customData);
  };

  // Bottom selector item click: opens choosing dialogs matching the first screen
  const handleBottomBarClick = useCallback(
    (optionId: string) => {
      if (
        optionId === "github" ||
        optionId === "application" ||
        optionId === "database" ||
        optionId === "docker"
      ) {
        if (optionId === "github") setGithubTargetServiceId(null);
        setActiveChooser(optionId);
      } else {
        void handleSelectBottomOption(optionId);
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
        onRenameProject={handleRenameProject}
        environments={environments}
        selectedEnvironmentId={selectedEnvironmentId}
        onChangeEnvironment={handleChangeEnvironment}
        onCreateEnvironment={handleCreateEnvironment}
        isSaving={isSaving}
        onDeploy={() => setIsDeployModalOpen(true)}
      />

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-[#080807]">
        <ReactFlow<SummitNode, Edge>
          nodes={visibleNodes}
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
          className="bg-[#080807]"
          style={{
            background:
              "radial-gradient(ellipse 75% 60% at 50% 48%, rgba(229, 139, 98, 0.045) 0%, rgba(20, 20, 19, 0.65) 45%, #080807 100%)",
          }}
        >
          {/* Crisp, Tactile Dot Matrix Blueprint Coordinates */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={2.5}
            color="rgba(240, 238, 233, 0.22)"
          />
        </ReactFlow>

        {/* Empty Canvas Railway Hero Prompt */}
        {environmentServices.length === 0 && visibleNodes.every((node) => node.hidden) && viewState === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center z-10 p-4 pointer-events-none select-none animate-in fade-in duration-300">
            <div className="w-full max-w-[420px] bg-[#111110] border border-[#222220] rounded-[14px] p-6 text-center pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
              <div className="w-9 h-9 rounded-[8px] bg-[#181817] border border-[#262522] flex items-center justify-center text-[#E58B62] mx-auto mb-3 shadow-inner">
                <div className="grid grid-cols-2 gap-1 w-3.5 h-3.5">
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#A09E98]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#A09E98]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#A09E98]" />
                  <span className="w-1.5 h-1.5 rounded-sm bg-[#E58B62]" />
                </div>
              </div>
              <h3 className="font-sans text-[18px] font-semibold text-[#F1F0ED] tracking-[-0.02em]">
                New Service
              </h3>
              <p className="font-sans text-[12.5px] text-[#77756F] mt-1 mb-4">
                Deploy your application, database, or worker to production effortlessly
              </p>

              <button
                type="button"
                onClick={() => setIsDeployPaletteOpen(true)}
                className="w-full h-10 px-3.5 bg-[#161615] hover:bg-[#181817] border border-[#222220] hover:border-[#2C2B28] rounded-[8px] flex items-center justify-between text-[#77756F] hover:text-[#F1F0ED] transition-all cursor-pointer text-[12.5px] group"
              >
                <span className="text-[#77756F] group-hover:text-[#F1F0ED] transition-colors">
                  What are we going to deploy today?
                </span>
                <kbd className="px-2 py-0.5 rounded bg-[#121211] border border-[#222220] text-[10.5px] font-mono text-[#77756F]">
                  ⌘K
                </kbd>
              </button>

              <p className="font-mono text-[11px] text-[#77756F] mt-3">
                Press <span className="text-[#A09E98]">C</span> or <span className="text-[#A09E98]">⌘K</span>, or choose from the dock below
              </p>
            </div>
          </div>
        )}

        {/* Backend status banner */}
        {viewState !== "ready" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-[8px] bg-[#141413]/95 border border-[#2A2A2A] text-[12px] font-sans text-[#C9C7C2] shadow-[0_8px_24px_rgba(0,0,0,0.6)] max-w-[min(560px,calc(100vw-32px))]">
            {viewState === "loading" && <span role="status">Loading project…</span>}
            {viewState === "signed-out" && (
              <>
                <span>Sign in to load this project&apos;s services.</span>
                <button
                  type="button"
                  onClick={() => openAuthModal({ mode: "signin" })}
                  className="shrink-0 px-2.5 py-1 rounded-[5px] bg-[#E58B62] hover:bg-[#EA9670] text-[#0B0B0A] text-[11.5px] font-semibold cursor-pointer"
                >
                  Sign in
                </button>
              </>
            )}
            {viewState === "error" && (
              <>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#D77D7D]" />
                <span role="alert" className="text-[#E8B29C]">{loadError}</span>
                <button
                  type="button"
                  onClick={handleRetryLoad}
                  className="shrink-0 px-2.5 py-1 rounded-[5px] border border-[#2C2B28] hover:bg-[#1A1A19] text-[11.5px] cursor-pointer"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        )}

        {/* Floating Node Selector */}
        <BottomNodeSelector
          onSelectOption={handleBottomBarClick}
          onOpenDeployPalette={() => setIsDeployPaletteOpen(true)}
        />

        {/* Minimal Floating Zoom Controls (Bottom-Right Pill Capsule) */}
        <div
          className={`absolute bottom-6 transition-all duration-200 ease-out z-30 flex items-center gap-0.5 bg-[#141414]/95 backdrop-blur-md border border-[#2A2A2A] rounded-full p-1 shadow-lg ${
            selectedNode ? "right-[360px]" : "right-6"
          }`}
        >
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
          onDeleteService={(node) => handleDeleteNode(node.id)}
          onConnectRepository={(serviceId) => openGitHubChooser(serviceId)}
        />
      </div>

      {/* Refined Top-Center Toast Pill (Auto-Dismissing) */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141414]/90 border border-[#2A2A2A] shadow-[0_8px_24px_rgba(0,0,0,0.6)] text-[12px] font-sans text-[#F2F0EC] backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 select-none">
          <Check className="w-3 h-3 text-[#72B69A] shrink-0" />
          <span className="font-medium tracking-[-0.01em]">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#77746F] hover:text-[#F2F0EC] ml-0.5 p-0.5 rounded cursor-pointer transition-colors"
            title="Dismiss"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* Node Choosing Modals matching the First Screen */}
      <NodeChooserDialogs
        activeChooser={activeChooser}
        onClose={closeChooser}
        onConfirm={handleChooserConfirm}
        onShowToast={showToast}
        ensureGitHubService={ensureProjectService}
        githubTargetDescription={
          githubTargetServiceId
            ? "Connects this repository to the selected service."
            : "Connects this repository to a web service in this project (one is created if needed)."
        }
      />

      {/* Railway-style Deploy Palette Modal */}
      {isDeployPaletteOpen && (
      <DeployPaletteModal
        isOpen={isDeployPaletteOpen}
        onClose={() => setIsDeployPaletteOpen(false)}
        onSelectOption={(optionId, customData) => {
          if (optionId === "github") openGitHubChooser(null);
          else void handleSelectBottomOption(optionId, customData);
        }}
      />
      )}

      {/* Real deployment dialog: deploys connected services and streams logs */}
      <DeploymentDialog
        isOpen={isDeployModalOpen}
        onClose={() => {
          setIsDeployModalOpen(false);
          void refreshProject();
        }}
        projectName={projectName}
        environmentName={selectedEnvironment?.name}
        services={environmentServices}
        accessToken={accessToken}
        onSignIn={() => openAuthModal({ mode: "signin" })}
        onConnectRepository={openGitHubChooser}
        onDeploymentSettled={() => void refreshProject()}
      />

      <DeleteServiceDialog
        isOpen={deleteTarget !== null}
        serviceName={deleteTarget?.name ?? ""}
        deletesData={isAddonType(deleteTarget?.type)}
        isDeleting={isDeletingService}
        error={deleteError}
        onClose={() => {
          if (!isDeletingService) setDeleteTarget(null);
        }}
        onConfirm={() => void handleConfirmDeleteService()}
      />
    </div>
  );
}

export function InfrastructureCanvas({
  projectId = "default",
  autoOpenDeploy = false,
}: {
  projectId?: string;
  autoOpenDeploy?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <CanvasContent projectId={projectId} autoOpenDeploy={autoOpenDeploy} />
    </ReactFlowProvider>
  );
}
