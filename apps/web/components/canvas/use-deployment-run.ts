"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelDeployment,
  deployService,
  describeApiError,
  getDeployment,
  getDeploymentLogs,
  isInFlightStatus,
  isSettledStatus,
  newIdempotencyKey,
  type DeploymentDetail,
  type DeploymentLogEntry,
  type DeploymentSummary,
} from "@/lib/platform-api";

const POLL_INTERVAL_MS = 2000;
const LOG_PAGE_LIMIT = 500;
const MAX_LOG_PAGES_PER_TICK = 5;
const MAX_LOG_LINES = 5000;

/**
 * Starts, tracks and cancels one service's deployment.
 *
 * While a tracked deployment is non-settled it polls `GET /v1/deployments/{id}`
 * every ~2s and drains `GET .../logs?after=`; polling stops once the deployment
 * is terminal or running, and is cleaned up on unmount / id change.
 */
export function useDeploymentRun(
  accessToken: string | undefined,
  latest: DeploymentSummary | null,
  onSettled?: () => void,
  options: { streamLogs?: boolean } = {},
) {
  const streamLogs = options.streamLogs !== false;
  // Follow an in-flight deployment that already exists or that Deploy all just started.
  const externalInFlightId = latest && isInFlightStatus(latest.status) ? latest.id : null;
  const [trackedId, setTrackedId] = useState<string | null>(externalInFlightId);
  const [syncedExternalId, setSyncedExternalId] = useState<string | null>(externalInFlightId);
  const [detail, setDetail] = useState<DeploymentDetail | null>(null);
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  if (externalInFlightId !== syncedExternalId) {
    setSyncedExternalId(externalInFlightId);
    if (externalInFlightId && externalInFlightId !== trackedId) {
      setTrackedId(externalInFlightId);
      setDetail(null);
      setLogs([]);
      setError(null);
    }
  }
  const deploymentId = trackedId;

  useEffect(() => {
    if (!accessToken || !deploymentId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let after: number | null = null;

    const drainLogs = async () => {
      for (let page = 0; page < MAX_LOG_PAGES_PER_TICK; page += 1) {
        const result = await getDeploymentLogs(accessToken, deploymentId, {
          after,
          limit: LOG_PAGE_LIMIT,
        });
        if (cancelled || result.data.length === 0) return;
        after = result.data[result.data.length - 1].id;
        setLogs((previous) => [...previous, ...result.data].slice(-MAX_LOG_LINES));
        if (result.next_after === null) return;
      }
    };

    const tick = async () => {
      let settled = false;
      try {
        const next = await getDeployment(accessToken, deploymentId);
        if (cancelled) return;
        setDetail(next);
        // Build-less deploys (image, postgres, redis) have no build log stream.
        if (streamLogs) await drainLogs();
        if (cancelled) return;
        setError(null);
        settled = isSettledStatus(next.status);
      } catch (caught) {
        if (cancelled) return;
        setError(describeApiError(caught, "Could not refresh the deployment."));
      }
      if (settled) {
        onSettled?.();
        return;
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `onSettled` is intentionally excluded: a changing callback must not restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, deploymentId, streamLogs]);

  const track = useCallback((id: string) => {
    setDetail(null);
    setLogs([]);
    setError(null);
    setTrackedId(id);
  }, []);

  const start = useCallback(
    async (serviceId: string) => {
      if (!accessToken) return;
      setIsStarting(true);
      setError(null);
      try {
        // A fresh key per click: retried requests of one click would reuse it,
        // but a new click is always a new deployment.
        const created = await deployService(accessToken, serviceId, {
          idempotencyKey: newIdempotencyKey(),
        });
        track(created.id);
      } catch (caught) {
        setError(describeApiError(caught, "Could not start the deployment."));
      } finally {
        setIsStarting(false);
      }
    },
    [accessToken, track],
  );

  const cancel = useCallback(async () => {
    if (!accessToken || !deploymentId) return;
    setIsCancelling(true);
    try {
      const updated = await cancelDeployment(accessToken, deploymentId);
      setDetail((previous) => (previous ? { ...previous, ...updated } : previous));
    } catch (caught) {
      setError(describeApiError(caught, "Could not cancel the deployment."));
    } finally {
      setIsCancelling(false);
    }
  }, [accessToken, deploymentId]);

  return { deploymentId, detail, logs, error, isStarting, isCancelling, start, cancel, track };
}
