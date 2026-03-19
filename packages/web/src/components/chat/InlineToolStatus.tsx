import { useState } from "react";
import { Loader2, Check, AlertCircle, Globe, Link, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import type { ActiveTool } from "../../hooks/useSSE";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Globe,
  fetch_url: Link,
};

function getToolLabel(tool: ActiveTool): string {
  if (tool.status === "completed" && tool.resultSummary) {
    return tool.resultSummary;
  }
  if (tool.name === "web_search") {
    const query = tool.args?.query;
    return query ? `Searching for "${query}"` : "Searching the web…";
  }
  if (tool.name === "fetch_url") {
    const url = tool.args?.url;
    return url ? `Reading ${url}` : "Fetching page…";
  }
  return tool.status === "running" ? `Running ${tool.name}…` : tool.name;
}

function getToolDetail(tool: ActiveTool): string | null {
  if (tool.name === "web_search" && tool.args?.query) {
    return `Query: ${tool.args.query}`;
  }
  if (tool.name === "fetch_url" && tool.args?.url) {
    return `URL: ${tool.args.url}`;
  }
  return null;
}

export function InlineToolStatus({ tool }: { tool: ActiveTool }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[tool.name];
  const label = getToolLabel(tool);
  const detail = getToolDetail(tool);
  const hasDetail = !!detail;

  return (
    <div className="my-1">
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors",
          "bg-surface-secondary/80 text-text-secondary border border-border/50",
          hasDetail && "cursor-pointer hover:bg-surface-secondary",
          !hasDetail && "cursor-default",
        )}
      >
        {hasDetail && (
          <ChevronRight
            className={clsx(
              "h-3 w-3 text-text-tertiary transition-transform duration-200",
              expanded && "rotate-90",
            )}
            aria-hidden="true"
          />
        )}
        {Icon && <Icon className="h-3 w-3 text-text-tertiary" aria-hidden="true" />}
        <span>{label}</span>
        {tool.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary ml-0.5" aria-hidden="true" />}
        {tool.status === "completed" && <Check className="h-3 w-3 text-success ml-0.5" aria-hidden="true" />}
        {tool.status === "failed" && <AlertCircle className="h-3 w-3 text-danger ml-0.5" aria-hidden="true" />}
      </button>
      {expanded && detail && (
        <div className="ml-5 mt-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary/50 border border-border/30 text-[11px] text-text-tertiary">
          {detail}
        </div>
      )}
    </div>
  );
}

export function InlineToolStatusList({ tools }: { tools: ActiveTool[] }) {
  if (tools.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 mb-1.5">
      {tools.map((tool, i) => (
        <InlineToolStatus key={`${tool.name}-${i}`} tool={tool} />
      ))}
    </div>
  );
}

const TOOL_PLURAL_LABELS: Record<string, [string, string]> = {
  web_search: ["web search", "web searches"],
  fetch_url: ["page fetch", "page fetches"],
};

function pluralLabel(name: string, count: number): string {
  const labels = TOOL_PLURAL_LABELS[name];
  if (labels) return `${count} ${count === 1 ? labels[0] : labels[1]}`;
  return `${count} ${name}${count === 1 ? "" : "s"}`;
}

export function ToolSummaryCompact({ tools }: { tools: ActiveTool[] }) {
  const [expanded, setExpanded] = useState(false);
  if (tools.length === 0) return null;

  const hasError = tools.some((t) => t.status === "failed");

  // Group by tool name
  const groups = new Map<string, number>();
  for (const t of tools) {
    groups.set(t.name, (groups.get(t.name) ?? 0) + 1);
  }
  const summary = Array.from(groups.entries())
    .map(([name, count]) => pluralLabel(name, count))
    .join(", ");

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors",
          "bg-surface-secondary/80 text-text-secondary border border-border/50",
          "cursor-pointer hover:bg-surface-secondary",
        )}
      >
        <ChevronRight
          className={clsx(
            "h-3 w-3 text-text-tertiary transition-transform duration-200",
            expanded && "rotate-90",
          )}
          aria-hidden="true"
        />
        <span>{summary}</span>
        {hasError ? (
          <AlertCircle className="h-3 w-3 text-danger ml-0.5" aria-hidden="true" />
        ) : (
          <Check className="h-3 w-3 text-success ml-0.5" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 ml-2">
          {tools.map((tool, i) => (
            <InlineToolStatus key={`${tool.name}-${i}`} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
