import { useMemo } from "react";
import katex from "katex";
import DOMPurify from "dompurify";
import { AlertTriangle } from "lucide-react";

export function MathWidget({ params }: { params?: Record<string, string> }) {
  const expression = params?.expression ?? "";
  const displayMode = params?.displayMode !== "false";

  const rendered = useMemo(() => {
    if (!expression) return { error: "No expression provided", html: "" };
    try {
      const raw = katex.renderToString(expression, {
        displayMode,
        throwOnError: true,
      });
      return { error: null, html: DOMPurify.sanitize(raw) };
    } catch (err: any) {
      return { error: err.message, html: "" };
    }
  }, [expression, displayMode]);

  if (rendered.error) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-warning mb-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>KaTeX error: {rendered.error}</span>
        </div>
        <code className="text-xs text-text-secondary bg-surface-tertiary px-2 py-1 rounded">
          {expression}
        </code>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-3 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: rendered.html }}
    />
  );
}
