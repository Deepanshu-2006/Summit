"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
  GitBranch,
  Rocket,
  Square,
} from "lucide-react";
import {
  deployService,
  describeApiError,
  formatRelativeTime,
  isInFlightStatus,
  safeHttpUrl,
  shortSha,
  statusLabel,
  type DeploymentLogEntry,
  type DeploymentSummary,
  type ServiceSummary,
} from "@/lib/platform-api";
import { isAddonType, isBuildlessType, isRepositoryType, orderForDeployAll } from "@/lib/canvas/service-draft";
import { useDeploymentRun } from "./use-deployment-run";

interface DeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  environmentName?: string;
  services: ServiceSummary[];
  accessToken: string | undefined;
  onSignIn: () => void;
  /** Opens the GitHub import flow; `serviceId` is null when the project has no service yet. */
  onConnectRepository: (serviceId: string | null) => void;
  /** Called when a deployment finishes so the canvas can refresh service state. */
  onDeploymentSettled?: () => void;
}

function statusColor(status: string): string {
  if (status === "running" || status === "active") return "bg-[#72B69A]";
  if (status === "failed") return "bg-[#D77D7D]";
  if (status === "cancelled" || status === "superseded") return "bg-[#5A5954]";
  return "bg-[#E5B462] animate-pulse";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#C9C7C2] capitalize">
      <span className={`w-1.5 h-1.5 rounded-full ${statusColor(status)}`} />
      {statusLabel(status)}
    </span>
  );
}

function clock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-GB", { hour12: false });
}

