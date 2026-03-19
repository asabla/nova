import { useCallback, useRef, useState } from "react";
import { getActiveOrgId } from "../lib/api";

export type StreamStatus = "idle" | "streaming" | "paused" | "done" | "error";

export interface ActiveTool {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "approval_required" | "timeout";
  args?: Record<string, unknown>;
  resultSummary?: string;
}

export interface DoneData {
  messageId?: string;
  tokenCountPrompt?: number;
  tokenCountCompletion?: number;
  latencyMs?: number;
}

export function useSSEStream() {
  const [tokens, setTokens] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [doneData, setDoneData] = useState<DoneData | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const bufferWhilePausedRef = useRef("");
  const pendingTokensRef = useRef("");
  const rafIdRef = useRef<number | null>(null);

  const flushPendingTokens = useCallback(() => {
    if (pendingTokensRef.current) {
      const pending = pendingTokensRef.current;
      pendingTokensRef.current = "";
      setTokens((prev) => prev + pending);
    }
    rafIdRef.current = null;
  }, []);

  const scheduleTokenFlush = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushPendingTokens);
    }
  }, [flushPendingTokens]);

  const startStream = useCallback(async (url: string, body: unknown) => {
    setTokens("");
    setStatus("streaming");
    setActiveTools([]);
    setDoneData(null);
    pausedRef.current = false;
    bufferWhilePausedRef.current = "";
    abortRef.current = new AbortController();

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const orgId = getActiveOrgId();
      if (orgId) headers["x-org-id"] = orgId;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Session expired — redirect to login
          window.location.href = "/login";
          return;
        }
        setStatus("error");
        return;
      }

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

              if (currentEventType === "done") {
                // Cancel pending rAF and flush all buffered tokens
                if (rafIdRef.current !== null) {
                  cancelAnimationFrame(rafIdRef.current);
                  rafIdRef.current = null;
                }
                const allPending = pendingTokensRef.current + bufferWhilePausedRef.current;
                pendingTokensRef.current = "";
                bufferWhilePausedRef.current = "";
                if (allPending) {
                  setTokens((prev) => prev + allPending);
                }
                setDoneData({
                  messageId: data.messageId,
                  tokenCountPrompt: data.tokenCountPrompt,
                  tokenCountCompletion: data.tokenCountCompletion,
                  latencyMs: data.latencyMs,
                });
                setStatus("done");
                currentEventType = "";
                return;
              }

              if (currentEventType === "error") {
                setStatus("error");
                currentEventType = "";
                return;
              }

              if (currentEventType === "tool_status" && data.tool) {
                setActiveTools((prev) => {
                  const existing = prev.findIndex((t) => t.name === data.tool);
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = {
                      ...updated[existing],
                      status: data.status,
                      ...(data.args ? { args: data.args } : {}),
                      ...(data.resultSummary ? { resultSummary: data.resultSummary } : {}),
                    };
                    return updated;
                  }
                  return [...prev, {
                    name: data.tool,
                    status: data.status,
                    ...(data.args ? { args: data.args } : {}),
                    ...(data.resultSummary ? { resultSummary: data.resultSummary } : {}),
                  }];
                });
                currentEventType = "";
                continue;
              }

              if (data.content) {
                if (pausedRef.current) {
                  bufferWhilePausedRef.current += data.content;
                } else {
                  pendingTokensRef.current += data.content;
                  scheduleTokenFlush();
                }
              }
            } catch {
              // Skip malformed data
            }
            currentEventType = "";
          }
        }
      }

      // Flush remaining paused content
      if (bufferWhilePausedRef.current) {
        setTokens((prev) => prev + bufferWhilePausedRef.current);
        bufferWhilePausedRef.current = "";
      }
      setStatus("done");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setStatus("error");
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    // Cancel pending rAF and flush all buffered content
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const allPending = pendingTokensRef.current + bufferWhilePausedRef.current;
    pendingTokensRef.current = "";
    bufferWhilePausedRef.current = "";
    if (allPending) {
      setTokens((prev) => prev + allPending);
    }
    setStatus("done");
  }, []);

  const pauseStream = useCallback(() => {
    pausedRef.current = true;
    setStatus("paused");
  }, []);

  const resumeStream = useCallback(() => {
    pausedRef.current = false;
    // Flush buffered content
    if (bufferWhilePausedRef.current) {
      setTokens((prev) => prev + bufferWhilePausedRef.current);
      bufferWhilePausedRef.current = "";
    }
    setStatus("streaming");
  }, []);

  const resetStream = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingTokensRef.current = "";
    bufferWhilePausedRef.current = "";
    setTokens("");
    setStatus("idle");
    setActiveTools([]);
    setDoneData(null);
  }, []);

  return { tokens, status, activeTools, doneData, startStream, stopStream, pauseStream, resumeStream, resetStream };
}
