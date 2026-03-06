import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, Copy, RotateCcw, ChevronDown, ChevronUp, Code2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/playground")({
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => api.get<any>("/api/models"),
  });

  const models = (modelsData as any)?.data ?? [];

  const handleRun = async () => {
    if (!userMessage.trim() || !model) return;
    setRunning(true);
    setResult(null);

    try {
      const messages = [];
      if (systemPrompt.trim()) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: userMessage });

      const startTime = performance.now();
      const response = await api.post<any>("/v1/chat/completions", {
        model,
        messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: false,
      });
      const duration = Math.round(performance.now() - startTime);

      setResult({
        content: response.choices?.[0]?.message?.content ?? "",
        model: response.model,
        usage: response.usage,
        finishReason: response.choices?.[0]?.finish_reason,
        duration,
        raw: response,
      });
    } catch (err: any) {
      setResult({ error: err.message ?? "Request failed" });
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content);
      toast.success("Copied to clipboard");
    }
  };

  const handleReset = () => {
    setSystemPrompt("");
    setUserMessage("");
    setResult(null);
    setTemperature(0.7);
    setTopP(1);
    setMaxTokens(2048);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Code2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-text">Model Playground</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button variant="primary" onClick={handleRun} disabled={running || !model || !userMessage.trim()}>
            <Play className="h-4 w-4" />
            {running ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left - Input */}
        <div className="w-1/2 border-r border-border overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
            >
              <option value="">Select a model...</option>
              {models.map((m: any) => (
                <option key={m.id} value={m.modelIdExternal ?? m.id}>
                  {m.name ?? m.modelIdExternal ?? m.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1.5">User Message</label>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder="Enter your prompt..."
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm"
            />
          </div>

          {/* Parameters */}
          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-medium text-text">Parameters</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Temperature: {temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Top P: {topP}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Max Tokens</label>
                <input
                  type="number"
                  min={1}
                  max={128000}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg border border-border bg-surface text-text text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right - Output */}
        <div className="w-1/2 overflow-y-auto p-6">
          {result ? (
            <div className="space-y-4">
              {result.error ? (
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
                  {result.error}
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-text-tertiary">
                    <span>Model: <span className="text-text-secondary">{result.model}</span></span>
                    <span>Duration: <span className="text-text-secondary">{result.duration}ms</span></span>
                    <span>Finish: <span className="text-text-secondary">{result.finishReason}</span></span>
                    {result.usage && (
                      <>
                        <span>Prompt: <span className="text-text-secondary">{result.usage.prompt_tokens}</span></span>
                        <span>Completion: <span className="text-text-secondary">{result.usage.completion_tokens}</span></span>
                        <span>Total: <span className="text-text-secondary">{result.usage.total_tokens}</span></span>
                      </>
                    )}
                  </div>

                  {/* Response */}
                  <div className="relative">
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-surface-secondary text-text-tertiary">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="px-4 py-3 rounded-xl border border-border bg-surface-secondary text-sm text-text whitespace-pre-wrap">
                      {result.content}
                    </div>
                  </div>

                  {/* Raw JSON */}
                  <div>
                    <button
                      onClick={() => setShowRaw(!showRaw)}
                      className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
                    >
                      {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Raw API Response
                    </button>
                    {showRaw && (
                      <pre className="mt-2 p-3 rounded-xl bg-surface-secondary border border-border text-xs text-text-secondary overflow-x-auto font-mono">
                        {JSON.stringify(result.raw, null, 2)}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-tertiary">
              <div className="text-center">
                <Code2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Run a prompt to see results</p>
                <p className="text-xs mt-1">Select a model and enter a message, then click Run</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