function LogPanel({ logs, isLive }: { logs: DeploymentLogEntry[]; isLive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div
      ref={ref}
      role="log"
      aria-live="off"
      className="h-44 overflow-y-auto rounded-[6px] bg-[#0A0A09] border border-[#1E1E1C] p-2.5 font-mono text-[11px] leading-[1.55] select-text"
    >
      {logs.length === 0 ? (
        <span className="text-[#55534E]">
          {isLive ? "Waiting for build output…" : "No build output recorded."}
        </span>
      ) : (
        logs.map((entry) => (
          <div key={entry.id} className="flex gap-2 whitespace-pre-wrap break-all">
            <span className="text-[#4A4944] shrink-0">{clock(entry.timestamp)}</span>
            <span className={entry.stream === "stderr" ? "text-[#E8B29C]" : "text-[#C9C7C2]"}>
              {entry.message}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function addonEnvName(service: ServiceSummary): string {
  if (service.addon?.url_env) return service.addon.url_env;
  return service.type === "redis" ? "REDIS_URL" : "DATABASE_URL";
}

function ServiceDeployRow({
  service,
  accessToken,
  onConnectRepository,
  onDeploymentSettled,
}: {
  service: ServiceSummary;
  accessToken: string | undefined;
  onConnectRepository: (serviceId: string | null) => void;
  onDeploymentSettled?: () => void;
}) {
  const repoBacked = isRepositoryType(service.type);
  const buildless = isBuildlessType(service.type);
  const addon = isAddonType(service.type);
  const run = useDeploymentRun(accessToken, service.latest_deployment, onDeploymentSettled, {
    streamLogs: !buildless,
  });
  const source = service.source;
  const sourceActive = source?.source_status === "active";
  const canDeploy = repoBacked ? Boolean(source && sourceActive) : true;

  // Prefer the freshly polled detail; fall back to the service's latest deployment.
  const tracking = run.deploymentId !== null;
  const shown: DeploymentSummary | null =
    run.detail ??
    (tracking && run.deploymentId !== service.latest_deployment?.id
      ? null
      : service.latest_deployment);
  const inFlight = shown ? isInFlightStatus(shown.status) && tracking : false;
  const busy = run.isStarting || inFlight;
  const publicUrl = addon || service.type === "worker" ? null : safeHttpUrl(shown?.public_url);

  return (
    <section className="rounded-[8px] border border-[#222220] bg-[#161615] p-3.5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-sans text-[13px] font-semibold text-[#F1F0ED] truncate">
              {service.name}
            </h4>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#77756F]">
              {service.type} · {service.environment_name}
            </span>
          </div>
          {repoBacked && source ? (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[#8E8C86] truncate">
              <span className="truncate">{source.repository_full_name}</span>
              <GitBranch className="w-3 h-3 shrink-0 text-[#5A5954]" />
              <span className="truncate">{source.branch}</span>
            </p>
          ) : repoBacked ? (
            <p className="mt-1 text-[11.5px] text-[#77756F]">No repository connected.</p>
          ) : service.type === "image" ? (
            <div className="mt-1 space-y-0.5 font-mono text-[11px] text-[#8E8C86]">
              <p className="truncate">{service.image?.image ?? "No image set"}</p>
              {service.image?.resolved_image && (
                <p className="truncate text-[#77756F]">{service.image.resolved_image}</p>
              )}
              {service.port ? <p className="text-[#77756F]">port {service.port}</p> : null}
            </div>
          ) : (
            <div className="mt-1 space-y-0.5 text-[11.5px] text-[#8E8C86]">
              <p>
                {service.addon
                  ? `${service.addon.engine} ${service.addon.version}`
                  : service.type === "redis"
                    ? "Redis"
                    : "PostgreSQL"}
              </p>
              <p className="text-[#77756F]">
                Connection injected as {addonEnvName(service)} into services in this environment.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {inFlight && (
            <button
              type="button"
              onClick={run.cancel}
              disabled={run.isCancelling}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[5px] border border-[#3A2A2A] text-[#D77D7D] hover:bg-[#1E1414] disabled:opacity-50 text-[11.5px] font-sans cursor-pointer"
            >
              <Square className="w-3 h-3" />
              {run.isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
          {canDeploy ? (
            <button
              type="button"
              onClick={() => run.start(service.id)}
              disabled={busy || !accessToken}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[5px] bg-[#E58B62] hover:bg-[#EA9670] disabled:opacity-50 disabled:cursor-not-allowed text-[#0B0B0A] text-[12px] font-semibold font-sans cursor-pointer"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
              {run.isStarting ? "Starting…" : inFlight ? "Deploying…" : "Deploy"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onConnectRepository(service.id)}
              className="inline-flex items-center h-7 px-3 rounded-[5px] border border-[#2C2B28] bg-[#1A1A19] hover:bg-[#202020] text-[#F1F0ED] text-[12px] font-sans cursor-pointer"
            >
              {source ? "Reconnect repository" : "Connect repository"}
            </button>
          )}
        </div>
      </div>

      {repoBacked && source && !sourceActive && (
        <p className="text-[11.5px] text-[#E8B29C]">
          This repository connection is {source.source_status}. Reconnect it to deploy.
        </p>
      )}

      {run.error && (
        <p role="alert" className="flex items-start gap-2 rounded-[5px] border border-[#4A2B24] bg-[#1A1412] px-3 py-2 text-[11.5px] text-[#E8B29C]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{run.error}</span>
        </p>
      )}

      {shown && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={shown.status} />
            {shortSha(shown.commit_sha) && (
              <span className="font-mono text-[11px] text-[#8E8C86]">{shortSha(shown.commit_sha)}</span>
            )}
            {shown.branch && (
              <span className="font-mono text-[11px] text-[#77756F]">{shown.branch}</span>
            )}
            <span className="font-mono text-[11px] text-[#55534E]">
              {formatRelativeTime(shown.created_at)}
            </span>
            {!tracking && (
              <button
                type="button"
                onClick={() => run.track(shown.id)}
                className="ml-auto font-mono text-[11px] text-[#77756F] hover:text-[#E58B62] cursor-pointer"
              >
                {buildless ? "View status" : "View logs"}
              </button>
            )}
          </div>

          {(shown.image_ref || publicUrl) && (
            <div className="space-y-1 font-mono text-[11px]">
              {shown.image_ref && (
                <div className="flex gap-2 text-[#8E8C86]">
                  <span className="text-[#55534E] shrink-0">image</span>
                  <span className="break-all select-text">{shown.image_ref}</span>
                </div>
              )}
              {publicUrl && (
                <div className="flex gap-2">
                  <span className="text-[#55534E] shrink-0">url</span>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#E58B62] hover:underline break-all"
                  >
                    {publicUrl}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>
          )}

          {(shown.error_message || (shown.status === "failed" && shown.status_reason)) && (
            <p className="text-[11.5px] text-[#E8B29C] break-words">
              {shown.error_message ?? shown.status_reason}
            </p>
          )}

          {run.detail?.build?.current_stage && inFlight && (
            <p className="font-mono text-[11px] text-[#8E8C86]">
              Build stage: {run.detail.build.current_stage}
            </p>
          )}

          {run.detail && run.detail.events.length > 0 && (
            <ol className="space-y-1 border-l border-[#262522] pl-3">
              {run.detail.events.map((event, index) => (
                <li key={`${event.created_at}-${index}`} className="relative font-mono text-[11px] text-[#8E8C86]">
                  <span className={`absolute -left-[16.5px] top-[5px] w-1.5 h-1.5 rounded-full ${statusColor(event.to_status)}`} />
                  <span className="capitalize text-[#C9C7C2]">{statusLabel(event.to_status)}</span>
                  <span className="text-[#55534E]"> · {clock(event.created_at)}</span>
                  {event.reason && <span className="text-[#77756F]"> — {event.reason}</span>}
                </li>
              ))}
            </ol>
          )}

          {tracking && buildless && run.detail && run.detail.events.length === 0 && (
            <p className="font-mono text-[11px] text-[#8E8C86]">
              {inFlight ? "Waiting for status…" : "No build for this service. Status is shown above."}
            </p>
          )}

          {tracking && !buildless && <LogPanel logs={run.logs} isLive={inFlight} />}
        </div>
      )}
    </section>
  );
}

export function DeploymentDialog({
  isOpen,
  onClose,
  projectName,
  environmentName,
  services,
  accessToken,
  onSignIn,
  onConnectRepository,
  onDeploymentSettled,
}: DeploymentDialogProps) {
  const [isDeployingAll, setIsDeployingAll] = useState(false);
  const [deployAllError, setDeployAllError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const deployAll = async () => {
    if (!accessToken || isDeployingAll) return;
    setIsDeployingAll(true);
    setDeployAllError(null);
    try {
      for (const service of orderForDeployAll(services)) {
        if (isRepositoryType(service.type) && service.source?.source_status !== "active") continue;
        await deployService(accessToken, service.id);
      }
      onDeploymentSettled?.();
    } catch (error) {
      setDeployAllError(describeApiError(error, "Could not deploy every service."));
    } finally {
      setIsDeployingAll(false);
    }
  };

  // Rows only exist while open, so closing the dialog stops all polling.
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deploy-dialog-title"
        className="w-full max-w-[640px] max-h-[88vh] flex flex-col bg-[#111110] border border-[#222220] rounded-[10px] shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[#1E1E1C] shrink-0">
          <div>
            <h3 id="deploy-dialog-title" className="font-sans text-[14px] font-semibold text-[#F2F0EC]">
              Deploy
            </h3>
            <p className="font-mono text-[11px] text-[#77756F] mt-0.5">
              {projectName}
              {environmentName ? ` · ${environmentName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#A09D98] hover:text-[#F2F0EC] p-1 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!accessToken ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-[12.5px] text-[#A09D98]">Sign in to deploy this project.</p>
              <button
                type="button"
                onClick={onSignIn}
                className="h-8 px-3.5 rounded-[5px] bg-[#E58B62] hover:bg-[#EA9670] text-[#0B0B0A] text-[12px] font-semibold cursor-pointer"
              >
                Sign in
              </button>
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-[12.5px] text-[#A09D98]">
                This environment has no services yet. Add one from the dock, then deploy it here.
              </p>
              <button
                type="button"
                onClick={() => onConnectRepository(null)}
                className="h-8 px-3.5 rounded-[5px] bg-[#E58B62] hover:bg-[#EA9670] text-[#0B0B0A] text-[12px] font-semibold cursor-pointer"
              >
                Connect GitHub repository
              </button>
            </div>
          ) : (
            services.map((service) => (
              <ServiceDeployRow
                key={service.id}
                service={service}
                accessToken={accessToken}
                onConnectRepository={onConnectRepository}
                onDeploymentSettled={onDeploymentSettled}
              />
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#1E1E1C] shrink-0 space-y-2">
          {deployAllError && (
            <p role="alert" className="flex items-start gap-2 text-[11.5px] text-[#E8B29C]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{deployAllError}</span>
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            {accessToken && services.length > 0 && (
              <button
                type="button"
                onClick={() => void deployAll()}
                disabled={isDeployingAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#E58B62] hover:bg-[#EA9670] disabled:opacity-50 text-[#0B0B0A] text-[12px] font-semibold font-sans transition-colors cursor-pointer"
              >
                {isDeployingAll && <Loader2 className="w-3 h-3 animate-spin" />}
                {isDeployingAll ? "Deploying…" : "Deploy all"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-[6px] bg-[#202020] hover:bg-[#2A2A2A] text-[#F2F0EC] text-[12px] font-sans transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
