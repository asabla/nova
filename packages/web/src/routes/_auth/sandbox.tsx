import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import {
  Play,
  RotateCcw,
  Terminal,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { Select } from "../../components/ui/Select";
import { toast } from "../../components/ui/Toast";

export const Route = createFileRoute("/_auth/sandbox")({
  component: SandboxPage,
});

interface ExecutionResult {
  id: string;
  language: string;
  code: string;
  status: "completed" | "failed";
  output?: string;
  error?: string;
  exitCode?: number;
  durationMs?: number;
  timestamp: number;
}

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "bash", label: "Bash" },
] as const;

function SandboxPage() {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<string>("python");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<ExecutionResult[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const latestResult = history.length > 0 ? history[0] : null;

  const handleRun = useCallback(async () => {
    if (!code.trim() || running) return;
    setRunning(true);

    try {
      const response = await api.post<{
        id: string;
        status: "completed" | "failed";
        output?: string;
        error?: string;
        exitCode?: number;
        durationMs?: number;
      }>("/api/sandbox/execute", {
        language,
        code,
      });

      const result: ExecutionResult = {
        id: response.id,
        language,
        code,
        status: response.status,
        output: response.output,
        error: response.error,
        exitCode: response.exitCode,
        durationMs: response.durationMs,
        timestamp: Date.now(),
      };

      setHistory((prev) => [result, ...prev]);
    } catch (err: any) {
      const result: ExecutionResult = {
        id: crypto.randomUUID(),
        language,
        code,
        status: "failed",
        error: err.message ?? "Execution failed",
        exitCode: 1,
        timestamp: Date.now(),
      };
      setHistory((prev) => [result, ...prev]);
      toast.error(t("sandbox.executionFailed", { defaultValue: "Execution failed" }));
    } finally {
      setRunning(false);
    }
  }, [code, language, running]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleRun();
    }
  };

  const handleClear = () => {
    setCode("");
    setHistory([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-text">{t("sandbox.title", { defaultValue: "Code Sandbox" })}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t("sandbox.clear", { defaultValue: "Clear" })}
          </Button>
          <Button
            variant="primary"
            onClick={handleRun}
            disabled={running || !code.trim()}
            loading={running}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            {running ? t("sandbox.running", { defaultValue: "Running..." }) : t("sandbox.run", { defaultValue: "Run" })}
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left panel - Editor */}
        <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-border flex flex-col">
          {/* Language selector */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-secondary/50">
            <label className="text-xs text-text-secondary">{t("sandbox.language", { defaultValue: "Language:" })}</label>
            <Select
              options={LANGUAGES.map((lang) => ({ value: lang.value, label: lang.label }))}
              value={language}
              onChange={(val) => setLanguage(val)}
              size="sm"
            />
            <span className="ml-auto text-[10px] text-text-tertiary">
              {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+Enter {t("sandbox.toRun", { defaultValue: "to run" })}
            </span>
          </div>

          {/* Code editor */}
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder(language)}
            className="flex-1 w-full rounded-none border-0 font-mono resize-none"
            spellCheck={false}
          />
        </div>

        {/* Right panel - Output */}
        <div className="w-full md:w-1/2 flex flex-col overflow-hidden">
          {/* Output panel */}
          <div className="flex-1 overflow-y-auto">
            {latestResult ? (
              <div className="flex flex-col h-full">
                {/* Output header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-secondary/50">
                  <div className="flex items-center gap-2">
                    {latestResult.status === "completed" && latestResult.exitCode === 0 ? (
                      <CheckCircle className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                    )}
                    <span className="text-xs text-text-secondary">
                      {t("sandbox.exitCode", { defaultValue: "Exit code:" })} {latestResult.exitCode ?? "N/A"}
                    </span>
                  </div>
                  {latestResult.durationMs != null && (
                    <div className="flex items-center gap-1 text-xs text-text-tertiary">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {latestResult.durationMs}ms
                    </div>
                  )}
                </div>

                {/* stdout */}
                {latestResult.output && (
                  <div className="flex-1 overflow-auto">
                    <div className="px-2 py-1 text-[10px] text-text-tertiary uppercase tracking-wider bg-surface-tertiary/30 border-b border-border">
                      {t("sandbox.stdout", { defaultValue: "stdout" })}
                    </div>
                    <pre className="px-4 py-3 text-xs font-mono text-text whitespace-pre-wrap">
                      {latestResult.output}
                    </pre>
                  </div>
                )}

                {/* stderr */}
                {latestResult.error && (
                  <div className="border-t border-border">
                    <div className="px-2 py-1 text-[10px] text-danger uppercase tracking-wider bg-danger/5 border-b border-border">
                      {t("sandbox.stderr", { defaultValue: "stderr" })}
                    </div>
                    <pre className="px-4 py-3 text-xs font-mono text-danger/80 whitespace-pre-wrap">
                      {latestResult.error}
                    </pre>
                  </div>
                )}

                {/* Empty output */}
                {!latestResult.output && !latestResult.error && (
                  <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
                    {t("sandbox.noOutput", { defaultValue: "No output" })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-text-tertiary">
                <div className="text-center">
                  <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                  <p className="text-sm">{t("sandbox.writeCode", { defaultValue: "Write code and click Run" })}</p>
                  <p className="text-xs mt-1">{t("sandbox.outputHere", { defaultValue: "Output will appear here" })}</p>
                </div>
              </div>
            )}
          </div>

          {/* History panel */}
          {history.length > 1 && (
            <div className="border-t border-border max-h-[200px] overflow-y-auto">
              <div className="px-4 py-2 text-xs font-medium text-text-secondary bg-surface-secondary/50 border-b border-border flex items-center justify-between sticky top-0">
                <span>{t("sandbox.history", { defaultValue: "History ({{count}} previous)", count: history.length - 1 })}</span>
                <button
                  onClick={() => setHistory((h) => h.slice(0, 1))}
                  className="text-text-tertiary hover:text-danger"
                  aria-label={t("sandbox.clearHistory", { defaultValue: "Clear history" })}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
              {history.slice(1).map((run) => (
                <div key={run.id} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    className="w-full flex items-center justify-between px-4 py-1.5 text-xs hover:bg-surface-secondary/50"
                  >
                    <div className="flex items-center gap-2">
                      {run.exitCode === 0 ? (
                        <CheckCircle className="h-3 w-3 text-success" aria-hidden="true" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-danger" aria-hidden="true" />
                      )}
                      <span className="text-text-tertiary">{run.language}</span>
                      <span className="text-text-secondary truncate max-w-[200px]">
                        {run.code.split("\n")[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.durationMs != null && (
                        <span className="text-text-tertiary">{run.durationMs}ms</span>
                      )}
                      {expandedRun === run.id ? (
                        <ChevronUp className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                  {expandedRun === run.id && (
                    <div className="px-4 py-2 bg-surface-tertiary/30 border-t border-border">
                      <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap mb-1">
                        {run.code}
                      </pre>
                      {run.output && (
                        <pre className="text-[11px] font-mono text-text-tertiary whitespace-pre-wrap mt-1 pt-1 border-t border-border">
                          {run.output}
                        </pre>
                      )}
                      {run.error && (
                        <pre className="text-[11px] font-mono text-danger/70 whitespace-pre-wrap mt-1 pt-1 border-t border-border">
                          {run.error}
                        </pre>
                      )}
                      <button
                        onClick={() => {
                          setCode(run.code);
                          setLanguage(run.language);
                        }}
                        className="text-[10px] text-primary hover:underline mt-1"
                      >
                        {t("sandbox.loadIntoEditor", { defaultValue: "Load into editor" })}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPlaceholder(language: string): string {
  switch (language) {
    case "python":
      return 'print("Hello, world!")';
    case "javascript":
      return 'console.log("Hello, world!");';
    case "typescript":
      return 'const msg: string = "Hello, world!";\nconsole.log(msg);';
    case "bash":
      return 'echo "Hello, world!"';
    default:
      return "Enter code...";
  }
}
