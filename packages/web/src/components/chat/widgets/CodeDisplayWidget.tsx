import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Terminal, ChevronDown, Copy, Check } from "lucide-react";
import clsx from "clsx";

export function CodeDisplayWidget({ params }: { params?: Record<string, string> }) {
  const code = params?.code ?? "";
  const language = params?.language ?? "text";
  const output = params?.output;
  const status = params?.status as "success" | "error" | undefined;

  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const isDark =
          document.documentElement.getAttribute("data-theme") === "dark" ||
          (!document.documentElement.getAttribute("data-theme") &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
        const html = await codeToHtml(code, {
          lang: language || "text",
          theme: isDark ? "github-dark" : "github-light",
        });
        if (!cancelled) setHighlightedHtml(html);
      } catch {
        // Fallback handled in render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!code) {
    return <p className="p-4 text-sm text-text-tertiary">No code provided</p>;
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-tertiary px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
          {language}
        </span>
        <div className="flex items-center gap-2">
          {status === "success" && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-400">
              <CheckCircle className="h-3 w-3" />
              Success
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
              <XCircle className="h-3 w-3" />
              Error
            </span>
          )}
          <button
            onClick={handleCopy}
            aria-label="Copy code"
            className="text-text-tertiary hover:text-text-secondary p-1 rounded transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Code */}
      {highlightedHtml ? (
        <div
          className="overflow-x-auto p-3 bg-surface-secondary text-xs font-mono leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 bg-surface-secondary">
          <code className="text-xs font-mono leading-relaxed text-text">{code}</code>
        </pre>
      )}

      {/* Output section */}
      {output !== undefined && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary transition-colors"
          >
            <Terminal className="h-3 w-3 text-text-tertiary" />
            <span className="font-medium">Output</span>
            <ChevronDown
              className={clsx(
                "h-3 w-3 text-text-tertiary transition-transform ml-auto",
                outputExpanded && "rotate-180",
              )}
            />
          </button>
          {outputExpanded && (
            <pre
              className={clsx(
                "overflow-x-auto px-3 py-2 bg-surface-tertiary text-xs font-mono leading-relaxed whitespace-pre-wrap break-all",
                status === "error" ? "text-red-400" : "text-text",
              )}
            >
              {output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
