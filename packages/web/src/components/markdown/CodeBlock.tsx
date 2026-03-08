import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
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
        // Fallback: language not supported or shiki failed
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

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-surface-tertiary px-3 py-1.5 border-b border-border">
        <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="text-text-tertiary hover:text-text-secondary p-1 rounded transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      </div>
      {highlightedHtml ? (
        <div
          className="overflow-x-auto p-3 bg-surface-secondary text-xs font-mono leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 bg-surface-secondary">
          <code ref={codeRef} className="text-xs font-mono leading-relaxed text-text">{code}</code>
        </pre>
      )}
    </div>
  );
}
