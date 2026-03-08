import { useCallback, useRef, useState } from "react";
import { getActiveOrgId } from "../lib/api";

export type StreamStatus = "idle" | "streaming" | "paused" | "done" | "error";

export interface ActiveTool {
  name: string;
  status: "running" | "completed" | "error";
}

export function useSSEStream() {
  const [tokens, setTokens] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const bufferWhilePausedRef = useRef("");

  const startStream = useCallback(async (url: string, body: unknown) => {
    setTokens("");
    setStatus("streaming");
    setActiveTools([]);
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

            if (currentEventType === "done") {
              if (bufferWhilePausedRef.current) {
                setTokens((prev) => prev + bufferWhilePausedRef.current);
                bufferWhilePausedRef.current = "";
              }
              setStatus("done");
              return;
            }
            if (currentEventType === "error") {
              setStatus("error");
              return;
            }
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (currentEventType === "tool_status" && data.tool) {
                setActiveTools((prev) => {
                  const existing = prev.findIndex((t) => t.name === data.tool);
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = { name: data.tool, status: data.status };
                    return updated;
                  }
                  return [...prev, { name: data.tool, status: data.status }];
                });
                currentEventType = "";
                continue;
              }

              if (data.content) {
                if (pausedRef.current) {
                  bufferWhilePausedRef.current += data.content;
                } else {
                  setTokens((prev) => prev + data.content);
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
    // Flush paused content before stopping
    if (bufferWhilePausedRef.current) {
      setTokens((prev) => prev + bufferWhilePausedRef.current);
      bufferWhilePausedRef.current = "";
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
    setTokens("");
    setStatus("idle");
    setActiveTools([]);
    bufferWhilePausedRef.current = "";
  }, []);

  return { tokens, status, activeTools, startStream, stopStream, pauseStream, resumeStream, resetStream };
}
