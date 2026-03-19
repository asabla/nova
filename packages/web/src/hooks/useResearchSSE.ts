import { useCallback, useEffect, useRef, useState } from "react";
import type { ResearchProgressType, ResearchStatus } from "@nova/shared/constants";
import { getActiveOrgId } from "../lib/api";

export interface ResearchProgressEvent {
  type: ResearchProgressType;
  message: string;
  sourceUrl?: string;
  timestamp: string;
}

export interface ResearchSourceEvent {
  title: string;
  url: string;
  relevance?: number;
}

interface UseResearchSSEState {
  status: ResearchStatus | "idle";
  phase?: string;
  progress: ResearchProgressEvent[];
  sources: ResearchSourceEvent[];
  error?: string;
  isDone: boolean;
}

/**
 * Hook that connects to the research SSE endpoint for real-time progress updates.
 * Only connects when reportId is provided and the report is in an active state.
 */
export function useResearchSSE(reportId: string | null, reportStatus?: string) {
  const [state, setState] = useState<UseResearchSSEState>({
    status: "idle",
    progress: [],
    sources: [],
    isDone: false,
  });
  const abortRef = useRef<AbortController | null>(null);

  const isActive = reportStatus === "pending" || reportStatus === "searching" ||
    reportStatus === "analyzing" || reportStatus === "generating" || reportStatus === "running";

  const connect = useCallback(async (id: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({
      status: reportStatus as ResearchStatus ?? "pending",
      progress: [],
      sources: [],
      isDone: false,
    });

    try {
      const headers: Record<string, string> = {};
      const orgId = getActiveOrgId();
      if (orgId) headers["x-org-id"] = orgId;

      const response = await fetch(`/api/research/${id}/stream`, {
        headers,
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!response.ok) return;

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (currentEventType) {
                case "research.status":
                  setState((prev) => ({
                    ...prev,
                    status: data.status,
                    phase: data.phase,
                  }));
                  break;

                case "research.source":
                  setState((prev) => ({
                    ...prev,
                    sources: [...prev.sources, {
                      title: data.title,
                      url: data.url,
                      relevance: data.relevance,
                    }],
                  }));
                  break;

                case "research.progress":
                  setState((prev) => ({
                    ...prev,
                    progress: [...prev.progress, {
                      type: data.type,
                      message: data.message,
                      sourceUrl: data.sourceUrl,
                      timestamp: new Date().toISOString(),
                    }],
                  }));
                  break;

                case "research.done":
                  setState((prev) => ({
                    ...prev,
                    status: "completed",
                    isDone: true,
                  }));
                  return;

                case "research.error":
                  setState((prev) => ({
                    ...prev,
                    status: "failed",
                    error: data.message,
                    isDone: true,
                  }));
                  return;
              }
            } catch {
              // Skip malformed data
            }
            currentEventType = "";
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setState((prev) => ({ ...prev, status: "failed", error: "Connection lost", isDone: true }));
      }
    }
  }, [reportStatus]);

  useEffect(() => {
    if (reportId && isActive) {
      connect(reportId);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [reportId, isActive, connect]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...state, disconnect };
}
