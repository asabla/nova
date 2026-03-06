import { useCallback, useRef, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "paused" | "done" | "error";

export function useSSEStream() {
  const [tokens, setTokens] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const bufferWhilePausedRef = useRef("");

  const startStream = useCallback(async (url: string, body: unknown) => {
    setTokens("");
    setStatus("streaming");
    pausedRef.current = false;
    bufferWhilePausedRef.current = "";
    abortRef.current = new AbortController();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("event: done")) {
            // Flush any paused content
            if (bufferWhilePausedRef.current) {
              setTokens((prev) => prev + bufferWhilePausedRef.current);
              bufferWhilePausedRef.current = "";
            }
            setStatus("done");
            return;
          }
          if (line.startsWith("event: error")) {
            setStatus("error");
            return;
          }
          if (line.startsWith("event: heartbeat")) continue;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                if (pausedRef.current) {
                  // Buffer content while paused
                  bufferWhilePausedRef.current += data.content;
                } else {
                  setTokens((prev) => prev + data.content);
                }
              }
            } catch {
              // Skip malformed data
            }
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
    bufferWhilePausedRef.current = "";
  }, []);

  return { tokens, status, startStream, stopStream, pauseStream, resumeStream, resetStream };
}
