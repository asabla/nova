import { useState, useEffect, useCallback, useRef } from "react";
import { getWsReadyState } from "../lib/ws-client";
import { useWSStore } from "../stores/ws.store";

export interface ConnectionStatusInfo {
  /** Whether the browser reports online connectivity */
  isOnline: boolean;
  /** Whether the WebSocket is in OPEN state */
  wsConnected: boolean;
  /** Whether the API health endpoint responded successfully */
  apiReachable: boolean;
  /** Timestamp of the last connectivity check */
  lastChecked: Date;
}

const API_CHECK_INTERVAL = 30_000;
const API_CHECK_TIMEOUT = 5_000;

/**
 * Hook that monitors WebSocket and API connectivity.
 *
 * - Tracks browser online/offline events
 * - Reads WS state from the store (ws-client already handles reconnection via
 *   reconnecting-websocket)
 * - Periodically pings `/api/health` to confirm API reachability
 * - Returns a unified connection status object that the `ConnectionStatus`
 *   component (or any other consumer) can use.
 */
export function useConnectionStatus(): ConnectionStatusInfo {
  const wsStatus = useWSStore((s) => s.status);

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [apiReachable, setApiReachable] = useState(true);
  const [lastChecked, setLastChecked] = useState(new Date());

  // Browser online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // API health check
  const checkApi = useCallback(async () => {
    try {
      const res = await fetch("/health", {
        method: "GET",
        signal: AbortSignal.timeout(API_CHECK_TIMEOUT),
      });
      setApiReachable(res.ok);
    } catch {
      setApiReachable(false);
    } finally {
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkApi();

    const interval = setInterval(checkApi, API_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkApi]);

  // Re-check API immediately when coming back online
  useEffect(() => {
    if (isOnline) {
      checkApi();
    }
  }, [isOnline, checkApi]);

  const wsConnected = wsStatus === "connected";

  return {
    isOnline,
    wsConnected,
    apiReachable,
    lastChecked,
  };
}
