import { useState, useCallback, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Play,
  Copy,
  RotateCcw,
  Code2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Save,
  FolderOpen,
  X,
  Zap,
  Clock,
  Hash,
  ToggleLeft,
  ToggleRight,
  Square,
} from "lucide-react";
import { api, apiHeaders } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/playground")({
  component: PlaygroundPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaygroundMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
}

interface PlaygroundPreset {
  name: string;
  model: string;
  systemPrompt: string;
  messages: PlaygroundMessage[];
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
  responseFormat: "text" | "json_object";
}

interface RunResult {
  content: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  finishReason: string;
  durationMs: number;
  raw: unknown;
  error?: string;
}

const STORAGE_KEY = "nova:playground:presets";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return crypto.randomUUID();
}

function loadPresets(): PlaygroundPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: PlaygroundPreset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

function buildCurl(
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  params: {
    temperature: number;
    top_p: number;
    max_tokens: number;
    frequency_penalty: number;
    presence_penalty: number;
    stream: boolean;
    response_format?: { type: string };
  },
): string {
  const body = {
    model,
    messages,
    ...params,
  };
  const json = JSON.stringify(body, null, 2);
  return `curl -X POST '${baseUrl}/api/v1/chat/completions' \\\n  -H 'Content-Type: application/json' \\\n  -d '${json}'`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PlaygroundPage() {
  const { t } = useTranslation();

  // --- Model data ---
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => api.get<any>("/api/models"),
    staleTime: 60_000,
  });
  const models: any[] = (modelsData as any)?.data ?? [];

  // --- State: inputs ---
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [messages, setMessages] = useState<PlaygroundMessage[]>([
    { id: uid(), role: "user", content: "" },
  ]);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [stream, setStream] = useState(false);
  const [responseFormat, setResponseFormat] = useState<"text" | "json_object">("text");

  // --- State: output ---
  const [result, setResult] = useState<RunResult | null>(null);
  const [streamContent, setStreamContent] = useState("");
  const [running, setRunning] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // --- State: presets ---
  const [presets, setPresets] = useState<PlaygroundPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState("");
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  // Persist presets on change
  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  // --- Message list management ---
  const addMessage = useCallback(() => {
    setMessages((prev) => [...prev, { id: uid(), role: "user", content: "" }]);
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => (prev.length > 1 ? prev.filter((m) => m.id !== id) : prev));
  }, []);

  const updateMessage = useCallback((id: string, field: "role" | "content", value: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  }, []);

  // --- Build request body ---
  const buildRequestMessages = useCallback(() => {
    const msgs: Array<{ role: string; content: string }> = [];
    if (systemPrompt.trim()) {
      msgs.push({ role: "system", content: systemPrompt.trim() });
    }
    for (const m of messages) {
      if (m.content.trim()) {
        msgs.push({ role: m.role, content: m.content.trim() });
      }
    }
    return msgs;
  }, [systemPrompt, messages]);

  // --- Run (non-streaming) ---
  const runNonStreaming = useCallback(async () => {
    const reqMessages = buildRequestMessages();
    if (reqMessages.length === 0 || !model) return;

    setRunning(true);
    setResult(null);
    setStreamContent("");

    try {
      const startTime = performance.now();
      const body: Record<string, unknown> = {
        model,
        messages: reqMessages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: false,
      };
      if (responseFormat !== "text") {
        body.response_format = { type: responseFormat };
      }

      const response = await api.post<any>("/api/v1/chat/completions", body);
      const durationMs = Math.round(performance.now() - startTime);

      setResult({
        content: response.choices?.[0]?.message?.content ?? "",
        model: response.model ?? model,
        usage: response.usage ?? null,
        finishReason: response.choices?.[0]?.finish_reason ?? "unknown",
        durationMs,
        raw: response,
      });
    } catch (err: any) {
      setResult({
        content: "",
        model,
        usage: null,
        finishReason: "error",
        durationMs: 0,
        raw: null,
        error: err.message ?? "Request failed",
      });
    } finally {
      setRunning(false);
    }
  }, [model, buildRequestMessages, temperature, topP, maxTokens, frequencyPenalty, presencePenalty, responseFormat]);

  // --- Run (streaming) ---
  const runStreaming = useCallback(async () => {
    const reqMessages = buildRequestMessages();
    if (reqMessages.length === 0 || !model) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setResult(null);
    setStreamContent("");

    const startTime = performance.now();

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "";
      const body: Record<string, unknown> = {
        model,
        messages: reqMessages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stream: true,
      };
      if (responseFormat !== "text") {
        body.response_format = { type: responseFormat };
      }

      const response = await fetch(`${baseUrl}/api/v1/chat/completions`, {
        method: "POST",
        credentials: "include",
        headers: apiHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.title ?? `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let lastChunk: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;

          try {
            const data = JSON.parse(raw);
            lastChunk = data;
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setStreamContent(accumulated);
            }
          } catch {
            // skip malformed
          }
        }
      }

      const durationMs = Math.round(performance.now() - startTime);
      setResult({
        content: accumulated,
        model: lastChunk?.model ?? model,
        usage: lastChunk?.usage ?? null,
        finishReason: lastChunk?.choices?.[0]?.finish_reason ?? "stop",
        durationMs,
        raw: lastChunk,
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const durationMs = Math.round(performance.now() - startTime);
        setResult({
          content: "",
          model,
          usage: null,
          finishReason: "error",
          durationMs,
          raw: null,
          error: err.message ?? "Stream failed",
        });
      }
    } finally {
      setRunning(false);
    }
  }, [model, buildRequestMessages, temperature, topP, maxTokens, frequencyPenalty, presencePenalty, responseFormat]);

  // --- Handlers ---
  const handleRun = useCallback(() => {
    if (stream) {
      runStreaming();
    } else {
      runNonStreaming();
    }
  }, [stream, runStreaming, runNonStreaming]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setModel("");
    setSystemPrompt("");
    setMessages([{ id: uid(), role: "user", content: "" }]);
    setTemperature(0.7);
    setTopP(1);
    setMaxTokens(2048);
    setFrequencyPenalty(0);
    setPresencePenalty(0);
    setStream(false);
    setResponseFormat("text");
    setResult(null);
    setStreamContent("");
    setShowRaw(false);
    setRunning(false);
  }, []);

  const handleCopyResponse = useCallback(() => {
    const text = result?.content || streamContent;
    if (text) {
      navigator.clipboard.writeText(text).then(
        () => toast.success(t("playground.copiedResponse", "Copied to clipboard")),
        () => toast.error(t("playground.copyFailed", "Failed to copy")),
      );
    }
  }, [result, streamContent, t]);

  const handleCopyCurl = useCallback(() => {
    const reqMessages = buildRequestMessages();
    const baseUrl = import.meta.env.VITE_API_URL ?? window.location.origin;
    const params = {
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      stream,
      ...(responseFormat !== "text" ? { response_format: { type: responseFormat } } : {}),
    };
    const curl = buildCurl(baseUrl, model, reqMessages, params);
    navigator.clipboard.writeText(curl).then(
      () => toast.success(t("playground.copiedCurl", "cURL copied to clipboard")),
      () => toast.error(t("playground.copyFailed", "Failed to copy")),
    );
  }, [model, buildRequestMessages, temperature, topP, maxTokens, frequencyPenalty, presencePenalty, stream, responseFormat, t]);

  const handleCopyRaw = useCallback(() => {
    if (result?.raw) {
      navigator.clipboard.writeText(JSON.stringify(result.raw, null, 2));
      toast.success(t("playground.copiedRaw", "Raw JSON copied"));
    }
  }, [result, t]);

  // --- Presets ---
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    const preset: PlaygroundPreset = {
      name: presetName.trim(),
      model,
      systemPrompt,
      messages,
      temperature,
      topP,
      maxTokens,
      frequencyPenalty,
      presencePenalty,
      stream,
      responseFormat,
    };
    setPresets((prev) => {
      const idx = prev.findIndex((p) => p.name === preset.name);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = preset;
        return updated;
      }
      return [...prev, preset];
    });
    setPresetName("");
    setShowPresetDialog(false);
    toast.success(t("playground.presetSaved", "Preset saved"));
  }, [presetName, model, systemPrompt, messages, temperature, topP, maxTokens, frequencyPenalty, presencePenalty, stream, responseFormat, t]);

  const handleLoadPreset = useCallback((preset: PlaygroundPreset) => {
    setModel(preset.model);
    setSystemPrompt(preset.systemPrompt);
    setMessages(preset.messages.map((m) => ({ ...m, id: uid() })));
    setTemperature(preset.temperature);
    setTopP(preset.topP);
    setMaxTokens(preset.maxTokens);
    setFrequencyPenalty(preset.frequencyPenalty);
    setPresencePenalty(preset.presencePenalty);
    setStream(preset.stream);
    setResponseFormat(preset.responseFormat);
    setShowLoadDialog(false);
    toast.success(t("playground.presetLoaded", `Loaded "${preset.name}"`));
  }, [t]);

  const handleDeletePreset = useCallback((name: string) => {
    setPresets((prev) => prev.filter((p) => p.name !== name));
    toast.success(t("playground.presetDeleted", "Preset deleted"));
  }, [t]);

  const hasContent = messages.some((m) => m.content.trim());
  const canRun = !!model && hasContent && !running;
  const displayContent = result?.content || streamContent;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Code2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-text">
            {t("playground.title", "Model Playground")}
          </h1>
          <Badge variant="primary">
            {t("playground.badge", "Developer")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowLoadDialog(true)}>
            <FolderOpen className="h-3.5 w-3.5" />
            {t("playground.load", "Load")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPresetDialog(true)}>
            <Save className="h-3.5 w-3.5" />
            {t("playground.save", "Save")}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t("playground.reset", "Reset")}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopyCurl} disabled={!model}>
            <Terminal className="h-3.5 w-3.5" />
            {t("playground.copyCurl", "cURL")}
          </Button>
          {running ? (
            <Button variant="danger" size="sm" onClick={handleStop}>
              <Square className="h-3.5 w-3.5" />
              {t("playground.stop", "Stop")}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleRun} disabled={!canRun}>
              <Play className="h-4 w-4" />
              {t("playground.run", "Run")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* ============================================================= */}
        {/* LEFT PANEL: Inputs                                            */}
        {/* ============================================================= */}
        <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-border overflow-y-auto p-6 space-y-5">
          {/* Model selector */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              {t("playground.model", "Model")}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm"
            >
              <option value="">{t("playground.selectModel", "Select a model...")}</option>
              {models.map((m: any) => (
                <option key={m.id} value={m.modelIdExternal ?? m.id}>
                  {m.name ?? m.modelIdExternal ?? m.id}
                </option>
              ))}
            </select>
          </div>

          {/* Toggles row: Stream + Response format */}
          <div className="flex items-center gap-6">
            {/* Stream toggle */}
            <button
              type="button"
              onClick={() => setStream((s) => !s)}
              disabled={running}
              aria-pressed={stream}
              className="flex items-center gap-2 text-sm text-text"
            >
              {stream ? (
                <ToggleRight className="h-5 w-5 text-primary" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-tertiary" />
              )}
              {t("playground.stream", "Stream")}
            </button>

            {/* Response format */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">
                {t("playground.format", "Format:")}
              </span>
              <select
                value={responseFormat}
                onChange={(e) => setResponseFormat(e.target.value as "text" | "json_object")}
                disabled={running}
                className="px-2 py-1 rounded-lg border border-border bg-surface text-text text-sm"
              >
                <option value="text">text</option>
                <option value="json_object">json_object</option>
              </select>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              {t("playground.systemPrompt", "System Prompt")}
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t("playground.systemPromptPlaceholder", "You are a helpful assistant...")}
              rows={3}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm font-mono"
            />
          </div>

          {/* Messages list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-text">
                {t("playground.messages", "Messages")}
              </label>
              <Button variant="ghost" size="sm" onClick={addMessage} disabled={running}>
                <Plus className="h-3.5 w-3.5" />
                {t("playground.addMessage", "Add")}
              </Button>
            </div>
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div key={msg.id} className="flex gap-2">
                  <select
                    value={msg.role}
                    onChange={(e) => updateMessage(msg.id, "role", e.target.value)}
                    disabled={running}
                    className="w-32 shrink-0 px-2 py-2 rounded-lg border border-border bg-surface text-text text-sm"
                  >
                    <option value="user">user</option>
                    <option value="assistant">assistant</option>
                    <option value="system">system</option>
                  </select>
                  <textarea
                    value={msg.content}
                    onChange={(e) => updateMessage(msg.id, "content", e.target.value)}
                    placeholder={`${t("playground.messagePlaceholder", "Message")} ${idx + 1}...`}
                    rows={3}
                    disabled={running}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-text placeholder:text-text-tertiary resize-y text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleRun();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeMessage(msg.id)}
                    disabled={running || messages.length <= 1}
                    className="self-start p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label={t("playground.removeMessage", "Remove message")}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowParams((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-text mb-3 hover:text-text-secondary transition-colors"
            >
              {showParams ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {t("playground.parameters", "Parameters")}
            </button>
            {showParams && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-secondary">
                      {t("playground.temperature", "Temperature")}
                    </label>
                    <span className="text-xs font-mono text-text-tertiary">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    disabled={running}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary">
                    <span>0</span>
                    <span>2</span>
                  </div>
                </div>

                {/* Top P */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-secondary">
                      {t("playground.topP", "Top P")}
                    </label>
                    <span className="text-xs font-mono text-text-tertiary">{topP.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(Number(e.target.value))}
                    disabled={running}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary">
                    <span>0</span>
                    <span>1</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-xs text-text-secondary mb-1">
                    {t("playground.maxTokens", "Max Tokens")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={128000}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    disabled={running}
                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-text text-sm"
                  />
                </div>

                {/* Frequency Penalty */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-secondary">
                      {t("playground.frequencyPenalty", "Frequency Penalty")}
                    </label>
                    <span className="text-xs font-mono text-text-tertiary">{frequencyPenalty.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={frequencyPenalty}
                    onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
                    disabled={running}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary">
                    <span>-2</span>
                    <span>2</span>
                  </div>
                </div>

                {/* Presence Penalty */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-text-secondary">
                      {t("playground.presencePenalty", "Presence Penalty")}
                    </label>
                    <span className="text-xs font-mono text-text-tertiary">{presencePenalty.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={presencePenalty}
                    onChange={(e) => setPresencePenalty(Number(e.target.value))}
                    disabled={running}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary">
                    <span>-2</span>
                    <span>2</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================= */}
        {/* RIGHT PANEL: Output                                           */}
        {/* ============================================================= */}
        <div className="w-full md:w-1/2 overflow-y-auto flex flex-col">
          {result || (running && stream) ? (
            <div className="flex flex-col flex-1">
              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-surface-secondary border-b border-border text-xs text-text-secondary">
                {result?.model && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    {result.model}
                  </span>
                )}
                {(result?.durationMs ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {result!.durationMs}ms
                  </span>
                )}
                {result?.finishReason && result.finishReason !== "error" && (
                  <Badge variant={result.finishReason === "stop" ? "success" : "warning"}>
                    {result.finishReason}
                  </Badge>
                )}
                {result?.usage && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" aria-hidden="true" />
                    {result.usage.prompt_tokens}p / {result.usage.completion_tokens}c = {result.usage.total_tokens} total
                  </span>
                )}
                {running && stream && (
                  <span className="text-primary animate-pulse">
                    {t("playground.streaming", "Streaming...")}
                  </span>
                )}
              </div>

              {/* Token usage detail */}
              {result?.usage && (
                <div className="grid grid-cols-3 gap-px bg-border mx-6 mt-4 rounded-lg overflow-hidden">
                  <div className="bg-surface-secondary px-4 py-2.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {t("playground.promptTokens", "Prompt")}
                    </div>
                    <div className="text-sm font-semibold text-text mt-0.5">
                      {result.usage.prompt_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-surface-secondary px-4 py-2.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {t("playground.completionTokens", "Completion")}
                    </div>
                    <div className="text-sm font-semibold text-text mt-0.5">
                      {result.usage.completion_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-surface-secondary px-4 py-2.5 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {t("playground.totalTokens", "Total")}
                    </div>
                    <div className="text-sm font-semibold text-text mt-0.5">
                      {result.usage.total_tokens.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Error display */}
              {result?.error && (
                <div className="mx-6 mt-4 p-4 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
                  {result.error}
                </div>
              )}

              {/* Response content */}
              {displayContent && (
                <div className="relative mx-6 mt-4">
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    <button
                      type="button"
                      onClick={handleCopyResponse}
                      className="p-1.5 rounded-lg hover:bg-surface-secondary text-text-tertiary hover:text-text transition-colors"
                      aria-label={t("playground.copyResponse", "Copy response")}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="px-4 py-3 rounded-xl border border-border bg-surface text-sm text-text whitespace-pre-wrap leading-relaxed">
                    {displayContent}
                    {running && stream && (
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                    )}
                  </div>
                </div>
              )}

              {/* Raw JSON toggle */}
              <div className="mx-6 mt-4 mb-6">
                <button
                  type="button"
                  onClick={() => setShowRaw((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {t("playground.rawResponse", "Raw API Response")}
                </button>
                {showRaw && (result as any)?.raw && (
                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-surface text-text-tertiary hover:text-text transition-colors"
                      aria-label={t("playground.copyRaw", "Copy raw JSON")}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <pre className="p-4 rounded-xl bg-surface-secondary border border-border text-xs text-text-secondary overflow-x-auto font-mono max-h-96">
                      {JSON.stringify(result?.raw, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-text-tertiary">
              <div className="text-center">
                <Code2 className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                <p className="text-sm">{t("playground.emptyTitle", "Run a prompt to see results")}</p>
                <p className="text-xs mt-1">
                  {t("playground.emptyHint", "Select a model and enter a message, then click Run")}
                </p>
                <p className="text-xs mt-3 text-text-tertiary">
                  {t("playground.shortcutHint", "Press Cmd+Enter / Ctrl+Enter to run")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================= */}
      {/* Save Preset Dialog                                             */}
      {/* ============================================================= */}
      {showPresetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" role="dialog" aria-modal="true" aria-label={t("playground.savePreset", "Save Preset")} onKeyDown={(e) => { if (e.key === "Escape") setShowPresetDialog(false); }}>
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-text">
                {t("playground.savePreset", "Save Preset")}
              </h2>
              <button
                type="button"
                onClick={() => setShowPresetDialog(false)}
                className="p-1.5 rounded-lg hover:bg-surface-secondary text-text-tertiary"
                aria-label={t("common.close", "Close")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder={t("playground.presetNamePlaceholder", "Preset name...")}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPresetDialog(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSavePreset} disabled={!presetName.trim()}>
                <Save className="h-3.5 w-3.5" />
                {t("common.save", "Save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* Load Preset Dialog                                             */}
      {/* ============================================================= */}
      {showLoadDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" role="dialog" aria-modal="true" aria-label={t("playground.loadPreset", "Load Preset")} onKeyDown={(e) => { if (e.key === "Escape") setShowLoadDialog(false); }}>
          <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-text">
                {t("playground.loadPreset", "Load Preset")}
              </h2>
              <button
                type="button"
                onClick={() => setShowLoadDialog(false)}
                className="p-1.5 rounded-lg hover:bg-surface-secondary text-text-tertiary"
                aria-label={t("common.close", "Close")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {presets.length === 0 ? (
              <p className="text-sm text-text-tertiary py-8 text-center">
                {t("playground.noPresets", "No saved presets yet.")}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {presets.map((preset) => (
                  <div
                    key={preset.name}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-surface-secondary transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-medium text-text">{preset.name}</div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {preset.model || "No model"} | {preset.messages.length} msg | temp {preset.temperature}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.name);
                      }}
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label={t("playground.deletePreset", "Delete preset")}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="ghost" size="sm" onClick={() => setShowLoadDialog(false)}>
                {t("common.close", "Close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
