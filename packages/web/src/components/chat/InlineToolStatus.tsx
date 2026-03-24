import { useState } from "react";
import { Loader2, Check, AlertCircle, Globe, Link, ChevronRight, Code2, Bot, FileText, Search, Wrench } from "lucide-react";
import { clsx } from "clsx";
import type { ActiveTool } from "../../hooks/useSSE";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Globe,
  fetch_url: Link,
  code_execute: Code2,
  invoke_agent: Bot,
  read_file: FileText,
  search_workspace: Search,
};

function getToolIcon(name: string): React.ComponentType<{ className?: string }> {
  return TOOL_ICONS[name] ?? Wrench;
}

function humanizeToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getToolLabel(tool: ActiveTool): string {
  if (tool.status === "completed" && tool.resultSummary) {
    return tool.resultSummary;
  }
  switch (tool.name) {
    case "web_search": {
      const query = tool.args?.query;
      return query ? `Searching for "${query}"` : "Searching the web…";
    }
    case "fetch_url": {
      const url = tool.args?.url;
      return url ? `Reading ${url}` : "Fetching page…";
    }
    case "code_execute": {
      const lang = tool.args?.language as string | undefined;
      return tool.status === "running"
        ? `Running ${lang || "code"}…`
        : `Executed ${lang || "code"}`;
    }
    case "invoke_agent": {
      const agentName = tool.args?.agent_name as string | undefined;
      return tool.status === "running"
        ? agentName ? `Delegating to ${agentName}…` : "Delegating to agent…"
        : agentName ? `${agentName} responded` : "Agent responded";
    }
    case "read_file": {
      const filename = tool.args?.filename as string | undefined;
      return tool.status === "running"
        ? `Reading ${filename || "file"}…`
        : `Read ${filename || "file"}`;
    }
    case "search_workspace": {
      const query = tool.args?.query as string | undefined;
      return query
        ? `Searching workspace for "${query}"…`
        : "Searching workspace…";
    }
    default:
      return tool.status === "running"
        ? `Running ${humanizeToolName(tool.name)}…`
        : humanizeToolName(tool.name);
  }
}

function getToolDetail(tool: ActiveTool): string | null {
  switch (tool.name) {
    case "web_search":
      return tool.args?.query ? `Query: ${tool.args.query}` : null;
    case "fetch_url":
      return tool.args?.url ? `URL: ${tool.args.url}` : null;
    case "code_execute": {
      const lang = tool.args?.language as string | undefined;
      const code = tool.args?.code as string | undefined;
      if (code) return `${lang ? `Language: ${lang}\n` : ""}${code.slice(0, 200)}${code.length > 200 ? "…" : ""}`;
      return lang ? `Language: ${lang}` : null;
    }
    case "invoke_agent": {
      const task = tool.args?.task as string | undefined;
      return task ? `Task: ${task}` : null;
    }
    case "read_file": {
      const filename = tool.args?.filename as string | undefined;
      const fileId = tool.args?.file_id as string | undefined;
      return filename ? `File: ${filename}` : fileId ? `File ID: ${fileId}` : null;
    }
    case "search_workspace": {
      const query = tool.args?.query as string | undefined;
      const mode = tool.args?.mode as string | undefined;
      return query ? `Query: ${query}${mode ? ` (${mode})` : ""}` : null;
    }
    default:
      return tool.args ? Object.entries(tool.args).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ") : null;
  }
}

export function InlineToolStatus({ tool }: { tool: ActiveTool }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getToolIcon(tool.name);
  const label = getToolLabel(tool);
  const detail = getToolDetail(tool);
  const hasDetail = !!detail;

  return (
    <div className="my-1">
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={clsx(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all duration-300",
          "text-text-secondary border",
          tool.status === "running" && "border-l-2 border-primary/40 bg-primary/5",
          tool.status === "completed" && "border-border/50 bg-success/5",
          tool.status === "failed" && "border-l-2 border-danger/40 bg-danger/5",
          !tool.status || (tool.status !== "running" && tool.status !== "completed" && tool.status !== "failed") && "border-border/50 bg-surface-secondary/80",
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
        <Icon className={clsx(
          "h-3 w-3",
          tool.status === "running" ? "text-primary" : "text-text-tertiary",
        )} aria-hidden="true" />
        <span>{label}</span>
        {tool.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary ml-0.5" aria-hidden="true" />}
        {tool.status === "completed" && <Check className="h-3 w-3 text-success ml-0.5" aria-hidden="true" />}
        {tool.status === "failed" && <AlertCircle className="h-3 w-3 text-danger ml-0.5" aria-hidden="true" />}
      </button>
      {expanded && detail && (
        <div className="ml-5 mt-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary/50 border border-border/30 text-[11px] text-text-tertiary whitespace-pre-wrap">
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
  code_execute: ["code execution", "code executions"],
  invoke_agent: ["agent delegation", "agent delegations"],
  read_file: ["file read", "file reads"],
  search_workspace: ["workspace search", "workspace searches"],
};

function pluralLabel(name: string, count: number): string {
  const labels = TOOL_PLURAL_LABELS[name];
  if (labels) return `${count} ${count === 1 ? labels[0] : labels[1]}`;
  return `${count} ${name}${count === 1 ? "" : "s"}`;
}

export function ToolSummaryCompact({ tools }: { tools: ActiveTool[] }) {
  const autoExpand = tools.length <= 3;
  const [expanded, setExpanded] = useState(autoExpand);
  if (tools.length === 0) return null;

  const hasError = tools.some((t) => t.status === "failed");

  // Group by tool name
  const groups = new Map<string, number>();
  for (const t of tools) {
    groups.set(t.name, (groups.get(t.name) ?? 0) + 1);
  }
  const groupEntries = Array.from(groups.entries());

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
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
        {groupEntries.map(([name, count], i) => {
          const ToolIcon = getToolIcon(name);
          return (
            <span key={name} className="inline-flex items-center gap-1">
              <ToolIcon className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
              <span>{pluralLabel(name, count)}</span>
              {i < groupEntries.length - 1 && <span className="text-text-tertiary mx-0.5">·</span>}
            </span>
          );
        })}
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
