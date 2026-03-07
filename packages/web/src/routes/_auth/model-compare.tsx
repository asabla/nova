import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { ArrowLeftRight, Send, Clock, Coins, Hash, Diff } from "lucide-react";
import { api, apiHeaders } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { ModelCapabilityBadges } from "../../components/ui/ModelCapabilityBadges";

export const Route = createFileRoute("/_auth/model-compare")({
  component: ModelComparePage,
});

interface ModelResult {
  content: string;
  responseTimeMs: number | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  error: string | null;
  streaming: boolean;
}

const emptyResult = (): ModelResult => ({
  content: "",
  responseTimeMs: null,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  error: null,
  streaming: false,
});

function ModelComparePage() {
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [resultA, setResultA] = useState<ModelResult>(emptyResult());
  const [resultB, setResultB] = useState<ModelResult>(emptyResult());
  const [isRunning, setIsRunning] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<any>("/api/models"),
  });

  const models: any[] = (modelsData as any)?.data ?? [];

  const runComparison = useCallback(async () => {
    if (!modelA || !modelB || !prompt.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setShowDiff(false);
    setResultA({ ...emptyResult(), streaming: true });
    setResultB({ ...emptyResult(), streaming: true });

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${baseUrl}/api/model-compare`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(),
        body: JSON.stringify({
          prompt: prompt.trim(),
          models: [modelA, modelB],
          temperature,
          maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const err = "Failed to start comparison";
        setResultA((r) => ({ ...r, streaming: false, error: err }));
        setResultB((r) => ({ ...r, streaming: false, error: err }));
        setIsRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7).trim();
            // Next data line
            continue;
          }
          if (!line.startsWith("data: ")) continue;
          const rawData = line.slice(6);
          if (!rawData) continue;

          // We need to pair event type with data. SSE format: event line then data line.
          // Re-parse using a simpler approach.
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message ?? "Connection error";
        setResultA((r) => ({ ...r, streaming: false, error: r.error ?? msg }));
        setResultB((r) => ({ ...r, streaming: false, error: r.error ?? msg }));
      }
    } finally {
      setIsRunning(false);
    }
  }, [modelA, modelB, prompt, temperature, maxTokens]);

  // Proper SSE parsing with event tracking
  const runComparisonSSE = useCallback(async () => {
    if (!modelA || !modelB || !prompt.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setShowDiff(false);
    setResultA({ ...emptyResult(), streaming: true });
    setResultB({ ...emptyResult(), streaming: true });

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "";
      const response = await fetch(`${baseUrl}/api/model-compare`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(),
        body: JSON.stringify({
          prompt: prompt.trim(),
          models: [modelA, modelB],
          temperature,
          maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const err = "Failed to start comparison";
        setResultA((r) => ({ ...r, streaming: false, error: err }));
        setResultB((r) => ({ ...r, streaming: false, error: err }));
        setIsRunning(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          let eventType = "message";
          let eventData = "";

          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            }
          }

          if (eventType === "heartbeat" || !eventData) continue;

          try {
            const data = JSON.parse(eventData);
            const setter = data.modelId === modelA ? setResultA : setResultB;

            if (eventType === "token") {
              setter((r) => ({ ...r, content: r.content + data.content }));
            } else if (eventType === "model-done") {
              setter((r) => ({
                ...r,
                content: data.content,
                responseTimeMs: data.responseTimeMs,
                promptTokens: data.promptTokens,
                completionTokens: data.completionTokens,
                totalTokens: data.totalTokens,
                streaming: false,
              }));
            } else if (eventType === "error") {
              if (data.modelId) {
                setter((r) => ({
                  ...r,
                  streaming: false,
                  error: data.message,
                }));
              } else {
                setResultA((r) => ({ ...r, streaming: false, error: data.message }));
                setResultB((r) => ({ ...r, streaming: false, error: data.message }));
              }
            }
          } catch {
            // Skip malformed data
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message ?? "Connection error";
        setResultA((r) => ({ ...r, streaming: false, error: r.error ?? msg }));
        setResultB((r) => ({ ...r, streaming: false, error: r.error ?? msg }));
      }
    } finally {
      setIsRunning(false);
    }
  }, [modelA, modelB, prompt, temperature, maxTokens]);

  const getModelName = (id: string) => {
    const m = models.find((m: any) => m.modelIdExternal === id);
    return m?.name ?? id;
  };

  const diffLines = showDiff ? computeSimpleDiff(resultA.content, resultB.content) : [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <ArrowLeftRight className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-text">Model Comparison</h1>
      </div>

      {/* Model selectors */}
      <div className="flex gap-4 px-6 py-4 border-b border-border">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Model A</label>
          <select
            value={modelA}
            onChange={(e) => setModelA(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            disabled={isRunning}
          >
            <option value="">Select model...</option>
            {models.map((m: any) => (
              <option key={m.id} value={m.modelIdExternal}>
                {m.name}
              </option>
            ))}
          </select>
          <ModelCapabilityBadges
            capabilities={models.find((m: any) => m.modelIdExternal === modelA)?.capabilities ?? []}
            compact
            className="mt-1.5"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Model B</label>
          <select
            value={modelB}
            onChange={(e) => setModelB(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            disabled={isRunning}
          >
            <option value="">Select model...</option>
            {models.map((m: any) => (
              <option key={m.id} value={m.modelIdExternal}>
                {m.name}
              </option>
            ))}
          </select>
          <ModelCapabilityBadges
            capabilities={models.find((m: any) => m.modelIdExternal === modelB)?.capabilities ?? []}
            compact
            className="mt-1.5"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-text-secondary mb-1">Temperature</label>
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            disabled={isRunning}
          />
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-text-secondary mb-1">Max Tokens</label>
          <input
            type="number"
            min={1}
            max={32768}
            step={256}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text"
            disabled={isRunning}
          />
        </div>
      </div>

      {/* Comparison panels */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        <ComparisonPanel
          label="Model A"
          modelName={getModelName(modelA)}
          result={resultA}
          side="left"
        />
        <div className="w-px bg-border" />
        <ComparisonPanel
          label="Model B"
          modelName={getModelName(modelB)}
          result={resultB}
          side="right"
        />
      </div>

      {/* Diff view (toggled) */}
      {showDiff && (
        <div className="border-t border-border px-6 py-4 max-h-64 overflow-y-auto bg-surface-secondary">
          <h3 className="text-sm font-medium text-text mb-2">Response Diff</h3>
          <div className="font-mono text-xs space-y-0.5">
            {diffLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.type === "add"
                    ? "text-success bg-success/5 px-2 rounded"
                    : line.type === "remove"
                      ? "text-danger bg-danger/5 px-2 rounded"
                      : "text-text-tertiary px-2"
                }
              >
                {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                {line.text}
              </div>
            ))}
            {diffLines.length === 0 && (
              <p className="text-text-tertiary">Responses are identical.</p>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border px-6 py-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to send to both models..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={isRunning}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runComparisonSSE();
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={runComparisonSSE}
              disabled={!modelA || !modelB || !prompt.trim() || modelA === modelB}
              loading={isRunning}
            >
              <Send className="h-4 w-4" />
              Compare
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDiff((d) => !d)}
              disabled={!resultA.content || !resultB.content}
            >
              <Diff className="h-3.5 w-3.5" />
              {showDiff ? "Hide Diff" : "Compare Results"}
            </Button>
          </div>
        </div>
        {modelA && modelB && modelA === modelB && (
          <p className="text-xs text-warning mt-2">Select two different models to compare.</p>
        )}
      </div>
    </div>
  );
}

function ComparisonPanel({
  label,
  modelName,
  result,
  side,
}: {
  label: string;
  modelName: string;
  result: ModelResult;
  side: "left" | "right";
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-secondary border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant={side === "left" ? "primary" : "success"}>{label}</Badge>
          <span className="text-sm font-medium text-text truncate">{modelName || "Not selected"}</span>
        </div>
        {result.streaming && (
          <span className="text-xs text-primary animate-pulse">Streaming...</span>
        )}
      </div>

      {/* Stats bar */}
      {(result.responseTimeMs !== null || result.totalTokens > 0) && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-surface-tertiary border-b border-border text-xs text-text-secondary">
          {result.responseTimeMs !== null && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(result.responseTimeMs / 1000).toFixed(2)}s
            </span>
          )}
          {result.totalTokens > 0 && (
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {result.totalTokens} tokens ({result.promptTokens}p / {result.completionTokens}c)
            </span>
          )}
          {result.totalTokens > 0 && (
            <span className="flex items-center gap-1">
              <Coins className="h-3 w-3" />
              est. cost TBD
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {result.error ? (
          <div className="text-sm text-danger bg-danger/5 rounded-lg p-3">{result.error}</div>
        ) : result.content ? (
          <div className="text-sm text-text whitespace-pre-wrap leading-relaxed">
            {result.content}
            {result.streaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
          </div>
        ) : !result.streaming ? (
          <p className="text-sm text-text-tertiary text-center py-12">
            Select a model and enter a prompt to begin.
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-text-tertiary py-12 justify-center">
            <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce" />
            <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
            <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Simple line-based diff for comparing two text outputs. */
function computeSimpleDiff(a: string, b: string): Array<{ type: "same" | "add" | "remove"; text: string }> {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const result: Array<{ type: "same" | "add" | "remove"; text: string }> = [];

  const max = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < max; i++) {
    const la = linesA[i];
    const lb = linesB[i];
    if (la === lb) {
      if (la !== undefined) result.push({ type: "same", text: la });
    } else {
      if (la !== undefined) result.push({ type: "remove", text: la });
      if (lb !== undefined) result.push({ type: "add", text: lb });
    }
  }

  return result;
}
