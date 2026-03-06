import { useCallback, useRef, useState } from "react";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

export function useSSEStream() {
  const [tokens, setTokens] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (url: string, body: unknown) => {
    setTokens("");
    setStatus("streaming");
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
                setTokens((prev) => prev + data.content);
              }
            } catch {
              // Skip malformed data
            }
          }
        }
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
    setStatus("done");
  }, []);

  const resetStream = useCallback(() => {
    setTokens("");
    setStatus("idle");
  }, []);

  return { tokens, status, startStream, stopStream, resetStream };
}
