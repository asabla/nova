import { Loader2, Check, AlertCircle, Globe, Link, Code2, Bot, FileText, Search, Wrench } from "lucide-react";

export interface ToolStatus {
  name: string;
  status: "running" | "completed" | "error";
}

const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching the web",
  fetch_url: "Fetching page",
  code_execute: "Executing code",
  invoke_agent: "Delegating to agent",
  read_file: "Reading file",
  search_workspace: "Searching workspace",
};

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  web_search: Globe,
  fetch_url: Link,
  code_execute: Code2,
  invoke_agent: Bot,
  read_file: FileText,
  search_workspace: Search,
};

export function ToolStatusChip({ name, status }: ToolStatus) {
  const label = TOOL_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const Icon = TOOL_ICONS[name] ?? Wrench;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
      {status === "completed" && <Check className="h-3 w-3 text-success" />}
      {status === "error" && <AlertCircle className="h-3 w-3 text-danger" />}
    </span>
  );
}

export function ToolStatusBar({ tools }: { tools: ToolStatus[] }) {
  if (tools.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2">
      {tools.map((tool, i) => (
        <ToolStatusChip key={`${tool.name}-${i}`} {...tool} />
      ))}
    </div>
  );
}
